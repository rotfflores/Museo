/* Sala 06 · Una obra para ti: el cierre del recorrido. Una gran obra cubierta, un banco, la carta y la vitrina secreta.
   Mismo motor, gestos, notas laterales, barra y puertas que las salas anteriores. */
import * as THREE from './vendor/three.module.min.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {createGallery,focusArtwork} from './gallery-engine.js';
import {isWalkable} from './navigation.mjs';

const Museum=window.Museum,config=window.MUSEUM_CONFIG,room=config.artworkRoom;
const ROOM_ID='artwork';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text=value=>String(value??'').replace(/\{(sender|recipient)\}/g,(_,key)=>config[key]);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const piece=room.centerpiece,letter=room.letter,vitrine=room.vitrine||{},video=room.video;
const PIECE_ID=piece.id||'obra-final',LETTER_ID=letter.id||'carta';
// Cada símbolo corresponde, en orden, a la pista de una de las primeras cinco salas.
const SYMBOLS=[['key','Llave'],['camera','Cámara'],['flower','Flor'],['star','Estrella'],['compass','Brújula']];

// Planta: una sala alta y recogida. La obra en un nicho al fondo; el banco delante; la carta a la izquierda y la vitrina a la derecha.
const HALF=6,BACK=-7,FRONT=5,WALL_H=5.2,ART_Y=2.55,ART_W=3.1,ART_H=2.3;
const BOUNDS={minX:-5.4,maxX:5.4,minZ:-5.9,maxZ:FRONT-.6};
const BENCH={x:0,z:-2.4},DESK={x:-3.9,z:-3.4},CASE={x:3.9,z:-3.4};
const obstacles=[
  {minX:BENCH.x-1.15,maxX:BENCH.x+1.15,minZ:BENCH.z-.38,maxZ:BENCH.z+.38},
  {minX:DESK.x-.85,maxX:DESK.x+.85,minZ:DESK.z-.5,maxZ:DESK.z+.5},
  {minX:CASE.x-.55,maxX:CASE.x+.55,minZ:CASE.z-.55,maxZ:CASE.z+.55},
  {minX:-2.2,maxX:2.2,minZ:BACK,maxZ:-6.05}
];

let engine=null,initialized=false,fallback=false,selected=null,focused=null,flyingTo=null,hoverTarget=null,ping=null,firstFrame=null,returnPose=null,noteOpen=false;
let exitTarget=null,exitOpen=0,exitOpening=false,pieceTarget=null,letterTarget=null,caseTarget=null,cloth=null,pieceSpot=null,namePlate=null,sheet=null,lid=null,giftCard=null,symbolMeshes=[];
let anim=null;
const targets=[];

{const words=room.title.split(' '),last=words.pop();$('#artwork-title').innerHTML=words.length?`${escape(words.join(' '))} <em>${escape(last)}</em>`:escape(last);}
$('#artwork-subtitle').textContent=room.subtitle;
$('#artwork-tour').innerHTML=[
  `<button class="tour-stop" data-artwork-tour="piece" type="button"><span class="tour-number">01</span><span>${escape(piece.plaque||'La obra')}<small>La obra central</small></span><span class="tour-check" aria-label="Pendiente">○</span></button>`,
  `<button class="tour-stop" data-artwork-tour="letter" type="button"><span class="tour-number">02</span><span>Mi carta para ti<small>El escritorio</small></span><span class="tour-check" aria-label="Pendiente">○</span></button>`,
  `<button class="tour-stop" data-artwork-tour="vitrine" type="button"><span class="tour-number">✧</span><span>La vitrina secreta<small>Opcional · se abre con las cinco pistas</small></span><span class="tour-check" aria-hidden="true"></span></button>`
].join('');

const found=()=>Museum.getProgress().discoveries[ROOM_ID]||[];
const revealed=()=>found().includes(PIECE_ID);
const letterRead=()=>found().includes(LETTER_ID);
const completed=()=>Museum.getProgress().completed.includes(ROOM_ID);
const cluesFound=()=>Museum.getProgress().clues;
const missingClueRooms=()=>config.clueIds.map((id,index)=>({id,room:config.rooms[index]})).filter(item=>!cluesFound().includes(item.id));
function updateProgress() {
  const progress=Museum.getProgress(),pieceState=`La obra: ${revealed()?'descubierta':'cubierta'}`,letterState=`La carta: ${letterRead()?'leída':'sin abrir'}`;
  $('#artwork-counter').textContent=completed()?`${progress.completed.length} de 6 salas completadas`:`${pieceState} · ${letterState}`;
  $('#artwork-piece-state').textContent=pieceState;$('#artwork-letter-state').textContent=letterState;
  $('#artwork-clue-count').textContent=`Pistas encontradas: ${progress.clues.length} de ${config.clueIds.length}${Museum.vitrineOpened()?' · vitrina abierta':''}`;
  $('#artwork-passport-count').textContent=`${progress.completed.length}/6`;
  $('#artwork-open-final').hidden=!completed();
  document.querySelectorAll('[data-artwork-tour]').forEach(button=>{
    const key=button.dataset.artworkTour;if(key==='vitrine')return;
    const done=key==='piece'?revealed():letterRead(),check=button.querySelector('.tour-check');
    button.classList.toggle('discovered',done);check.textContent=done?'✧':'○';check.setAttribute('aria-label',done?'Hecho':'Pendiente');
  });
  if(cloth&&revealed()&&anim?.kind!=='cloth'){cloth.visible=false;if(pieceSpot)pieceSpot.intensity=pieceSpot.userData.on;if(namePlate)namePlate.visible=true;}
  symbolMeshes.forEach((mesh,index)=>{const on=progress.clues.includes(config.clueIds[index]);mesh.material.color.set(on?'#ffd98a':'#6b5a44');mesh.material.opacity=on?1:.55;});
  if(lid&&Museum.vitrineOpened()&&anim?.kind!=='lid'){lid.rotation.x=-1.25;if(giftCard)giftCard.visible=true;}
}
function nameOf(target) {
  if(!target)return room.subtitle;
  return {exit:'La puerta al vestíbulo',piece:revealed()?`${config.couple} · ${config.celebration}`:(piece.plaque||'La obra cubierta'),letter:`Una carta para ${config.recipient}`,vitrine:'La vitrina secreta',bench:'El banco frente a la obra'}[target.id]||'';
}
function setTarget(target){selected=target;$('#artwork-target-name').textContent=nameOf(target);}
function fallbackMode(){fallback=true;$('#artwork-fallback').hidden=false;$('#artwork-stage').classList.add('without-webgl');}
function texture(width,height,paint) {
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;paint(canvas.getContext('2d'),width,height);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map;
}
function wrapText(g,value,x,y,maxWidth,lineHeight,maxLines=2) {
  const words=String(value).split(' ');let line='',lines=[];
  for(const word of words){const test=line?line+' '+word:word;if(g.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;}
  if(line)lines.push(line);
  if(lines.length>maxLines){lines=lines.slice(0,maxLines);lines[maxLines-1]=lines[maxLines-1].replace(/\s*\S*$/,'')+'…';}
  lines.forEach((l,i)=>g.fillText(l,x,y+i*lineHeight));return lines.length;
}
function plaqueTexture(eyebrow,title,line) {
  const map=texture(1024,300,(g,w,h)=>{
    const grad=g.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#efe5d0');grad.addColorStop(1,'#e0d0b3');g.fillStyle=grad;g.fillRect(0,0,w,h);
    g.strokeStyle='#beaa85';g.lineWidth=4;g.strokeRect(2,2,w-4,h-4);g.fillStyle='#a28b61';for(const [sx,sy] of [[24,24],[w-24,24],[24,h-24],[w-24,h-24]]){g.beginPath();g.arc(sx,sy,5,0,Math.PI*2);g.fill();}
    g.textAlign='center';g.fillStyle='#9a7b45';g.font='500 22px "Segoe UI", Arial, sans-serif';g.letterSpacing='5px';g.fillText(eyebrow,w/2,62);g.letterSpacing='0px';
    let size=58;g.font=`italic ${size}px Georgia, "Times New Roman", serif`;while(g.measureText(title).width>w-90&&size>30){size-=2;g.font=`italic ${size}px Georgia, "Times New Roman", serif`;}
    g.fillStyle='#4a3c2c';g.fillText(title,w/2,140);
    g.strokeStyle='#b89b66';g.lineWidth=2;g.beginPath();g.moveTo(w/2-70,168);g.lineTo(w/2+70,168);g.stroke();
    g.font='28px Georgia, "Times New Roman", serif';g.fillStyle='#766750';wrapText(g,line||'',w/2,214,w-120,36,2);
  });
  map.anisotropy=4;return map;
}
const rand=(seed=>()=>(seed=(seed*16807)%2147483647)/2147483647)(61);
// Símbolos grabados de la vitrina, dibujados como trazos simples.
function drawSymbol(g,kind,s) {
  g.lineWidth=s*.07;g.lineCap='round';g.lineJoin='round';g.beginPath();
  if(kind==='key'){g.arc(s*.32,s*.5,s*.14,0,Math.PI*2);g.moveTo(s*.46,s*.5);g.lineTo(s*.82,s*.5);g.moveTo(s*.7,s*.5);g.lineTo(s*.7,s*.64);g.moveTo(s*.8,s*.5);g.lineTo(s*.8,s*.62);}
  else if(kind==='camera'){g.roundRect?.(s*.18,s*.34,s*.64,s*.42,s*.06);g.moveTo(s*.38,s*.34);g.lineTo(s*.44,s*.25);g.lineTo(s*.58,s*.25);g.lineTo(s*.62,s*.34);g.moveTo(s*.64,s*.55);g.arc(s*.5,s*.55,s*.13,0,Math.PI*2);}
  else if(kind==='flower'){for(let i=0;i<5;i++){const a=i/5*Math.PI*2-Math.PI/2;g.moveTo(s*.5+Math.cos(a)*s*.28,s*.45+Math.sin(a)*s*.28);g.arc(s*.5+Math.cos(a)*s*.17,s*.45+Math.sin(a)*s*.17,s*.11,0,Math.PI*2);}g.moveTo(s*.5,s*.6);g.lineTo(s*.5,s*.86);}
  else if(kind==='star'){for(let i=0;i<10;i++){const r=i%2?s*.15:s*.34,a=i/10*Math.PI*2-Math.PI/2;const x=s*.5+Math.cos(a)*r,y=s*.52+Math.sin(a)*r;if(i)g.lineTo(x,y);else g.moveTo(x,y);}g.closePath();}
  else if(kind==='compass'){g.arc(s*.5,s*.5,s*.32,0,Math.PI*2);g.moveTo(s*.5,s*.24);g.lineTo(s*.58,s*.5);g.lineTo(s*.5,s*.76);g.lineTo(s*.42,s*.5);g.closePath();}
  g.stroke();
}

function buildRoom() {
  const test=document.createElement('canvas');
  if(!test.getContext('webgl2')){fallbackMode();return;}
  const small=innerWidth<600,maxTexture=small?1024:2048;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#2a211b');scene.fog=new THREE.Fog('#2a211b',14,30);
  const camera=new THREE.PerspectiveCamera(60,1,.1,40);camera.position.set(0,1.65,FRONT-1.1);
  const wall=new THREE.MeshStandardMaterial({color:'#e9dfcd',roughness:.95});
  const deep=new THREE.MeshStandardMaterial({color:'#6e2f2a',roughness:.85});
  const wood=new THREE.MeshStandardMaterial({color:'#5a3a24',roughness:.5});
  const oak=new THREE.MeshStandardMaterial({color:'#8a6342',roughness:.55});
  const goldTrim=new THREE.MeshStandardMaterial({color:'#c9a564',metalness:1,roughness:.3});
  const dotMap=texture(64,64,g=>{const grad=g.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(255,248,225,1)');grad.addColorStop(.35,'rgba(255,232,180,.55)');grad.addColorStop(1,'rgba(255,230,170,0)');g.fillStyle=grad;g.fillRect(0,0,64,64);});
  function box(width,height,depth,x,y,z,material=wall){const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);mesh.position.set(x,y,z);scene.add(mesh);return mesh;}
  const depth=FRONT-BACK,midZ=(FRONT+BACK)/2;
  // Suelo de madera oscura con una alfombra que lleva hacia la obra.
  const floorMap=texture(1024,1024,(g,w,h)=>{g.fillStyle='#4a3324';g.fillRect(0,0,w,h);for(let x=0;x<w;x+=64){const tone=60+Math.floor(rand()*24);g.fillStyle=`rgb(${tone+24},${tone+6},${tone-12})`;g.fillRect(x,0,62,h);for(let i=0;i<6;i++){g.strokeStyle=`rgba(30,18,10,${.15+rand()*.2})`;g.beginPath();const y=rand()*h;g.moveTo(x,y);g.lineTo(x+62,y+(rand()-.5)*8);g.stroke();}}});
  floorMap.wrapS=floorMap.wrapT=THREE.RepeatWrapping;floorMap.repeat.set(3,3);floorMap.anisotropy=4;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(HALF*2,depth),new THREE.MeshStandardMaterial({map:floorMap,roughness:.6}));floor.rotation.x=-Math.PI/2;floor.position.set(0,0,midZ);scene.add(floor);
  const runnerMap=texture(256,1024,(g,w,h)=>{g.fillStyle='#7a3530';g.fillRect(0,0,w,h);g.strokeStyle='#c9a564';g.lineWidth=5;g.strokeRect(14,0,w-28,h);g.lineWidth=2;g.strokeRect(26,0,w-52,h);});
  const runner=new THREE.Mesh(new THREE.PlaneGeometry(1.5,FRONT-BACK-2.2),new THREE.MeshStandardMaterial({map:runnerMap,roughness:1}));runner.rotation.x=-Math.PI/2;runner.position.set(0,.006,(FRONT+BACK+.6)/2);scene.add(runner);
  // Muros: crema cálido con zócalo de madera y un nicho rojo profundo para la obra.
  for(const side of [-1,1]){box(.2,WALL_H,depth,side*(HALF+.1),WALL_H/2,midZ);box(.06,.9,depth,side*(HALF-.03),.45,midZ,wood);box(.04,.04,depth,side*(HALF-.07),.92,midZ,goldTrim);}
  box(HALF*2,WALL_H,.2,0,WALL_H/2,FRONT+.1);
  box(HALF*2,WALL_H,.2,0,WALL_H/2,BACK-.1);
  const niche=new THREE.Mesh(new THREE.PlaneGeometry(4.6,4.3),deep);niche.position.set(0,2.45,BACK+.01);scene.add(niche);
  const archShape=new THREE.Shape();archShape.moveTo(-2.45,0);archShape.lineTo(-2.45,4.3);archShape.lineTo(2.45,4.3);archShape.lineTo(2.45,0);
  for(const side of [-1,1]){const pilaster=box(.32,4.4,.3,side*2.45,2.2,BACK+.15,wall);pilaster.material=wall;box(.36,.12,.34,side*2.45,4.42,BACK+.15,goldTrim);}
  box(5.3,.24,.34,0,4.6,BACK+.15,wall);
  const ceiling=new THREE.Mesh(new THREE.PlaneGeometry(HALF*2,depth),new THREE.MeshStandardMaterial({color:'#3a2c22',roughness:1}));ceiling.rotation.x=Math.PI/2;ceiling.position.set(0,WALL_H,midZ);scene.add(ceiling);
  // Bienvenida en el muro izquierdo, visible al llegar.
  {
    const map=texture(1024,300,(g,w)=>{g.textAlign='center';g.fillStyle='#9a7b45';g.font='500 24px "Segoe UI", Arial, sans-serif';g.letterSpacing='12px';g.fillText('SALA 06',w/2,50);g.letterSpacing='0px';
      g.fillStyle='#4a3c2c';g.font='italic 70px Georgia, "Times New Roman", serif';g.fillText(room.title,w/2,132);
      g.strokeStyle='#b89b66';g.lineWidth=3;g.beginPath();g.moveTo(w/2-100,162);g.lineTo(w/2+100,162);g.stroke();
      g.fillStyle='#766750';g.font='28px Georgia, "Times New Roman", serif';wrapText(g,room.subtitle,w/2,210,w-140,38,2);});
    map.anisotropy=4;
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.8,.82),new THREE.MeshBasicMaterial({map,transparent:true,toneMapped:false}));sign.position.set(-HALF+.02,2.9,1.6);sign.rotation.y=Math.PI/2;scene.add(sign);
  }
  scene.add(new THREE.HemisphereLight('#ffe9cc','#3a281c',.75));
  const fill=new THREE.PointLight('#ffd9a8',6,11,1.6);fill.position.set(0,4.2,1);scene.add(fill);
  function marker(x,z,radius=.55){const mesh=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.025,48),new THREE.MeshBasicMaterial({color:'#d8bb85',transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.012,z);scene.add(mesh);return mesh;}
  // La gran obra: marco dorado, fotografía y tela que la cubre.
  {
    const group=new THREE.Group();group.position.set(0,ART_Y,BACK+.32);scene.add(group);
    const frameMaterial=goldTrim.clone(),b=.2;
    for(const [w,h,x,y] of [[ART_W+b*2,b,0,ART_H/2+b/2],[ART_W+b*2,b,0,-ART_H/2-b/2],[b,ART_H,-ART_W/2-b/2,0],[b,ART_H,ART_W/2+b/2,0]]){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,.16),frameMaterial);m.position.set(x,y,.06);group.add(m);}
    const passe=new THREE.Mesh(new THREE.PlaneGeometry(ART_W,ART_H),new THREE.MeshStandardMaterial({color:'#f7f1e4',roughness:.95}));passe.position.z=.01;group.add(passe);
    const surface=new THREE.Mesh(new THREE.PlaneGeometry(ART_W*.9,ART_H*.88),new THREE.MeshStandardMaterial({color:'#d9cdb8'}));surface.position.z=.02;group.add(surface);
    if(piece.photo)new THREE.TextureLoader().load(piece.photo,map=>{
      const img=map.image,iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,ratio=iw/ih;let w=ART_W*.9,h=w/ratio;if(h>ART_H*.88){h=ART_H*.88;w=h*ratio;}
      const raster=document.createElement('canvas'),scale=Math.min(1,maxTexture/Math.max(iw,ih));raster.width=Math.round(iw*scale);raster.height=Math.round(ih*scale);raster.getContext('2d').drawImage(img,0,0,raster.width,raster.height);
      const photoMap=new THREE.CanvasTexture(raster);photoMap.colorSpace=THREE.SRGBColorSpace;photoMap.anisotropy=4;map.dispose();
      surface.geometry.dispose();surface.geometry=new THREE.PlaneGeometry(w,h);surface.material.dispose();surface.material=new THREE.MeshBasicMaterial({map:photoMap,toneMapped:false,color:'#f2ebe0'});
    },undefined,()=>{/* Sin imagen: queda el paspartú. */});
    // La tela: pliegues verticales, se levanta y desaparece al descubrir la obra.
    const clothGeometry=new THREE.PlaneGeometry(ART_W+.7,ART_H+.75,30,24),pos=clothGeometry.attributes.position;
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),low=Math.max(0,-(y-.6))/(ART_H/2+.9),fold=(Math.sin(x*7+Math.sin(y*1.8)*1.3)*.06+Math.sin(x*2.3)*.04)*(.3+low);pos.setX(i,x*(1+low*.06));pos.setZ(i,fold+.1*(1-Math.abs(x)/(ART_W/2+.4)));}
    clothGeometry.computeVertexNormals();
    const linen=texture(256,256,(g,w,h)=>{g.fillStyle='#efe4cf';g.fillRect(0,0,w,h);for(let i=0;i<1400;i++){g.fillStyle=`rgba(${150+rand()*40},${120+rand()*30},${90+rand()*20},${.05+rand()*.06})`;g.fillRect(rand()*w,rand()*h,1+rand()*2,1);}});
    linen.wrapS=linen.wrapT=THREE.RepeatWrapping;linen.repeat.set(3,3);
    cloth=new THREE.Mesh(clothGeometry,new THREE.MeshStandardMaterial({map:linen,color:'#e6d6bb',roughness:.95,side:THREE.DoubleSide,transparent:true}));
    cloth.position.set(0,ART_Y-.1,BACK+.55);scene.add(cloth);cloth.userData.base=cloth.position.clone();
    // Base con la placa «Nuestra historia sigue» y una placa con los nombres que aparece al descubrir la obra.
    const ledge=new THREE.Mesh(new THREE.BoxGeometry(3.6,.9,.6),wall);ledge.position.set(0,.45,BACK+.42);scene.add(ledge);
    const ledgeTop=new THREE.Mesh(new THREE.BoxGeometry(3.7,.05,.66),goldTrim);ledgeTop.position.set(0,.92,BACK+.42);scene.add(ledgeTop);
    const plaque=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.5*300/1024),new THREE.MeshBasicMaterial({map:plaqueTexture('LA OBRA FINAL',text(piece.plaque||'Nuestra historia sigue'),''),toneMapped:false}));plaque.position.set(0,.5,BACK+.73);scene.add(plaque);
    namePlate=new THREE.Mesh(new THREE.PlaneGeometry(2,2*300/1024),new THREE.MeshBasicMaterial({map:plaqueTexture(String(config.date||'').toUpperCase(),config.couple,config.celebration),toneMapped:false,transparent:true}));
    namePlate.position.set(0,ART_Y-ART_H/2-.42,BACK+.78);namePlate.rotation.x=-.08;namePlate.visible=false;scene.add(namePlate);
    pieceSpot=new THREE.SpotLight('#ffe0b0',small?14:18,10,.42,.75,1.3);pieceSpot.position.set(0,WALL_H-.2,BACK+4.2);pieceSpot.target.position.set(0,ART_Y,BACK+.3);pieceSpot.userData={off:small?14:18,on:small?55:75};scene.add(pieceSpot,pieceSpot.target);
    const hit=new THREE.Mesh(new THREE.BoxGeometry(ART_W+.8,ART_H+.9,.5),new THREE.MeshBasicMaterial({visible:false}));hit.position.set(0,ART_Y,BACK+.6);scene.add(hit);
    pieceTarget={id:'piece',focus:new THREE.Vector3(0,ART_Y-.1,BACK+.3),approach:{x:0,z:BENCH.z+1.3},hits:[hit,plaque],marker:null,glow:[frameMaterial],lift:plaque,rise:[0,.02,0],halo:[0,ART_Y,BACK+.8,4.4]};
    targets.push(pieceTarget);
  }
  // El banco frente a la obra: sentarse acerca la mirada sin abrir nada.
  {
    const bench=new THREE.Group();bench.position.set(BENCH.x,0,BENCH.z);scene.add(bench);
    const seat=new THREE.Mesh(new THREE.BoxGeometry(2.1,.12,.56),oak);seat.position.y=.46;bench.add(seat);
    const cushion=new THREE.Mesh(new THREE.BoxGeometry(1.95,.07,.48),new THREE.MeshStandardMaterial({color:'#7a3530',roughness:.9}));cushion.position.y=.555;bench.add(cushion);
    for(const sx of [-.9,.9])for(const sz of [-.2,.2]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.035,.03,.44,10),wood);leg.position.set(sx,.22,sz);bench.add(leg);}
    const hit=new THREE.Mesh(new THREE.BoxGeometry(2.2,.8,.7),new THREE.MeshBasicMaterial({visible:false}));hit.position.y=.4;bench.add(hit);
    targets.push({id:'bench',focus:new THREE.Vector3(0,ART_Y-.2,BACK),approach:{x:0,z:BENCH.z+1.25},hits:[hit],marker:marker(0,BENCH.z+1.25,.5),glow:[],lift:cushion,rise:[0,.01,0],halo:[0,.6,BENCH.z,1.6]});
  }
  // El escritorio con el sobre de la carta.
  {
    const desk=new THREE.Group();desk.position.set(DESK.x,0,DESK.z);desk.rotation.y=.35;scene.add(desk);
    const top=new THREE.Mesh(new THREE.BoxGeometry(1.5,.06,.8),wood);top.position.y=.8;desk.add(top);
    for(const sx of [-.68,.68])for(const sz of [-.33,.33]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.06,.8,.06),wood);leg.position.set(sx,.4,sz);desk.add(leg);}
    const drawer=new THREE.Mesh(new THREE.BoxGeometry(1.3,.16,.04),oak);drawer.position.set(0,.68,.39);desk.add(drawer);
    const lampBase=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,.04,16),goldTrim);lampBase.position.set(-.55,.85,-.22);desk.add(lampBase);
    const lampStem=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.4,8),goldTrim);lampStem.position.set(-.55,1.05,-.22);desk.add(lampStem);
    const shade=new THREE.Mesh(new THREE.ConeGeometry(.16,.16,20,1,true),new THREE.MeshBasicMaterial({color:'#f5d9a6',side:THREE.DoubleSide,toneMapped:false}));shade.position.set(-.55,1.27,-.22);desk.add(shade);
    const deskLight=new THREE.PointLight('#ffd49a',3.2,4,1.5);deskLight.position.set(-.55,1.2,-.1);desk.add(deskLight);
    const envelope=new THREE.Group();envelope.position.set(.12,.84,.02);envelope.rotation.set(-Math.PI/2,0,.12);desk.add(envelope);
    const envMap=texture(512,340,(g,w,h)=>{g.fillStyle='#fbf3e3';g.fillRect(0,0,w,h);g.strokeStyle='#c9b08a';g.lineWidth=4;g.strokeRect(4,4,w-8,h-8);g.beginPath();g.moveTo(4,4);g.lineTo(w/2,h*.55);g.lineTo(w-4,4);g.stroke();
      g.fillStyle='#a8413a';g.beginPath();g.arc(w/2,h*.55,26,0,Math.PI*2);g.fill();g.fillStyle='#f6e2c0';g.font='bold 24px Georgia, serif';g.textAlign='center';g.fillText('✦',w/2,h*.55+8);
      g.fillStyle='#5b4a36';g.font='italic 40px Georgia, "Times New Roman", serif';g.fillText(`Para ${config.recipient}`,w/2,h*.86);});
    const envelopeMesh=new THREE.Mesh(new THREE.BoxGeometry(.5,.33,.015),new THREE.MeshLambertMaterial({map:envMap}));envelope.add(envelopeMesh);
    const sheetMap=texture(256,340,(g,w,h)=>{g.fillStyle='#fffaf0';g.fillRect(0,0,w,h);g.fillStyle='#c9b48e';for(let i=0;i<11;i++)g.fillRect(28,40+i*24,w-56-rand()*40,3);});
    sheet=new THREE.Mesh(new THREE.PlaneGeometry(.42,.56),new THREE.MeshLambertMaterial({map:sheetMap,side:THREE.DoubleSide}));sheet.position.set(0,0,.012);sheet.visible=false;envelope.add(sheet);sheet.userData.base=sheet.position.clone();
    const pen=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.2,8),goldTrim);pen.rotation.set(Math.PI/2,0,.6);pen.position.set(.5,.845,.1);desk.add(pen);
    const hit=new THREE.Mesh(new THREE.BoxGeometry(.9,.5,.7),new THREE.MeshBasicMaterial({visible:false}));hit.position.set(.1,.95,0);desk.add(hit);
    const world=new THREE.Vector3();envelope.getWorldPosition(world);
    letterTarget={id:'letter',focus:new THREE.Vector3(world.x,.85,world.z),approach:{x:DESK.x+1.05,z:DESK.z+1.6},hits:[hit,envelopeMesh],marker:marker(DESK.x+1.05,DESK.z+1.6,.45),glow:[],lift:envelope,rise:[0,0,0],halo:[world.x,1,world.z,1.1],envelope};
    targets.push(letterTarget);
  }
  // La vitrina secreta: pedestal, cinco símbolos grabados y una tapa de cristal que se abre.
  {
    const group=new THREE.Group();group.position.set(CASE.x,0,CASE.z);group.rotation.y=-.35;scene.add(group);
    const pedestal=new THREE.Mesh(new THREE.BoxGeometry(.8,1,.8),wood);pedestal.position.y=.5;group.add(pedestal);
    const trim=new THREE.Mesh(new THREE.BoxGeometry(.84,.04,.84),goldTrim);trim.position.y=1.01;group.add(trim);
    const glassMaterial=new THREE.MeshStandardMaterial({color:'#e9f2f2',transparent:true,opacity:.18,roughness:.05,metalness:.1,depthWrite:false});
    for(const [w,h,d,x,z] of [[.74,.5,.01,0,.37],[.74,.5,.01,0,-.37],[.01,.5,.74,.37,0],[.01,.5,.74,-.37,0]]){const pane=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),glassMaterial);pane.position.set(x,1.28,z);group.add(pane);}
    lid=new THREE.Group();lid.position.set(0,1.53,-.37);group.add(lid);
    const lidPane=new THREE.Mesh(new THREE.BoxGeometry(.76,.012,.76),glassMaterial);lidPane.position.set(0,0,.37);lid.add(lidPane);
    const lidRim=new THREE.Mesh(new THREE.BoxGeometry(.78,.025,.025),goldTrim);lidRim.position.set(0,0,.75);lid.add(lidRim);
    // Placa con los cinco símbolos en el frente del pedestal.
    const strip=new THREE.Mesh(new THREE.BoxGeometry(.72,.18,.02),new THREE.MeshStandardMaterial({color:'#3a2a1d',roughness:.6}));strip.position.set(0,.78,.41);group.add(strip);
    SYMBOLS.forEach(([kind],index)=>{
      const map=texture(128,128,(g,w)=>{g.strokeStyle='#ffffff';drawSymbol(g,kind,w);});
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.11,.11),new THREE.MeshBasicMaterial({map,color:'#6b5a44',transparent:true,opacity:.55,toneMapped:false}));
      mesh.position.set(-.28+index*.14,.78,.422);group.add(mesh);symbolMeshes.push(mesh);
    });
    // Dentro: un pequeño cofre y la tarjeta de la sorpresa, visible al abrir.
    const chest=new THREE.Mesh(new THREE.BoxGeometry(.3,.16,.2),new THREE.MeshStandardMaterial({color:'#7a3530',roughness:.7}));chest.position.set(0,1.11,0);group.add(chest);
    const ribbon=new THREE.Mesh(new THREE.BoxGeometry(.31,.165,.03),goldTrim);ribbon.position.set(0,1.11,0);group.add(ribbon);
    const cardMap=texture(256,160,(g,w,h)=>{g.fillStyle='#fffaf0';g.fillRect(0,0,w,h);g.strokeStyle='#c9a564';g.lineWidth=4;g.strokeRect(6,6,w-12,h-12);g.fillStyle='#4a3c2c';g.font='italic 22px Georgia, serif';g.textAlign='center';g.fillText('Para ti',w/2,h/2+8);});
    giftCard=new THREE.Mesh(new THREE.PlaneGeometry(.26,.16),new THREE.MeshBasicMaterial({map:cardMap,side:THREE.DoubleSide,toneMapped:false}));giftCard.position.set(0,1.32,.05);giftCard.rotation.x=-.4;giftCard.visible=false;group.add(giftCard);
    const caseLight=new THREE.PointLight('#ffe0b0',2.4,3,1.5);caseLight.position.set(0,1.9,.4);group.add(caseLight);
    const hit=new THREE.Mesh(new THREE.BoxGeometry(.95,1.7,.95),new THREE.MeshBasicMaterial({visible:false}));hit.position.y=.85;group.add(hit);
    caseTarget={id:'vitrine',focus:new THREE.Vector3(CASE.x,1.05,CASE.z),approach:{x:CASE.x-1.05,z:CASE.z+1.6},hits:[hit],marker:marker(CASE.x-1.05,CASE.z+1.6,.45),glow:[],lift:chest,rise:[0,.02,0],halo:[CASE.x,1.3,CASE.z,1.3]};
    targets.push(caseTarget);
  }
  // Puerta de regreso al vestíbulo: detrás de la cámara, por donde se entra.
  {
    const door=new THREE.Group();door.position.set(0,0,FRONT-.04);door.rotation.y=Math.PI;scene.add(door);
    const W=1.4,H=2.45;
    const ring=(w,h,grow,inner)=>{const o=new THREE.Shape();o.moveTo(-w/2-grow,-.02);o.lineTo(w/2+grow,-.02);o.lineTo(w/2+grow,h+grow);o.lineTo(-w/2-grow,h+grow);o.lineTo(-w/2-grow,-.02);const i=new THREE.Path();i.moveTo(-w/2-inner,0);i.lineTo(-w/2-inner,h+inner);i.lineTo(w/2+inner,h+inner);i.lineTo(w/2+inner,0);i.lineTo(-w/2-inner,0);o.holes.push(i);return o;};
    const extrude=(shape,depth)=>new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:2,curveSegments:32});
    door.add(new THREE.Mesh(extrude(ring(W,H,.26,.12),.12),wood));door.add(new THREE.Mesh(extrude(ring(W,H,.12,0),.16),goldTrim));
    const beyond=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.MeshBasicMaterial({color:'#ffe4b4',toneMapped:false}));beyond.position.set(0,H/2,.004);door.add(beyond);
    const leafMap=texture(256,512,(g,w,h)=>{const grad=g.createLinearGradient(0,0,w,0);grad.addColorStop(0,'#3e2516');grad.addColorStop(.5,'#5e3a22');grad.addColorStop(1,'#3e2516');g.fillStyle=grad;g.fillRect(0,0,w,h);
      for(let i=0;i<70;i++){g.strokeStyle=`rgba(30,16,8,${.08+rand()*.12})`;g.lineWidth=1;g.beginPath();const x=rand()*w;g.moveTo(x,0);g.bezierCurveTo(x+(rand()-.5)*20,h*.33,x+(rand()-.5)*20,h*.66,x+(rand()-.5)*14,h);g.stroke();}
      for(const [y,ph] of [[40,230],[300,170]]){g.strokeStyle='#b38a4e';g.lineWidth=3;g.strokeRect(34,y,w-68,ph);g.strokeStyle='rgba(20,10,5,.55)';g.lineWidth=6;g.strokeRect(44,y+10,w-88,ph-20);}});
    const leafMaterial=new THREE.MeshStandardMaterial({map:leafMap,roughness:.55}),leaves=[];
    for(const side of [-1,1]){const hinge=new THREE.Group();hinge.position.set(side*W/2,0,.03);door.add(hinge);
      const leaf=new THREE.Mesh(new THREE.BoxGeometry(W/2-.01,H-.01,.06),leafMaterial);leaf.position.set(-side*(W/4),H/2,0);hinge.add(leaf);
      const handle=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.34,10),goldTrim);handle.position.set(-side*(W/2-.12),1.2,.06);hinge.add(handle);leaves.push({hinge,side,leaf});}
    const plateMap=texture(512,160,(g,w,h)=>{const grad=g.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#efe5d0');grad.addColorStop(1,'#e0d0b3');g.fillStyle=grad;g.fillRect(0,0,w,h);
      g.strokeStyle='#beaa85';g.lineWidth=4;g.strokeRect(2,2,w-4,h-4);
      g.textAlign='center';g.fillStyle='#9a7b45';g.font='500 18px "Segoe UI", Arial, sans-serif';g.letterSpacing='6px';g.fillText('SALIDA',w/2,52);g.letterSpacing='0px';g.fillStyle='#4a3c2c';g.font='italic 54px Georgia, "Times New Roman", serif';g.fillText('Vestíbulo',w/2,118);});
    const plate=new THREE.Mesh(new THREE.PlaneGeometry(1.15,.36),new THREE.MeshBasicMaterial({map:plateMap,toneMapped:false}));plate.position.set(0,H+.55,.06);door.add(plate);
    const lamp=new THREE.PointLight('#ffd9a0',1.6,4,1.6);lamp.position.set(0,3.6,.9);door.add(lamp);
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
  ping=new THREE.Mesh(new THREE.RingGeometry(.18,.24,40),new THREE.MeshBasicMaterial({color:'#d8bb85',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));ping.rotation.x=-Math.PI/2;ping.position.y=.012;ping.userData.t=1;scene.add(ping);
  const COUNT=small?90:170,dust=new Float32Array(COUNT*3),speeds=new Float32Array(COUNT);
  for(let i=0;i<COUNT;i++){dust.set([(rand()-.5)*11,rand()*WALL_H,BACK+rand()*depth],i*3);speeds[i]=.03+rand()*.06;}
  const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(dust,3));
  const motes=new THREE.Points(dustGeometry,new THREE.PointsMaterial({map:dotMap,size:.035,transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending,color:'#ffe2b0'}));
  motes.frustumCulled=false;scene.add(motes);let lastDust=performance.now();
  motes.onBeforeRender=()=>{const now=performance.now(),dt=Math.min((now-lastDust)/1000,.05);lastDust=now;if(reducedMotion.matches)return;const p=dustGeometry.attributes.position;for(let i=0;i<COUNT;i++){let y=p.getY(i)+speeds[i]*dt;if(y>WALL_H)y=0;p.setY(i,y);}p.needsUpdate=true;};
  firstFrame=new Promise(resolve=>$('#artwork-stage').addEventListener('gallery:ready',resolve,{once:true}));
  engine=createGallery({container:$('#artwork-stage'),scene,camera,obstacles,targets,floor,bounds:BOUNDS,onTarget:setTarget,onActivate:target=>openTarget(target),onUnavailable:fallbackMode,onTap,onSwipe,onHover:target=>{hoverTarget=target;},onBack:()=>{if(noteOpen)closeNote();else if(focused)stepBack();},onFrame:animate});
  engine.renderer.toneMappingExposure=.95;
  const pmrem=new THREE.PMREMGenerator(engine.renderer),environment=new RoomEnvironment();
  scene.environment=pmrem.fromScene(environment,.04).texture;scene.environmentIntensity=.35;environment.dispose();pmrem.dispose();
  engine.setActive(true);
  setTarget(null);updateProgress();
}

async function enterRoom() {
  const cover=()=>{
    Museum.showView(ROOM_ID);
    if(!initialized){initialized=true;try{buildRoom();}catch(error){console.warn('Sala 06 sin 3D:',error);fallbackMode();}}
    engine?.setActive(true);updateProgress();
  };
  const opened=await Museum.playDoors({lines:['Bajando las luces…','Preparando la última sala…','Una obra para ti.'],cover,ready:()=>fallback?null:firstFrame,minimum:1600,variant:'room-06',plate:'06',label:'SALA 06 · UNA OBRA PARA TI',title:room.title});
  if(!opened)cover();
  $('#artwork-title').setAttribute('tabindex','-1');$('#artwork-title').focus({preventScroll:true});
  if(!Museum.tutorialSeen('room'))Museum.openTutorial('room',$('#artwork-help'));
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
  $('#artwork-screen').classList.toggle('viewing-art',!!target.artwork&&open);
  if(target.id!=='exit'&&open)rememberPose();
  if(focused===target&&!engine.isFlying()){if(open)openTarget(target,source||undefined);return;}
  const previous=$('#artwork-target-name').textContent;
  $('#artwork-target-name').textContent=`Hacia: ${nameOf(target)}`;
  flyingTo=target;focused=null;
  const ok=engine.guideTo(target,{onArrive:()=>{flyingTo=null;focused=target;if(open)openTarget(target,source||undefined);}});
  if(ok)return;
  flyingTo=null;$('#artwork-target-name').textContent=previous;
  if(open&&engine.camera.position.distanceTo(target.focus)<7.5)openTarget(target,source||undefined);
  else Museum.notify('Puedes acercarte caminando por la sala.');
}
// «Acercarme a la obra»: un paseo guiado opcional hasta el banco, sin abrir nada.
function approachArtwork() {
  if(fallback||!engine){openPiece();return;}
  closeNote(false,false);resume();focused=null;returnPose=null;
  engine.guideTo({id:'approach',focus:new THREE.Vector3(0,ART_Y-.25,BACK),approach:{x:0,z:BENCH.z+1.35},hits:[],marker:null},{select:false});
}
function guide(key,source=null) {
  if(fallback||!engine){({piece:openPiece,letter:openLetterNote,vitrine:openVitrine})[key](source||undefined);return;}
  goTo({piece:pieceTarget,letter:letterTarget,vitrine:caseTarget}[key],{source});
}
function stepBack() {
  closeNote(false,false);
  if(!engine)return;
  resume();focused=null;flyingTo=null;returnPose=null;
  engine.guideTo({id:'overview',focus:new THREE.Vector3(0,2.1,BACK),approach:{x:0,z:FRONT-1.4},hits:[],marker:null},{select:false});
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
  if(noteOpen||anim)return;
  if(target?.id==='bench'){approachArtwork();return;}
  if(target)goTo(target);
  else if(point)walkTo(point);
  else if(focused)stepBack();
}
function onSwipe(direction,restoreView) {
  if(noteOpen||anim)return;
  restoreView();
  if(direction==='down')stepBack();
}
const easeInOut=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
function syncApproach() {
  const pill=$('#artwork-approach');
  const show=!!engine&&!noteOpen&&!anim&&!engine.isFlying()&&!$('#artwork-screen').hidden&&engine.camera.position.z>BENCH.z+2.6;
  if(pill.hidden===!show)return;
  pill.hidden=!show;
}
function animate(dt) {
  if(exitTarget){exitOpen+=((exitOpening?1:0)-exitOpen)*(reducedMotion.matches?1:Math.min(1,dt*4));for(const {hinge,side} of exitTarget.leaves)hinge.rotation.y=side*exitOpen*1.75;}
  if(anim){
    anim.t=Math.min(1,anim.t+dt/(reducedMotion.matches?.3:anim.duration));const k=easeInOut(anim.t);
    if(anim.kind==='cloth'&&cloth){
      const base=cloth.userData.base;
      if(reducedMotion.matches)cloth.material.opacity=1-k;
      else{cloth.position.set(base.x,base.y+k*2.2,base.z+k*.6);cloth.scale.set(1-k*.3,1-k*.7,1);cloth.rotation.x=-k*.9;cloth.material.opacity=1-Math.max(0,(k-.5)/.5);}
      if(pieceSpot)pieceSpot.intensity=pieceSpot.userData.off+(pieceSpot.userData.on-pieceSpot.userData.off)*k;
      if(namePlate){namePlate.visible=k>.6;namePlate.material.opacity=Math.max(0,(k-.6)/.4);}
    } else if(anim.kind==='sheet'&&sheet){
      sheet.visible=true;const base=sheet.userData.base;
      if(reducedMotion.matches)sheet.position.set(base.x,base.y+.3,base.z+.02);
      else sheet.position.set(base.x,base.y+k*.32,base.z+.02+Math.sin(k*Math.PI)*.08);
    } else if(anim.kind==='lid'&&lid){
      lid.rotation.x=-k*1.25;if(giftCard){giftCard.visible=k>.4;giftCard.position.y=1.2+k*.12;}
    }
    if(anim.t>=1){const done=anim.done;if(anim.kind==='cloth'&&cloth)cloth.visible=false;anim=null;done?.();}
  }
  const ease=reducedMotion.matches?1:Math.min(1,dt*8);
  for(const target of targets){
    const goal=!noteOpen&&(hoverTarget===target||flyingTo===target)?1:0;
    target.h+=(goal-target.h)*ease;
    const h=target.h,[rx,ry,rz]=target.rise;
    target.lift.position.set(target.base.x+rx*h,target.base.y+ry*h,target.base.z+rz*h);
    for(const material of target.glow)material.emissiveIntensity=h*.3;
    target.haloSprite.material.opacity=h*.22;
    if(target.marker)target.marker.material.opacity=Math.max(engine.getSelected()===target?.9:.16,.16+h*.74);
  }
  if(ping&&ping.userData.t<1){ping.userData.t=Math.min(1,ping.userData.t+dt*1.4);const t=ping.userData.t;ping.scale.setScalar(1+t*2.2);ping.material.opacity=(1-t)*.8;}
  if(focused&&!noteOpen&&!engine.isFlying()&&Math.hypot(engine.camera.position.x-focused.approach.x,engine.camera.position.z-focused.approach.z)>.6){focused=null;returnPose=null;}
  syncApproach();
}
function play(kind,duration,done) {
  if(fallback||!engine){done();return;}
  engine.setLocked(true);
  anim={kind,t:0,duration,done:()=>{engine.setLocked(false);done();}};
}

/* Notas laterales: las mismas de las otras salas. */
let noteSource=null;
function closeNote(restoreFocus=true,returnBack=true) {
  const note=$('#artwork-note');$('#artwork-screen').classList.remove('viewing-art');
  if(note.hidden)return;
  note.hidden=true;$('#artwork-note-content').replaceChildren();noteOpen=false;engine?.setLocked(false);
  if(restoreFocus)(noteSource?.isConnected&&!noteSource.closest('[hidden]')?noteSource:$('#artwork-stage')).focus({preventScroll:true});
  noteSource=null;
  const pose=returnPose;returnPose=null;
  if(returnBack&&engine&&pose){focused=null;resume();engine.guideTo({id:'return',focus:pose.focus,approach:{x:pose.x,z:pose.z},hits:[],marker:null},{select:false});}
}
function showNote({eyebrow,title,body,source=$('#artwork-stage'),art=false}) {
  noteSource=source;
  $('#artwork-note-content').innerHTML=`<p class="eyebrow">${escape(eyebrow)}</p><h2 id="artwork-note-title" tabindex="-1">${escape(title)}</h2>${body}`;
  $('#artwork-note').hidden=false;noteOpen=true;engine?.setLocked(true);$('#artwork-screen').classList.toggle('viewing-art',art);
  $('#artwork-approach').hidden=true;
  $('#artwork-note-title').focus({preventScroll:true});
}
$('#close-artwork-note').addEventListener('click',()=>closeNote());
$('#artwork-note').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeNote();}});
function discover(id) {
  const progress=Museum.discoverPiece(ROOM_ID,id);
  buzz(progress.newlyCompleted?[30,60,45]:14);
  updateProgress();
  return progress;
}

// La obra: cubierta con «Descubrir la obra», o descubierta con nombres, celebración y dedicatoria.
function openPiece(source=$('#artwork-stage')) {
  if(!revealed()){
    showNote({eyebrow:'LA OBRA FINAL',title:text(piece.plaque||'Nuestra historia sigue'),source,body:`<p class="room-note-description">Hay algo bajo esta tela que quiero que veas.</p><div class="future-actions"><button id="artwork-reveal" class="button primary" type="button">Descubrir la obra</button></div>`});
    $('#artwork-reveal').addEventListener('click',()=>{
      const pose=returnPose;closeNote(false,false);returnPose=pose;
      play('cloth',2.2,()=>{const progress=discover(PIECE_ID);showPiece(source);if(progress.newlyCompleted)setTimeout(()=>openFinale(),reducedMotion.matches?200:900);});
    });
    return;
  }
  showPiece(source);
}
function showPiece(source=$('#artwork-stage')) {
  showNote({eyebrow:`${config.couple} · ${config.celebration}`.toUpperCase(),title:room.title,source,art:true,body:`
    <p class="room-note-description">${escape(config.date||'')}</p>
    <p class="room-note-dedication">${escape(text(piece.dedication||''))}</p>
    <div class="future-actions">${piece.photo?'<button id="artwork-photo" class="button secondary" type="button">Ver la fotografía</button>':''}${video?.src?'<button id="artwork-video" class="button primary" type="button">Tengo algo más que decirte</button>':''}</div>
    ${letterRead()?'':'<p class="future-choice-note">Sobre el escritorio te espera una carta.</p>'}`});
  $('#artwork-photo')?.addEventListener('click',event=>openPhoto(event.currentTarget));
  $('#artwork-video')?.addEventListener('click',event=>openVideo(event.currentTarget));
}
function openPhoto(source) {
  const pose=returnPose;
  Museum.openContent({className:'moments-photo',source,onClose:()=>{if(!$('#artwork-screen').hidden&&revealed()){returnPose=pose;showPiece();}},
    html:`<figure class="moments-photo-figure"><img src="${escape(piece.photo)}" alt="${escape(piece.alt||room.title)}" decoding="async"><figcaption><p class="eyebrow">${escape(`${config.couple} · ${config.celebration}`)}</p><h2 id="dialog-title">${escape(room.title)}</h2><p>${escape(text(piece.dedication||''))}</p></figcaption></figure>`});
  const image=$('.moments-photo img');
  image?.addEventListener('error',()=>{const replacement=document.createElement('p');replacement.className='missing-memory-image';replacement.textContent='Esta fotografía no está disponible por ahora.';image.replaceWith(replacement);},{once:true});
}
// Dedicatoria en video: se carga al pedirla, conserva su proporción y se detiene al cerrar.
function openVideo(source) {
  if(!video?.src)return;
  const pose=returnPose;let element=null;
  Museum.openContent({className:'final-video',source,onClose:()=>{if(element){element.pause();Museum.releaseMedia(element);element.removeAttribute('src');element.load();}if(!$('#artwork-screen').hidden&&revealed()){returnPose=pose;showPiece();}},
    html:`<div class="dialog-heading"><p class="eyebrow">UNA DEDICATORIA</p><h2 id="dialog-title">${escape(text(video.title||'Tengo algo más que decirte'))}</h2></div><div class="final-video-frame"><video controls playsinline preload="metadata" ${video.poster?`poster="${escape(video.poster)}"`:''}></video></div><div class="future-actions">${document.fullscreenEnabled?'<button id="final-video-full" class="text-button" type="button">Pantalla completa</button>':''}<p id="final-video-status" role="status"></p></div>`});
  element=$('.final-video-frame video');element.src=video.src;
  element.addEventListener('play',()=>{if(!Museum.audioPlaying?.(video.src))Museum.playMedia(element,{title:text(video.title||room.title),kind:'video'});});
  element.addEventListener('error',()=>{$('#final-video-status').textContent='El video no está disponible por ahora.';},{once:true});
  $('#final-video-full')?.addEventListener('click',()=>element.requestFullscreen?.().catch(()=>{}));
}
// La carta: el sobre en el escritorio; al abrirla sale la hoja y aparece la carta completa.
function openLetterNote(source=$('#artwork-stage')) {
  showNote({eyebrow:'SOBRE EL ESCRITORIO',title:`Para ${config.recipient}`,source,body:`<p class="room-note-description">Una carta escrita por ${escape(config.sender)}.</p><div class="future-actions"><button id="artwork-read" class="button primary" type="button">Leer mi carta</button></div>`});
  $('#artwork-read').addEventListener('click',event=>readLetter(event.currentTarget));
}
function readLetter(source) {
  const pose=returnPose;closeNote(false,false);returnPose=pose;
  play('sheet',.9,()=>{
    const progress=discover(LETTER_ID);
    showLetter(source,()=>{if(sheet)sheet.visible=false;if(progress.newlyCompleted)openFinale();else if(!$('#artwork-screen').hidden&&engine&&returnPose){const back=returnPose;returnPose=null;resume();engine.guideTo({id:'return',focus:back.focus,approach:{x:back.x,z:back.z},hits:[],marker:null},{select:false});}});
  });
}
function showLetter(source=$('#artwork-stage'),after=null) {
  Museum.openContent({className:'final-letter',source,onClose:()=>{Museum.stopMedia();after?.();},html:`<article class="letter-sheet">
    <p class="eyebrow">UNA CARTA PARA TI</p>
    <h2 id="dialog-title">${escape(text(letter.greeting||''))}</h2>
    ${(letter.body||[]).map(paragraph=>`<p>${escape(text(paragraph))}</p>`).join('')}
    <p class="letter-closing">${escape(text(letter.closing||''))}</p>
    <p class="letter-signature">${escape(text(letter.signature||''))}</p>
    ${letter.audio?`<div class="optional-audio you-audio"><button id="letter-voice" class="button secondary" type="button">▶ ${escape(text(letter.audioLabel||'Escuchar mi voz'))}</button><p id="letter-voice-status" role="status"></p></div>`:''}
  </article>`});
  Museum.bindAudioButton($('#letter-voice'),{src:letter.audio,title:`Carta de ${config.sender}`,label:`▶ ${text(letter.audioLabel||'Escuchar mi voz')}`,status:$('#letter-voice-status')});
  $('.letter-sheet')?.closest('#dialog-content')?.scrollTo?.(0,0);
}
// La vitrina: símbolos de las pistas encontradas; con las cinco, «Abrir mi sorpresa».
function openVitrine(source=$('#artwork-stage')) {
  const clues=Museum.getProgress().clues,count=clues.length,total=config.clueIds.length;
  const symbols=`<ul class="vitrine-symbols">${SYMBOLS.map(([kind,label],index)=>`<li class="${clues.includes(config.clueIds[index])?'found':''}"><span aria-hidden="true">${{key:'⚿',camera:'◉',flower:'✿',star:'✦',compass:'✧'}[kind]}</span>${label}</li>`).join('')}</ul>`;
  if(Museum.vitrineOpened()){
    showNote({eyebrow:'LA VITRINA SECRETA',title:'Tu sorpresa',source,body:`${symbols}<div class="future-actions"><button id="artwork-gift" class="button primary" type="button">Ver mi sorpresa</button></div>`});
    $('#artwork-gift').addEventListener('click',event=>openGift(event.currentTarget));
    return;
  }
  if(count>=total){
    showNote({eyebrow:'LA VITRINA SECRETA',title:'Has reunido las cinco pistas',source,body:`${symbols}<div class="future-actions"><button id="artwork-open-gift" class="button primary" type="button">Abrir mi sorpresa</button></div>`});
    $('#artwork-open-gift').addEventListener('click',event=>{
      const pose=returnPose;closeNote(false,false);returnPose=pose;
      play('lid',1.2,()=>{Museum.openVitrine();updateProgress();openGift($('#artwork-stage'));});
    });
    return;
  }
  const missing=missingClueRooms();
  showNote({eyebrow:'LA VITRINA SECRETA',title:`Pistas encontradas: ${count} de ${total}`,source,body:`${symbols}
    <p class="room-note-description">Faltan pistas en: ${missing.map(item=>escape(item.room.title.replace(/\.$/,''))).join(', ')}.</p>
    <div class="future-actions"><button id="artwork-map" class="button secondary" type="button">Abrir el mapa</button></div>
    <p class="future-choice-note">La carta y la obra no dependen de las pistas.</p>`});
  $('#artwork-map').addEventListener('click',event=>{closeNote(false,false);Museum.openMap(event.currentTarget);});
}
function openGift(source) {
  const rows=[['Fecha',vitrine.date],['Lugar',vitrine.place],['Indicaciones',vitrine.instructions]].filter(([,value])=>String(value||'').trim());
  Museum.openContent({className:'future-invitation',source,html:`<article class="invitation-card gift-card"><p class="eyebrow">${escape((vitrine.kind||'Tu sorpresa').toUpperCase())}</p><h2 id="dialog-title">${escape(text(vitrine.title||''))}</h2>${vitrine.photo?`<img class="gift-photo" src="${escape(vitrine.photo)}" alt="${escape(vitrine.photoAlt||'')}" decoding="async">`:''}${vitrine.message?`<p class="invitation-message">${escape(text(vitrine.message))}</p>`:''}${rows.length?`<dl>${rows.map(([label,value])=>`<div><dt>${label}</dt><dd>${escape(text(value))}</dd></div>`).join('')}</dl>`:''}<p class="invitation-sign">${escape(config.sender)}</p></article>`});
}

/* Cierre del recorrido: pasaporte completo, mensaje final, acciones y el recuerdo descargable. */
function stampsMarkup() {
  const done=Museum.getProgress().completed;
  return `<div class="final-stamps">${config.rooms.map((item,index)=>`<div class="final-stamp ${done.includes(item.id)?'on':''} ${item.id===ROOM_ID?'last':''}"><span>${done.includes(item.id)?'✧':String(index+1).padStart(2,'0')}</span><small>${escape(item.title.replace(/\.$/,''))}</small></div>`).join('')}</div>`;
}
function openFinale(source=$('#artwork-help')) {
  closeNote(false,false);
  const progress=Museum.getProgress();
  Museum.openContent({className:'final-closing',source,html:`<div class="dialog-heading"><p class="eyebrow">PASAPORTE DE RECUERDOS · ${progress.completed.length} DE 6 SALAS COMPLETADAS</p><h2 id="dialog-title">${escape(room.completionTitle)}</h2><p>${escape(room.completionMessage)}</p></div>
    ${stampsMarkup()}
    <div class="final-actions">
      <button class="button primary" data-final="map" type="button">Volver a recorrerlo</button>
      <button class="button secondary" data-final="letter" type="button">Leer la carta otra vez</button>
      ${Museum.vitrineOpened()?'<button class="button secondary" data-final="gift" type="button">Ver mi sorpresa</button>':''}
      ${progress.cluesComplete?'':'<button class="button secondary" data-final="clues" type="button">Buscar las pistas pendientes</button>'}
      ${progress.completed.length>=6?'<button class="button secondary" data-final="card" type="button">Guardar mi recuerdo</button>':''}
    </div>
    <p id="final-card-status" class="final-card-status" role="status"></p>`});
  $('#dialog-content').onclick=event=>{
    const action=event.target.closest('[data-final]')?.dataset.final;if(!action)return;
    if(action==='map'){Museum.closeOverlay();setTimeout(()=>Museum.openMap($('#open-map')),0);}
    else if(action==='letter')showLetter($('#artwork-stage'));
    else if(action==='gift')openGift($('#artwork-stage'));
    else if(action==='clues'){Museum.closeOverlay();setTimeout(()=>openVitrine(),0);}
    else if(action==='card')saveCard(event.target.closest('button'));
  };
}
// Tarjeta PNG: una composición 2D propia, con fuentes del sistema ya cargadas y sin recursos externos.
async function saveCard(button) {
  const status=$('#final-card-status');
  button.disabled=true;if(status)status.textContent='Preparando tu recuerdo…';
  try{
    await document.fonts?.ready;
    const blob=await renderCard();
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=room.card?.fileName||'nuestro-museo.png';document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
    if(status)status.textContent='Tu recuerdo se ha guardado.';
  }catch(error){
    console.warn('No se pudo crear la tarjeta:',error);
    if(status)status.textContent='No se pudo guardar la imagen. Inténtalo de nuevo.';
  }finally{button.disabled=false;}
}
function renderCard() {
  const w=1200,h=1600,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const g=canvas.getContext('2d');if(!g)return Promise.reject(new Error('Sin canvas 2D'));
  const serif='Georgia, "Times New Roman", serif',sans='"Segoe UI", Arial, sans-serif';
  const bg=g.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#fbf7ed');bg.addColorStop(1,'#efe4cf');g.fillStyle=bg;g.fillRect(0,0,w,h);
  g.strokeStyle='#b89b66';g.lineWidth=4;g.strokeRect(40,40,w-80,h-80);g.lineWidth=1.5;g.strokeRect(58,58,w-116,h-116);
  g.textAlign='center';g.fillStyle='#9a7b45';g.font=`500 24px ${sans}`;g.letterSpacing='10px';g.fillText('EL MUSEO DE NOSOTROS',w/2,170);g.letterSpacing='0px';
  g.fillStyle='#443b30';g.font=`italic 84px ${serif}`;g.fillText(config.couple,w/2,290);
  g.strokeStyle='#b89b66';g.lineWidth=2;g.beginPath();g.moveTo(w/2-120,330);g.lineTo(w/2+120,330);g.stroke();
  g.fillStyle='#7c7263';g.font=`34px ${serif}`;g.fillText(config.celebration,w/2,395);g.font=`28px ${sans}`;g.fillText(config.date,w/2,445);
  const done=Museum.getProgress().completed;
  config.rooms.forEach((item,index)=>{
    const col=index%3,row=Math.floor(index/3),cx=w/2+(col-1)*300,cy=640+row*330,on=done.includes(item.id);
    g.strokeStyle=on?'#8a6a3c':'#c9b89c';g.lineWidth=5;g.beginPath();g.arc(cx,cy,104,0,Math.PI*2);g.stroke();g.lineWidth=2;g.beginPath();g.arc(cx,cy,88,0,Math.PI*2);g.stroke();
    g.fillStyle=on?'#8a6a3c':'#c9b89c';g.font=`500 18px ${sans}`;g.letterSpacing='4px';g.fillText(`SALA ${String(index+1).padStart(2,'0')}`,cx,cy-34);g.letterSpacing='0px';
    g.font=`48px ${serif}`;g.fillText(on?'✧':'·',cx,cy+22);
    g.fillStyle='#5b4a36';g.font=`italic 22px ${serif}`;wrapText(g,item.title.replace(/\.$/,''),cx,cy+150,250,28,2);
  });
  g.fillStyle='#443b30';g.font=`italic 46px ${serif}`;wrapText(g,room.card?.phrase||'Nuestra historia merece su propio museo',w/2,1390,w-200,56,2);
  g.fillStyle='#9a7b45';g.font=`500 20px ${sans}`;g.letterSpacing='6px';g.fillText(`${done.length} DE 6 SALAS COMPLETADAS`,w/2,1500);g.letterSpacing='0px';
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Sin imagen')),'image/png'));
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
  else if(target.id==='piece')openPiece(source);
  else if(target.id==='letter')openLetterNote(source);
  else if(target.id==='vitrine')openVitrine(source);
  else if(target.id==='bench')approachArtwork();
}
function openHelp(source) {
  const panel=$('#artwork-help-panel');
  Museum.openContent({className:'room-help-sheet',source,html:'<div class="dialog-heading"><p class="eyebrow">SALA 06 · AYUDA</p><h2 id="dialog-title">Tu recorrido</h2></div><button class="button primary help-tutorial" type="button">Ver cómo moverse</button>',onClose:()=>{panel.hidden=true;$('#artwork-screen').append(panel);}});
  $('#dialog-content').append(panel);panel.hidden=false;
  $('#dialog-content .help-tutorial').addEventListener('click',()=>Museum.openTutorial('room',source));
}

Museum.registerRoom(ROOM_ID,enterRoom);
$('#artwork-approach').addEventListener('click',approachArtwork);
$('#artwork-go-piece').addEventListener('click',event=>guide('piece',event.currentTarget));
$('#artwork-go-letter').addEventListener('click',event=>guide('letter',event.currentTarget));
$('#artwork-go-vitrine').addEventListener('click',event=>guide('vitrine',event.currentTarget));
$('#artwork-exit-door').addEventListener('click',event=>{if(fallback||!engine||!exitTarget){Museum.returnToLobby();return;}goTo(exitTarget,{source:event.currentTarget});});
document.querySelectorAll('[data-artwork-tour]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.artworkTour;Museum.closeOverlay();setTimeout(()=>guide(key),0);}));
$('#artwork-open-final').addEventListener('click',event=>openFinale(event.currentTarget));
$('#artwork-help').addEventListener('click',event=>openHelp(event.currentTarget));
$('#artwork-back').addEventListener('click',()=>{closeNote(false,false);Museum.returnToLobby();});
$('#artwork-passport').addEventListener('click',event=>Museum.openPassport(event.currentTarget));
document.addEventListener('museum:progress',updateProgress);
document.addEventListener('museum:overlay',event=>{engine?.setPaused(event.detail);});
// Al salir de la sala: se cierra la nota y se detiene cualquier medio de esta sala.
document.addEventListener('museum:screen',event=>{
  const here=event.detail===ROOM_ID;
  if(!here){closeNote(false,false);$('#artwork-approach').hidden=true;}
  engine?.setActive(here);
});
updateProgress();
window.__artDebug={get engine(){return engine;},reducedMotion,THREE,get piece(){return pieceTarget;},get letter(){return letterTarget;},get vitrine(){return caseTarget;}};
