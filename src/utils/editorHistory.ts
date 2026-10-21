/** Bounded, per-component edit history. A drag/typing burst is one undo step. */
export interface EditHistory<T> {
  snapshots: T[];
  index: number;
  lastGroup: string | null;
  lastTime: number;
}
export function createHistory<T>(current: T): EditHistory<T> {
  return {snapshots:[structuredClone(current)], index:0,lastGroup:null,lastTime:0};
}
export function pushHistory<T>(state: EditHistory<T>, next: T, group: string | null = null, now = Date.now(), limit = 60): EditHistory<T> {
  const clean = state.snapshots.slice(0,state.index+1);
  if (JSON.stringify(clean[state.index]) === JSON.stringify(next)) return state;
  // A group only coalesces consecutive changes in the same uninterrupted edit burst.
  const coalesce = !!group && group === state.lastGroup && (group.startsWith('drag:') || now-state.lastTime < 800) && state.index>0;
  if (coalesce) clean[clean.length-1] = structuredClone(next);
  else clean.push(structuredClone(next));
  const trimmed = clean.slice(-limit);
  return { snapshots:trimmed, index:trimmed.length-1,lastGroup:group,lastTime:now};
}
export function stepHistory<T>(state: EditHistory<T>, direction: -1|1): {state:EditHistory<T>;value:T|null} {
  const index = Math.max(0,Math.min(state.snapshots.length-1,state.index+direction));
  if(index===state.index) return {state,value:null};
  return {state:{...state,index,lastGroup:null,lastTime:0},value:structuredClone(state.snapshots[index])};
}
export function historyFlags<T>(state:EditHistory<T>) {
  return {canUndo:state.index>0,canRedo:state.index<state.snapshots.length-1};
}
