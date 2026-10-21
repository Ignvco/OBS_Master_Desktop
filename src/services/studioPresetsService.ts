import type {StudioPreset} from '../utils/studioPresets';
const endpoint='/api/station/studio-presets';
async function parse(response:Response):Promise<StudioPreset[]>{
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||`Servicio local ${response.status}`);
  return body.presets as StudioPreset[];
}
export const StudioPresetsService={
  read:()=>fetch(endpoint,{cache:'no-store'}).then(parse),
  action:(payload:object)=>fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(parse),
  save:(preset:StudioPreset)=>StudioPresetsService.action({action:'save',preset}),
  delete:(id:string)=>StudioPresetsService.action({action:'delete',id}),
};
