/* Motor reutilizable de salas: Three.js local, navegación, enfoque y pausa. */
import * as THREE from './vendor/three.module.min.js';
import {moveWithCollisions,planPath} from './navigation.mjs';

export function createGallery({container,scene,camera,obstacles,targets,onTarget,onActivate,onUnavailable,onTap,onSwipe,onHover,onBack,onFrame,floor}) {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<600?1.25:1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.05;
  const canvas=renderer.domElement;canvas.className='gallery-canvas';canvas.setAttribute('aria-hidden','true');container.prepend(canvas);
  const view={yaw:0,pitch:-.03},keys=new Set(),pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster();
  const meshes=targets.flatMap(target=>target.hits);
  let active=false,paused=false,running=false,raf=0,last=0,drag=null,flight=null,selected=null,pointerInside=false,hovered=null,rendered=false;
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
    // Arranca y frena con suavidad, como los vuelos de cámara del vestíbulo.
    const progress=flight.length?Math.min(1,flight.travelled/flight.length):1;
    let remaining=dt*2.8*(.3+1.4*Math.sin(Math.PI*progress));
    flight.travelled+=remaining;
    while(remaining>0 && flight.index<flight.path.length) {
      const goal=flight.path[flight.index],distance=Math.hypot(goal.x-camera.position.x,goal.z-camera.position.z);
      if(distance<=remaining){camera.position.x=goal.x;camera.position.z=goal.z;remaining-=distance;flight.index++;}
      else{camera.position.x+=(goal.x-camera.position.x)/distance*remaining;camera.position.z+=(goal.z-camera.position.z)/distance*remaining;remaining=0;}
    }
    const delta=flight.yaw-view.yaw;view.yaw+=Math.atan2(Math.sin(delta),Math.cos(delta))*Math.min(1,dt*5);
    view.pitch+=(flight.pitch-view.pitch)*Math.min(1,dt*5);
    if(flight.index>=flight.path.length) {const done=flight;view.yaw=done.yaw;view.pitch=done.pitch;setTarget(done.select?done.target:null);flight=null;container.classList.remove('guiding');container.dispatchEvent(new CustomEvent('gallery:arrived'));done.onArrive?.(done.target);}
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
      look();select();onFrame?.(dt,now);
    }
    renderer.render(scene,camera);
    if(!rendered){rendered=true;container.dispatchEvent(new CustomEvent('gallery:ready'));}
    raf=requestAnimationFrame(frame);
  }
  function sync() {
    const should=active&&!document.hidden&&!paused;
    if(should&&!running){running=true;last=performance.now();raf=requestAnimationFrame(frame);}
    if(!should&&running){running=false;cancelAnimationFrame(raf);}
  }
  function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=camera.aspect<.75?88:camera.aspect<1.1?72:60;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(container);
  function pick(event,objects) {
    const rect=canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
    return raycaster.intersectObjects(objects,false)[0]||null;
  }
  function hover(target){if(hovered===target)return;hovered=target;canvas.style.cursor=target?'pointer':'';onHover?.(target);}
  canvas.addEventListener('pointerdown',event=>{
    if(paused)return;keys.clear();drag={x:event.clientX,y:event.clientY,time:performance.now(),yaw:view.yaw,pitch:view.pitch,moved:false,flying:!!flight};
    try{canvas.setPointerCapture(event.pointerId);}catch{/* Puntero ya liberado. */}container.focus({preventScroll:true});
    // El primer toque ya ilumina la pieza, igual que pasar el mouse por encima.
    if(event.pointerType!=='mouse'){const hit=pick(event,meshes);hover(hit?resolveTarget(hit.object):null);}
  });
  canvas.addEventListener('pointermove',event=>{
    if(paused)return;
    if(drag){if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>8){drag.moved=true;flight=null;container.classList.remove('guiding');if(event.pointerType!=='mouse')hover(null);}if(!drag.moved)return;view.yaw=drag.yaw-(event.clientX-drag.x)/container.clientWidth*2.5;view.pitch=THREE.MathUtils.clamp(drag.pitch-(event.clientY-drag.y)/container.clientHeight*1.6,-.5,.55);}
    else if(event.pointerType==='mouse'){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);pointerInside=true;const hit=flight?null:pick(event,meshes);hover(hit?resolveTarget(hit.object):null);}
  });
  function release(){drag=null;pointerInside=false;}
  function leave(){pointerInside=false;hover(null);}
  canvas.addEventListener('pointerup',event=>{
    const start=drag;release();
    if(!start||paused)return;
    if(event.pointerType!=='mouse')setTimeout(()=>{if(!flight)hover(null);},450);
    if(!start.moved){
      // Un toque sin arrastre: una pieza, un punto del suelo o el vacío.
      const hit=pick(event,meshes);
      if(hit){onTap?.(resolveTarget(hit.object),null);return;}
      const ground=floor?pick(event,[floor]):null;
      onTap?.(null,ground?ground.point:null);
      return;
    }
    // Deslizar rápido: a los lados cambia de pieza, hacia abajo da un paso atrás.
    const dx=event.clientX-start.x,dy=event.clientY-start.y,quick=performance.now()-start.time<450;
    if(quick&&Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.4)onSwipe?.(dx<0?'left':'right',()=>{view.yaw=start.yaw;view.pitch=start.pitch;});
    else if(quick&&dy>70&&dy>Math.abs(dx)*1.4)onSwipe?.('down',()=>{view.yaw=start.yaw;view.pitch=start.pitch;});
  });canvas.addEventListener('pointercancel',()=>{release();hover(null);});canvas.addEventListener('pointerleave',leave);
  // Las tres piezas se abren con un botón; la pequeña llave admite un toque sin arrastre.
  container.addEventListener('keydown',event=>{
    if(paused||event.target.closest('button'))return;
    const key=event.key.toLowerCase();
    if(key==='q'||key==='e'){event.preventDefault();view.yaw+=(key==='q'?1:-1)*.18;flight=null;container.classList.remove('guiding');}
    if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){event.preventDefault();keys.add(key);flight=null;container.classList.remove('guiding');}
    if(event.key==='Enter'&&selected){event.preventDefault();onActivate(selected);}
    if(event.key==='Escape'&&onBack){event.preventDefault();onBack();}
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
    guideTo(target,{onArrive=null,select=true}={}){
      if(paused)return false;
      const path=planPath(camera.position,target.approach,obstacles);if(!path.length)return false;
      const delta=target.focus.clone().sub(new THREE.Vector3(target.approach.x,1.65,target.approach.z));
      const yaw=Math.atan2(-delta.x,-delta.z),pitch=Math.atan2(delta.y,Math.hypot(delta.x,delta.z));
      if(reduced.matches){flight=null;camera.position.set(target.approach.x,1.65,target.approach.z);view.yaw=yaw;view.pitch=pitch;look();setTarget(select?target:null);container.dispatchEvent(new CustomEvent('gallery:arrived'));onArrive?.(target);}
      else{let length=0;for(let i=1;i<path.length;i++)length+=Math.hypot(path[i].x-path[i-1].x,path[i].z-path[i-1].z);flight={path,index:1,yaw,pitch,target,length,travelled:0,select,onArrive};container.classList.add('guiding');setTarget(null);}
      return true;
    },
    getSelected:()=>selected,
    isFlying:()=>!!flight,
    camera,
    dispose(){active=false;sync();observer.disconnect();renderer.dispose();canvas.remove();}
  };
}
