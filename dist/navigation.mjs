/* Colisiones en el plano del suelo: cámara de altura fija y radio de 25 cm. */
export const WALK_BOUNDS = {minX:-5.35,maxX:5.35,minZ:-5.2,maxZ:5.35};
export function isWalkable(x,z,obstacles,bounds=WALK_BOUNDS,radius=.25) {
  if(!Number.isFinite(x)||!Number.isFinite(z)||x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ) return false;
  return !obstacles.some(box=>x>box.minX-radius && x<box.maxX+radius && z>box.minZ-radius && z<box.maxZ+radius);
}
export function moveWithCollisions(position,dx,dz,obstacles) {
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));
  const result={x:position.x,z:position.z};
  for(let i=0;i<steps;i++) {
    if(isWalkable(result.x+dx/steps,result.z,obstacles)) result.x+=dx/steps;
    if(isWalkable(result.x,result.z+dz/steps,obstacles)) result.z+=dz/steps;
  }
  return result;
}
function lineClear(a,b,obstacles) {
  const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.08));
  for(let i=0;i<=steps;i++) if(!isWalkable(a.x+(b.x-a.x)*i/steps,a.z+(b.z-a.z)*i/steps,obstacles)) return false;
  return true;
}
/* A* evita que el recorrido guiado atraviese una vitrina o un pedestal. */
export function planPath(start,goal,obstacles) {
  if(!isWalkable(start.x,start.z,obstacles)||!isWalkable(goal.x,goal.z,obstacles)) return [];
  if(lineClear(start,goal,obstacles)) return [{...start},{...goal}];
  const step=.3, origin=-5.1, size=35;
  const point=(x,z)=>({x:origin+x*step,z:origin+z*step});
  const index=(x,z)=>z*size+x;
  function nearest(p) {
    let best=null,distance=Infinity;
    for(let z=0;z<size;z++)for(let x=0;x<size;x++) {
      const q=point(x,z),d=Math.hypot(q.x-p.x,q.z-p.z);
      if(d<distance && lineClear(p,q,obstacles)) {best={x,z};distance=d;}
    }
    return best;
  }
  const first=nearest(start),last=nearest(goal);
  if(!first||!last)return [];
  const open=[{...first,g:0,f:0}],came=new Map(),cost=new Map([[index(first.x,first.z),0]]),closed=new Set();
  while(open.length) {
    open.sort((a,b)=>a.f-b.f);
    const current=open.shift(),id=index(current.x,current.z);
    if(closed.has(id))continue;
    if(current.x===last.x && current.z===last.z) {
      const path=[{...goal},point(current.x,current.z)];let cursor=id;
      while(came.has(cursor)){const previous=came.get(cursor);path.push(point(previous.x,previous.z));cursor=index(previous.x,previous.z);}
      path.push({...start});path.reverse();
      const simplified=[path[0]];let at=0;
      while(at<path.length-1){let next=path.length-1;while(next>at+1 && !lineClear(path[at],path[next],obstacles))next--;simplified.push(path[next]);at=next;}
      return simplified;
    }
    closed.add(id);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
      const x=current.x+dx,z=current.z+dz;
      if(x<0||z<0||x>=size||z>=size)continue;
      if(!lineClear(point(current.x,current.z),point(x,z),obstacles))continue;
      const nextId=index(x,z),g=current.g+Math.hypot(dx,dz);
      if(g>=(cost.get(nextId)??Infinity))continue;
      cost.set(nextId,g);came.set(nextId,{x:current.x,z:current.z});
      open.push({x,z,g,f:g+Math.hypot(last.x-x,last.z-z)});
    }
  }
  return [];
}
