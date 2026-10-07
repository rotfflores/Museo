/* Sala 05 · Lo que todavía nos espera: un taller luminoso con cinco marcos cubiertos de papel y un libro en el centro.
   Mismo motor, gestos, notas laterales, barra y puertas que las salas anteriores. */
import * as THREE from './vendor/three.module.min.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {createGallery,focusArtwork} from './gallery-engine.js';
import {isWalkable} from './navigation.mjs';

const Museum=window.Museum,config=window.MUSEUM_CONFIG,room=config.futureRoom;
const ROOM_ID='future';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text=value=>String(value??'').replace(/\{(sender|recipient)\}/g,(_,key)=>config[key]);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const plans=room.plans,book=room.book||{};
const number=index=>String(index+1).padStart(2,'0');

// Planta: un taller rectangular con dos ventanales al amanecer en el fondo. Marcos en los muros laterales y uno al fondo.
const HALF=6,BACK=-6,FRONT=5.2,WALL_H=4.6,DEPTH=.42,FRAME_Y=2.05,OPEN_W=1.5,OPEN_H=1.1;
const BOUNDS={minX:-5.35,maxX:5.35,minZ:-5.35,maxZ:FRONT-.6};
const TABLE={x:0,z:-.4,w:2.1,d:1.05,h:.78};
// Recorrido: izquierda cerca, izquierda fondo, fondo, derecha fondo, derecha cerca. Con menos planes se usan los primeros huecos.
const SLOTS=[
  {x:-HALF,z:1.3,out:[1,0,0]},{x:-HALF,z:-2.7,out:[1,0,0]},{x:0,z:BACK,out:[0,0,1]},{x:HALF,z:-2.7,out:[-1,0,0]},{x:HALF,z:1.3,out:[-1,0,0]}
];
const obstacles=[{minX:TABLE.x-TABLE.w/2-.18,maxX:TABLE.x+TABLE.w/2+.18,minZ:TABLE.z-TABLE.d/2-.18,maxZ:TABLE.z+TABLE.d/2+.18}];

let engine=null,initialized=false,fallback=false,selected=null,currentPlan=-1;
let focused=null,flyingTo=null,hoverTarget=null,ping=null,firstFrame=null,returnPose=null,noteOpen=false;
let exitTarget=null,exitOpen=0,exitOpening=false,bookTarget=null,clueTarget=null,bookPage=null,revealing=null,pillTarget=undefined;
const targets=[],planTargets=[];

{const words=room.title.split(' '),last=words.pop();$('#future-title').innerHTML=words.length?`${escape(words.join(' '))} <em>${escape(last)}</em>`:escape(last);}
$('#future-subtitle').textContent=room.subtitle;
$('#future-tour').innerHTML=[
  ...plans.map((plan,index)=>`<button class="tour-stop" data-future-tour="p${index}" type="button"><span class="tour-number">${number(index)}</span><span>${escape(plan.title)}<small>Plan</small></span><span class="tour-check" aria-label="Sin descubrir">○</span></button>`),
  `<button class="tour-stop" data-future-tour="book" type="button"><span class="tour-number">✧</span><span>${escape(book.title||'Nuestro próximo capítulo')}<small>El libro de la mesa · opcional</small></span><span class="tour-check" aria-hidden="true"></span></button>`
].join('');

const found=()=>Museum.getProgress().discoveries[ROOM_ID]||[];
const revealed=plan=>found().includes(plan.id);
const chosen=()=>plans.find(plan=>plan.id===Museum.getNextChapter())||null;
function updateProgress() {
  const progress=Museum.getProgress(),count=`Planes descubiertos: ${plans.filter(revealed).length} de ${plans.length}`,choice=chosen();
  $('#future-counter').textContent=count;$('#future-discovery-count').textContent=count;
  $('#future-choice-state').textContent=`Próximo capítulo: ${choice?choice.title:'todavía sin elegir'}`;
  $('#future-clue-count').textContent=`Pistas encontradas: ${progress.clues.length} de ${config.clueIds.length}${progress.cluesComplete?' · colección completa':''}`;
  $('#future-passport-count').textContent=`${progress.completed.length}/6`;
  $('#future-passport').setAttribute('aria-label',`Pasaporte de recuerdos, ${progress.completed.length} de 6 salas completadas`);
  document.querySelectorAll('[data-future-tour^="p"]').forEach(button=>{
    const done=revealed(plans[Number(button.dataset.futureTour.slice(1))]);
    button.classList.toggle('discovered',done);
    const check=button.querySelector('.tour-check');check.textContent=done?'✧':'○';check.setAttribute('aria-label',done?'Descubierto':'Sin descubrir');
  });
  // Las obras descubiertas siguen descubiertas al volver; el marcador señala el plan elegido.
  for(const target of planTargets){
    const plan=plans[target.index],open=revealed(plan);
    if(revealing?.target!==target){target.paper.visible=!open;target.paperPivot.rotation.x=0;target.paper.material.opacity=1;}
    if(target.revealedPlaque!==open){target.revealedPlaque=open;target.plaque.material.map.dispose();target.plaque.material.map=plaqueTexture(`PLAN ${number(target.index)}`,open?plan.title:'Una obra por crear',open?text(plan.description):'Próximamente');}
    target.ribbon.visible=open&&choice?.id===plan.id;
    if(target.envelope)target.envelope.visible=open;
  }
  drawBook();
}
function nameOf(target) {
  if(!target)return room.subtitle;
  if(target.id==='exit')return 'La puerta al vestíbulo';
  if(target.id==='clue')return 'Un pequeño símbolo en la mesa';
  if(target.id==='book')return book.title||'Nuestro próximo capítulo';
  if(target.plan!==undefined)return `Invitación · ${plans[target.plan].title}`;
  const plan=plans[target.index];
  return revealed(plan)?plan.title:`Plan ${number(target.index)} · Próximamente`;
}
function setTarget(target){selected=target;$('#future-target-name').textContent=nameOf(target);}
function fallbackMode(){fallback=true;$('#future-fallback').hidden=false;$('#future-stage').classList.add('without-webgl');$('#future-accessible-clue').hidden=false;}
function texture(width,height,paint) {
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;paint(canvas.getContext('2d'),width,height);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map;
}
function wrapText(g,value,x,y,maxWidth,lineHeight,maxLines=2) {
  const words=String(value).split(' ');let line='',lines=[];
  for(const word of words){const test=line?line+' '+word:word;if(g.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;}
  if(line)lines.push(line);
  if(lines.length>maxLines){lines=lines.slice(0,maxLines);lines[maxLines-1]=lines[maxLines-1].replace(/\s*\S*$/,'')+'…';}
  lines.forEach((l,i)=>g.fillText(l,x,y+i*lineHeight));
  return lines.length;
}
function plaqueTexture(eyebrow,title,line) {
  const map=texture(1024,300,(g,w,h)=>{
    const grad=g.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#f6efe2');grad.addColorStop(1,'#eadfca');g.fillStyle=grad;g.fillRect(0,0,w,h);
    g.strokeStyle='#c9b48e';g.lineWidth=4;g.strokeRect(2,2,w-4,h-4);
    g.fillStyle='#b19a70';for(const [sx,sy] of [[24,24],[w-24,24],[24,h-24],[w-24,h-24]]){g.beginPath();g.arc(sx,sy,5,0,Math.PI*2);g.fill();}
    g.textAlign='center';g.fillStyle='#9a7b45';g.font='500 22px "Segoe UI", Arial, sans-serif';g.letterSpacing='5px';g.fillText(eyebrow,w/2,60);g.letterSpacing='0px';
    let size=54;g.font=`italic ${size}px Georgia, "Times New Roman", serif`;while(g.measureText(title).width>w-90&&size>30){size-=2;g.font=`italic ${size}px Georgia, "Times New Roman", serif`;}
    g.fillStyle='#4a3c2c';g.fillText(title,w/2,136);
    g.strokeStyle='#b89b66';g.lineWidth=2;g.beginPath();g.moveTo(w/2-70,164);g.lineTo(w/2+70,164);g.stroke();
    g.font='27px Georgia, "Times New Roman", serif';g.fillStyle='#766750';wrapText(g,line||'',w/2,210,w-120,35,2);
  });
  map.anisotropy=4;return map;
}
const rand=(seed=>()=>(seed=(seed*16807)%2147483647)/2147483647)(53);

/* Fondos pintados para cada escenario: gradientes y formas simples, sin imágenes externas. */
const backdrops={
  dinner:(g,w,h)=>{const sky=g.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#3d4a6b');sky.addColorStop(.6,'#c98f72');sky.addColorStop(1,'#f0c590');g.fillStyle=sky;g.fillRect(0,0,w,h);
    g.fillStyle='#fff3d6';g.beginPath();g.arc(w*.78,h*.22,28,0,Math.PI*2);g.fill();
    g.strokeStyle='#5e4632';g.lineWidth=3;g.beginPath();g.moveTo(0,h*.12);g.quadraticCurveTo(w/2,h*.3,w,h*.1);g.stroke();
    for(let i=0;i<14;i++){const x=i/13*w,y=h*.12+Math.sin(i/13*Math.PI)*h*.14;g.fillStyle='rgba(255,226,150,.95)';g.shadowColor='#ffd27a';g.shadowBlur=14;g.beginPath();g.arc(x,y+8,6,0,Math.PI*2);g.fill();}
    g.shadowBlur=0;g.fillStyle='#6d8a5e';g.beginPath();g.moveTo(0,h*.78);g.quadraticCurveTo(w*.3,h*.66,w*.6,h*.74);g.quadraticCurveTo(w*.85,h*.8,w,h*.7);g.lineTo(w,h);g.lineTo(0,h);g.fill();},
  journey:(g,w,h)=>{const sky=g.createLinearGradient(0,0,0,h*.6);sky.addColorStop(0,'#8ec5e6');sky.addColorStop(1,'#fbe0b8');g.fillStyle=sky;g.fillRect(0,0,w,h);
    g.fillStyle='#ffe2a0';g.beginPath();g.arc(w*.68,h*.48,46,0,Math.PI*2);g.fill();
    g.fillStyle='#8aa6b8';g.beginPath();g.moveTo(0,h*.55);g.lineTo(w*.2,h*.36);g.lineTo(w*.38,h*.52);g.lineTo(w*.5,h*.42);g.lineTo(w*.66,h*.55);g.fill();
    const sea=g.createLinearGradient(0,h*.55,0,h);sea.addColorStop(0,'#4f9cc0');sea.addColorStop(1,'#2d6f95');g.fillStyle=sea;g.fillRect(0,h*.55,w,h*.45);
    g.strokeStyle='rgba(255,255,255,.5)';g.lineWidth=2;for(let i=0;i<9;i++){const y=h*.6+i*h*.045;g.beginPath();g.moveTo(rand()*w*.5,y);g.lineTo(w*.5+rand()*w*.5,y);g.stroke();}
    g.fillStyle='#f1d9a8';g.beginPath();g.moveTo(w*.55,h);g.quadraticCurveTo(w*.8,h*.72,w,h*.7);g.lineTo(w,h);g.fill();},
  'first-time':(g,w,h)=>{g.fillStyle='#f4dfd2';g.fillRect(0,0,w,h);
    g.fillStyle='#e8c7b4';for(let x=0;x<w;x+=46)g.fillRect(x,0,22,h);
    g.fillStyle='#8a5e44';g.fillRect(w*.08,h*.32,w*.4,10);g.fillRect(w*.56,h*.22,w*.36,10);
    const jars=[['#d7a05f',.12],['#9cb57a',.2],['#c46b5b',.29],['#e6c58a',.38]];for(const [c,x] of jars){g.fillStyle=c;g.fillRect(w*x,h*.2,34,h*.12);}
    g.fillStyle='#5e4632';g.font='64px Georgia, serif';g.fillText('♪',w*.62,h*.18);g.fillText('♫',w*.78,h*.16);
    g.fillStyle='#4a3c2c';g.font='italic 30px Georgia, serif';g.fillText('Algo nuevo',w*.6,h*.45);},
  'slow-day':(g,w,h)=>{g.fillStyle='#efe2cf';g.fillRect(0,0,w,h);
    const win=g.createLinearGradient(0,0,0,h*.55);win.addColorStop(0,'#cfe4ef');win.addColorStop(1,'#fdf1d8');g.fillStyle=win;g.fillRect(w*.08,h*.08,w*.32,h*.5);
    g.strokeStyle='#b89b76';g.lineWidth=8;g.strokeRect(w*.08,h*.08,w*.32,h*.5);g.beginPath();g.moveTo(w*.24,h*.08);g.lineTo(w*.24,h*.58);g.stroke();
    g.fillStyle='#2c2a33';g.fillRect(w*.52,h*.14,w*.4,h*.32);g.fillStyle='#e9b97c';g.fillRect(w*.54,h*.17,w*.36,h*.26);
    g.fillStyle='#fff6e0';g.font='italic 26px Georgia, serif';g.textAlign='center';g.fillText('Nuestra película',w*.72,h*.32);
    g.fillStyle='rgba(255,236,200,.5)';g.beginPath();g.moveTo(w*.08,h*.58);g.lineTo(w*.4,h*.58);g.lineTo(w*.6,h);g.lineTo(0,h);g.fill();},
  dream:(g,w,h)=>{const sky=g.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#2b3557');sky.addColorStop(.55,'#9b7fa8');sky.addColorStop(1,'#f7c99a');g.fillStyle=sky;g.fillRect(0,0,w,h);
    for(let i=0;i<70;i++){g.fillStyle=`rgba(255,250,235,${.4+rand()*.6})`;g.beginPath();g.arc(rand()*w,rand()*h*.45,rand()*2+.6,0,Math.PI*2);g.fill();}
    g.fillStyle='#ffe9b8';g.beginPath();g.arc(w*.5,h*.86,70,Math.PI,0);g.fill();
    g.fillStyle='#6b6489';g.beginPath();g.moveTo(0,h);g.lineTo(w*.25,h*.62);g.lineTo(w*.4,h*.78);g.lineTo(w*.62,h*.55);g.lineTo(w,h*.9);g.lineTo(w,h);g.fill();}
};
/* Pequeños escenarios 3D dentro de cada marco: geometría sencilla y materiales mate, económicos para el celular. */
function buildScene(kind,group,mats) {
  const add=(geometry,material,x,y,z,rx=0,ry=0,rz=0)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,rz);group.add(mesh);return mesh;};
  const floorY=-OPEN_H/2+.02;
  if(kind==='dinner'){
    add(new THREE.CylinderGeometry(.24,.24,.025,28),mats.cloth,0,floorY+.3,-.2);
    add(new THREE.CylinderGeometry(.025,.05,.3,10),mats.wood,0,floorY+.15,-.2);
    for(const s of [-1,1]){
      add(new THREE.BoxGeometry(.16,.02,.16),mats.wood,s*.38,floorY+.18,-.2);add(new THREE.BoxGeometry(.16,.22,.02),mats.wood,s*.46,floorY+.3,-.2,0,Math.PI/2,0);
      for(const [lx,lz] of [[-.06,-.06],[.06,-.06],[-.06,.06],[.06,.06]])add(new THREE.BoxGeometry(.015,.18,.015),mats.wood,s*.38+lx,floorY+.09,-.2+lz);
      add(new THREE.CylinderGeometry(.07,.06,.01,20),mats.porcelain,s*.12,floorY+.32,-.2);
      add(new THREE.CylinderGeometry(.018,.012,.08,10),mats.glass,s*.1,floorY+.36,-.3);
    }
    add(new THREE.CylinderGeometry(.015,.015,.09,10),mats.porcelain,0,floorY+.36,-.17);
    add(new THREE.SphereGeometry(.018,10,8),mats.flame,0,floorY+.42,-.17);
  } else if(kind==='journey'){
    const suitcase=new THREE.Group();suitcase.position.set(-.2,floorY+.16,-.16);suitcase.rotation.y=.35;group.add(suitcase);
    suitcase.add(new THREE.Mesh(new THREE.BoxGeometry(.42,.3,.14),mats.leather));
    const handle=new THREE.Mesh(new THREE.TorusGeometry(.05,.012,8,16,Math.PI),mats.gold);handle.position.y=.15;suitcase.add(handle);
    for(const [x,y,c] of [[-.1,.04,mats.stickerA],[.11,-.06,mats.stickerB],[.05,.08,mats.porcelain]]){const s=new THREE.Mesh(new THREE.CircleGeometry(.04,16),c);s.position.set(x,y,.071);suitcase.add(s);}
    for(const x of [-.19,.19]){const strap=new THREE.Mesh(new THREE.BoxGeometry(.02,.31,.15),mats.wood);strap.position.x=x*.6;suitcase.add(strap);}
    const map=add(new THREE.PlaneGeometry(.34,.22),mats.map,.32,floorY+.005,-.16,-Math.PI/2,0,.2);map.renderOrder=1;
    add(new THREE.CylinderGeometry(.12,.12,.012,24),mats.straw,.3,floorY+.03,-.28);add(new THREE.CylinderGeometry(.06,.07,.07,20),mats.straw,.3,floorY+.07,-.28);
  } else if(kind==='first-time'){
    add(new THREE.BoxGeometry(.9,.36,.3),mats.wood,0,floorY+.18,-.24);
    add(new THREE.BoxGeometry(.92,.025,.32),mats.porcelain,0,floorY+.37,-.24);
    add(new THREE.CylinderGeometry(.1,.09,.12,22),mats.metal,-.22,floorY+.44,-.24);
    add(new THREE.CylinderGeometry(.11,.11,.012,22),mats.metal,-.22,floorY+.5,-.24);
    add(new THREE.SphereGeometry(.1,18,10,0,Math.PI*2,Math.PI/2,Math.PI/2),mats.porcelain,.12,floorY+.48,-.24);
    add(new THREE.BoxGeometry(.012,.012,.26),mats.wood,.12,floorY+.5,-.2,.5,.6,0);
    add(new THREE.PlaneGeometry(.18,.24),mats.card,.36,floorY+.5,-.2,-.3,0,-.15);
    for(const s of [-1,1])add(new THREE.BoxGeometry(.1,.03,.18),mats.shoes,s*.12+.25,floorY+.015,-.14,0,s*.3,0);
  } else if(kind==='slow-day'){
    add(new THREE.BoxGeometry(.8,.14,.32),mats.sofa,0,floorY+.12,-.22);
    add(new THREE.BoxGeometry(.8,.26,.08),mats.sofa,0,floorY+.3,-.36);
    for(const s of [-1,1])add(new THREE.BoxGeometry(.08,.2,.32),mats.sofa,s*.42,floorY+.2,-.22);
    for(const s of [-1,1])add(new THREE.BoxGeometry(.3,.08,.22),mats.cushion,s*.18,floorY+.23,-.22,0,0,s*.05);
    add(new THREE.BoxGeometry(.34,.015,.36),mats.blanket,.2,floorY+.28,-.2,0,.3,.12);
    add(new THREE.SphereGeometry(.07,16,10,0,Math.PI*2,Math.PI/2,Math.PI/2),mats.stickerB,-.24,floorY+.07,-.1);
    for(let i=0;i<9;i++)add(new THREE.SphereGeometry(.014,6,5),mats.porcelain,-.24+(rand()-.5)*.08,floorY+.075+rand()*.02,-.1+(rand()-.5)*.08);
    add(new THREE.CylinderGeometry(.03,.026,.06,14),mats.porcelain,.3,floorY+.03,-.1);
  } else if(kind==='dream'){
    add(new THREE.ConeGeometry(.32,.5,6),mats.mountain,-.05,floorY+.25,-.26);
    add(new THREE.ConeGeometry(.1,.14,6),mats.porcelain,-.05,floorY+.44,-.26);
    add(new THREE.ConeGeometry(.22,.32,6),mats.mountainB,.3,floorY+.16,-.3);
    add(new THREE.CylinderGeometry(.006,.006,.2,6),mats.wood,-.05,floorY+.6,-.26);
    add(new THREE.PlaneGeometry(.1,.06),mats.flag,.0,floorY+.66,-.26);
    // Dos huellas que suben juntas por el sendero.
    for(let i=0;i<5;i++)for(const s of [-1,1])add(new THREE.CircleGeometry(.018,10),mats.porcelain,-.35+i*.07+s*.02,floorY+.004,-.08-i*.05,-Math.PI/2);
    const star=new THREE.Shape();for(let i=0;i<10;i++){const r=i%2?.03:.07,a=i/10*Math.PI*2-Math.PI/2;const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i)star.lineTo(x,y);else star.moveTo(x,y);}star.closePath();
    add(new THREE.ShapeGeometry(star),mats.flame,.42,.3,-.3);
  }
}

function buildRoom() {
  const test=document.createElement('canvas');
  if(!test.getContext('webgl2')){fallbackMode();return;}
  const small=innerWidth<600,maxTexture=small?640:1024;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#f6f1e6');scene.fog=new THREE.Fog('#f6f1e6',14,28);
  const camera=new THREE.PerspectiveCamera(60,1,.1,40);camera.position.set(0,1.65,FRONT-1.2);
  const ivory=new THREE.MeshStandardMaterial({color:'#f7f2e8',roughness:.95});
  const oak=new THREE.MeshStandardMaterial({color:'#c9a679',roughness:.6});
  const wood=new THREE.MeshStandardMaterial({color:'#6b4a30',roughness:.5});
  const goldTrim=new THREE.MeshStandardMaterial({color:'#c9a564',metalness:1,roughness:.3});
  const dotMap=texture(64,64,g=>{const grad=g.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(255,248,225,1)');grad.addColorStop(.35,'rgba(255,232,180,.55)');grad.addColorStop(1,'rgba(255,230,170,0)');g.fillStyle=grad;g.fillRect(0,0,64,64);});
  function box(width,height,depth,x,y,z,material=ivory){const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);mesh.position.set(x,y,z);scene.add(mesh);return mesh;}
  const depth=FRONT-BACK,midZ=(FRONT+BACK)/2;
  // Suelo de madera clara en espiga, con un camino de luz hacia los ventanales.
  const floorMap=texture(1024,1024,(g,w,h)=>{
    g.fillStyle='#e6d2b2';g.fillRect(0,0,w,h);
    const pw=64,ph=16;
    for(let y=-ph;y<h+ph;y+=ph)for(let x=-pw;x<w+pw;x+=pw){const o=((y/ph)%2)*pw/2;const tone=200+Math.floor(rand()*30);g.fillStyle=`rgb(${tone+20},${tone},${tone-36})`;g.fillRect(x+o,y,pw-2,ph-2);}
    const glow=g.createLinearGradient(0,0,0,h);glow.addColorStop(0,'rgba(255,240,205,.55)');glow.addColorStop(.6,'rgba(255,240,205,0)');g.fillStyle=glow;g.fillRect(0,0,w,h);
  });
  floorMap.wrapS=floorMap.wrapT=THREE.RepeatWrapping;floorMap.repeat.set(2,2);floorMap.anisotropy=4;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(HALF*2,depth),new THREE.MeshStandardMaterial({map:floorMap,roughness:.55}));
  floor.rotation.x=-Math.PI/2;floor.position.set(0,0,midZ);scene.add(floor);
  // Alfombra clara bajo la mesa del libro.
  const rugMap=texture(512,320,(g,w,h)=>{g.fillStyle='#efe4cf';g.fillRect(0,0,w,h);g.strokeStyle='#c9b08a';g.lineWidth=6;g.strokeRect(16,16,w-32,h-32);g.lineWidth=2;g.strokeRect(30,30,w-60,h-60);});
  const rug=new THREE.Mesh(new THREE.PlaneGeometry(3.6,2.4),new THREE.MeshStandardMaterial({map:rugMap,roughness:1}));rug.rotation.x=-Math.PI/2;rug.position.set(TABLE.x,.006,TABLE.z);scene.add(rug);
  // Muros, zócalo de roble y cornisa. El fondo tiene dos ventanales con un amanecer suave.
  for(const side of [-1,1]){box(.2,WALL_H,depth,side*(HALF+.1),WALL_H/2,midZ);box(.06,.5,depth,side*(HALF-.03),.25,midZ,oak);box(.08,.1,depth,side*(HALF-.04),WALL_H-.25,midZ);}
  box(HALF*2,WALL_H,.2,0,WALL_H/2,FRONT+.1);
  const windowMap=texture(256,512,(g,w,h)=>{const sky=g.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#cfe1ee');sky.addColorStop(.55,'#fde9c8');sky.addColorStop(.8,'#f8c99a');sky.addColorStop(1,'#f3b98a');g.fillStyle=sky;g.fillRect(0,0,w,h);
    g.fillStyle='rgba(255,246,220,.9)';g.beginPath();g.arc(w*.5,h*.78,46,0,Math.PI*2);g.fill();g.fillStyle='rgba(160,140,170,.35)';g.fillRect(0,h*.86,w,h*.14);});
  const backWall=new THREE.Shape();backWall.moveTo(-HALF,0);backWall.lineTo(HALF,0);backWall.lineTo(HALF,WALL_H);backWall.lineTo(-HALF,WALL_H);backWall.lineTo(-HALF,0);
  const WIN_W=1.5,WIN_H=3.1,WIN_Y=.75;
  for(const s of [-1,1]){const hole=new THREE.Path(),cx=s*3.4;hole.moveTo(cx-WIN_W/2,WIN_Y);hole.lineTo(cx-WIN_W/2,WIN_Y+WIN_H-WIN_W/2);hole.absarc(cx,WIN_Y+WIN_H-WIN_W/2,WIN_W/2,Math.PI,0,true);hole.lineTo(cx+WIN_W/2,WIN_Y);hole.lineTo(cx-WIN_W/2,WIN_Y);backWall.holes.push(hole);}
  const back=new THREE.Mesh(new THREE.ShapeGeometry(backWall,24),ivory);back.position.z=BACK;scene.add(back);
  for(const s of [-1,1]){
    const cx=s*3.4,sky=new THREE.Mesh(new THREE.PlaneGeometry(WIN_W,WIN_H),new THREE.MeshBasicMaterial({map:windowMap,toneMapped:false}));sky.position.set(cx,WIN_Y+WIN_H/2,BACK-.05);scene.add(sky);
    const arch=new THREE.Mesh(new THREE.TorusGeometry(WIN_W/2,.05,8,32,Math.PI),oak);arch.position.set(cx,WIN_Y+WIN_H-WIN_W/2,BACK+.03);scene.add(arch);
    for(const dx of [-WIN_W/2,0,WIN_W/2])box(.06,WIN_H-WIN_W/2,.08,cx+dx,WIN_Y+(WIN_H-WIN_W/2)/2,BACK+.03,oak);
    for(const y of [WIN_Y,WIN_Y+1.2])box(WIN_W,.05,.08,cx,y,BACK+.03,oak);
    // Haz de luz suave que entra por la ventana.
    const beam=new THREE.Mesh(new THREE.PlaneGeometry(1.6,5),new THREE.MeshBasicMaterial({color:'#fff1d2',transparent:true,opacity:.045,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
    beam.position.set(cx*.85,1.6,BACK+2.1);beam.rotation.set(-1.05,0,0);scene.add(beam);
  }
  // Techo con un tragaluz alargado.
  const ceiling=new THREE.Mesh(new THREE.PlaneGeometry(HALF*2,depth),new THREE.MeshStandardMaterial({color:'#f7f2e8',roughness:.95}));ceiling.rotation.x=Math.PI/2;ceiling.position.set(0,WALL_H,midZ);scene.add(ceiling);
  const skylight=new THREE.Mesh(new THREE.PlaneGeometry(2.4,depth-3),new THREE.MeshBasicMaterial({color:'#fffaf0',toneMapped:false}));skylight.rotation.x=Math.PI/2;skylight.position.set(0,WALL_H-.01,midZ);scene.add(skylight);
  // Texto de bienvenida sobre la entrada del fondo, entre los ventanales.
  {
    const map=texture(1024,300,(g,w)=>{g.textAlign='center';g.fillStyle='#9a7b45';g.font='500 24px "Segoe UI", Arial, sans-serif';g.letterSpacing='12px';g.fillText('SALA 05',w/2,50);g.letterSpacing='0px';
      g.fillStyle='#4a3c2c';let size=66;g.font=`italic ${size}px Georgia, "Times New Roman", serif`;while(g.measureText(room.title).width>w-80&&size>40){size-=2;g.font=`italic ${size}px Georgia, "Times New Roman", serif`;}g.fillText(room.title,w/2,132);
      g.strokeStyle='#b89b66';g.lineWidth=3;g.beginPath();g.moveTo(w/2-100,162);g.lineTo(w/2+100,162);g.stroke();
      g.fillStyle='#766750';g.font='27px Georgia, "Times New Roman", serif';wrapText(g,room.subtitle,w/2,208,w-140,36,2);});
    map.anisotropy=4;
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.6,.76),new THREE.MeshBasicMaterial({map,transparent:true,toneMapped:false}));sign.position.set(0,4.05,BACK+.02);scene.add(sign);
  }
  scene.add(new THREE.HemisphereLight('#fffaf0','#d8c6a8',1.35));
  const sun=new THREE.DirectionalLight('#ffe6c2',1.2);sun.position.set(0,4,BACK-2);sun.target.position.set(0,0,2);scene.add(sun,sun.target);
  const fill=new THREE.PointLight('#fff0d8',8,12,1.6);fill.position.set(0,3.8,0);scene.add(fill);
  function marker(x,z,radius=.55){const mesh=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.025,48),new THREE.MeshBasicMaterial({color:'#b89b66',transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.012,z);scene.add(mesh);return mesh;}
  // Materiales compartidos de los escenarios.
  const mat=(color,extra={})=>new THREE.MeshLambertMaterial({color,...extra});
  const mats={cloth:mat('#f4ead8'),wood:mat('#8a5e3c'),porcelain:mat('#fbf7ee'),glass:mat('#cfe6ee',{transparent:true,opacity:.7}),flame:new THREE.MeshBasicMaterial({color:'#ffd27a',side:THREE.DoubleSide}),
    leather:mat('#a8573c'),gold:new THREE.MeshLambertMaterial({color:'#c9a564'}),stickerA:mat('#f0c05a'),stickerB:mat('#e9a08c'),map:new THREE.MeshLambertMaterial({map:texture(256,160,(g,w,h)=>{g.fillStyle='#f3e6c4';g.fillRect(0,0,w,h);g.strokeStyle='#9cb3a2';g.lineWidth=3;for(let i=0;i<5;i++){g.beginPath();g.moveTo(0,rand()*h);g.bezierCurveTo(w*.3,rand()*h,w*.6,rand()*h,w,rand()*h);g.stroke();}g.fillStyle='#c46b5b';g.beginPath();g.arc(w*.7,h*.4,7,0,Math.PI*2);g.fill();g.strokeStyle='#c46b5b';g.setLineDash([6,5]);g.beginPath();g.moveTo(w*.15,h*.8);g.quadraticCurveTo(w*.4,h*.3,w*.7,h*.4);g.stroke();}),side:THREE.DoubleSide}),
    straw:mat('#e2c58a'),metal:new THREE.MeshStandardMaterial({color:'#c0c4c8',metalness:.6,roughness:.35}),card:new THREE.MeshLambertMaterial({map:texture(128,170,(g,w,h)=>{g.fillStyle='#fffaf0';g.fillRect(0,0,w,h);g.fillStyle='#8a5e3c';g.font='italic 18px Georgia, serif';g.fillText('Receta',20,30);g.fillStyle='#c9b48e';for(let i=0;i<6;i++)g.fillRect(18,48+i*18,w-36-rand()*30,3);}),side:THREE.DoubleSide}),
    shoes:mat('#c46b5b'),sofa:mat('#9fb1a3'),cushion:mat('#efd9b6'),blanket:mat('#d98f6f'),mountain:mat('#8c86ad'),mountainB:mat('#a79ec0'),flag:new THREE.MeshLambertMaterial({color:'#c46b5b',side:THREE.DoubleSide})};
  // Cinco marcos-caja: el papel con «Próximamente» se retira y deja ver un pequeño escenario.
  const paperBase=texture(512,384,(g,w,h)=>{g.fillStyle='#fbf8f1';g.fillRect(0,0,w,h);for(let i=0;i<900;i++){g.fillStyle=`rgba(${170+rand()*40},${150+rand()*40},${120+rand()*30},${.04+rand()*.06})`;g.fillRect(rand()*w,rand()*h,1+rand()*3,1);}});
  plans.forEach((plan,index)=>{
    const slot=SLOTS[index%SLOTS.length],out=slot.out;
    const fx=slot.x+out[0]*DEPTH,fz=slot.z+out[2]*DEPTH;
    const group=new THREE.Group();group.position.set(fx,FRAME_Y,fz);group.lookAt(fx+out[0],FRAME_Y,fz+out[2]);scene.add(group);
    const frameMaterial=oak.clone(),b=.14;
    for(const [w,h,x,y] of [[OPEN_W+b*2,b,0,OPEN_H/2+b/2],[OPEN_W+b*2,b,0,-OPEN_H/2-b/2],[b,OPEN_H,-OPEN_W/2-b/2,0],[b,OPEN_H,OPEN_W/2+b/2,0]]){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,DEPTH+.04),frameMaterial);m.position.set(x,y,-DEPTH/2+.02);group.add(m);}
    for(const [w,h,x,y] of [[OPEN_W+.02,.02,0,OPEN_H/2],[OPEN_W+.02,.02,0,-OPEN_H/2],[.02,OPEN_H,-OPEN_W/2,0],[.02,OPEN_H,OPEN_W/2,0]]){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,.03),goldTrim);m.position.set(x,y,.03);group.add(m);}
    // Interior de la caja: fondo pintado (o la fotografía opcional) y suelo claro.
    const inner=new THREE.Group();group.add(inner);
    const backPanel=new THREE.Mesh(new THREE.PlaneGeometry(OPEN_W,OPEN_H),new THREE.MeshBasicMaterial({map:texture(512,384,backdrops[plan.scene]||backdrops.dream),toneMapped:false}));backPanel.position.z=-DEPTH+.01;inner.add(backPanel);
    const innerFloor=new THREE.Mesh(new THREE.PlaneGeometry(OPEN_W,DEPTH),mats.cloth);innerFloor.rotation.x=-Math.PI/2;innerFloor.position.set(0,-OPEN_H/2+.01,-DEPTH/2);inner.add(innerFloor);
    const diorama=new THREE.Group();inner.add(diorama);
    if(plan.photo)new THREE.TextureLoader().load(plan.photo,map=>{
      const img=map.image,iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,scale=Math.min(1,maxTexture/Math.max(iw,ih));
      // La fotografía llena el fondo sin deformarse: se recorta al centro.
      const raster=document.createElement('canvas');raster.width=512;raster.height=Math.round(512*OPEN_H/OPEN_W);const g=raster.getContext('2d'),fit=Math.max(raster.width/iw,raster.height/ih);
      g.drawImage(img,(raster.width-iw*fit)/2,(raster.height-ih*fit)/2,iw*fit,ih*fit);
      const photoMap=new THREE.CanvasTexture(raster);photoMap.colorSpace=THREE.SRGBColorSpace;map.dispose();
      backPanel.material.map.dispose();backPanel.material.map=photoMap;backPanel.material.needsUpdate=true;diorama.visible=false;void scale;
    },undefined,()=>{/* Sin imagen: queda el escenario. */});
    buildScene(plan.scene,diorama,mats);
    // El papel cuelga del borde superior: al descubrir el plan se levanta y desaparece.
    const paperPivot=new THREE.Group();paperPivot.position.set(0,OPEN_H/2,.065);group.add(paperPivot);
    const paperMap=texture(512,384,(g,w,h)=>{g.drawImage(paperBase.image,0,0);g.strokeStyle='rgba(185,160,120,.5)';g.lineWidth=2;g.strokeRect(14,14,w-28,h-28);
      g.textAlign='center';g.fillStyle='#a58a5c';g.font='500 18px "Segoe UI", Arial, sans-serif';g.letterSpacing='8px';g.fillText(`PLAN ${number(index)}`,w/2,h*.36);g.letterSpacing='0px';
      g.fillStyle='#5b4a36';g.font='italic 58px Georgia, "Times New Roman", serif';g.fillText('Próximamente',w/2,h*.58);
      g.strokeStyle='#c9b08a';g.lineWidth=2;g.beginPath();g.moveTo(w/2-60,h*.68);g.lineTo(w/2+60,h*.68);g.stroke();});
    const paperGeometry=new THREE.PlaneGeometry(OPEN_W+.04,OPEN_H+.04,12,8);paperGeometry.translate(0,-(OPEN_H+.04)/2,0);
    const p=paperGeometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(p.getX(i)*7+p.getY(i)*4)*.006);paperGeometry.computeVertexNormals();
    const paper=new THREE.Mesh(paperGeometry,new THREE.MeshStandardMaterial({map:paperMap,roughness:.95,transparent:true,side:THREE.DoubleSide}));paperPivot.add(paper);
    // Marcador del próximo capítulo: una cinta que cuelga del marco.
    const ribbon=new THREE.Group();ribbon.position.set(OPEN_W/2-.12,OPEN_H/2+.1,.09);ribbon.visible=false;group.add(ribbon);
    const ribbonShape=new THREE.Shape();ribbonShape.moveTo(-.05,0);ribbonShape.lineTo(.05,0);ribbonShape.lineTo(.05,-.52);ribbonShape.lineTo(0,-.46);ribbonShape.lineTo(-.05,-.52);ribbonShape.lineTo(-.05,0);
    ribbon.add(new THREE.Mesh(new THREE.ShapeGeometry(ribbonShape),new THREE.MeshLambertMaterial({color:'#a8413a',side:THREE.DoubleSide})));
    const ribbonTop=new THREE.Mesh(new THREE.BoxGeometry(.14,.05,.03),goldTrim);ribbon.add(ribbonTop);
    // Sobre pequeño con la invitación opcional, en la esquina inferior del marco.
    let envelope=null,envelopeHit=null;
    if(plan.invitation){
      envelope=new THREE.Group();envelope.position.set(-OPEN_W/2+.2,-OPEN_H/2+.16,.1);envelope.rotation.z=.08;envelope.visible=false;group.add(envelope);
      const envMap=texture(256,170,(g,w,h)=>{g.fillStyle='#fbf3e3';g.fillRect(0,0,w,h);g.strokeStyle='#c9b08a';g.lineWidth=3;g.strokeRect(3,3,w-6,h-6);g.beginPath();g.moveTo(3,3);g.lineTo(w/2,h*.58);g.lineTo(w-3,3);g.stroke();g.fillStyle='#a8413a';g.beginPath();g.arc(w/2,h*.58,16,0,Math.PI*2);g.fill();g.fillStyle='#f6e2c0';g.font='bold 16px Georgia, serif';g.textAlign='center';g.fillText('✦',w/2,h*.58+6);});
      envelope.add(new THREE.Mesh(new THREE.BoxGeometry(.3,.2,.012),new THREE.MeshLambertMaterial({map:envMap})));
      envelopeHit=new THREE.Mesh(new THREE.BoxGeometry(.42,.32,.1),new THREE.MeshBasicMaterial({visible:false}));envelope.add(envelopeHit);
    }
    const plaque=new THREE.Mesh(new THREE.PlaneGeometry(1.2,1.2*300/1024),new THREE.MeshBasicMaterial({map:plaqueTexture(`PLAN ${number(index)}`,'Una obra por crear','Próximamente'),toneMapped:false}));plaque.position.set(0,-OPEN_H/2-.48,.0);group.add(plaque);
    const hit=new THREE.Mesh(new THREE.BoxGeometry(OPEN_W+.3,OPEN_H+.3,.1),new THREE.MeshBasicMaterial({visible:false}));hit.position.z=.02;group.add(hit);
    const approach={x:fx+out[0]*2.6,z:fz+out[2]*2.6};
    const target={id:plan.id,index,focus:new THREE.Vector3(fx,FRAME_Y-.1,fz),approach,artwork:{x:fx,y:FRAME_Y-.15,z:fz,width:OPEN_W+.5,height:OPEN_H+.9,out},hits:[hit,plaque],marker:marker(approach.x,approach.z),glow:[frameMaterial],lift:inner,rise:[0,0,.0],
      halo:[fx+out[0]*.3,FRAME_Y,fz+out[2]*.3,2.4],paper,paperPivot,plaque,ribbon,envelope,revealedPlaque:false};
    targets.push(target);planTargets.push(target);
    if(envelopeHit){const envTarget={id:`invitation-${plan.id}`,plan:index,focus:target.focus,approach,artwork:target.artwork,hits:[envelopeHit],marker:null,glow:[],lift:envelope,rise:[0,.02,0],halo:[fx+out[0]*.3,FRAME_Y-.4,fz+out[2]*.3,.6]};targets.push(envTarget);}
  });
  // La mesa central con el libro abierto «Nuestro próximo capítulo».
  {
    const table=new THREE.Group();table.position.set(TABLE.x,0,TABLE.z);scene.add(table);
    const top=new THREE.Mesh(new THREE.BoxGeometry(TABLE.w,.06,TABLE.d),oak);top.position.y=TABLE.h;table.add(top);
    for(const sx of [-1,1])for(const sz of [-1,1]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.04,.03,TABLE.h,12),oak);leg.position.set(sx*(TABLE.w/2-.12),TABLE.h/2,sz*(TABLE.d/2-.12));table.add(leg);}
    for(const sx of [-1,1]){const apron=new THREE.Mesh(new THREE.BoxGeometry(.04,.14,TABLE.d-.2),oak);apron.position.set(sx*(TABLE.w/2-.1),TABLE.h-.1,0);table.add(apron);}
    for(const sz of [-1,1]){const apron=new THREE.Mesh(new THREE.BoxGeometry(TABLE.w-.2,.14,.04),oak);apron.position.set(0,TABLE.h-.1,sz*(TABLE.d/2-.1));table.add(apron);}
    const cover=new THREE.Mesh(new THREE.BoxGeometry(.98,.03,.66),new THREE.MeshLambertMaterial({color:'#7d3b33'}));cover.position.set(0,TABLE.h+.045,.02);table.add(cover);
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=680;
    const pageMap=new THREE.CanvasTexture(canvas);pageMap.colorSpace=THREE.SRGBColorSpace;pageMap.anisotropy=4;
    bookPage={canvas,map:pageMap};
    const pagesGeometry=new THREE.PlaneGeometry(.94,.62,20,1),pp=pagesGeometry.attributes.position;
    for(let i=0;i<pp.count;i++){const x=pp.getX(i);pp.setZ(i,Math.abs(x)<.47?Math.sin(Math.abs(x)/.47*Math.PI)*.025+Math.abs(x)*.03:0);}
    pagesGeometry.computeVertexNormals();
    const pages=new THREE.Mesh(pagesGeometry,new THREE.MeshLambertMaterial({map:pageMap}));pages.rotation.x=-Math.PI/2;pages.position.set(0,TABLE.h+.065,.02);table.add(pages);
    const vase=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,.22,16),new THREE.MeshLambertMaterial({color:'#e8e2d4'}));vase.position.set(.78,TABLE.h+.14,-.28);table.add(vase);
    for(let i=0;i<3;i++){const stem=new THREE.Mesh(new THREE.CylinderGeometry(.004,.004,.3,5),new THREE.MeshLambertMaterial({color:'#7c9a6a'}));stem.position.set(.78+(i-1)*.03,TABLE.h+.36,-.28);stem.rotation.z=(i-1)*.25;table.add(stem);
      const bloom=new THREE.Mesh(new THREE.SphereGeometry(.035,10,8),new THREE.MeshLambertMaterial({color:['#f2c2b0','#fbe6c2','#e9a08c'][i]}));bloom.position.set(.78+(i-1)*.07,TABLE.h+.51,-.28);table.add(bloom);}
    const pen=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.18,8),goldTrim);pen.rotation.set(0,0,Math.PI/2);pen.rotation.y=.4;pen.position.set(-.7,TABLE.h+.04,.25);table.add(pen);
    const bookHit=new THREE.Mesh(new THREE.BoxGeometry(1.2,.4,.9),new THREE.MeshBasicMaterial({visible:false}));bookHit.position.set(0,TABLE.h+.12,.02);table.add(bookHit);
    bookTarget={id:'book',focus:new THREE.Vector3(TABLE.x,TABLE.h,TABLE.z+.05),approach:{x:TABLE.x,z:TABLE.z+TABLE.d/2+1.25},hits:[bookHit,pages],marker:marker(TABLE.x,TABLE.z+TABLE.d/2+1.25,.5),glow:[],lift:pages,rise:[0,.015,0],halo:[TABLE.x,TABLE.h+.2,TABLE.z,1.6]};
    targets.push(bookTarget);
    // Quinta pista: una pequeña brújula en el costado izquierdo de la mesa, alcanzable desde el pasillo.
    const compass=new THREE.Group();compass.position.set(-TABLE.w/2+.07,TABLE.h-.1,0);compass.rotation.y=-Math.PI/2;table.add(compass);
    const compassMaterial=new THREE.MeshStandardMaterial({color:'#e2bf72',metalness:1,roughness:.25,emissive:'#6a4a14',emissiveIntensity:.2});
    const face=new THREE.Mesh(new THREE.CircleGeometry(.06,24),new THREE.MeshBasicMaterial({color:'#fbf3e3'}));face.position.z=.032;compass.add(face);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.062,.008,8,28),compassMaterial);rim.position.z=.032;compass.add(rim);
    const needleShape=new THREE.Shape();needleShape.moveTo(0,.05);needleShape.lineTo(.012,0);needleShape.lineTo(0,-.05);needleShape.lineTo(-.012,0);needleShape.lineTo(0,.05);
    const needle=new THREE.Mesh(new THREE.ShapeGeometry(needleShape),new THREE.MeshBasicMaterial({color:'#a8413a'}));needle.position.z=.036;needle.rotation.z=-.5;compass.add(needle);
    const clueHit=new THREE.Mesh(new THREE.SphereGeometry(.17,12,8),new THREE.MeshBasicMaterial({visible:false}));clueHit.position.z=.08;compass.add(clueHit);
    const world=new THREE.Vector3(TABLE.x-TABLE.w/2+.04,TABLE.h-.1,TABLE.z);
    clueTarget={id:'clue',focus:world.clone(),approach:{x:TABLE.x-TABLE.w/2-1.15,z:TABLE.z},hits:[clueHit],marker:null,glow:[compassMaterial],lift:compass,rise:[0,.01,0],halo:[world.x-.06,world.y,world.z,.42],needle};
    targets.push(clueTarget);
  }
  // Puerta de regreso al vestíbulo: detrás de la cámara, por donde se entra.
  {
    const door=new THREE.Group();door.position.set(0,0,FRONT-.04);door.rotation.y=Math.PI;scene.add(door);
    const W=1.4,H=2.45;
    const ring=(w,h,grow,inner)=>{const o=new THREE.Shape();o.moveTo(-w/2-grow,-.02);o.lineTo(w/2+grow,-.02);o.lineTo(w/2+grow,h+grow);o.lineTo(-w/2-grow,h+grow);o.lineTo(-w/2-grow,-.02);const i=new THREE.Path();i.moveTo(-w/2-inner,0);i.lineTo(-w/2-inner,h+inner);i.lineTo(w/2+inner,h+inner);i.lineTo(w/2+inner,0);i.lineTo(-w/2-inner,0);o.holes.push(i);return o;};
    const extrude=(shape,depth)=>new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:2,curveSegments:32});
    door.add(new THREE.Mesh(extrude(ring(W,H,.26,.12),.12),oak));door.add(new THREE.Mesh(extrude(ring(W,H,.12,0),.16),goldTrim));
    const beyond=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.MeshBasicMaterial({color:'#ffe4b4',toneMapped:false}));beyond.position.set(0,H/2,.004);door.add(beyond);
    const leafMap=texture(256,512,(g,w,h)=>{const grad=g.createLinearGradient(0,0,w,0);grad.addColorStop(0,'#a07c56');grad.addColorStop(.5,'#c29d72');grad.addColorStop(1,'#a07c56');g.fillStyle=grad;g.fillRect(0,0,w,h);
      for(let i=0;i<60;i++){g.strokeStyle=`rgba(90,60,30,${.06+rand()*.1})`;g.lineWidth=1;g.beginPath();const x=rand()*w;g.moveTo(x,0);g.bezierCurveTo(x+(rand()-.5)*20,h*.33,x+(rand()-.5)*20,h*.66,x+(rand()-.5)*14,h);g.stroke();}
      g.fillStyle='rgba(255,246,225,.75)';g.fillRect(40,40,w-80,200);g.strokeStyle='#8a6a44';g.lineWidth=4;g.strokeRect(40,40,w-80,200);g.strokeRect(40,290,w-80,180);});
    const leafMaterial=new THREE.MeshStandardMaterial({map:leafMap,roughness:.55}),leaves=[];
    for(const side of [-1,1]){const hinge=new THREE.Group();hinge.position.set(side*W/2,0,.03);door.add(hinge);
      const leaf=new THREE.Mesh(new THREE.BoxGeometry(W/2-.01,H-.01,.06),leafMaterial);leaf.position.set(-side*(W/4),H/2,0);hinge.add(leaf);
      const handle=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.34,10),goldTrim);handle.position.set(-side*(W/2-.12),1.2,.06);hinge.add(handle);leaves.push({hinge,side,leaf});}
    const plateMap=texture(512,160,(g,w,h)=>{const grad=g.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#f6efe2');grad.addColorStop(1,'#eadfca');g.fillStyle=grad;g.fillRect(0,0,w,h);
      g.strokeStyle='#c9b48e';g.lineWidth=4;g.strokeRect(2,2,w-4,h-4);
      g.textAlign='center';g.fillStyle='#9a7b45';g.font='500 18px "Segoe UI", Arial, sans-serif';g.letterSpacing='6px';g.fillText('SALIDA',w/2,52);g.letterSpacing='0px';g.fillStyle='#4a3c2c';g.font='italic 54px Georgia, "Times New Roman", serif';g.fillText('Vestíbulo',w/2,118);});
    const plate=new THREE.Mesh(new THREE.PlaneGeometry(1.15,.36),new THREE.MeshBasicMaterial({map:plateMap,toneMapped:false}));plate.position.set(0,H+.55,.06);door.add(plate);
    const doorHit=new THREE.Mesh(new THREE.BoxGeometry(W+.3,H+1,.12),new THREE.MeshBasicMaterial({visible:false}));doorHit.position.set(0,(H+1)/2,.1);door.add(doorHit);
    exitTarget={id:'exit',focus:new THREE.Vector3(0,1.45,FRONT),approach:{x:0,z:FRONT-2.5},hits:[doorHit,...leaves.map(item=>item.leaf),plate],marker:marker(0,FRONT-1,.55),glow:[leafMaterial],lift:plate,rise:[0,.04,0],halo:[0,1.5,FRONT-.2,2.6],leaves};
    targets.push(exitTarget);
  }
  for(const target of targets){
    for(const material of target.glow){material.emissive=new THREE.Color('#c9a564');material.emissiveIntensity=0;}
    target.base=target.lift.position.clone();target.h=0;
    const [x,y,z,size]=target.halo;
    target.haloSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:dotMap,color:'#ffe2a8',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
    target.haloSprite.position.set(x,y,z);target.haloSprite.scale.setScalar(size);scene.add(target.haloSprite);
  }
  ping=new THREE.Mesh(new THREE.RingGeometry(.18,.24,40),new THREE.MeshBasicMaterial({color:'#b89b66',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));ping.rotation.x=-Math.PI/2;ping.position.y=.012;ping.userData.t=1;scene.add(ping);
  // Motas de luz que suben despacio, como un comienzo.
  const COUNT=small?90:170,dust=new Float32Array(COUNT*3),speeds=new Float32Array(COUNT);
  for(let i=0;i<COUNT;i++){dust.set([(rand()-.5)*11,rand()*WALL_H,BACK+rand()*depth],i*3);speeds[i]=.04+rand()*.08;}
  const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(dust,3));
  const motes=new THREE.Points(dustGeometry,new THREE.PointsMaterial({map:dotMap,size:.035,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending,color:'#ffe9c4'}));
  motes.frustumCulled=false;scene.add(motes);let lastDust=performance.now();
  motes.onBeforeRender=()=>{const now=performance.now(),dt=Math.min((now-lastDust)/1000,.05);lastDust=now;if(reducedMotion.matches)return;const p=dustGeometry.attributes.position;for(let i=0;i<COUNT;i++){let y=p.getY(i)+speeds[i]*dt;if(y>WALL_H)y=0;p.setY(i,y);}p.needsUpdate=true;};
  firstFrame=new Promise(resolve=>$('#future-stage').addEventListener('gallery:ready',resolve,{once:true}));
  engine=createGallery({container:$('#future-stage'),scene,camera,obstacles,targets,floor,bounds:BOUNDS,onTarget:setTarget,onActivate:target=>openTarget(target),onUnavailable:fallbackMode,onTap,onSwipe,onHover:target=>{hoverTarget=target;},onBack:()=>{if(noteOpen)closeNote();else if(focused)stepBack();},onFrame:animate});
  engine.renderer.toneMappingExposure=.95;
  const pmrem=new THREE.PMREMGenerator(engine.renderer),environment=new RoomEnvironment();
  scene.environment=pmrem.fromScene(environment,.04).texture;scene.environmentIntensity=.5;environment.dispose();pmrem.dispose();
  engine.setActive(true);
  setTarget(null);updateProgress();
}

/* El libro de la mesa: título y, si hay una elección, el plan con su dedicatoria. */
function drawBook() {
  if(!bookPage)return;
  const g=bookPage.canvas.getContext('2d'),w=bookPage.canvas.width,h=bookPage.canvas.height,choice=chosen();
  g.fillStyle='#fbf6ea';g.fillRect(0,0,w,h);
  const shade=g.createLinearGradient(w/2-60,0,w/2+60,0);shade.addColorStop(0,'rgba(120,96,60,0)');shade.addColorStop(.5,'rgba(120,96,60,.22)');shade.addColorStop(1,'rgba(120,96,60,0)');g.fillStyle=shade;g.fillRect(w/2-60,0,120,h);
  g.textAlign='center';
  g.fillStyle='#9a7b45';g.font='500 20px "Segoe UI", Arial, sans-serif';g.letterSpacing='6px';g.fillText('CAPÍTULO SIGUIENTE',w/4,h*.3);g.letterSpacing='0px';
  g.fillStyle='#4a3c2c';g.font='italic 46px Georgia, "Times New Roman", serif';wrapText(g,book.title||'Nuestro próximo capítulo',w/4,h*.45,w/2-120,54,2);
  g.fillStyle='#b89b66';g.font='34px Georgia, serif';g.fillText('✧',w/4,h*.72);
  if(choice){
    g.fillStyle='#9a7b45';g.font='500 18px "Segoe UI", Arial, sans-serif';g.letterSpacing='5px';g.fillText('EMPEZAREMOS POR',w*.75,h*.22);g.letterSpacing='0px';
    g.fillStyle='#4a3c2c';g.font='italic 40px Georgia, "Times New Roman", serif';const lines=wrapText(g,choice.title,w*.75,h*.34,w/2-110,46,2);
    g.fillStyle='#6f6048';g.font='26px Georgia, "Times New Roman", serif';wrapText(g,text(choice.dedication),w*.75,h*.34+lines*46+30,w/2-120,34,5);
  } else {
    g.fillStyle='#8a7a62';g.font='italic 28px Georgia, "Times New Roman", serif';wrapText(g,book.empty||'',w*.75,h*.42,w/2-130,38,4);
  }
  bookPage.map.needsUpdate=true;
}

async function enterRoom() {
  const cover=()=>{
    Museum.showView(ROOM_ID);
    if(!initialized){initialized=true;try{buildRoom();}catch(error){console.warn('Sala 05 sin 3D:',error);fallbackMode();}}
    engine?.setActive(true);updateProgress();
  };
  const opened=await Museum.playDoors({lines:['Abriendo las ventanas…','Preparando lo que viene…','Lo que todavía nos espera.'],cover,ready:()=>fallback?null:firstFrame,minimum:1500,variant:'room-05',plate:'05',label:'SALA 05 · LO QUE TODAVÍA NOS ESPERA',title:room.title});
  if(!opened)cover();
  $('#future-title').setAttribute('tabindex','-1');$('#future-title').focus({preventScroll:true});
  if(!Museum.tutorialSeen('room'))Museum.openTutorial('room',$('#future-help'));
}
function buzz(pattern){try{if(matchMedia('(pointer: coarse)').matches&&navigator.userActivation?.hasBeenActive)navigator.vibrate?.(pattern);}catch{/* Sin vibración. */}}
function resume(){if(!$('#museum-dialog').open)engine?.setPaused(false);}
function rememberPose() {
  if(!engine||returnPose)return;
  const position=engine.camera.position,direction=engine.camera.getWorldDirection(new THREE.Vector3());
  returnPose={x:position.x,z:position.z,focus:new THREE.Vector3(position.x+direction.x*4,1.65+direction.y*4,position.z+direction.z*4)};
}
function goTo(target,{open=true,source=null}={}) {
  closeNote(false,false);resume();
  if(target.artwork)focusArtwork(engine.camera,target,BOUNDS);
  $('#future-screen').classList.toggle('viewing-art',!!target.artwork);
  if(target.index!==undefined)currentPlan=target.index;
  if(target.id!=='exit')rememberPose();
  if(focused===target&&!engine.isFlying()){if(open)openTarget(target,source||undefined);return;}
  const previous=$('#future-target-name').textContent;
  $('#future-target-name').textContent=`Hacia: ${nameOf(target)}`;
  flyingTo=target;focused=null;
  const ok=engine.guideTo(target,{onArrive:()=>{flyingTo=null;focused=target;if(open)openTarget(target,source||undefined);}});
  if(ok)return;
  flyingTo=null;$('#future-target-name').textContent=previous;
  if(open&&engine.camera.position.distanceTo(target.focus)<5.5)openTarget(target,source||undefined);
  else Museum.notify('Puedes acercarte caminando por la sala.');
}
function guidePlan(index,source=null){currentPlan=index;if(fallback||!engine){openPlan(index,source||undefined);return;}goTo(planTargets[index],{source});}
function stepBack() {
  closeNote(false,false);
  if(!engine)return;
  resume();focused=null;flyingTo=null;returnPose=null;
  engine.guideTo({id:'overview',focus:new THREE.Vector3(0,1.9,BACK),approach:{x:0,z:FRONT-1.4},hits:[],marker:null},{select:false});
}
function walkTo(point) {
  closeNote(false,false);
  const camera=engine.camera.position;
  let x=THREE.MathUtils.clamp(point.x,BOUNDS.minX,BOUNDS.maxX),z=THREE.MathUtils.clamp(point.z,BOUNDS.minZ,BOUNDS.maxZ);
  for(let i=0;i<14&&!isWalkable(x,z,obstacles,BOUNDS);i++){x+=(camera.x-x)*.22;z+=(camera.z-z)*.22;}
  const dx=x-camera.x,dz=z-camera.z,length=Math.hypot(dx,dz);
  if(!isWalkable(x,z,obstacles,BOUNDS)||length<.3)return;
  resume();focused=null;flyingTo=null;returnPose=null;
  if(ping){ping.position.x=x;ping.position.z=z;ping.userData.t=0;}
  engine.guideTo({id:'floor',focus:new THREE.Vector3(x+dx/length*4,1.65,z+dz/length*4),approach:{x,z},hits:[],marker:null},{select:false});
}
function onTap(target,point) {
  if(noteOpen||revealing)return;
  if(target)goTo(target);
  else if(point)walkTo(point);
  else if(focused)stepBack();
}
function onSwipe(direction,restoreView) {
  if(noteOpen||revealing||!focused||focused.index===undefined)return;
  restoreView();
  if(direction==='down'){stepBack();return;}
  const count=planTargets.length;goTo(planTargets[(focused.index+(direction==='left'?1:count-1))%count]);
}
const easeInOut=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
// «Descubrir este plan»: aparece al acercarse a un marco que todavía no se ha abierto.
function syncPill() {
  let next=null;
  if(engine&&!noteOpen&&!revealing&&!engine.isFlying()&&selected?.index!==undefined&&!$('#future-screen').hidden){
    const distance=Math.hypot(engine.camera.position.x-selected.focus.x,engine.camera.position.z-selected.focus.z);
    if(distance<4.6)next=selected;
  }
  if(next===pillTarget)return;
  pillTarget=next;const pill=$('#future-discover');
  pill.hidden=!next;
  if(next)pill.textContent=revealed(plans[next.index])?`Ver «${plans[next.index].title}»`:'Descubrir este plan';
}
function animate(dt) {
  if(exitTarget){exitOpen+=((exitOpening?1:0)-exitOpen)*(reducedMotion.matches?1:Math.min(1,dt*4));for(const {hinge,side} of exitTarget.leaves)hinge.rotation.y=side*exitOpen*1.75;}
  // El papel se levanta desde el borde superior y se desvanece; con movimiento reducido, solo un fundido breve.
  if(revealing){
    const r=revealing;r.t=Math.min(1,r.t+dt/(reducedMotion.matches?.3:1.3));const k=easeInOut(r.t);
    if(reducedMotion.matches){r.target.paper.material.opacity=1-k;}
    else{r.target.paperPivot.rotation.x=-k*2.1;r.target.paper.material.opacity=1-Math.max(0,(k-.45)/.55);}
    if(r.t>=1){r.target.paper.visible=false;revealing=null;r.done();}
  }
  if(clueTarget&&!reducedMotion.matches)clueTarget.needle.rotation.z=-.5+Math.sin(performance.now()/900)*.25;
  const ease=reducedMotion.matches?1:Math.min(1,dt*8);
  for(const target of targets){
    const goal=!noteOpen&&(hoverTarget===target||flyingTo===target)?1:0;
    target.h+=(goal-target.h)*ease;
    const h=target.h,[rx,ry,rz]=target.rise;
    target.lift.position.set(target.base.x+rx*h,target.base.y+ry*h,target.base.z+rz*h);
    for(const material of target.glow)material.emissiveIntensity=h*.3;
    target.haloSprite.material.opacity=h*.24;
    if(target.marker)target.marker.material.opacity=Math.max(engine.getSelected()===target?.9:.16,.16+h*.74);
  }
  if(ping&&ping.userData.t<1){ping.userData.t=Math.min(1,ping.userData.t+dt*1.4);const t=ping.userData.t;ping.scale.setScalar(1+t*2.2);ping.material.opacity=(1-t)*.8;}
  if(focused&&!noteOpen&&!engine.isFlying()&&Math.hypot(engine.camera.position.x-focused.approach.x,engine.camera.position.z-focused.approach.z)>.6){focused=null;returnPose=null;}
  syncPill();
}

/* Notas laterales: las mismas de las otras salas. Mientras están abiertas, la cámara no se mueve. */
let noteSource=null;
function closeNote(restoreFocus=true,returnBack=true) {
  const note=$('#future-note');$('#future-screen').classList.remove('viewing-art');
  if(note.hidden)return;
  note.hidden=true;$('#future-note-content').replaceChildren();noteOpen=false;engine?.setLocked(false);
  if(restoreFocus)(noteSource?.isConnected&&!noteSource.closest('[hidden]')?noteSource:$('#future-stage')).focus({preventScroll:true});
  noteSource=null;
  const pose=returnPose;returnPose=null;
  if(returnBack&&engine&&pose){focused=null;resume();engine.guideTo({id:'return',focus:pose.focus,approach:{x:pose.x,z:pose.z},hits:[],marker:null},{select:false});}
}
function showNote({eyebrow,title,body,source=$('#future-stage'),art=false}) {
  noteSource=source;
  $('#future-note-content').innerHTML=`<p class="eyebrow">${escape(eyebrow)}</p><h2 id="future-note-title" tabindex="-1">${escape(title)}</h2>${body}`;
  $('#future-note').hidden=false;noteOpen=true;engine?.setLocked(true);$('#future-screen').classList.toggle('viewing-art',art);
  pillTarget=undefined;$('#future-discover').hidden=true;
  $('#future-note-title').focus({preventScroll:true});
}
$('#close-future-note').addEventListener('click',()=>closeNote());
$('#future-note').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeNote();}});
function discover(id) {
  const progress=Museum.discoverPiece(ROOM_ID,id);
  buzz(progress.newlyCompleted?[30,60,45]:14);
  updateProgress();
  if(progress.newlyCompleted)celebrate();
  return progress;
}
// Un plan: primero se retira el papel; después, la nota con título, descripción, dedicatoria y acciones opcionales.
function openPlan(index,source=$('#future-stage')) {
  const plan=plans[index],target=planTargets[index];currentPlan=index;
  if(!revealed(plan)&&target&&!fallback&&engine){
    if(revealing)return;
    engine.setLocked(true);pillTarget=undefined;$('#future-discover').hidden=true;
    target.paper.visible=true;
    revealing={target,t:0,done:()=>{engine.setLocked(false);discover(plan.id);showPlan(index,source);}};
    return;
  }
  if(!revealed(plan))discover(plan.id);
  showPlan(index,source);
}
function showPlan(index,source) {
  const plan=plans[index],choice=chosen(),mine=choice?.id===plan.id;
  const action=mine
    ?`<p class="future-chosen" role="status">✓ Guardado en «${escape(book.title||'Nuestro próximo capítulo')}»</p><button id="future-unchoose" class="text-button" type="button">Quitar elección</button>`
    :`<button id="future-choose" class="button primary" type="button">${escape(book.choose||'Me gustaría empezar por este')}</button>${choice?`<p class="future-choice-note">Reemplazará «${escape(choice.title)}» en el libro.</p>`:''}`;
  showNote({eyebrow:`PLAN ${number(index)} DE ${number(plans.length-1)} · UNA INVITACIÓN DE ${config.sender.toUpperCase()}`,title:plan.title,source,art:true,body:`
    <p class="room-note-description">${escape(text(plan.description||''))}</p>
    <p class="room-note-dedication">${escape(text(plan.dedication||''))}</p>
    <div class="future-actions">${plan.invitation?'<button id="future-invite" class="button secondary" type="button"><span aria-hidden="true">✉</span> Abrir invitación</button>':''}${action}</div>
    <p class="future-choice-note">Elegir es opcional y solo se guarda en este dispositivo.</p>`});
  $('#future-invite')?.addEventListener('click',event=>openInvitation(index,event.currentTarget));
  $('#future-choose')?.addEventListener('click',()=>{Museum.setNextChapter(plan.id);buzz(14);showPlan(index,source);});
  $('#future-unchoose')?.addEventListener('click',()=>{Museum.setNextChapter(null);showPlan(index,source);});
}
// La tarjeta muestra solo los datos configurados; no hay botones de respuesta ni confirmaciones.
function openInvitation(index,source) {
  const plan=plans[index],card=plan.invitation;if(!card)return;
  const pose=returnPose;
  const rows=[['Fecha',card.date],['Hora',card.time],['Lugar',card.place]].filter(([,value])=>String(value||'').trim());
  Museum.openContent({className:'future-invitation',source,onClose:()=>{if(!$('#future-screen').hidden&&revealed(plan)){returnPose=pose;showPlan(index,$('#future-stage'));}},
    html:`<article class="invitation-card"><p class="eyebrow">UNA INVITACIÓN DE ${escape(config.sender.toUpperCase())}</p><h2 id="dialog-title">${escape(plan.title)}</h2>${rows.length?`<dl>${rows.map(([label,value])=>`<div><dt>${label}</dt><dd>${escape(text(value))}</dd></div>`).join('')}</dl>`:''}${card.message?`<p class="invitation-message">${escape(text(card.message))}</p>`:''}<p class="invitation-sign">${escape(config.sender)}</p></article>`});
}
function openBook(source=$('#future-stage')) {
  const choice=chosen();
  showNote({eyebrow:'EL LIBRO DE LA MESA',title:book.title||'Nuestro próximo capítulo',source,body:choice
    ?`<p class="room-note-description">${escape(choice.title)}</p><p class="room-note-dedication">${escape(text(choice.dedication||''))}</p><div class="future-actions"><button id="future-book-unchoose" class="text-button" type="button">Quitar elección</button></div><p class="future-choice-note">Puedes cambiarla desde cualquier otro plan descubierto.</p>`
    :`<p class="room-note-dedication">${escape(book.empty||'')}</p>`});
  $('#future-book-unchoose')?.addEventListener('click',()=>{Museum.setNextChapter(null);openBook(source);});
}
function openClue(source=$('#future-stage')) {
  const added=Museum.findClue(room.clue.id);buzz(14);
  const progress=Museum.getProgress();
  showNote({eyebrow:added?'PISTA ENCONTRADA':'UNA PISTA YA ENCONTRADA',title:'Una brújula pequeña',source,body:`<p class="room-note-description">Una brújula dorada, en el costado de la mesa del libro.</p><p class="room-note-dedication">${escape(room.clue.message)}</p><p class="room-note-reward" role="status">Pistas encontradas: ${progress.clues.length} de ${config.clueIds.length}${progress.cluesComplete?`. ${escape(config.texts.cluesComplete)}.`:''}</p>`});
  updateProgress();
}
function celebrate() {
  $('#future-screen .moments-stamp')?.remove();
  const stamp=document.createElement('div');stamp.className='moments-stamp';stamp.setAttribute('role','status');
  stamp.innerHTML=`<div class="stamp-page" aria-hidden="true"><div class="new-stamp"><span>SALA 05</span><b>✧</b><span>LO QUE NOS ESPERA</span></div></div><p>${escape(room.completionMessage)}</p><button class="text-button" type="button">Seguir explorando</button>`;
  $('#future-screen').append(stamp);
  const close=()=>stamp.remove();
  stamp.querySelector('button').addEventListener('click',close);
  setTimeout(close,reducedMotion.matches?9000:7000);
}
function openExit() {
  closeNote(false,false);
  if(exitOpening)return;
  exitOpening=true;
  setTimeout(async()=>{await Museum.returnToLobby();exitOpening=false;exitOpen=0;},reducedMotion.matches?0:750);
}
function openTarget(target=selected,source){
  if(!target)return;
  if(target.id==='exit')openExit();
  else if(target.id==='clue')openClue(source);
  else if(target.id==='book')openBook(source);
  else if(target.plan!==undefined){if(revealed(plans[target.plan]))openInvitation(target.plan,source||$('#future-stage'));else openPlan(target.plan,source);}
  else openPlan(target.index,source);
}
function openHelp(source) {
  const panel=$('#future-help-panel');
  Museum.openContent({className:'room-help-sheet',source,html:'<div class="dialog-heading"><p class="eyebrow">SALA 05 · AYUDA</p><h2 id="dialog-title">Tu recorrido</h2></div><button class="button primary help-tutorial" type="button">Ver cómo moverse</button>',onClose:()=>{panel.hidden=true;$('#future-screen').append(panel);}});
  $('#dialog-content').append(panel);panel.hidden=false;
  $('#dialog-content .help-tutorial').addEventListener('click',()=>Museum.openTutorial('room',source));
}
function tourAction(key) {
  if(key==='book')return ()=>fallback||!engine?openBook():goTo(bookTarget);
  return ()=>guidePlan(Number(key.slice(1)));
}

Museum.registerRoom(ROOM_ID,enterRoom);
const step=offset=>{const from=focused&&focused.index!==undefined?focused.index:currentPlan;guidePlan(from<0?(offset>0?0:plans.length-1):(from+offset+plans.length)%plans.length);};
$('#future-prev').addEventListener('click',()=>step(-1));
$('#future-next').addEventListener('click',()=>step(1));
$('#future-book-key').addEventListener('click',()=>tourAction('book')());
$('#future-discover').addEventListener('click',event=>{if(pillTarget)goTo(pillTarget,{source:event.currentTarget});});
$('#future-exit-door').addEventListener('click',event=>{if(fallback||!engine||!exitTarget){Museum.returnToLobby();return;}goTo(exitTarget,{source:event.currentTarget});});
$('#future-stage').addEventListener('keydown',event=>{
  if(event.target.closest('button')||noteOpen)return;
  const offset=event.key==='<'||event.key===','?-1:event.key==='>'||event.key==='.'?1:0;
  if(!offset)return;event.preventDefault();step(offset);
});
document.querySelectorAll('[data-future-tour]').forEach(button=>button.addEventListener('click',()=>{const action=tourAction(button.dataset.futureTour);Museum.closeOverlay();setTimeout(action,0);}));
$('#future-help').addEventListener('click',event=>openHelp(event.currentTarget));
$('#future-back').addEventListener('click',()=>{closeNote(false,false);Museum.returnToLobby();});
$('#future-passport').addEventListener('click',event=>Museum.openPassport(event.currentTarget));
$('#future-clue-hint').addEventListener('click',()=>Museum.notify(room.clue.hint));
$('#future-accessible-clue').addEventListener('click',event=>openClue(event.currentTarget));
document.addEventListener('museum:progress',updateProgress);
document.addEventListener('museum:next-chapter',updateProgress);
document.addEventListener('museum:overlay',event=>{engine?.setPaused(event.detail);});
document.addEventListener('museum:screen',event=>{
  const here=event.detail===ROOM_ID;
  if(!here){closeNote(false,false);$('#future-screen .moments-stamp')?.remove();pillTarget=undefined;$('#future-discover').hidden=true;}
  engine?.setActive(here);
});
updateProgress();
