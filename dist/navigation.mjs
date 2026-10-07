/* Colisiones en el plano del suelo: cámara de altura fija y radio de 25 cm. */
export const WALK_BOUNDS = {minX:-5.35,maxX:5.35,minZ:-5.2,maxZ:5.35};
export function isWalkable(x,z,obstacles,bounds=WALK_BOUNDS,radius=.25) {
  if(!Number.isFinite(x)||!Number.isFinite(z)||x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ) return false;
  return !obstacles.some(box=>x>box.minX-radius && x<box.maxX+radius && z>box.minZ-radius && z<box.maxZ+radius);
}
export function moveWithCollisions(position,dx,dz,obstacles,bounds=WALK_BOUNDS) {
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));
  const result={x:position.x,z:position.z};
  for(let i=0;i<steps;i++) {
    if(isWalkable(result.x+dx/steps,result.z,obstacles,bounds)) result.x+=dx/steps;
    if(isWalkable(result.x,result.z+dz/steps,obstacles,bounds)) result.z+=dz/steps;
  }
  return result;
}
function lineClear(a,b,obstacles,bounds=WALK_BOUNDS) {
  const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.08));
  for(let i=0;i<=steps;i++) if(!isWalkable(a.x+(b.x-a.x)*i/steps,a.z+(b.z-a.z)*i/steps,obstacles,bounds)) return false;
  return true;
}
/* A* evita que el recorrido guiado atraviese una vitrina o un pedestal. */
/* Las salas más grandes pasan sus propios límites; la cuadrícula se ajusta a ellos. */
export function planPath(start,goal,obstacles,bounds=WALK_BOUNDS) {
  const clear=(a,b)=>lineClear(a,b,obstacles,bounds);
  if(!isWalkable(start.x,start.z,obstacles,bounds)||!isWalkable(goal.x,goal.z,obstacles,bounds)) return [];
  if(clear(start,goal)) return [{...start},{...goal}];
  const step=.3,custom=bounds!==WALK_BOUNDS;
  const originX=custom?bounds.minX+.15:-5.1,originZ=custom?bounds.minZ+.15:-5.1;
  const sizeX=custom?Math.floor((bounds.maxX-bounds.minX-.3)/step)+1:35,sizeZ=custom?Math.floor((bounds.maxZ-bounds.minZ-.3)/step)+1:35;
  const point=(x,z)=>({x:originX+x*step,z:originZ+z*step});
  const index=(x,z)=>z*sizeX+x;
  function nearest(p) {
    let best=null,distance=Infinity;
    for(let z=0;z<sizeZ;z++)for(let x=0;x<sizeX;x++) {
      const q=point(x,z),d=Math.hypot(q.x-p.x,q.z-p.z);
      if(d<distance && clear(p,q)) {best={x,z};distance=d;}
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
      while(at<path.length-1){let next=path.length-1;while(next>at+1 && !clear(path[at],path[next]))next--;simplified.push(path[next]);at=next;}
      return simplified;
    }
    closed.add(id);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
      const x=current.x+dx,z=current.z+dz;
      if(x<0||z<0||x>=sizeX||z>=sizeZ)continue;
      if(!clear(point(current.x,current.z),point(x,z)))continue;
      const nextId=index(x,z),g=current.g+Math.hypot(dx,dz);
      if(g>=(cost.get(nextId)??Infinity))continue;
      cost.set(nextId,g);came.set(nextId,{x:current.x,z:current.z});
      open.push({x,z,g,f:g+Math.hypot(last.x-x,last.z-z)});
    }
  }
  return [];
}
