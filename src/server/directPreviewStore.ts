import {mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {DATA_DIRECTORY} from './runtimePaths.ts';
import {CUSTOM_ID_PATTERN} from '../utils/componentRegistry.ts';

const FILE=resolve(DATA_DIRECTORY,'direct-preview.json');
const builtin=new Set(['banner','lower-third','chapter','section','question','quote','scripture','social','social-pill','logo-bug','ticker','editorial','waiting','break','outro']);
export type DirectPreviewState={version:1;revision:number;ids:string[];updatedAt:string};
let cached:DirectPreviewState|null=null;

export function validDirectPreviewId(id:unknown):id is string {
  return typeof id==='string' && (builtin.has(id)||CUSTOM_ID_PATTERN.test(id));
}
export function validDirectPreviewIds(ids:unknown):ids is string[] {
  return Array.isArray(ids)&&ids.length<=32&&ids.every(validDirectPreviewId)&&new Set(ids).size===ids.length;
}
function initial():DirectPreviewState {
  return {version:1,revision:0,ids:[],updatedAt:new Date(0).toISOString()};
}
export function getDirectPreview():DirectPreviewState {
  if(cached)return structuredClone(cached);
  try {
    const read=JSON.parse(readFileSync(FILE,'utf8'));
    if(read.version===1&&Number.isSafeInteger(read.revision)&&read.revision>=0&&validDirectPreviewIds(read.ids)) {
      cached=read;return structuredClone(cached);
    }
  }catch{/* new installation */}
  return initial();
}
/** Preview never mutates station.json, published graphics or the Program feed. */
export function saveDirectPreview(ids:string[], publishedIds:ReadonlySet<string>, expectedRevision:number):DirectPreviewState {
  if(!validDirectPreviewIds(ids)) throw new Error('La selección de Preview no es válida');
  if(ids.some(id=>!publishedIds.has(id)))throw new Error('Solo se pueden preparar gráficas ya publicadas');
  const previous=getDirectPreview();
  if(expectedRevision!==previous.revision)throw new Error('Preview cambió mientras se preparaba. Actualiza antes de guardar');
  const next:DirectPreviewState={version:1,revision:previous.revision+1,ids:[...ids],updatedAt:new Date().toISOString()};
  mkdirSync(dirname(FILE),{recursive:true});
  const temp=FILE+'.tmp';
  writeFileSync(temp,JSON.stringify(next),{encoding:'utf8',mode:0o600});
  renameSync(temp,FILE);
  cached=next;return structuredClone(next);
}
export function resetDirectPreviewCache(){cached=null;}
