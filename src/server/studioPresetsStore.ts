import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {DATA_DIRECTORY} from './runtimePaths.ts';
import {validStudioPreset,MAX_STUDIO_PRESETS} from '../utils/studioPresets.ts';
import type {StudioPreset} from '../utils/studioPresets.ts';

export function readStudioPresets(root=DATA_DIRECTORY):StudioPreset[]{
  const file=resolve(root,'studio-presets.json');
  if(!existsSync(file))return [];
  const parsed=JSON.parse(readFileSync(file,'utf8'));
  if(!Array.isArray(parsed)||parsed.length>MAX_STUDIO_PRESETS||!parsed.every(validStudioPreset))
    throw new Error('La biblioteca de estilos requiere reparación. Conservamos el archivo original.');
  return parsed;
}
export function mutateStudioPresets(action:unknown,root=DATA_DIRECTORY):StudioPreset[]{
  if(!action||typeof action!=='object'||Array.isArray(action))throw new Error('Acción inválida');
  const a=action as {action?:string;preset?:unknown;id?:unknown};
  const before=readStudioPresets(root);
  let after:StudioPreset[];
  if(a.action==='save'){
    if(!validStudioPreset(a.preset))throw new Error('Estilo o composición inválidos');
    const preset=a.preset;
    after=[...before.filter(p=>p.id!==preset.id),preset];
  }else if(a.action==='delete'){
    if(typeof a.id!=='string'||!/^[a-zA-Z0-9_-]{6,90}$/.test(a.id))throw new Error('Identificador inválido');
    after=before.filter(p=>p.id!==a.id);
  }else throw new Error('Acción desconocida');
  if(after.length>MAX_STUDIO_PRESETS)throw new Error('Límite de 100 estilos alcanzado');
  const file=resolve(root,'studio-presets.json');
  mkdirSync(dirname(file),{recursive:true});
  const temp=file+'.tmp';
  writeFileSync(temp,JSON.stringify(after,null,2),{encoding:'utf8',mode:0o600});
  renameSync(temp,file);
  return after;
}
