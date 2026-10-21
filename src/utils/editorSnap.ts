/** World-pixel snapping. Independent of preview scaling or OBS screen resolution. */
export interface Rect {x:number;y:number;width:number;height:number}
export interface Guide {axis:'x'|'y';value:number}
export function snapRect(rect:Rect, peers:Rect[], bounds:Rect, threshold=12):{rect:Rect;guides:Guide[]} {
  const sourceX=[rect.x,rect.x+rect.width/2,rect.x+rect.width];
  const sourceY=[rect.y,rect.y+rect.height/2,rect.y+rect.height];
  const targetX=[bounds.x,bounds.x+bounds.width/2,bounds.x+bounds.width];
  const targetY=[bounds.y,bounds.y+bounds.height/2,bounds.y+bounds.height];
  for(const peer of peers) {
    targetX.push(peer.x,peer.x+peer.width/2,peer.x+peer.width);
    targetY.push(peer.y,peer.y+peer.height/2,peer.y+peer.height);
  }
  const closest=(sources:number[],targets:number[])=>{
    let result:{delta:number;value:number}|null=null;
    for(const source of sources) for(const target of targets) {
      const delta=target-source;
      if(Math.abs(delta)<=threshold && (!result || Math.abs(delta)<Math.abs(result.delta))) result={delta,value:target};
    }
    return result;
  };
  const sx=closest(sourceX,targetX),sy=closest(sourceY,targetY);
  return { rect:{...rect,x:Math.round(rect.x+(sx?.delta??0)),y:Math.round(rect.y+(sy?.delta??0))},
    guides:[...(sx?[{axis:'x' as const,value:sx.value}]:[]),...(sy?[{axis:'y' as const,value:sy.value}]:[])] };
}
