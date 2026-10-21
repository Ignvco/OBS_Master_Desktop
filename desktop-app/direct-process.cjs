'use strict';
// OBS MASTER native output process supervisor (Windows, RC1).
// Uses the validated Python lab as a temporary external dependency.
// No extra UI panel or second transmission mode.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

class DirectProcess {
  constructor({python, script, camera=0, url='http://127.0.0.1:3000/?overlay=direct-program', log=()=>{}}={}) {
    this.python=python;
    this.script=script;
    this.camera=camera;
    this.url=url;
    this.log=log;
    this.child=null;
    this.state='stopped';
    this.lastError=null;
    this._closePromise=null;
    this._closed=null;
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
    try {
      const proc=spawn(this.python,['-u',this.script,'--camera',String(this.camera),'--url',this.url],{
        windowsHide:true,stdio:['pipe','pipe','pipe'],shell:false,
        cwd:path.dirname(this.script),env:{...process.env,PYTHONUNBUFFERED:'1'}
      });
      this.child=proc;
      this._closePromise=new Promise(resolve=>{this._closed=resolve;});
      const receive=(chunk)=>{const msg=chunk.toString();this.log(msg);
        if(msg.includes('SALIDA ACTIVA:')&&this.child===proc&&this.state==='starting')this.state='running';
        if(msg.includes('ERROR HTML:')||msg.includes('Traceback'))this.lastError=msg.slice(-800);
      };
      proc.stdout.on('data',receive);proc.stderr.on('data',receive);
      proc.once('error',(error)=>{this.lastError=error.message;this.log(error.message);});
      proc.once('close',(code,signal)=>{
        if(this.child===proc){this.child=null;this.state=code===0||this.state==='stopping'?'stopped':'error';}
        if(code!==0&&this.state==='error')this.lastError ??='Motor finalizó con código '+code;
        this.log('Direct cerrado (code='+code+',signal='+signal+')');
        this._closed?.();this._closed=null;
      });
      return this.status();
    }catch(e){this.child=null;this.state='error';this.lastError=String(e.message||e);throw e;}
  }
  async stop({timeoutMs=35000}={}){
    const proc=this.child;
    if(!proc)return this.status();
    if(this.state==='stopping'){await this._closePromise;return this.status();}
    this.state='stopping';
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
