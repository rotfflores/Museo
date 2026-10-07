/* Sala 02 · Momentos que se quedaron: una galería larga con tres zonas conectadas.
   Usa el mismo motor, gestos, notas laterales, dock y puertas que la sala 01. */
import * as THREE from './vendor/three.module.min.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {Reflector} from './vendor/Reflector.js';
import {createGallery,focusArtwork} from './gallery-engine.js';
import {isWalkable} from './navigation.mjs';

const Museum=window.Museum,config=window.MUSEUM_CONFIG,room=config.momentsRoom;
const ROOM_ID='moments';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text=value=>String(value??'').replace(/\{(sender|recipient)\}/g,(_,key)=>config[key]);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const exhibits=room.exhibits;
const TOTAL=()=>exhibits.length;

// Planta: x de -5 a 5; la entrada en z = 6 y el fondo en z = -20. Dos tabiques con vano separan las zonas.
const WIDTH=10,FRONT=6,BACK=-20,WALL_H=5.2,PARTITIONS=[-3.5,-11.5],OPENING=1.7;
const ZONES=[{start:FRONT,end:PARTITIONS[0]},{start:PARTITIONS[0],end:PARTITIONS[1]},{start:PARTITIONS[1],end:BACK}];
const BOUNDS={minX:-4.55,maxX:4.55,minZ:BACK+.45,maxZ:FRONT-.65};
const obstacles=[
  ...PARTITIONS.flatMap(z=>[{minX:-5,maxX:-OPENING-.05,minZ:z-.2,maxZ:z+.2},{minX:OPENING+.05,maxX:5,minZ:z-.2,maxZ:z+.2}])
];

let engine=null,initialized=false,fallback=false,selected=null,currentPiece=0;
let focused=null,flyingTo=null,hoverTarget=null,ping=null,firstFrame=null,contemplating=false;
let exitTarget=null,exitOpen=0,exitOpening=false,overviewTarget=null,clueTarget=null;
const targets=[],pieceTargets=[],lazy=[];
let playback=null;
const videoControls=document.createElement('div');
videoControls.className='room-video-controls';videoControls.hidden=true;
videoControls.setAttribute('role','group');videoControls.setAttribute('aria-label','Controles del video en el cuadro');
videoControls.innerHTML='<button id="room-video-play" type="button">Reproducir</button><input id="room-video-seek" type="range" min="0" max="100" value="0" step=".1" aria-label="Posición del video"><button id="room-video-sound" type="button" aria-label="Silenciar video">Sonido</button><button id="room-video-back" type="button">Volver</button><p id="room-video-status" class="sr-only" role="status"></p>';
$('#moments-screen').append(videoControls);

{const words=room.title.split(' '),last=words.pop();$('#moments-title').innerHTML=words.length?`${escape(words.join(' '))} <em>${escape(last)}</em>`:escape(last);}
$('#moments-subtitle').textContent=room.subtitle;
// Contador discreto bajo el título, como parte del rótulo de la sala.
$('#moments-screen .room-overlay').append($('#moments-counter'));
$('#moments-tour').innerHTML=exhibits.map((piece,index)=>`<button class="tour-stop" data-moments-tour="${index}" type="button"><span class="tour-number">${String(index+1).padStart(2,'0')}</span><span>${escape(piece.title)}<small>${escape(room.zones[piece.zone]||'')} · ${escape(piece.mediaLabel?.toLowerCase()||(piece.type==='video'?'video':'fotografía'))}</small></span><span class="tour-check" aria-label="Sin descubrir">○</span></button>`).join('');
const videoDescriptions=document.createElement('div');videoDescriptions.className='room-video-descriptions';
videoDescriptions.innerHTML=exhibits.filter(piece=>piece.type==='video').map(piece=>`<h3>${escape(piece.title)}</h3><p class="room-note-dedication">${escape(text(piece.dedication||piece.phrase||''))}</p>${mediaCredit(piece)}`).join('');
$('#moments-help-panel').append(videoDescriptions);

function updateProgress() {
  const progress=Museum.getProgress(),found=progress.discoveries[ROOM_ID]||[];
  const counter=`Recuerdos descubiertos: ${found.length} de ${TOTAL()}`;
  $('#moments-counter').textContent=counter;$('#moments-discovery-count').textContent=counter;
  $('#moments-clue-count').textContent=`Pistas encontradas: ${progress.clues.length} de ${config.clueIds.length}`;
  $('#moments-passport-count').textContent=`${progress.completed.length}/6`;
  $('#moments-passport').setAttribute('aria-label',`Pasaporte de recuerdos, ${progress.completed.length} de 6 salas completadas`);
  for(const target of pieceTargets)if(target.seen)target.seen.visible=found.includes(target.id);
  document.querySelectorAll('[data-moments-tour]').forEach(button=>{
    const done=found.includes(exhibits[Number(button.dataset.momentsTour)].id);
    button.classList.toggle('discovered',done);
    const check=button.querySelector('.tour-check');check.textContent=done?'✧':'○';check.setAttribute('aria-label',done?'Descubierto':'Sin descubrir');
  });
}
function nameOf(target) {
  if(!target)return room.subtitle;
  if(target.id==='exit')return 'La puerta al vestíbulo';
  if(target.id==='overview')return 'Contemplar la sala';
  if(target.id==='clue')return 'Un pequeño detalle en la pared';
  return exhibits[target.index].title;
}
function setTarget(target) {
  selected=target;
  $('#moments-target-name').textContent=nameOf(target);
  $('#moments-view').textContent=target?target.id==='exit'?'Volver al vestíbulo':target.id==='overview'?'Contemplar la sala':target.id==='clue'?'Mirar el detalle':`Ver el recuerdo: ${nameOf(target)}`:'Ir al recuerdo más cercano';
}
function fallbackMode() {
  fallback=true;$('#moments-fallback').hidden=false;$('#moments-stage').classList.add('without-webgl');
  $('#moments-accessible-clue').hidden=false;
}
function texture(width,height,paint) {
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;paint(canvas.getContext('2d'),width,height);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map;
}
// Texto envuelto en el lienzo de una placa.
function wrapText(g,value,x,y,maxWidth,lineHeight,maxLines=2) {
  const words=value.split(' ');let line='',lines=[];
  for(const word of words){const test=line?line+' '+word:word;if(g.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;}
  if(line)lines.push(line);
  if(lines.length>maxLines){lines=lines.slice(0,maxLines);lines[maxLines-1]=lines[maxLines-1].replace(/\s*\S*$/,'')+'…';}
  lines.forEach((l,i)=>g.fillText(l,x,y+i*lineHeight));
}

function buildRoom() {
  const test=document.createElement('canvas');
  if(!test.getContext('webgl2')){fallbackMode();return;}
  const small=innerWidth<600,maxTexture=small?768:1024;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#efe6d6');scene.fog=new THREE.Fog('#efe6d6',16,34);
  const camera=new THREE.PerspectiveCamera(60,1,.1,45);camera.position.set(0,1.65,4.6);
  // Los haces decorativos sólo se dibujan en la vista directa, fuera del espejo.
  camera.layers.enable(1);
  const ivory=new THREE.MeshStandardMaterial({color:'#f1e8d6',roughness:.95});
  const trim=new THREE.MeshStandardMaterial({color:'#d8c6a6',roughness:.8});
  const wood=new THREE.MeshStandardMaterial({color:'#4c3828',roughness:.5});
  const marble=new THREE.MeshStandardMaterial({color:'#f3ece0',roughness:.3});
  const goldTrim=new THREE.MeshStandardMaterial({color:'#c9a564',metalness:1,roughness:.28});
  const mat=new THREE.MeshStandardMaterial({color:'#f7f1e4',roughness:.95});
  const rand=(seed=>()=>(seed=(seed*16807)%2147483647)/2147483647)(23);
  const dotMap=texture(64,64,g=>{const grad=g.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(255,248,225,1)');grad.addColorStop(.35,'rgba(255,232,180,.55)');grad.addColorStop(1,'rgba(255,230,170,0)');g.fillStyle=grad;g.fillRect(0,0,64,64);});
  const washMap=texture(128,128,g=>{const grad=g.createRadialGradient(64,40,0,64,64,64);grad.addColorStop(0,'rgba(255,236,196,.95)');grad.addColorStop(.55,'rgba(255,222,170,.35)');grad.addColorStop(1,'rgba(255,220,160,0)');g.fillStyle=grad;g.fillRect(0,0,128,128);});
  function box(width,height,depth,x,y,z,material=ivory) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);mesh.position.set(x,y,z);mesh.receiveShadow=true;scene.add(mesh);return mesh;
  }
  const length=FRONT-BACK,midZ=(FRONT+BACK)/2;
  // Suelo: espejo bajo un mármol con losas y filete dorado, sin círculos centrales.
  const floorMap=texture(788,2048,(g,w,h)=>{
    const u=x=>(x+WIDTH/2)/WIDTH*w,v=z=>(FRONT-z)/length*h;
    g.fillStyle='#eadfca';g.fillRect(0,0,w,h);
    for(let i=0;i<70;i++){g.strokeStyle=`rgba(150,128,98,${.05+rand()*.08})`;g.lineWidth=1+rand()*2.5;g.beginPath();let x=rand()*w,y=rand()*h;g.moveTo(x,y);for(let k=0;k<4;k++){x+=(rand()-.5)*260;y+=(rand()-.5)*260;g.quadraticCurveTo(x+(rand()-.5)*160,y+(rand()-.5)*160,x,y);}g.stroke();}
    g.strokeStyle='rgba(181,154,108,.45)';g.lineWidth=2;
    for(let x=-5;x<=5;x+=2.5){g.beginPath();g.moveTo(u(x),0);g.lineTo(u(x),h);g.stroke();}
    for(let z=FRONT;z>=BACK;z-=2.5){g.beginPath();g.moveTo(0,v(z));g.lineTo(w,v(z));g.stroke();}
    g.strokeStyle='#b59a6c';g.lineWidth=8;g.strokeRect(u(-4.6),v(FRONT-.4),u(4.6)-u(-4.6),v(BACK+.4)-v(FRONT-.4));
  });
  box(WIDTH,.12,length,0,-.061,midZ,new THREE.MeshStandardMaterial({color:'#8a8378',roughness:.4}));
  const mirror=new Reflector(new THREE.PlaneGeometry(WIDTH,length),{textureWidth:small?384:768,textureHeight:small?1024:2048,color:0x8a8378,clipBias:.003});
  mirror.rotation.x=-Math.PI/2;mirror.position.set(0,.001,midZ);scene.add(mirror);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(WIDTH,length),new THREE.MeshStandardMaterial({map:floorMap,transparent:true,opacity:.8,roughness:.35}));
  floor.material.map.anisotropy=4;floor.rotation.x=-Math.PI/2;floor.position.set(0,.005,midZ);scene.add(floor);
  // Muros, zócalo con filete dorado, cornisa y techo con tres óculos (uno por zona).
  box(.18,WALL_H,length,-5,WALL_H/2,midZ);box(.18,WALL_H,length,5,WALL_H/2,midZ);box(WIDTH,WALL_H,.18,0,WALL_H/2,BACK);box(WIDTH,WALL_H,.18,0,WALL_H/2,FRONT);
  box(WIDTH,.14,length,0,WALL_H+.07,midZ);
  const skirting=new THREE.MeshStandardMaterial({color:'#d9c7a7',roughness:.75});
  for(const side of [-1,1]){box(.12,.45,length,side*4.86,.225,midZ,skirting);box(.035,.035,length,side*4.79,.47,midZ,goldTrim);box(.12,.12,length,side*4.86,WALL_H-.3,midZ,trim);}
  box(WIDTH,.45,.12,0,.225,BACK+.14,skirting);box(WIDTH,.12,.12,0,WALL_H-.3,BACK+.14,trim);
  // Tabiques con vano entre zonas: piedra crema, marco dorado y el nombre de la zona en la pared.
  for(const z of PARTITIONS){
    for(const side of [-1,1]){const w=5-OPENING;box(w,WALL_H,.3,side*(OPENING+w/2),WALL_H/2,z);box(w,.45,.36,side*(OPENING+w/2),.225,z,skirting);}
    box(OPENING*2,WALL_H-3.4,.3,0,3.4+(WALL_H-3.4)/2,z);
    for(const side of [-1,1])box(.06,3.4,.36,side*OPENING,1.7,z,goldTrim);
    box(OPENING*2+.06,.06,.36,0,3.4,z,goldTrim);
  }
  function zoneTitle(index,x,y,z,width=2.7) {
    const map=texture(1024,256,(g,w,h)=>{
      g.textAlign='center';g.fillStyle='#9a7b45';g.font='500 26px "Segoe UI", Arial, sans-serif';g.letterSpacing='12px';g.fillText(`ZONA 0${index+1}`,w/2,62);g.letterSpacing='0px';
      g.fillStyle='#4a3c2c';let size=78;g.font=`italic ${size}px Georgia, "Times New Roman", serif`;while(g.measureText(room.zones[index]).width>w-60&&size>40){size-=4;g.font=`italic ${size}px Georgia, "Times New Roman", serif`;}
      g.fillText(room.zones[index],w/2,160);g.strokeStyle='#b89b66';g.lineWidth=3;g.beginPath();g.moveTo(w/2-110,200);g.lineTo(w/2+110,200);g.stroke();
    });
    map.anisotropy=4;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map,transparent:true,toneMapped:false}));mesh.position.set(x,y,z);scene.add(mesh);return mesh;
  }
  // Cada zona muestra su nombre a la altura de la vista, en el muro del fondo junto al vano.
  zoneTitle(0,3.35,2.6,PARTITIONS[0]+.16);zoneTitle(1,3.35,2.6,PARTITIONS[1]+.16);zoneTitle(2,3.35,2.6,BACK+.1);
  // Techo: tres óculos con su haz de luz, como la rotonda.
  const shaftTime={value:0};
  const shaftMaterial=new THREE.ShaderMaterial({uniforms:{uTime:shaftTime},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`varying vec2 vUv; varying float vFacing; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vec3 n=normalize(normalMatrix*normal); vFacing=abs(dot(n,normalize(-mv.xyz))); gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`uniform float uTime; varying vec2 vUv; varying float vFacing; void main(){ float rays=.65+.35*sin(vUv.x*62.+uTime*.35)*sin(vUv.x*23.-uTime*.21); float a=pow(vFacing,2.2)*smoothstep(0.,.55,vUv.y)*.07*rays; gl_FragColor=vec4(vec3(1.,.93,.78)*a,a); }`});
  const shaftGeometry=new THREE.CylinderGeometry(.75,1.7,WALL_H-.05,40,1,true),oculusGeometry=new THREE.CircleGeometry(.75,40),ringGeometry=new THREE.TorusGeometry(.79,.035,8,56);
  const oculusMaterial=new THREE.MeshBasicMaterial({color:'#fff8e8',toneMapped:false});
  scene.add(new THREE.HemisphereLight('#fff4de','#9c8466',1.05));
  for(const zone of ZONES){const cz=(zone.start+zone.end)/2;
    const oculus=new THREE.Mesh(oculusGeometry,oculusMaterial);oculus.rotation.x=Math.PI/2;oculus.position.set(0,WALL_H-.01,cz);scene.add(oculus);
    const ring=new THREE.Mesh(ringGeometry,goldTrim);ring.rotation.x=Math.PI/2;ring.position.set(0,WALL_H-.02,cz);scene.add(ring);
    const shaft=new THREE.Mesh(shaftGeometry,shaftMaterial);shaft.layers.set(1);shaft.position.set(0,(WALL_H-.05)/2,cz);scene.add(shaft);
    const light=new THREE.PointLight('#ffe2b0',16,13,1.4);light.position.set(0,3.6,cz);scene.add(light);
  }
  // Placas como las de la sala 01: título, fecha o etapa y una frase breve.
  function plaque(piece,index,width=1.7) {
    const map=texture(1024,300,(g,w,h)=>{
      const grad=g.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#efe5d0');grad.addColorStop(1,'#e0d0b3');g.fillStyle=grad;g.fillRect(0,0,w,h);
      g.strokeStyle='#beaa85';g.lineWidth=4;g.strokeRect(2,2,w-4,h-4);g.strokeStyle='rgba(245,236,212,.7)';g.lineWidth=8;g.strokeRect(8,8,w-16,h-16);
      g.fillStyle='#a28b61';for(const [sx,sy] of [[24,24],[w-24,24],[24,h-24],[w-24,h-24]]){g.beginPath();g.arc(sx,sy,5,0,Math.PI*2);g.fill();}
      g.textAlign='center';g.fillStyle='#9a7b45';g.font='500 20px "Segoe UI", Arial, sans-serif';g.letterSpacing='5px';
      let eyebrow=`${piece.mediaLabel||(piece.type==='video'?'VIDEO':'OBRA')} ${String(index+1).padStart(2,'0')}  ·  ${piece.date.toUpperCase()}`;while(g.measureText(eyebrow).width>w-80)eyebrow=eyebrow.slice(0,-2);
      g.fillText(eyebrow,w/2,58);g.letterSpacing='0px';
      let size=50;g.font=`italic ${size}px Georgia, "Times New Roman", serif`;while(g.measureText(piece.title).width>w-90){size-=2;g.font=`italic ${size}px Georgia, "Times New Roman", serif`;}
      g.fillStyle='#4a3c2c';g.fillText(piece.title,w/2,128);
      g.strokeStyle='#b89b66';g.lineWidth=2;g.beginPath();g.moveTo(w/2-70,154);g.lineTo(w/2+70,154);g.stroke();
      g.font='26px Georgia, "Times New Roman", serif';g.fillStyle='#766750';wrapText(g,text(piece.phrase||''),w/2,202,w-120,34,2);
    });
    map.anisotropy=4;
    return new THREE.Mesh(new THREE.PlaneGeometry(width,width*300/1024),new THREE.MeshBasicMaterial({map,toneMapped:false}));
  }
  // Ubicaciones: dos muros laterales por zona y el muro del fondo de cada zona.
  const SIZES={landscape:[2.6,1.95],portrait:[1.65,2.35],square:[2.0,2.0],wide:[3.0,1.85],screen:[2.4,1.42],bigscreen:[3.2,1.86],portraitScreen:[1.45,1.45*976/576]};
  const sizeFor=(piece,index)=>piece.frame||(piece.type==='video'?(piece.zone===2?'bigscreen':'screen'):['landscape','portrait','square','landscape','portrait','wide'][index%6]);
  function slotsFor(zone) {
    const {start,end}=ZONES[zone],span=start-end,far=zone===2?BACK+.1:PARTITIONS[zone]+.17;
    const walls=[{x:-4.9,z:start-span*.33,face:'left'},{x:4.9,z:start-span*.58,face:'right'},{x:-4.9,z:start-span*.74,face:'left'},{x:4.9,z:start-span*.22,face:'right'}];
    const farSlots=zone===2?[{x:0,z:far,face:'far'},{x:-3.35,z:far,face:'far'}]:[{x:-3.35,z:far,face:'far'}];
    return {walls,farSlots};
  }
  const used=new Map();
  function placeFor(piece) {
    const zone=Math.min(2,Math.max(0,piece.zone|0)),slots=slotsFor(zone),taken=used.get(zone)||new Set();used.set(zone,taken);
    const order=piece.type==='video'?[...slots.farSlots,...slots.walls]:[...slots.walls,...slots.farSlots];
    const slot=order.find(item=>!taken.has(`${item.x},${item.z}`))||order[0];taken.add(`${slot.x},${slot.z}`);
    return slot;
  }
  const rotations={left:Math.PI/2,right:-Math.PI/2,far:0};
  const outward={left:[1,0,0],right:[-1,0,0],far:[0,0,1]};
  const frameMaterials=[];
  exhibits.forEach((piece,index)=>{
    const slot=placeFor(piece),[fw,fh]=SIZES[sizeFor(piece,index)],group=new THREE.Group();
    const portraitVideo=piece.type==='video'&&fh>fw;
    const cy=piece.type==='video'?2.25:2.15;
    group.position.set(slot.x,cy,slot.z);group.rotation.y=rotations[slot.face];scene.add(group);
    const frameGold=goldTrim.clone();frameMaterials.push(frameGold);
    const border=.1;
    // Marco de madera con filete dorado.
    for(const [w,h,x,y] of [[fw+border*2,border,0,fh/2+border/2],[fw+border*2,border,0,-fh/2-border/2],[border,fh,-fw/2-border/2,0],[border,fh,fw/2+border/2,0]]){const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,.09),wood);b.position.set(x,y,.045);b.castShadow=true;group.add(b);}
    for(const [w,h,x,y] of [[fw+.02,.025,0,fh/2],[fw+.02,.025,0,-fh/2],[.025,fh,-fw/2,0],[.025,fh,fw/2,0]]){const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,.1),frameGold);b.position.set(x,y,.05);group.add(b);}
    let surface,media=null;
    if(piece.type==='photo'){
      // Paspartú: la foto conserva su proporción dentro del marco, nunca se deforma.
      const passe=new THREE.Mesh(new THREE.PlaneGeometry(fw,fh),mat);passe.position.z=.012;group.add(passe);
      surface=new THREE.Mesh(new THREE.PlaneGeometry(fw*.8,fh*.8),new THREE.MeshStandardMaterial({color:'#e6dccb',roughness:.9}));surface.position.z=.018;group.add(surface);
      const bevel=new THREE.Mesh(new THREE.PlaneGeometry(fw*.8+.03,fh*.8+.03),new THREE.MeshStandardMaterial({color:'#d9cdb6',roughness:.9}));bevel.position.z=.015;group.add(bevel);
      lazy.push({group,load:()=>new THREE.TextureLoader().load(piece.src,map=>{
        const img=map.image,iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,ratio=iw/ih,maxW=fw*.84,maxH=fh*.84;
        let w=maxW,h=w/ratio;if(h>maxH){h=maxH;w=h*ratio;}
        const raster=document.createElement('canvas'),scale=Math.min(1,maxTexture/Math.max(iw,ih));raster.width=Math.round(iw*scale);raster.height=Math.round(ih*scale);
        raster.getContext('2d').drawImage(img,0,0,raster.width,raster.height);
        const sceneMap=new THREE.CanvasTexture(raster);sceneMap.colorSpace=THREE.SRGBColorSpace;sceneMap.anisotropy=4;
        surface.geometry.dispose();surface.geometry=new THREE.PlaneGeometry(w,h);surface.material.dispose();surface.material=new THREE.MeshBasicMaterial({map:sceneMap,toneMapped:false,color:'#f2ebe0'});
        bevel.geometry.dispose();bevel.geometry=new THREE.PlaneGeometry(w+.03,h+.03);map.dispose();
      },undefined,()=>{/* Si falta la imagen, el marco conserva su paspartú. */})});
    } else {
      // Pantalla enmarcada: portada con botón de reproducción; el video se carga sólo al pedirlo.
      const portrait=fh>fw,screenCanvas=document.createElement('canvas');screenCanvas.width=portrait?576:640;screenCanvas.height=Math.round(screenCanvas.width*fh/fw);
      const paintScreen=image=>{const g=screenCanvas.getContext('2d'),w=screenCanvas.width,h=screenCanvas.height,cx=w/2,cy=h/2;g.fillStyle='#1f1814';g.fillRect(0,0,w,h);if(image){const r=Math.min(w/image.width,h/image.height);g.drawImage(image,(w-image.width*r)/2,(h-image.height*r)/2,image.width*r,image.height*r);}
        g.beginPath();g.arc(cx,cy,portrait?42:52,0,Math.PI*2);g.fillStyle='rgba(251,247,237,.92)';g.fill();g.strokeStyle='#c9a564';g.lineWidth=4;g.stroke();
        g.beginPath();g.moveTo(cx-12,cy-22);g.lineTo(cx-12,cy+22);g.lineTo(cx+25,cy);g.closePath();g.fillStyle='#4a3c2c';g.fill();};
      paintScreen(null);
      const screenMap=new THREE.CanvasTexture(screenCanvas);screenMap.colorSpace=THREE.SRGBColorSpace;
      surface=new THREE.Mesh(new THREE.PlaneGeometry(fw,fh),new THREE.MeshBasicMaterial({map:screenMap,toneMapped:false}));surface.position.z=.015;group.add(surface);
      media={group,surface,posterMap:screenMap,width:fw,height:fh,x:slot.x,z:slot.z,out:outward[slot.face],cy};
      if(piece.poster)lazy.push({group,load:()=>{const image=new Image();image.decoding='async';image.onload=()=>{paintScreen(image);screenMap.needsUpdate=true;};image.src=piece.poster;}});
    }
    // Foco cálido sobre la obra y un lavado de luz en el muro.
    const fixture=new THREE.Mesh(new THREE.BoxGeometry(.5,.05,.16),goldTrim);fixture.position.set(0,fh/2+.75,.35);group.add(fixture);
    const wash=new THREE.Mesh(new THREE.PlaneGeometry(fw*1.9,fh*1.9),new THREE.MeshBasicMaterial({map:washMap,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending}));wash.position.set(0,.15,.004);group.add(wash);
    const p=plaque(piece,index,Math.min(1.8,Math.max(1.35,fw*.62)));
    if(slot.face==='far'&&piece.type==='video'){p.position.set(0,-fh/2-.42,.03);}else{p.position.set(0,-fh/2-.42,.03);}
    group.add(p);
    // Puntos de acceso y orientación de la cámara.
    const out=outward[slot.face],distance=portraitVideo?3.6:piece.type==='video'?2.9:2.7;
    const approach={x:THREE.MathUtils.clamp(slot.x+out[0]*distance,BOUNDS.minX+.2,BOUNDS.maxX-.2),z:slot.z+out[2]*distance};
    const world=group.position;
    const halo=[world.x+out[0]*.25,cy,world.z+out[2]*.25,Math.max(fw,fh)*1.15];
    const seenPos=[world.x+out[0]*.08,cy+fh/2+.36,world.z+out[2]*.08];
    targets.push({id:piece.id,index,focus:new THREE.Vector3(world.x,portraitVideo?1.8:cy-.05,world.z),approach,hits:[surface,p],marker:null,glow:[frameGold],lift:group,rise:out.map(v=>v*.05),halo,seen:seenPos,piece,media,artwork:piece.type==='photo'?{x:slot.x,y:cy,z:slot.z,width:fw+.2,height:fh+.2,out}:null});
  });
  // Contemplar desde el pasillo abierto, sin mobiliario ni obstáculos invisibles.
  overviewTarget={id:'overview',focus:new THREE.Vector3(0,1.65,-12),approach:{x:0,z:3.2},hits:[],marker:null};
  // Pista secreta: cámara dorada en el muro derecho al entrar a la segunda zona.
  {
    const gold=new THREE.MeshStandardMaterial({color:'#d7b46a',metalness:1,roughness:.25});
    const camera3d=new THREE.Group();camera3d.position.set(4.86,1.1,-4.6);camera3d.rotation.y=-Math.PI/2;scene.add(camera3d);
    const body=new THREE.Mesh(new THREE.BoxGeometry(.16,.1,.04),gold);camera3d.add(body);
    const lens=new THREE.Mesh(new THREE.CylinderGeometry(.032,.036,.035,20),gold);lens.rotation.x=Math.PI/2;lens.position.z=.035;camera3d.add(lens);
    const top=new THREE.Mesh(new THREE.BoxGeometry(.05,.025,.035),gold);top.position.set(-.04,.06,0);camera3d.add(top);
    const clueHit=new THREE.Mesh(new THREE.SphereGeometry(.3,12,8),new THREE.MeshBasicMaterial({visible:false}));clueHit.position.set(4.8,1.1,-4.6);scene.add(clueHit);
    clueTarget={id:'clue',focus:new THREE.Vector3(4.86,1.1,-4.6),approach:{x:2.4,z:-4.6},hits:[clueHit],marker:null,glow:[gold],lift:camera3d,rise:[-.02,.02,0],halo:[4.78,1.1,-4.6,.6]};
    targets.push(clueTarget);
  }
  // Puerta de regreso al vestíbulo: detrás de la cámara, en el muro por donde se entra (igual que en la sala 01).
  {
    const door=new THREE.Group();door.position.set(0,0,FRONT-.24);door.rotation.y=Math.PI;scene.add(door);
    const W=1.4,H=2.45;
    const ring=(w,h,grow,inner)=>{const o=new THREE.Shape();o.moveTo(-w/2-grow,-.02);o.lineTo(w/2+grow,-.02);o.lineTo(w/2+grow,h+grow);o.lineTo(-w/2-grow,h+grow);o.lineTo(-w/2-grow,-.02);const i=new THREE.Path();i.moveTo(-w/2-inner,0);i.lineTo(-w/2-inner,h+inner);i.lineTo(w/2+inner,h+inner);i.lineTo(w/2+inner,0);i.lineTo(-w/2-inner,0);o.holes.push(i);return o;};
    const extrude=(shape,depth)=>new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:2,curveSegments:32});
    door.add(new THREE.Mesh(extrude(ring(W,H,.26,.12),.12),wood));door.add(new THREE.Mesh(extrude(ring(W,H,.12,0),.16),goldTrim));
    const beyond=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.MeshBasicMaterial({color:'#ffe4b4',toneMapped:false}));beyond.position.set(0,H/2,.004);door.add(beyond);
    const transomShape=new THREE.Shape();transomShape.moveTo(-W/2,0);transomShape.absarc(0,0,W/2,Math.PI,0,true);transomShape.lineTo(-W/2,0);
    const transom=new THREE.Mesh(new THREE.ShapeGeometry(transomShape,32),new THREE.MeshBasicMaterial({color:'#ffe0a8',toneMapped:false}));transom.position.set(0,H+.12,.02);door.add(transom);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(W/2+.04,.035,10,48,Math.PI),goldTrim);rim.position.set(0,H+.12,.05);door.add(rim);
    const leafMap=texture(256,512,(g,w,h)=>{const grad=g.createLinearGradient(0,0,w,0);grad.addColorStop(0,'#3e2516');grad.addColorStop(.5,'#5e3a22');grad.addColorStop(1,'#3e2516');g.fillStyle=grad;g.fillRect(0,0,w,h);
      for(let i=0;i<70;i++){g.strokeStyle=`rgba(30,16,8,${.08+rand()*.12})`;g.lineWidth=1;g.beginPath();const x=rand()*w;g.moveTo(x,0);g.bezierCurveTo(x+(rand()-.5)*20,h*.33,x+(rand()-.5)*20,h*.66,x+(rand()-.5)*14,h);g.stroke();}
      for(const [y,ph] of [[40,230],[300,170]]){g.strokeStyle='#b38a4e';g.lineWidth=3;g.strokeRect(34,y,w-68,ph);g.strokeStyle='rgba(20,10,5,.55)';g.lineWidth=6;g.strokeRect(44,y+10,w-88,ph-20);}});
    const leafMaterial=new THREE.MeshStandardMaterial({map:leafMap,roughness:.55}),leaves=[];
    for(const side of [-1,1]){const hinge=new THREE.Group();hinge.position.set(side*W/2,0,.03);door.add(hinge);
      const leaf=new THREE.Mesh(new THREE.BoxGeometry(W/2-.01,H-.01,.06),leafMaterial);leaf.position.set(-side*(W/4),H/2,0);hinge.add(leaf);
      const handle=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.34,10),goldTrim);handle.position.set(-side*(W/2-.12),1.2,.06);hinge.add(handle);leaves.push({hinge,side,leaf});}
    const plateMap=texture(512,160,(g,w,h)=>{const grad=g.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#efe5d0');grad.addColorStop(1,'#e0d0b3');g.fillStyle=grad;g.fillRect(0,0,w,h);
      g.strokeStyle='#beaa85';g.lineWidth=4;g.strokeRect(2,2,w-4,h-4);g.fillStyle='#a28b61';for(const [x,y] of [[18,18],[w-18,18],[18,h-18],[w-18,h-18]]){g.beginPath();g.arc(x,y,5,0,Math.PI*2);g.fill();}
      g.textAlign='center';g.fillStyle='#9a7b45';g.font='500 18px "Segoe UI", Arial, sans-serif';g.letterSpacing='6px';g.fillText('SALIDA',w/2,52);g.letterSpacing='0px';g.fillStyle='#4a3c2c';g.font='italic 54px Georgia, "Times New Roman", serif';g.fillText('Vestíbulo',w/2,118);});
    const plate=new THREE.Mesh(new THREE.PlaneGeometry(1.15,.36),new THREE.MeshBasicMaterial({map:plateMap,toneMapped:false}));plate.position.set(0,H+1.05,.06);door.add(plate);
    const lamp=new THREE.PointLight('#ffd9a0',1.6,4,1.6);lamp.position.set(0,3.9,.9);door.add(lamp);
    const doorHit=new THREE.Mesh(new THREE.BoxGeometry(W+.3,H+1.4,.12),new THREE.MeshBasicMaterial({visible:false}));doorHit.position.set(0,(H+1.4)/2,.1);door.add(doorHit);
    exitTarget={id:'exit',focus:new THREE.Vector3(0,1.45,FRONT-.2),approach:{x:0,z:FRONT-2.7},hits:[doorHit,...leaves.map(item=>item.leaf),plate,transom],marker:null,glow:[leafMaterial],lift:plate,rise:[0,.04,0],halo:[0,1.5,FRONT-.4,2.6],leaves};
    targets.push(exitTarget);
  }
  pieceTargets.push(...targets.filter(target=>target.index!==undefined));
  // Brillo dorado, halo y ✧ sobre las obras ya vistas, como en la sala 01.
  const sparkle=texture(128,128,(g,w,h)=>{g.textAlign='center';g.textBaseline='middle';g.font='92px Georgia, "Segoe UI Symbol", serif';g.shadowColor='rgba(255,226,160,.9)';g.shadowBlur=18;g.fillStyle=g.strokeStyle='#c9a564';g.lineWidth=5;g.lineJoin='round';g.strokeText('✧',w/2,h/2+4);g.fillText('✧',w/2,h/2+4);});
  for(const target of targets){
    for(const material of target.glow){material.emissive=new THREE.Color('#c9a564');material.emissiveIntensity=0;}
    target.base=target.lift.position.clone();target.h=0;
    const [x,y,z,size]=target.halo;
    target.haloSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:dotMap,color:'#ffe2a8',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
    target.haloSprite.position.set(x,y,z);target.haloSprite.scale.setScalar(size);scene.add(target.haloSprite);
    if(Array.isArray(target.seen)){const star=new THREE.Sprite(new THREE.SpriteMaterial({map:sparkle,transparent:true,depthWrite:false,toneMapped:false}));star.position.set(...target.seen);star.scale.setScalar(.3);star.visible=false;scene.add(star);target.seen=star;}
  }
  ping=new THREE.Mesh(new THREE.RingGeometry(.18,.24,40),new THREE.MeshBasicMaterial({color:'#b89b66',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));ping.rotation.x=-Math.PI/2;ping.position.y=.012;ping.userData.t=1;scene.add(ping);
  // Polvo dorado, más ligero en celular.
  const COUNT=small?150:280,dust=new Float32Array(COUNT*3),speeds=new Float32Array(COUNT);
  for(let i=0;i<COUNT;i++){dust.set([(rand()-.5)*8.5,rand()*WALL_H,FRONT-rand()*length],i*3);speeds[i]=.05+rand()*.1;}
  const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(dust,3));
  const motes=new THREE.Points(dustGeometry,new THREE.PointsMaterial({map:dotMap,size:.035,transparent:true,opacity:.65,depthWrite:false,blending:THREE.AdditiveBlending,color:'#ffe8bf'}));
  motes.frustumCulled=false;scene.add(motes);let lastDust=performance.now();
  motes.onBeforeRender=()=>{const now=performance.now(),dt=Math.min((now-lastDust)/1000,.05),t=now/1000;lastDust=now;if(reducedMotion.matches){shaftTime.value=2;return;}shaftTime.value=t;
    const p=dustGeometry.attributes.position;for(let i=0;i<COUNT;i++){let y=p.getY(i)+speeds[i]*dt;if(y>WALL_H)y=0;p.setY(i,y);}p.needsUpdate=true;};
  firstFrame=new Promise(resolve=>$('#moments-stage').addEventListener('gallery:ready',resolve,{once:true}));
  engine=createGallery({container:$('#moments-stage'),scene,camera,obstacles,targets,floor,bounds:BOUNDS,onTarget:setTarget,onActivate:target=>openTarget(target),onUnavailable:fallbackMode,onTap,onSwipe,onHover:target=>{hoverTarget=target;},onBack:()=>{if(contemplating)stopContemplating();else if(focused)stepBack();},onFrame:animate});
  engine.renderer.toneMappingExposure=.88;
  const pmrem=new THREE.PMREMGenerator(engine.renderer),environment=new RoomEnvironment();
  scene.environment=pmrem.fromScene(environment,.04).texture;scene.environmentIntensity=.55;environment.dispose();pmrem.dispose();
  engine.setActive(true);
  setTarget(null);
}

// Carga diferida: las imágenes de cada obra se piden cuando el visitante se acerca.
function loadNearby() {
  if(!engine)return;
  const camera=engine.camera.position;
  for(const item of lazy){if(item.done)continue;const p=item.group.position;if(Math.hypot(p.x-camera.x,p.z-camera.z)<13){item.done=true;item.load();}}
}
async function enterRoom() {
  const cover=()=>{
    Museum.showView(ROOM_ID);
    if(!initialized){initialized=true;try{buildRoom();}catch(error){console.warn('Sala 02 sin 3D:',error);fallbackMode();}}
    engine?.setActive(true);loadNearby();updateProgress();
  };
  const opened=await Museum.playDoors({lines:['Preparando la galería…','Encendiendo los focos…','Los momentos te esperan.'],cover,ready:()=>fallback?null:firstFrame,minimum:1500,variant:'room-02',plate:'02',label:'SALA 02 · MOMENTOS',title:room.title});
  if(!opened)cover();
  $('#moments-title').setAttribute('tabindex','-1');$('#moments-title').focus({preventScroll:true});
  if(!Museum.tutorialSeen('room'))Museum.openTutorial('room',$('#moments-help'));
}
function buzz(pattern){try{if(matchMedia('(pointer: coarse)').matches)navigator.vibrate?.(pattern);}catch{/* Sin vibración. */}}
function resume(){if(!$('#museum-dialog').open)engine?.setPaused(false);}
function guideTo(index,source=null) {
  currentPiece=index;
  if(fallback||!engine){openPiece(index,source||undefined);return;}
  goTo(pieceTargets[index],{source});
}
function goTo(target,{open=true,source=null}={}) {
  if(playback&&playback.target!==target)stopVideo();
  closeNote(false);resume();focusArtwork(engine.camera,target,BOUNDS);$('#moments-screen').classList.toggle('viewing-art',!!target.artwork);
  if(target.media){
    const m=target.media,tan=Math.tan(THREE.MathUtils.degToRad(engine.camera.fov/2));
    const distance=Math.max(1.5,m.height*1.12/(2*tan*.74),m.width*1.12/(2*tan*engine.camera.aspect*.88));
    target.approach={x:THREE.MathUtils.clamp(m.x+m.out[0]*distance,BOUNDS.minX+.2,BOUNDS.maxX-.2),z:m.z+m.out[2]*distance};
    target.focus.set(m.x,m.cy-.15,m.z);
    $('#moments-screen').classList.add('viewing-video');
  }else $('#moments-screen').classList.remove('viewing-video');
  if(target.index!==undefined)currentPiece=target.index;
  if(focused===target&&!engine.isFlying()){if(open)openTarget(target,source||undefined);return;}
  const previous=$('#moments-target-name').textContent;
  $('#moments-target-name').textContent=`Hacia: ${nameOf(target)}`;
  flyingTo=target;focused=null;
  const ok=engine.guideTo(target,{onArrive:()=>{flyingTo=null;focused=target;loadNearby();if(open)openTarget(target,source||undefined);}});
  if(ok)return;
  flyingTo=null;$('#moments-target-name').textContent=previous;
  if(open&&engine.camera.position.distanceTo(target.focus)<5)openTarget(target,source||undefined);
  else Museum.notify('Puedes acercarte a la obra caminando por la sala.');
}
// Un paso atrás: al centro del pasillo, mirando hacia el fondo de la galería.
function stepBack() {
  stopVideo();
  closeNote(false);
  if(!engine)return;
  resume();
  const from=focused?.approach||{x:engine.camera.position.x,z:engine.camera.position.z};focused=null;flyingTo=null;
  const candidates=[[0,from.z],[2.4,from.z],[-2.4,from.z],[0,from.z+1.6],[0,from.z-1.6]];
  const spot=candidates.find(([x,z])=>isWalkable(x,z,obstacles,BOUNDS));
  if(!spot)return;
  engine.guideTo({id:'overview',focus:new THREE.Vector3(spot[0],1.75,spot[1]-6),approach:{x:spot[0],z:spot[1]},hits:[],marker:null},{select:false});
}
function walkTo(point) {
  stopVideo();
  closeNote(false);
  const camera=engine.camera.position;
  let x=THREE.MathUtils.clamp(point.x,BOUNDS.minX,BOUNDS.maxX),z=THREE.MathUtils.clamp(point.z,BOUNDS.minZ,BOUNDS.maxZ);
  for(let i=0;i<14&&!isWalkable(x,z,obstacles,BOUNDS);i++){x+=(camera.x-x)*.22;z+=(camera.z-z)*.22;}
  const dx=x-camera.x,dz=z-camera.z,length=Math.hypot(dx,dz);
  if(!isWalkable(x,z,obstacles,BOUNDS)||length<.3)return;
  resume();focused=null;flyingTo=null;
  if(ping){ping.position.x=x;ping.position.z=z;ping.userData.t=0;}
  engine.guideTo({id:'floor',focus:new THREE.Vector3(x+dx/length*4,1.65,z+dz/length*4),approach:{x,z},hits:[],marker:null},{select:false,onArrive:loadNearby});
}
function onTap(target,point) {
  if(contemplating)return;
  if(target)goTo(target);
  else if(point)walkTo(point);
  else if(focused)stepBack();
}
function onSwipe(direction,restoreView) {
  if(contemplating||!focused||focused.index===undefined)return;
  restoreView();
  if(direction==='down'){stepBack();return;}
  const count=pieceTargets.length;goTo(pieceTargets[(focused.index+(direction==='left'?1:count-1))%count]);
}
function animate(dt) {
  if(!playback&&!engine.isFlying()&&!focused?.media)$('#moments-screen').classList.remove('viewing-video');
  if(exitTarget){exitOpen+=((exitOpening?1:0)-exitOpen)*(reducedMotion.matches?1:Math.min(1,dt*4));for(const {hinge,side} of exitTarget.leaves)hinge.rotation.y=side*exitOpen*1.75;}
  const ease=reducedMotion.matches?1:Math.min(1,dt*8);
  for(const target of targets){
    const goal=!contemplating&&(hoverTarget===target||flyingTo===target)?1:0;
    target.h+=(goal-target.h)*ease;
    const h=target.h,[rx,ry,rz]=target.rise;
    target.lift.position.set(target.base.x+rx*h,target.base.y+ry*h,target.base.z+rz*h);
    for(const material of target.glow)material.emissiveIntensity=h*.32;
    target.haloSprite.material.opacity=h*.28;
    if(target.marker)target.marker.material.opacity=contemplating?0:Math.max(engine.getSelected()===target?.9:.16,.16+h*.74);
  }
  if(ping&&ping.userData.t<1){ping.userData.t=Math.min(1,ping.userData.t+dt*1.4);const t=ping.userData.t;ping.scale.setScalar(1+t*2.2);ping.material.opacity=(1-t)*.8;}
  if(focused&&!engine.isFlying()&&Math.hypot(engine.camera.position.x-focused.approach.x,engine.camera.position.z-focused.approach.z)>.6){focused=null;stopVideo();}
  if(!engine.isFlying())loadNearby.tick=(loadNearby.tick||0)+dt;
  if(loadNearby.tick>.5){loadNearby.tick=0;loadNearby();}
}

/* Notas laterales: las mismas de la sala 01, sin ventanas sobre la fotografía. */
let noteSource=null;
function closeNote(restoreFocus=true) {
  const note=$('#moments-note');$('#moments-screen').classList.remove('viewing-art');if(note.hidden)return;
  note.hidden=true;$('#moments-note-content').replaceChildren();
  if(restoreFocus)(noteSource?.isConnected&&!noteSource.closest('[hidden]')?noteSource:$('#moments-stage')).focus({preventScroll:true});
  noteSource=null;
}
function showNote({eyebrow,title,body,source=$('#moments-stage')}) {
  closeNote(false);noteSource=source;
  $('#moments-note-content').innerHTML=`<p class="eyebrow">${escape(eyebrow)}</p><h2 id="moments-note-title" tabindex="-1">${escape(title)}</h2>${body}`;
  $('#moments-note').hidden=false;$('#moments-note-title').focus({preventScroll:true});
}
$('#close-moments-note').addEventListener('click',()=>closeNote());
$('#moments-note').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeNote();}});

function discover(piece) {
  const progress=Museum.discoverPiece(ROOM_ID,piece.id);
  buzz(progress.newlyCompleted?[30,60,45]:14);
  updateProgress();
  if(progress.newlyCompleted)celebrate();
  return progress;
}
function openPiece(index,source=$('#moments-stage')) {
  closeNote(false);
  const piece=exhibits[index];currentPiece=index;
  if(piece.type==='video'){openVideo(piece,index,source);return;}
  discover(piece);
  showPhotoNote(piece,index,source);
}
function mediaCredit(piece) {
  const credit=piece.credit;if(!credit)return '';
  return `<details class="media-credit"><summary>${piece.type==='video'?'Video':'Fotografía'} de ejemplo</summary><a href="${escape(credit.url)}" target="_blank" rel="noopener noreferrer">${escape(credit.author)}</a> · <a href="https://www.pexels.com/license/" target="_blank" rel="noopener noreferrer">Pexels</a>${credit.note?`<br>${escape(credit.note)}`:''}</details>`;
}
function showPhotoNote(piece,index,source) {
  $('#moments-screen').classList.add('viewing-art');
  showNote({eyebrow:piece.date,title:piece.title,source,body:`<p class="room-note-dedication">${escape(text(piece.phrase||''))}</p>${mediaCredit(piece)}`});
  $('#moments-screen').classList.add('viewing-art');
}
/* El video ocupa el propio cuadro 3D; no abre notas ni diálogos. */
function stopVideo() {
  const session=playback;playback=null;
  videoControls.hidden=true;$('#moments-screen').classList.remove('viewing-video');
  if(!session)return;
  session.video.pause();session.video.removeAttribute('src');session.video.load();session.video.remove();
  if(session.target?.media){const m=session.target.media;m.surface.material.map=m.posterMap;m.surface.material.color.set('#ffffff');m.surface.material.needsUpdate=true;m.group.remove(session.mesh);session.mesh.geometry.dispose();session.mesh.material.dispose();session.texture.dispose();}
  Museum.releaseMedia(session.video);
}
function syncVideoControls() {
  if(!playback)return;
  const video=playback.video;
  $('#room-video-play').textContent=video.ended?'Repetir':video.paused?'Reproducir':'Pausar';
  $('#room-video-sound').textContent=video.muted?'Sin sonido':'Sonido';
  $('#room-video-sound').setAttribute('aria-label',video.muted?'Activar sonido del video':'Silenciar video');
  $('#room-video-seek').value=Number.isFinite(video.duration)&&video.duration>0?video.currentTime/video.duration*100:0;
}
async function toggleVideo() {
  const session=playback;if(!session)return;
  if(!session.video.paused){Museum.pauseMedia(session.video);return;}
  if(!session.video.src)session.video.src=session.piece.src;
  const started=await Museum.playMedia(session.video,{title:session.piece.title,kind:'video',onStop:stopVideo});
  if(playback===session)$('#room-video-status').textContent=started?'':'Pulsa Reproducir para iniciar el video.';
  syncVideoControls();
}
function openVideo(piece,index,source) {
  const target=pieceTargets[index];
  if(engine&&!fallback&&focused!==target){goTo(target,{source});return;}
  if(playback?.target===target){toggleVideo();return;}
  stopVideo();discover(piece);
  if(!piece.src){Museum.notify('Este video llegará pronto.');return;}
  const video=document.createElement('video');video.playsInline=true;video.preload='none';video.setAttribute('aria-label',piece.title);
  video.className=fallback?'room-video-fallback':'room-video-source';
  if(!fallback)video.setAttribute('aria-hidden','true');
  if(piece.poster)video.poster=piece.poster;
  $('#moments-stage').append(video);
  const session={target,piece,video,ambient:false,texture:null,mesh:null};playback=session;
  if(target?.media){
    const m=target.media,texture=new THREE.VideoTexture(video);texture.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(m.width,m.height),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));mesh.position.z=.021;mesh.visible=false;m.group.add(mesh);
    session.texture=texture;session.mesh=mesh;
    video.addEventListener('loadedmetadata',()=>{
      if(playback!==session)return;
      const ratio=video.videoWidth/video.videoHeight;let w=m.width,h=w/ratio;if(h>m.height){h=m.height;w=h*ratio;}
      mesh.geometry.dispose();mesh.geometry=new THREE.PlaneGeometry(w,h);
    });
    video.addEventListener('playing',()=>{if(playback!==session)return;mesh.visible=true;m.surface.material.map=null;m.surface.material.color.set('#1f1814');m.surface.material.needsUpdate=true;});
  }
  for(const event of ['play','pause','ended','timeupdate','volumechange'])video.addEventListener(event,syncVideoControls);
  video.addEventListener('error',()=>{if(playback===session)Museum.notify('No se pudo cargar este video. Puedes seguir explorando.');});
  videoControls.hidden=false;$('#moments-screen').classList.add('viewing-video');syncVideoControls();
  $('#room-video-play').focus({preventScroll:true});
}
$('#room-video-play').addEventListener('click',toggleVideo);
$('#room-video-sound').addEventListener('click',()=>{if(playback)Museum.toggleVideoSound(playback.video);});
$('#room-video-seek').addEventListener('input',event=>{if(playback&&Number.isFinite(playback.video.duration))playback.video.currentTime=playback.video.duration*Number(event.target.value)/100;});
$('#room-video-back').addEventListener('click',()=>{stepBack();$('#moments-stage').focus({preventScroll:true});});
videoControls.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();stepBack();$('#moments-stage').focus({preventScroll:true});}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)playback?.video.pause();});
function openClue(source=$('#moments-stage')) {
  const added=Museum.findClue(room.clue.id);buzz(14);
  showNote({eyebrow:added?'PISTA ENCONTRADA':'UNA PISTA YA ENCONTRADA',title:'Una cámara diminuta',source,body:`<p class="room-note-description">Una pequeña cámara dorada, escondida en el muro de «La belleza de lo cotidiano».</p><p class="room-note-dedication">${escape(room.clue.message)}</p><p class="room-note-reward" role="status">Pistas encontradas: ${Museum.getProgress().clues.length} de ${config.clueIds.length}</p>`});
  updateProgress();
}
// Sello: una animación breve, como la de la sala 01, con el mensaje de la sala.
function celebrate() {
  const old=$('.moments-stamp');old?.remove();
  const stamp=document.createElement('div');stamp.className='moments-stamp';stamp.setAttribute('role','status');
  stamp.innerHTML=`<div class="stamp-page" aria-hidden="true"><div class="new-stamp"><span>SALA 02</span><b>✧</b><span>MOMENTOS</span></div></div><p>${escape(room.completionMessage)}</p><button class="text-button" type="button">Seguir explorando</button>`;
  $('#moments-screen').append(stamp);
  const close=()=>stamp.remove();
  stamp.querySelector('button').addEventListener('click',close);
  setTimeout(close,reducedMotion.matches?9000:7000);
}
/* Contemplar la sala: cámara fija con buena vista, controles ocultos y un botón para volver. */
function startContemplating() {
  if(contemplating||!engine)return;
  stopVideo();closeNote(false);contemplating=true;
  $('#moments-screen').classList.add('contemplating');
  $('#moments-stop-contemplating').hidden=false;
  engine.setLocked(true);
  $('#moments-stop-contemplating').focus({preventScroll:true});
}
function stopContemplating() {
  if(!contemplating)return;
  contemplating=false;
  $('#moments-screen').classList.remove('contemplating');
  $('#moments-stop-contemplating').hidden=true;
  engine?.setLocked(false);
  $('#moments-stage').focus({preventScroll:true});
}
function contemplate(source) {
  if(fallback||!engine)return;
  if(contemplating){stopContemplating();return;}
  stopVideo();closeNote(false);resume();focused=null;
  const ok=engine.guideTo(overviewTarget,{select:false,onArrive:startContemplating});
  if(!ok)startContemplating();
}
function openExit() {
  stopVideo();closeNote(false);
  if(exitOpening)return;
  exitOpening=true;
  setTimeout(async()=>{await Museum.returnToLobby();exitOpening=false;exitOpen=0;},reducedMotion.matches?0:750);
}
function openTarget(target=selected,source){
  if(!target)return;
  if(target.id==='exit')openExit();
  else if(target.id==='overview')contemplate(source);
  else if(target.id==='clue')openClue(source);
  else openPiece(target.index,source);
}
function openHelp(source) {
  const panel=$('#moments-help-panel');
  Museum.openContent({className:'room-help-sheet',source,html:'<div class="dialog-heading"><p class="eyebrow">SALA 02 · AYUDA</p><h2 id="dialog-title">Tu recorrido</h2></div><button class="button primary help-tutorial" type="button">Ver cómo moverse</button>',onClose:()=>{panel.hidden=true;$('#moments-screen').append(panel);}});
  $('#dialog-content').append(panel);panel.hidden=false;
  $('#dialog-content .help-tutorial').addEventListener('click',()=>Museum.openTutorial('room',source));
}

Museum.registerRoom(ROOM_ID,enterRoom);
$('#moments-view').addEventListener('click',event=>{
  if(selected){openTarget(selected,event.currentTarget);return;}
  if(fallback||!engine){guideTo(currentPiece,event.currentTarget);return;}
  const camera=engine.camera.position,nearest=[...pieceTargets].sort((a,b)=>camera.distanceTo(a.focus)-camera.distanceTo(b.focus))[0];
  goTo(nearest,{source:event.currentTarget});
});
const step=offset=>guideTo(((focused&&focused.index!==undefined?focused.index:currentPiece)+offset+exhibits.length)%exhibits.length);
$('#moments-prev').addEventListener('click',()=>step(-1));
$('#moments-next').addEventListener('click',()=>step(1));
$('#moments-contemplate').addEventListener('click',event=>contemplate(event.currentTarget));
$('#moments-stop-contemplating').addEventListener('click',stopContemplating);
$('#moments-exit-door').addEventListener('click',event=>{if(fallback||!engine||!exitTarget){Museum.returnToLobby();return;}goTo(exitTarget,{source:event.currentTarget});});
$('#moments-stage').addEventListener('keydown',event=>{
  if(event.target.closest('button')||contemplating)return;
  const offset=event.key==='<'||event.key===','?-1:event.key==='>'||event.key==='.'?1:0;
  if(!offset)return;event.preventDefault();step(offset);
});
document.querySelectorAll('[data-moments-tour]').forEach(button=>button.addEventListener('click',()=>{Museum.closeOverlay();setTimeout(()=>guideTo(Number(button.dataset.momentsTour)),0);}));
$('#moments-help').addEventListener('click',event=>openHelp(event.currentTarget));
$('#moments-back').addEventListener('click',()=>{stopVideo();stopContemplating();Museum.returnToLobby();});
$('#moments-passport').addEventListener('click',event=>Museum.openPassport(event.currentTarget));
$('#moments-clue-hint').addEventListener('click',()=>Museum.notify(room.clue.hint));
$('#moments-accessible-clue').addEventListener('click',event=>openClue(event.currentTarget));
document.addEventListener('museum:progress',updateProgress);
document.addEventListener('museum:overlay',event=>{if(event.detail){closeNote(false);}engine?.setPaused(event.detail);});
// Al salir de la sala se detiene el dibujo, se cierra la contemplación y no queda ningún video activo.
document.addEventListener('museum:screen',event=>{
  const here=event.detail===ROOM_ID;
  if(!here){stopVideo();closeNote(false);stopContemplating();$('.moments-stamp')?.remove();}
  engine?.setActive(here);
});
updateProgress();
