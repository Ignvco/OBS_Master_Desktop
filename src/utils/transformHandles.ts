export type Corner='nw'|'ne'|'sw'|'se';
export type LayerBox={x:number;y:number;width:number;height:number};
/** Corner resize never allows a negative box or jumps when reaching the minimum. */
export function resizeByCorner(box:LayerBox,dx:number,dy:number,corner:Corner,min=16):LayerBox{
  const west=corner.includes('w'), north=corner.includes('n');
  const width=Math.max(min,Math.round(box.width+(west?-dx:dx)));
  const height=Math.max(min,Math.round(box.height+(north?-dy:dy)));
  return {
    x:Math.round(box.x+(west?box.width-width:0)),
    y:Math.round(box.y+(north?box.height-height:0)),
    width,height,
  };
}
export function rotateByPointer(initial:number,startAngle:number,nextAngle:number,snap=false):number{
  const degrees=initial+nextAngle-startAngle;
  const step=snap?15:1;
  return Math.max(-360,Math.min(360,Math.round(degrees/step)*step));
}
