'use strict';
// OBS MASTER native output process supervisor (Windows, RC1).
// Uses the validated Python lab as a temporary external dependency.
// No extra UI panel or second transmission mode.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const path = require('node:path');

class DirectProcess {
  constructor({python, script, camera=0, url='http://127.0.0.1:3000/?overlay=direct-program', log=()=>{}}={}) {
    this.python=python;
    this.script=script;
    this.camera=camera;
    this.url=url;
    this.log=log;
    this.monitorPort=31311;
    this.monitorToken=null;
    this.child=null;
    this.state='stopped';
    this.lastError=null;
    this._closePromise=null;
    this._closed=null;
    this._lineBuffer='';
    this._pendingTake=null;
    this._pendingRollback=null;
  }
  status() {return {state:this.state,pid:this.child?.pid??null,error:this.lastError,url:this.url,camera:this.camera};}
  start() {
    if(this.child || this.state==='starting' || this.state==='stopping') throw Error('La salida ya está activa o cambiando de estado.');
    if(process.platform!=='win32')throw Error('El motor Unity Capture requiere Windows.');
    if(!this.python || !fs.existsSync(this.python))throw Error('Python del motor Direct no disponible.');
    if(!this.script || !fs.existsSync(this.script))throw Error('Script Direct no disponible.');
    const parsed=new URL(this.url);
    if(parsed.protocol!=='http:' || parsed.hostname!=='127.0.0.1' || parsed.port!=='3000') throw Error('La URL de gráficos debe apuntar al servidor local 127.0.0.1:3000.');
    this.state='starting';this.lastError=null;
    this._lineBuffer='';
    this.monitorToken=randomBytes(32).toString('hex');
    try {
      const proc=spawn(this.python,['-u',this.script,'--camera',String(this.camera),'--url',this.url],{
        windowsHide:true,stdio:['pipe','pipe','pipe'],shell:false,
        cwd:path.dirname(this.script),env:{
          ...process.env,PYTHONUNBUFFERED:'1',
          STDQ_DIRECT_MONITOR_TOKEN:this.monitorToken,
          STDQ_DIRECT_MONITOR_PORT:String(this.monitorPort),
        }
      });
      this.child=proc;
      this._closePromise=new Promise(resolve=>{this._closed=resolve;});
      const receive=(chunk)=>{const msg=chunk.toString();this.log(msg);
        if(msg.includes('SALIDA ACTIVA:')&&this.child===proc&&this.state==='starting')this.state='running';
        if(msg.includes('ERROR HTML:')||msg.includes('Traceback'))this.lastError=msg.slice(-800);
        this._lineBuffer+=msg;
        const parts=this._lineBuffer.split(/\r?\n/);
        this._lineBuffer=parts.pop().slice(-1000);
        for(const line of parts)this._consumeEngineLine(line.trim());
      };
      proc.stdout.on('data',receive);proc.stderr.on('data',receive);
      proc.once('error',(error)=>{this.lastError=error.message;this.log(error.message);});
      proc.once('close',(code,signal)=>{
        this._rejectPending(new Error('Unity Camera terminó antes de confirmar la operación.'));
        if(this.child===proc){this.child=null;this.state=code===0||this.state==='stopping'?'stopped':'error';}
        if(code!==0&&this.state==='error')this.lastError ??='Motor finalizó con código '+code;
        this.log('Direct cerrado (code='+code+',signal='+signal+')');
        this._closed?.();this._closed=null;
      });
      return this.status();
    }catch(e){this.child=null;this.state='error';this.lastError=String(e.message||e);throw e;}
  }
  _rejectPending(error){
    for(const field of ['_pendingTake','_pendingRollback']){
      const op=this[field];
      if(op){clearTimeout(op.timer);this[field]=null;op.reject(error);}
    }
  }
  _consumeEngineLine(line){
    const parts=line.split(/\s+/);
    if(parts[0]==='STDQ_TAKE_ACK' || parts[0]==='STDQ_TAKE_NACK'){
      const op=this._pendingTake;
      if(!op || op.id!==parts[1])return;
      clearTimeout(op.timer);this._pendingTake=null;
      if(parts[0]==='STDQ_TAKE_ACK')op.resolve({takeId:op.id,frame:Number(parts[2])});
      else op.reject(new Error('Motor rechazó Take: '+(parts[2]||'sin composición lista')));
    }
    if(parts[0]==='STDQ_ROLLBACK_ACK'){
      const op=this._pendingRollback;
      if(op?.id===parts[1]){
        clearTimeout(op.timer);this._pendingRollback=null;
        op.resolve({frame:Number(parts[2])});
      }
    }
  }
  _engineCommand(command,id,field,timeoutMs){
    if(this.state!=='running'||!this.child?.stdin?.writable)
      return Promise.reject(new Error('Unity Camera no está disponible para aceptar comandos'));
    if(this._pendingTake||this._pendingRollback)
      return Promise.reject(new Error('Hay otra orden de video en curso'));
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        if(this[field]?.id===id)this[field]=null;
        reject(new Error('El motor no confirmó '+field+' dentro del plazo de seguridad'));
      },timeoutMs);
      this[field]={id,timer,resolve,reject};
      try{this.child.stdin.write(command+'\n');}
      catch(error){clearTimeout(timer);this[field]=null;reject(error);}
    });
  }
  async take(revision,takeId){
    if(!Number.isSafeInteger(revision)||revision<0||!/^[0-9a-f]{32}$/.test(takeId))
      throw new Error('Orden Take no válida');
    return this._engineCommand('TAKE '+revision+' '+takeId,takeId,'_pendingTake',12000);
  }
  async rollbackTake(takeId){
    if(!/^[0-9a-f]{32}$/.test(takeId))throw new Error('Rollback inválido');
    return this._engineCommand('ROLLBACK '+takeId,takeId,'_pendingRollback',6000);
  }
  async stop({timeoutMs=35000}={}){
    const proc=this.child;
    if(!proc)return this.status();
    if(this.state==='stopping'){await this._closePromise;return this.status();}
    this.state='stopping';
    this._rejectPending(new Error('Unity Camera se está deteniendo'));
    try{if(proc.stdin.writable)proc.stdin.write('STOP\n');}catch(e){this.log('No se pudo enviar STOP: '+e.message);}
    let timer;
    try{await Promise.race([this._closePromise,new Promise(resolve=>{timer=setTimeout(resolve,timeoutMs);})]);}
    finally{clearTimeout(timer);}
    if(this.child===proc){
      this.lastError='El motor no confirmó cierre dentro del plazo; requiere revisión manual.';
      this.state='error';
      // Do not kill abruptly: that could leave Edge/Unity Capture orphaned.
      this.log(this.lastError);
    }
    return this.status();
  }
}
module.exports={DirectProcess};
