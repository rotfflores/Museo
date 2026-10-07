/* Motor reutilizable de salas: Three.js local, navegación, enfoque y pausa. */
import * as THREE from './vendor/three.module.min.js';
import {moveWithCollisions,planPath} from './navigation.mjs';

export function createGallery({container,scene,camera,obstacles,targets,onTarget,onActivate,onUnavailable}) {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<600?1.25:1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.05;
  const canvas=renderer.domElement;canvas.className='gallery-canvas';canvas.setAttribute('aria-hidden','true');container.prepend(canvas);
  const view={yaw:0,pitch:-.03},keys=new Set(),pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster();
  const meshes=targets.flatMap(target=>target.hits);
  let active=false,paused=false,running=false,raf=0,last=0,drag=null,flight=null,selected=null,pointerInside=false;
  const resolveTarget=object=>targets.find(target=>target.hits.includes(object));
  function setTarget(target) {
    if(selected===target)return;
    selected=target;
    for(const item of targets) if(item.marker) item.marker.material.opacity=item===target ? .9 : .16;
    onTarget(target);
  }
  function select() {
    if(paused||flight)return;
    raycaster.setFromCamera(pointerInside?pointer:new THREE.Vector2(0,0),camera);
    const hit=raycaster.intersectObjects(meshes,false)[0];
    let target=hit?resolveTarget(hit.object):null;
    if(!target) {
      const direction=camera.getWorldDirection(new THREE.Vector3());
      target=targets.map(item=>({item,distance:camera.position.distanceTo(item.focus),dot:direction.dot(item.focus.clone().sub(camera.position).normalize())})).filter(item=>item.distance<3.5&&item.dot>.85).sort((a,b)=>b.dot-a.dot)[0]?.item;
    }
    if(target&&camera.position.distanceTo(target.focus)>5)target=null;
    setTarget(target||null);
  }
  function look() {camera.rotation.set(view.pitch,view.yaw,0,'YXZ');}
  function updateFlight(dt) {
    if(!flight)return;
    let remaining=dt*2.8;
    while(remaining>0 && flight.index<flight.path.length) {
      const goal=flight.path[flight.index],distance=Math.hypot(goal.x-camera.position.x,goal.z-camera.position.z);
      if(distance<=remaining){camera.position.x=goal.x;camera.position.z=goal.z;remaining-=distance;flight.index++;}
      else{camera.position.x+=(goal.x-camera.position.x)/distance*remaining;camera.position.z+=(goal.z-camera.position.z)/distance*remaining;remaining=0;}
    }
    const delta=flight.yaw-view.yaw;view.yaw+=Math.atan2(Math.sin(delta),Math.cos(delta))*Math.min(1,dt*5);
    view.pitch+=(flight.pitch-view.pitch)*Math.min(1,dt*5);
    if(flight.index>=flight.path.length) {view.yaw=flight.yaw;view.pitch=flight.pitch;setTarget(flight.target);flight=null;container.classList.remove('guiding');container.dispatchEvent(new CustomEvent('gallery:arrived'));}
  }
  function frame(now) {
    if(!running)return;
    const dt=Math.min((now-last)/1000||0,.045);last=now;
    if(!paused) {
      if(flight)updateFlight(dt);
      else {
        const forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0);
        const strafe=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
        if(forward||strafe){
          const length=Math.hypot(forward,strafe),speed=dt*2;
          const dx=(-Math.sin(view.yaw)*forward+Math.cos(view.yaw)*strafe)/length*speed;
          const dz=(-Math.cos(view.yaw)*forward-Math.sin(view.yaw)*strafe)/length*speed;
          const next=moveWithCollisions(camera.position,dx,dz,obstacles);camera.position.x=next.x;camera.position.z=next.z;
        }
      }
      look();select();
    }
    renderer.render(scene,camera);
    raf=requestAnimationFrame(frame);
  }
  function sync() {
    const should=active&&!document.hidden&&!paused;
    if(should&&!running){running=true;last=performance.now();raf=requestAnimationFrame(frame);}
    if(!should&&running){running=false;cancelAnimationFrame(raf);}
  }
  function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<600?100:60;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(container);
  canvas.addEventListener('pointerdown',event=>{if(paused)return;flight=null;container.classList.remove('guiding');keys.clear();drag={x:event.clientX,y:event.clientY,yaw:view.yaw,pitch:view.pitch,moved:false};canvas.setPointerCapture(event.pointerId);container.focus({preventScroll:true});});
  canvas.addEventListener('pointermove',event=>{
    if(paused)return;
    if(drag){if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>6)drag.moved=true;view.yaw=drag.yaw-(event.clientX-drag.x)/container.clientWidth*2.5;view.pitch=THREE.MathUtils.clamp(drag.pitch-(event.clientY-drag.y)/container.clientHeight*1.6,-.5,.55);}
    else if(event.pointerType==='mouse'){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);pointerInside=true;}
  });
  function release(){drag=null;pointerInside=false;}
  canvas.addEventListener('pointerup',event=>{
    const tap=drag&&!drag.moved&&!paused;release();
    if(tap){const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);const hit=raycaster.intersectObjects(meshes,false)[0];const target=hit?resolveTarget(hit.object):null;if(target?.id==='key'&&camera.position.distanceTo(target.focus)<5)onActivate(target);}
  });canvas.addEventListener('pointercancel',release);canvas.addEventListener('pointerleave',()=>{pointerInside=false;});
  // Las tres piezas se abren con un botón; la pequeña llave admite un toque sin arrastre.
  container.addEventListener('keydown',event=>{
    if(paused||event.target.closest('button'))return;
    const key=event.key.toLowerCase();
    if(key==='q'||key==='e'){event.preventDefault();view.yaw+=(key==='q'?1:-1)*.18;flight=null;container.classList.remove('guiding');}
    if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){event.preventDefault();keys.add(key);flight=null;container.classList.remove('guiding');}
    if(event.key==='Enter'&&selected){event.preventDefault();onActivate(selected);}
  });
  window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur',()=>{keys.clear();drag=null;});
  document.addEventListener('visibilitychange',()=>{keys.clear();sync();});
  const directionKeys={forward:'w',backward:'s',left:'a',right:'d'};
  container.querySelectorAll('[data-turn]').forEach(button=>button.addEventListener('click',()=>{if(paused)return;view.yaw+=(button.dataset.turn==='left'?1:-1)*.35;flight=null;container.classList.remove('guiding');}));
  container.querySelectorAll('[data-walk]').forEach(button=>{
    const key=directionKeys[button.dataset.walk];
    button.addEventListener('pointerdown',event=>{if(paused)return;event.preventDefault();keys.add(key);flight=null;button.setPointerCapture(event.pointerId);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(key));
    button.addEventListener('click',event=>{
      if(event.detail===0&&!paused){const f=key==='w'?1:key==='s'?-1:0,s=key==='d'?1:key==='a'?-1:0;const next=moveWithCollisions(camera.position,(-Math.sin(view.yaw)*f+Math.cos(view.yaw)*s)*.45,(-Math.cos(view.yaw)*f-Math.sin(view.yaw)*s)*.45,obstacles);camera.position.x=next.x;camera.position.z=next.z;}
    });
  });
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();active=false;sync();onUnavailable?.();});
  return {
    renderer,
    setActive(value){active=value;keys.clear();resize();sync();},
    setPaused(value){paused=value;keys.clear();drag=null;sync();},
    guideTo(target){
      if(paused)return false;
      const path=planPath(camera.position,target.approach,obstacles);if(!path.length)return false;
      const delta=target.focus.clone().sub(new THREE.Vector3(target.approach.x,1.65,target.approach.z));
      const yaw=Math.atan2(-delta.x,-delta.z),pitch=Math.atan2(delta.y,Math.hypot(delta.x,delta.z));
      if(reduced.matches){camera.position.set(target.approach.x,1.65,target.approach.z);view.yaw=yaw;view.pitch=pitch;look();setTarget(target);container.dispatchEvent(new CustomEvent('gallery:arrived'));}
      else{flight={path,index:1,yaw,pitch,target};container.classList.add('guiding');setTarget(null);}
      return true;
    },
    getSelected:()=>selected,
    dispose(){active=false;sync();observer.disconnect();renderer.dispose();canvas.remove();}
  };
}
