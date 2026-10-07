/* Sala 04 · Así te veo yo: una galería semicircular de retratos con una obra central cubierta por una tela.
   Mismo motor, gestos, notas laterales, dock y puertas que las salas anteriores. */
import * as THREE from './vendor/three.module.min.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {Reflector} from './vendor/Reflector.js';
import {createGallery,focusArtwork} from './gallery-engine.js';
import {isWalkable} from './navigation.mjs';

const Museum=window.Museum,config=window.MUSEUM_CONFIG,room=config.youRoom;
const ROOM_ID='you';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text=value=>String(value??'').replace(/\{(sender|recipient)\}/g,(_,key)=>config[key]);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const portraits=room.portraits,center=room.centerpiece,songs=room.songs||[];

// Planta: un ábside semicircular (radio 6.5) al fondo y un tramo recto hasta la entrada.
const RADIUS=6.5,WALL_H=4.8,FRONT=5.2,ARC=5.95;
const portraitAngle=index=>THREE.MathUtils.degToRad(portraits.length>1?-72+144*index/(portraits.length-1):0);
const arcPoint=(angle,r)=>({x:r*Math.sin(angle),z:-r*Math.cos(angle)});
const BOUNDS={minX:-5.95,maxX:5.95,minZ:-5.95,maxZ:FRONT-.6};
const EASEL={x:0,z:-.3};
const stationAngle=song=>portraitAngle(Math.min(portraits.length,Math.max(1,song.near||1))-1)+THREE.MathUtils.degToRad(15)*(((song.near||1)-1)<portraits.length/2?1:-1);
const obstacles=[
  {minX:EASEL.x-.95,maxX:EASEL.x+.95,minZ:EASEL.z-.75,maxZ:EASEL.z+.55},
  ...songs.map(song=>{const p=arcPoint(stationAngle(song),4.75);return {minX:p.x-.4,maxX:p.x+.4,minZ:p.z-.4,maxZ:p.z+.4};}),
  // El ábside es curvo: las esquinas del rectángulo de paso quedan fuera.
  ...[1,-1].flatMap(side=>[{minX:side>0?4.3:-6.2,maxX:side>0?6.2:-4.3,minZ:-6.2,maxZ:-4.1},{minX:side>0?2.7:-6.2,maxX:side>0?6.2:-2.7,minZ:-6.2,maxZ:-5.3},{minX:side>0?5.3:-6.2,maxX:side>0?6.2:-5.3,minZ:-6.2,maxZ:-2.7}])
];

let engine=null,initialized=false,fallback=false,selected=null,currentPortrait=-1;
let focused=null,flyingTo=null,hoverTarget=null,ping=null,firstFrame=null,returnPose=null,noteOpen=false;
let exitTarget=null,exitOpen=0,exitOpening=false,easelTarget=null,clueTarget=null,cloth=null,revealT=1,revealing=false,easelSpot=null;
const targets=[],portraitTargets=[],stationTargets=[];

{const words=room.title.split(' '),last=words.pop();$('#you-title').innerHTML=words.length?`${escape(words.join(' '))} <em>${escape(last)}</em>`:escape(last);}
$('#you-subtitle').textContent=room.subtitle;
$('#you-tour').innerHTML=[
  ...portraits.map((piece,index)=>`<button class="tour-stop" data-you-tour="p${index}" type="button"><span class="tour-number">${String(index+1).padStart(2,'0')}</span><span>${escape(piece.title)}<small>Retrato</small></span><span class="tour-check" aria-label="Sin descubrir">○</span></button>`),
  center?`<button class="tour-stop" data-you-tour="center" type="button"><span class="tour-number">✧</span><span>${escape(center.title)}<small>Obra central</small></span><span class="tour-check" aria-label="Pendiente">○</span></button>`:'',
  ...songs.map((song,index)=>`<button class="tour-stop" data-you-tour="s${index}" type="button"><span class="tour-number">♪</span><span>${escape(song.title)}<small>${escape(song.artist||'')} · opcional</small></span><span class="tour-check" aria-hidden="true"></span></button>`)
].join('');

const found=()=>Museum.getProgress().discoveries[ROOM_ID]||[];
const portraitsFound=()=>portraits.filter(piece=>found().includes(piece.id)).length;
const centerRevealed=()=>!!center&&found().includes(center.id);
function updateProgress() {
  const progress=Museum.getProgress(),list=progress.discoveries[ROOM_ID]||[];
  const count=`Retratos descubiertos: ${portraitsFound()} de ${portraits.length}`,state=`Obra central: ${centerRevealed()?'descubierta':'pendiente'}`;
  $('#you-counter').textContent=center?`${count} · ${state}`:count;
  $('#you-discovery-count').textContent=count;$('#you-center-state').textContent=state;$('#you-center-state').hidden=!center;
  $('#you-clue-count').textContent=`Pistas encontradas: ${progress.clues.length} de ${config.clueIds.length}`;
  $('#you-passport-count').textContent=`${progress.completed.length}/6`;
  $('#you-passport').setAttribute('aria-label',`Pasaporte de recuerdos, ${progress.completed.length} de 6 salas completadas`);
  for(const target of portraitTargets)if(target.seen)target.seen.visible=list.includes(target.id);
  document.querySelectorAll('[data-you-tour]').forEach(button=>{
    const key=button.dataset.youTour;if(key.startsWith('s'))return;
    const id=key==='center'?center.id:portraits[Number(key.slice(1))].id,done=list.includes(id);
    button.classList.toggle('discovered',done);
    const check=button.querySelector('.tour-check');check.textContent=done?'✧':'○';check.setAttribute('aria-label',done?'Descubierto':'Sin descubrir');
  });
  if(cloth&&centerRevealed()&&!revealing){cloth.visible=false;revealT=1;if(easelSpot)easelSpot.intensity=easelSpot.userData.on;}
}
function nameOf(target) {
  if(!target)return room.subtitle;
  if(target.id==='exit')return 'La puerta al vestíbulo';
  if(target.id==='clue')return 'Un pequeño destello en el caballete';
  if(target.id==='easel')return center.title;
  if(target.song!==undefined)return `${songs[target.song].title} · ${songs[target.song].artist||''}`;
  return portraits[target.index].title;
}
function setTarget(target){selected=target;$('#you-target-name').textContent=nameOf(target);}
function fallbackMode(){fallback=true;$('#you-fallback').hidden=false;$('#you-stage').classList.add('without-webgl');$('#you-accessible-clue').hidden=false;}
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
}
function plaqueTexture(eyebrow,title,line) {
  const map=texture(1024,300,(g,w,h)=>{
    const grad=g.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#efe5d0');grad.addColorStop(1,'#e0d0b3');g.fillStyle=grad;g.fillRect(0,0,w,h);
    g.strokeStyle='#beaa85';g.lineWidth=4;g.strokeRect(2,2,w-4,h-4);g.strokeStyle='rgba(245,236,212,.7)';g.lineWidth=8;g.strokeRect(8,8,w-16,h-16);
    g.fillStyle='#a28b61';for(const [sx,sy] of [[24,24],[w-24,24],[24,h-24],[w-24,h-24]]){g.beginPath();g.arc(sx,sy,5,0,Math.PI*2);g.fill();}
    g.textAlign='center';g.fillStyle='#9a7b45';g.font='500 22px "Segoe UI", Arial, sans-serif';g.letterSpacing='5px';g.fillText(eyebrow,w/2,60);g.letterSpacing='0px';
    let size=56;g.font=`italic ${size}px Georgia, "Times New Roman", serif`;while(g.measureText(title).width>w-90&&size>30){size-=2;g.font=`italic ${size}px Georgia, "Times New Roman", serif`;}
    g.fillStyle='#4a3c2c';g.fillText(title,w/2,136);
    g.strokeStyle='#b89b66';g.lineWidth=2;g.beginPath();g.moveTo(w/2-70,164);g.lineTo(w/2+70,164);g.stroke();
    g.font='28px Georgia, "Times New Roman", serif';g.fillStyle='#766750';wrapText(g,line||'',w/2,212,w-120,36,2);
  });
  map.anisotropy=4;return map;
}

function buildRoom() {
  const test=document.createElement('canvas');
  if(!test.getContext('webgl2')){fallbackMode();return;}
  const small=innerWidth<600,maxTexture=small?768:1024;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#efe6d6');scene.fog=new THREE.Fog('#efe6d6',13,26);
  const camera=new THREE.PerspectiveCamera(60,1,.1,40);camera.position.set(0,1.65,FRONT-1.1);
  const ivory=new THREE.MeshStandardMaterial({color:'#f2e9d8',roughness:.95});
  const wood=new THREE.MeshStandardMaterial({color:'#5a3a24',roughness:.5});
  const goldTrim=new THREE.MeshStandardMaterial({color:'#c9a564',metalness:1,roughness:.3});
  const rand=(seed=>()=>(seed=(seed*16807)%2147483647)/2147483647)(41);
  const dotMap=texture(64,64,g=>{const grad=g.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(255,248,225,1)');grad.addColorStop(.35,'rgba(255,232,180,.55)');grad.addColorStop(1,'rgba(255,230,170,0)');g.fillStyle=grad;g.fillRect(0,0,64,64);});
  function box(width,height,depth,x,y,z,material=ivory){const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);mesh.position.set(x,y,z);mesh.receiveShadow=true;scene.add(mesh);return mesh;}
  const depth=FRONT+RADIUS,midZ=(FRONT-RADIUS)/2;
  // Suelo: mármol marfil con una rosa de los vientos bajo el caballete, sobre un espejo suave.
  const floorMap=texture(1024,Math.round(1024*depth/(RADIUS*2)),(g,w,h)=>{
    const u=x=>(x+RADIUS)/(RADIUS*2)*w,v=z=>(FRONT-z)/depth*h;
    g.fillStyle='#ece2cf';g.fillRect(0,0,w,h);
    for(let i=0;i<60;i++){g.strokeStyle=`rgba(150,128,98,${.05+rand()*.07})`;g.lineWidth=1+rand()*2;g.beginPath();let x=rand()*w,y=rand()*h;g.moveTo(x,y);for(let k=0;k<4;k++){x+=(rand()-.5)*260;y+=(rand()-.5)*260;g.quadraticCurveTo(x+(rand()-.5)*160,y+(rand()-.5)*160,x,y);}g.stroke();}
    const cx=u(0),cy=v(EASEL.z),r=w*.17;
    g.strokeStyle='#b59a6c';g.lineWidth=6;g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.stroke();g.lineWidth=2;g.beginPath();g.arc(cx,cy,r*1.08,0,Math.PI*2);g.stroke();
    g.save();g.translate(cx,cy);for(let i=0;i<8;i++){g.rotate(Math.PI/4);g.fillStyle=i%2?'rgba(160,128,84,.45)':'rgba(120,94,62,.35)';g.beginPath();g.moveTo(0,0);g.lineTo(12,34);g.lineTo(0,r*.92);g.lineTo(-12,34);g.closePath();g.fill();}g.restore();
    g.strokeStyle='#c8b085';g.lineWidth=3;g.beginPath();g.arc(cx,v(0),u(ARC-.2)-cx,Math.PI,0);g.stroke();
  });
  floorMap.anisotropy=4;
  const mirror=new Reflector(new THREE.PlaneGeometry(RADIUS*2,depth),{textureWidth:small?512:1024,textureHeight:small?512:1024,color:0x8a8378,clipBias:.003});
  mirror.rotation.x=-Math.PI/2;mirror.position.set(0,.001,midZ);scene.add(mirror);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(RADIUS*2,depth),new THREE.MeshStandardMaterial({map:floorMap,transparent:true,opacity:.82,roughness:.35}));
  floor.rotation.x=-Math.PI/2;floor.position.set(0,.005,midZ);floor.receiveShadow=true;scene.add(floor);
  // Muros: ábside curvo, laterales rectos y la pared de entrada. Zócalo de madera y filete dorado suave.
  const apse=new THREE.Mesh(new THREE.CylinderGeometry(RADIUS,RADIUS,WALL_H,72,1,true,Math.PI/2,Math.PI),new THREE.MeshStandardMaterial({color:'#f2e9d8',roughness:.95,side:THREE.BackSide}));apse.position.y=WALL_H/2;scene.add(apse);
  const dado=new THREE.Mesh(new THREE.CylinderGeometry(RADIUS-.04,RADIUS-.04,1,72,1,true,Math.PI/2,Math.PI),new THREE.MeshStandardMaterial({color:'#6b4a30',roughness:.5,side:THREE.BackSide}));dado.position.y=.5;scene.add(dado);
  const rail=new THREE.Mesh(new THREE.TorusGeometry(RADIUS-.06,.022,8,96,Math.PI),goldTrim);rail.rotation.x=Math.PI/2;rail.rotation.z=Math.PI;rail.position.y=1.02;scene.add(rail);
  const cornice=new THREE.Mesh(new THREE.TorusGeometry(RADIUS-.06,.07,8,96,Math.PI),new THREE.MeshStandardMaterial({color:'#d8c6a6',roughness:.8}));cornice.rotation.x=Math.PI/2;cornice.rotation.z=Math.PI;cornice.position.y=WALL_H-.2;scene.add(cornice);
  for(const side of [-1,1]){box(.18,WALL_H,FRONT,side*RADIUS,WALL_H/2,FRONT/2);box(.1,1,FRONT,side*(RADIUS-.06),.5,FRONT/2,new THREE.MeshStandardMaterial({color:'#6b4a30',roughness:.5}));box(.04,.04,FRONT,side*(RADIUS-.12),1.02,FRONT/2,goldTrim);}
  box(RADIUS*2,WALL_H,.18,0,WALL_H/2,FRONT);
  const ceiling=new THREE.Mesh(new THREE.CircleGeometry(RADIUS,64,0,Math.PI),new THREE.MeshStandardMaterial({color:'#f2e9d8',roughness:.95,side:THREE.DoubleSide}));ceiling.rotation.x=Math.PI/2;ceiling.position.y=WALL_H;scene.add(ceiling);
  box(RADIUS*2,.1,FRONT,0,WALL_H+.05,FRONT/2);
  // Texto de bienvenida en la entrada, sobre el muro lateral izquierdo, visible al llegar.
  {
    const map=texture(1024,300,(g,w)=>{g.textAlign='center';g.fillStyle='#9a7b45';g.font='500 24px "Segoe UI", Arial, sans-serif';g.letterSpacing='12px';g.fillText('SALA 04',w/2,50);g.letterSpacing='0px';
      g.fillStyle='#4a3c2c';g.font='italic 70px Georgia, "Times New Roman", serif';g.fillText(room.title,w/2,132);
      g.strokeStyle='#b89b66';g.lineWidth=3;g.beginPath();g.moveTo(w/2-100,162);g.lineTo(w/2+100,162);g.stroke();
      g.fillStyle='#766750';g.font='28px Georgia, "Times New Roman", serif';wrapText(g,room.subtitle,w/2,210,w-140,38,2);});
    map.anisotropy=4;
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.5,.73),new THREE.MeshBasicMaterial({map,transparent:true,toneMapped:false}));sign.position.set(0,4.15,-RADIUS+.5);scene.add(sign);
  }
  scene.add(new THREE.HemisphereLight('#fff3dc','#9a7e60',1));
  const fill=new THREE.PointLight('#ffe0b4',10,10,1.5);fill.position.set(0,3.6,1.2);scene.add(fill);
  function marker(x,z,radius=.55){const mesh=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.025,48),new THREE.MeshBasicMaterial({color:'#b89b66',transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.012,z);scene.add(mesh);return mesh;}
  // Fotografía dentro de un marco: conserva la proporción con un paspartú, sin deformarla.
  function framed(group,src,fw,fh,onLoad) {
    const passe=new THREE.Mesh(new THREE.PlaneGeometry(fw,fh),new THREE.MeshStandardMaterial({color:'#f7f1e4',roughness:.95}));passe.position.z=.012;group.add(passe);
    const surface=new THREE.Mesh(new THREE.PlaneGeometry(fw*.82,fh*.82),new THREE.MeshStandardMaterial({color:'#e6dccb',roughness:.9}));surface.position.z=.02;group.add(surface);
    if(src)new THREE.TextureLoader().load(src,map=>{
      const img=map.image,iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,ratio=iw/ih;let w=fw*.84,h=w/ratio;if(h>fh*.84){h=fh*.84;w=h*ratio;}
      const raster=document.createElement('canvas'),scale=Math.min(1,maxTexture/Math.max(iw,ih));raster.width=Math.round(iw*scale);raster.height=Math.round(ih*scale);raster.getContext('2d').drawImage(img,0,0,raster.width,raster.height);
      const sceneMap=new THREE.CanvasTexture(raster);sceneMap.colorSpace=THREE.SRGBColorSpace;sceneMap.anisotropy=4;
      surface.geometry.dispose();surface.geometry=new THREE.PlaneGeometry(w,h);surface.material.dispose();surface.material=new THREE.MeshBasicMaterial({map:sceneMap,toneMapped:false,color:'#f2ebe0'});map.dispose();onLoad?.(surface);
    },undefined,()=>{/* Sin imagen: queda el paspartú. */});
    return surface;
  }
  function goldFrame(group,fw,fh,material) {
    const b=.13;
    for(const [w,h,x,y] of [[fw+b*2,b,0,fh/2+b/2],[fw+b*2,b,0,-fh/2-b/2],[b,fh,-fw/2-b/2,0],[b,fh,fw/2+b/2,0]]){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,.1),material);m.position.set(x,y,.05);m.castShadow=true;group.add(m);}
    for(const [w,h,x,y] of [[fw+.02,.02,0,fh/2],[fw+.02,.02,0,-fh/2],[.02,fh,-fw/2,0],[.02,fh,fw/2,0]]){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,.11),wood);m.position.set(x,y,.055);group.add(m);}
  }
  // Cinco retratos en el ábside, cada uno con su foco cálido y su placa.
  const washMap=texture(128,128,g=>{const grad=g.createRadialGradient(64,40,0,64,64,64);grad.addColorStop(0,'rgba(255,236,196,.9)');grad.addColorStop(.55,'rgba(255,222,170,.3)');grad.addColorStop(1,'rgba(255,220,160,0)');g.fillStyle=grad;g.fillRect(0,0,128,128);});
  portraits.forEach((piece,index)=>{
    const angle=portraitAngle(index),p=arcPoint(angle,RADIUS-.12),group=new THREE.Group();
    const [fw,fh]=index===Math.floor(portraits.length/2)?[1.7,2.2]:[1.45,1.9];
    group.position.set(p.x,2.4,p.z);group.lookAt(0,2.4,0);scene.add(group);
    const frameMaterial=goldTrim.clone();goldFrame(group,fw,fh,frameMaterial);
    const surface=framed(group,piece.photo,fw,fh);
    const wash=new THREE.Mesh(new THREE.PlaneGeometry(fw*2,fh*1.9),new THREE.MeshBasicMaterial({map:washMap,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending}));wash.position.set(0,.1,.004);group.add(wash);
    const plaque=new THREE.Mesh(new THREE.PlaneGeometry(1.3,1.3*300/1024),new THREE.MeshBasicMaterial({map:plaqueTexture(`RETRATO ${String(index+1).padStart(2,'0')}`,piece.title,text(piece.phrase||'')),toneMapped:false}));plaque.position.set(0,-fh/2-.42,.03);group.add(plaque);
    const spot=new THREE.SpotLight('#ffdcaa',small?14:20,7,.42,.8,1.5);const a=arcPoint(angle,RADIUS-2.2);spot.position.set(a.x,4.4,a.z);spot.target.position.set(p.x,2.4,p.z);scene.add(spot,spot.target);
    const approach=arcPoint(angle,RADIUS-2.95),focus=new THREE.Vector3(p.x,2.3,p.z);
    const target={id:piece.id,index,focus,approach,artwork:{x:p.x,y:2.4,z:p.z,width:fw+.26,height:fh+.26,out:[-Math.sin(angle),0,Math.cos(angle)]},hits:[surface,plaque],marker:marker(approach.x,approach.z),glow:[frameMaterial],lift:group,rise:[-Math.sin(angle)*.05,0,Math.cos(angle)*.05],halo:[p.x*.97,2.4,p.z*.97,2.6],seen:[p.x*.98,2.4+fh/2+.35,p.z*.98]};
    targets.push(target);portraitTargets.push(target);
  });
  // Tres estaciones de escucha: tocadiscos sobre pedestales junto a sus retratos.
  songs.forEach((song,index)=>{
    const angle=stationAngle(song),p=arcPoint(angle,4.75),group=new THREE.Group();group.position.set(p.x,0,p.z);group.lookAt(0,0,0);scene.add(group);
    const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.28,.32,1,32),new THREE.MeshStandardMaterial({color:'#f3ece0',roughness:.35}));pedestal.position.y=.5;pedestal.castShadow=true;group.add(pedestal);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.29,.012,8,40),goldTrim);ring.rotation.x=Math.PI/2;ring.position.y=.98;group.add(ring);
    const player=new THREE.Group();player.position.y=1.0;group.add(player);
    const base=new THREE.Mesh(new THREE.BoxGeometry(.5,.1,.38),wood);base.position.y=.05;player.add(base);
    const record=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,.012,40),new THREE.MeshStandardMaterial({color:'#1d1714',roughness:.3,metalness:.2}));record.position.set(-.05,.108,0);player.add(record);
    const label=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.014,24),new THREE.MeshStandardMaterial({color:'#c9a564',roughness:.4}));label.position.set(-.05,.11,0);player.add(label);
    const arm=new THREE.Mesh(new THREE.BoxGeometry(.02,.015,.24),goldTrim);arm.position.set(.16,.13,-.02);arm.rotation.y=.35;player.add(arm);
    const knob=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.03,16),goldTrim);knob.position.set(.18,.11,.13);player.add(knob);
    const plaque=new THREE.Mesh(new THREE.PlaneGeometry(.62,.62*300/1024),new THREE.MeshBasicMaterial({map:plaqueTexture('CANCIÓN DEDICADA',song.title,song.artist||''),toneMapped:false}));plaque.position.set(0,.72,.33);plaque.rotation.x=-.08;group.add(plaque);
    const hit=new THREE.Mesh(new THREE.BoxGeometry(.7,1.3,.7),new THREE.MeshBasicMaterial({visible:false}));hit.position.y=.65;group.add(hit);
    const approach=arcPoint(angle,3.35);
    const target={id:`song-${song.id}`,song:index,focus:new THREE.Vector3(p.x,1.05,p.z),approach,hits:[hit,plaque],marker:null,glow:[ring.material===goldTrim?(ring.material=goldTrim.clone()):ring.material],lift:player,rise:[0,.03,0],halo:[p.x,1.15,p.z,.9],record};
    targets.push(target);stationTargets.push(target);
  });
  // La obra central: un caballete con un retrato cubierto por una tela.
  if(center){
    const easel=new THREE.Group();easel.position.set(EASEL.x,0,EASEL.z);scene.add(easel);
    for(const [x,z,rx,rz] of [[-.45,.12,-.08,.12],[.45,.12,-.08,-.12],[0,-.42,.3,0]]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.055,2.35,.055),wood);leg.position.set(x,1.12,z);leg.rotation.set(rx,0,rz);leg.castShadow=true;easel.add(leg);}
    const shelf=new THREE.Mesh(new THREE.BoxGeometry(1.2,.05,.16),wood);shelf.position.set(0,.6,.15);easel.add(shelf);
    const board=new THREE.Group();board.position.set(0,1.32,.1);board.rotation.x=-.1;easel.add(board);
    const fw=1.05,fh=1.32;goldFrame(board,fw,fh,goldTrim.clone());
    const photo=framed(board,center.photo,fw,fh);
    const centerPlaque=new THREE.Mesh(new THREE.PlaneGeometry(.95,.95*300/1024),new THREE.MeshBasicMaterial({map:plaqueTexture('LA OBRA CENTRAL',center.title,text(center.plaque||'')),toneMapped:false}));centerPlaque.position.set(0,.42,.24);centerPlaque.rotation.x=-.35;easel.add(centerPlaque);
    // La tela: un plano con pliegues suaves y caída, que se retira con una animación sencilla.
    const clothGeometry=new THREE.PlaneGeometry(1.5,1.9,30,36),pos=clothGeometry.attributes.position;
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),low=Math.max(0,-(y-.5))/1.45,fold=(Math.sin(x*13+Math.sin(y*2.2)*1.4)*.045+Math.sin(x*5.3+.8)*.03)*(.35+low),top=Math.max(0,y-.82)*.5;pos.setX(i,x*(1+low*.12));pos.setZ(i,fold+.07*(1-Math.abs(x)/.8)-top);}
    clothGeometry.computeVertexNormals();
    const linen=texture(256,256,(g,w,h)=>{g.fillStyle='#f4ecdc';g.fillRect(0,0,w,h);for(let i=0;i<1400;i++){g.fillStyle=`rgba(${150+rand()*40},${130+rand()*30},${100+rand()*20},${.05+rand()*.06})`;g.fillRect(rand()*w,rand()*h,1+rand()*2,1);}});
    linen.wrapS=linen.wrapT=THREE.RepeatWrapping;linen.repeat.set(3,3);
    cloth=new THREE.Mesh(clothGeometry,new THREE.MeshStandardMaterial({map:linen,color:'#e9dcc4',roughness:.95,side:THREE.DoubleSide,transparent:true}));
    cloth.position.set(0,1.26,.2);cloth.rotation.x=-.1;cloth.castShadow=true;easel.add(cloth);
    cloth.userData.base=cloth.position.clone();
    easelSpot=new THREE.SpotLight('#ffe2b4',small?10:14,7,.45,.8,1.4);easelSpot.position.set(0,4.3,2.3);easelSpot.target.position.set(0,1.3,EASEL.z);easelSpot.userData={off:small?10:14,on:small?42:60};scene.add(easelSpot,easelSpot.target);
    const hit=new THREE.Mesh(new THREE.BoxGeometry(1.4,1.7,.25),new THREE.MeshBasicMaterial({visible:false}));hit.position.set(0,1.4,.12);easel.add(hit);
    easelTarget={id:'easel',artwork:{x:0,y:1.32,z:EASEL.z+.1,width:1.31,height:1.58,out:[0,0,1]},focus:new THREE.Vector3(0,1.3,EASEL.z),approach:{x:0,z:1.9},hits:[hit,centerPlaque,photo],marker:marker(0,1.6,.6),glow:[],lift:centerPlaque,rise:[0,.02,0],halo:[0,1.3,EASEL.z+.4,2.3]};
    targets.push(easelTarget);
    // Cuarta pista: una pequeña estrella dorada en la base del caballete, accesible desde el principio.
    const star=new THREE.Shape();for(let i=0;i<10;i++){const r=i%2?.022:.055,a=i/10*Math.PI*2-Math.PI/2;const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i)star.lineTo(x,y);else star.moveTo(x,y);}star.closePath();
    const starMaterial=new THREE.MeshStandardMaterial({color:'#e2bf72',metalness:1,roughness:.22,emissive:'#6a4a14',emissiveIntensity:.2});
    const starMesh=new THREE.Mesh(new THREE.ExtrudeGeometry(star,{depth:.012,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:2}),starMaterial);
    const starHolder=new THREE.Group();starHolder.position.set(.5,.12,.2);starHolder.add(starMesh);easel.add(starHolder);
    const footBar=new THREE.Mesh(new THREE.BoxGeometry(1.05,.05,.06),wood);footBar.position.set(0,.12,.12);easel.add(footBar);
    const clueHit=new THREE.Mesh(new THREE.SphereGeometry(.26,12,8),new THREE.MeshBasicMaterial({visible:false}));clueHit.position.set(.5,.14,.3);easel.add(clueHit);
    clueTarget={id:'clue',focus:new THREE.Vector3(EASEL.x+.5,.12,EASEL.z+.2),approach:{x:EASEL.x+.9,z:EASEL.z+1.65},hits:[clueHit],marker:null,glow:[starMaterial],lift:starHolder,rise:[0,.02,.02],halo:[EASEL.x+.5,.14,EASEL.z+.26,.45]};
    targets.push(clueTarget);
  }
  // Puerta de regreso al vestíbulo: detrás de la cámara, por donde se entra.
  {
    const door=new THREE.Group();door.position.set(0,0,FRONT-.24);door.rotation.y=Math.PI;scene.add(door);
    const W=1.4,H=2.45;
    const ring=(w,h,grow,inner)=>{const o=new THREE.Shape();o.moveTo(-w/2-grow,-.02);o.lineTo(w/2+grow,-.02);o.lineTo(w/2+grow,h+grow);o.lineTo(-w/2-grow,h+grow);o.lineTo(-w/2-grow,-.02);const i=new THREE.Path();i.moveTo(-w/2-inner,0);i.lineTo(-w/2-inner,h+inner);i.lineTo(w/2+inner,h+inner);i.lineTo(w/2+inner,0);i.lineTo(-w/2-inner,0);o.holes.push(i);return o;};
    const extrude=(shape,depth)=>new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:2,curveSegments:32});
    door.add(new THREE.Mesh(extrude(ring(W,H,.26,.12),.12),wood));door.add(new THREE.Mesh(extrude(ring(W,H,.12,0),.16),goldTrim));
    const beyond=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.MeshBasicMaterial({color:'#ffe4b4',toneMapped:false}));beyond.position.set(0,H/2,.004);door.add(beyond);
    const transomShape=new THREE.Shape();transomShape.moveTo(-W/2,0);transomShape.absarc(0,0,W/2,Math.PI,0,true);transomShape.lineTo(-W/2,0);
    const transom=new THREE.Mesh(new THREE.ShapeGeometry(transomShape,32),new THREE.MeshBasicMaterial({color:'#ffe0a8',toneMapped:false}));transom.position.set(0,H+.12,.02);door.add(transom);
    const rimArc=new THREE.Mesh(new THREE.TorusGeometry(W/2+.04,.035,10,48,Math.PI),goldTrim);rimArc.position.set(0,H+.12,.05);door.add(rimArc);
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
    exitTarget={id:'exit',focus:new THREE.Vector3(0,1.45,FRONT-.2),approach:{x:0,z:FRONT-2.7},hits:[doorHit,...leaves.map(item=>item.leaf),plate,transom],marker:marker(0,FRONT-1,.55),glow:[leafMaterial],lift:plate,rise:[0,.04,0],halo:[0,1.5,FRONT-.4,2.6],leaves};
    targets.push(exitTarget);
  }
  const sparkle=texture(128,128,(g,w,h)=>{g.textAlign='center';g.textBaseline='middle';g.font='92px Georgia, "Segoe UI Symbol", serif';g.shadowColor='rgba(255,226,160,.9)';g.shadowBlur=18;g.fillStyle=g.strokeStyle='#c9a564';g.lineWidth=5;g.lineJoin='round';g.strokeText('✧',w/2,h/2+4);g.fillText('✧',w/2,h/2+4);});
  for(const target of targets){
    for(const material of target.glow){material.emissive=new THREE.Color('#c9a564');material.emissiveIntensity=0;}
    target.base=target.lift.position.clone();target.h=0;
    const [x,y,z,size]=target.halo;
    target.haloSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:dotMap,color:'#ffe2a8',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
    target.haloSprite.position.set(x,y,z);target.haloSprite.scale.setScalar(size);scene.add(target.haloSprite);
    if(Array.isArray(target.seen)){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:sparkle,transparent:true,depthWrite:false,toneMapped:false}));s.position.set(...target.seen);s.scale.setScalar(.28);s.visible=false;scene.add(s);target.seen=s;}
  }
  ping=new THREE.Mesh(new THREE.RingGeometry(.18,.24,40),new THREE.MeshBasicMaterial({color:'#b89b66',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));ping.rotation.x=-Math.PI/2;ping.position.y=.012;ping.userData.t=1;scene.add(ping);
  const COUNT=small?110:200,dust=new Float32Array(COUNT*3),speeds=new Float32Array(COUNT);
  for(let i=0;i<COUNT;i++){dust.set([(rand()-.5)*10,rand()*WALL_H,FRONT-rand()*(FRONT+RADIUS-1)],i*3);speeds[i]=.04+rand()*.08;}
  const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(dust,3));
  const motes=new THREE.Points(dustGeometry,new THREE.PointsMaterial({map:dotMap,size:.03,transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending,color:'#ffe8bf'}));
  motes.frustumCulled=false;scene.add(motes);let lastDust=performance.now();
  motes.onBeforeRender=()=>{const now=performance.now(),dt=Math.min((now-lastDust)/1000,.05);lastDust=now;if(reducedMotion.matches)return;const p=dustGeometry.attributes.position;for(let i=0;i<COUNT;i++){let y=p.getY(i)+speeds[i]*dt;if(y>WALL_H)y=0;p.setY(i,y);}p.needsUpdate=true;};
  firstFrame=new Promise(resolve=>$('#you-stage').addEventListener('gallery:ready',resolve,{once:true}));
  engine=createGallery({container:$('#you-stage'),scene,camera,obstacles,targets,floor,bounds:BOUNDS,onTarget:setTarget,onActivate:target=>openTarget(target),onUnavailable:fallbackMode,onTap,onSwipe,onHover:target=>{hoverTarget=target;},onBack:()=>{if(noteOpen)closeNote();else if(focused)stepBack();},onFrame:animate});
  engine.renderer.toneMappingExposure=.9;
  const pmrem=new THREE.PMREMGenerator(engine.renderer),environment=new RoomEnvironment();
  scene.environment=pmrem.fromScene(environment,.04).texture;scene.environmentIntensity=.55;environment.dispose();pmrem.dispose();
  engine.setActive(true);
  setTarget(null);updateProgress();
}

async function enterRoom() {
  const cover=()=>{
    Museum.showView(ROOM_ID);
    if(!initialized){initialized=true;try{buildRoom();}catch(error){console.warn('Sala 04 sin 3D:',error);fallbackMode();}}
    engine?.setActive(true);updateProgress();
  };
  const opened=await Museum.playDoors({lines:['Encendiendo los retratos…','Preparando la mirada…','Así te veo yo.'],cover,ready:()=>fallback?null:firstFrame,minimum:1500,variant:'room-04',plate:'04',label:'SALA 04 · ASÍ TE VEO YO',title:room.title});
  if(!opened)cover();
  $('#you-title').setAttribute('tabindex','-1');$('#you-title').focus({preventScroll:true});
  if(!Museum.tutorialSeen('room'))Museum.openTutorial('room',$('#you-help'));
}
function buzz(pattern){try{if(matchMedia('(pointer: coarse)').matches)navigator.vibrate?.(pattern);}catch{/* Sin vibración. */}}
function resume(){if(!$('#museum-dialog').open)engine?.setPaused(false);}
function rememberPose() {
  if(!engine||returnPose)return;
  const position=engine.camera.position,direction=engine.camera.getWorldDirection(new THREE.Vector3());
  returnPose={x:position.x,z:position.z,focus:new THREE.Vector3(position.x+direction.x*4,1.65+direction.y*4,position.z+direction.z*4)};
}
function goTo(target,{open=true,source=null}={}) {
  closeNote(false,false);resume();
  focusArtwork(engine.camera,target,BOUNDS);$('#you-screen').classList.toggle('viewing-art',!!target.artwork);
  if(target.index!==undefined)currentPortrait=target.index;
  if(target.id!=='exit')rememberPose();
  if(focused===target&&!engine.isFlying()){if(open)openTarget(target,source||undefined);return;}
  const previous=$('#you-target-name').textContent;
  $('#you-target-name').textContent=`Hacia: ${nameOf(target)}`;
  flyingTo=target;focused=null;
  const ok=engine.guideTo(target,{onArrive:()=>{flyingTo=null;focused=target;if(open)openTarget(target,source||undefined);}});
  if(ok)return;
  flyingTo=null;$('#you-target-name').textContent=previous;
  if(open&&engine.camera.position.distanceTo(target.focus)<5.5)openTarget(target,source||undefined);
  else Museum.notify('Puedes acercarte caminando por la sala.');
}
function guidePortrait(index,source=null){currentPortrait=index;if(fallback||!engine){openPortrait(index,source||undefined);return;}goTo(portraitTargets[index],{source});}
function stepBack() {
  closeNote(false,false);
  if(!engine)return;
  resume();focused=null;flyingTo=null;returnPose=null;
  engine.guideTo({id:'overview',focus:new THREE.Vector3(0,1.9,-RADIUS),approach:{x:0,z:FRONT-1.4},hits:[],marker:null},{select:false});
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
  if(noteOpen)return;
  if(target)goTo(target);
  else if(point)walkTo(point);
  else if(focused)stepBack();
}
function onSwipe(direction,restoreView) {
  if(noteOpen||!focused||focused.index===undefined)return;
  restoreView();
  if(direction==='down'){stepBack();return;}
  const count=portraitTargets.length;goTo(portraitTargets[(focused.index+(direction==='left'?1:count-1))%count]);
}
const easeInOut=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
function animate(dt) {
  if(exitTarget){exitOpen+=((exitOpening?1:0)-exitOpen)*(reducedMotion.matches?1:Math.min(1,dt*4));for(const {hinge,side} of exitTarget.leaves)hinge.rotation.y=side*exitOpen*1.75;}
  // La tela sube y se retira; el foco de la obra se enciende.
  if(revealing&&cloth){
    revealT=Math.min(1,revealT+dt/(reducedMotion.matches?.35:1.8));const k=easeInOut(revealT),base=cloth.userData.base;
    if(reducedMotion.matches){cloth.material.opacity=1-k;}
    else{cloth.position.set(base.x,base.y+k*1.4,base.z+k*.5);cloth.scale.set(1-k*.35,1-k*.75,1);cloth.rotation.x=-.1-k*.9;cloth.material.opacity=1-Math.max(0,(k-.55)/.45);}
    if(easelSpot)easelSpot.intensity=easelSpot.userData.off+(easelSpot.userData.on-easelSpot.userData.off)*k;
    if(revealT>=1){revealing=false;cloth.visible=false;revealDone?.();revealDone=null;}
  }
  for(const target of stationTargets)if(target.record&&Museum.audioPlaying(songs[target.song].audio)&&!reducedMotion.matches)target.record.rotation.y+=dt*3.5;
  const ease=reducedMotion.matches?1:Math.min(1,dt*8);
  for(const target of targets){
    const goal=!noteOpen&&(hoverTarget===target||flyingTo===target)?1:0;
    target.h+=(goal-target.h)*ease;
    const h=target.h,[rx,ry,rz]=target.rise;
    target.lift.position.set(target.base.x+rx*h,target.base.y+ry*h,target.base.z+rz*h);
    for(const material of target.glow)material.emissiveIntensity=h*.32;
    target.haloSprite.material.opacity=h*.26;
    if(target.marker)target.marker.material.opacity=Math.max(engine.getSelected()===target?.9:.16,.16+h*.74);
  }
  if(ping&&ping.userData.t<1){ping.userData.t=Math.min(1,ping.userData.t+dt*1.4);const t=ping.userData.t;ping.scale.setScalar(1+t*2.2);ping.material.opacity=(1-t)*.8;}
  if(focused&&!noteOpen&&!engine.isFlying()&&Math.hypot(engine.camera.position.x-focused.approach.x,engine.camera.position.z-focused.approach.z)>.6){focused=null;returnPose=null;}
}

/* Notas laterales: las mismas de las salas 01 y 02. Mientras están abiertas, la cámara no se mueve. */
let noteSource=null,revealDone=null;
function closeNote(restoreFocus=true,returnBack=true) {
  const note=$('#you-note');$('#you-screen').classList.remove('viewing-art');
  if(note.hidden)return;
  note.hidden=true;$('#you-note-content').replaceChildren();noteOpen=false;engine?.setLocked(false);
  if(restoreFocus)(noteSource?.isConnected&&!noteSource.closest('[hidden]')?noteSource:$('#you-stage')).focus({preventScroll:true});
  noteSource=null;
  // Al cerrar, el visitante vuelve a donde estaba antes de acercarse.
  const pose=returnPose;returnPose=null;
  if(returnBack&&engine&&pose){focused=null;resume();engine.guideTo({id:'return',focus:pose.focus,approach:{x:pose.x,z:pose.z},hits:[],marker:null},{select:false});}
}
function showNote({eyebrow,title,body,source=$('#you-stage')}) {
  noteSource=source;
  $('#you-note-content').innerHTML=`<p class="eyebrow">${escape(eyebrow)}</p><h2 id="you-note-title" tabindex="-1">${escape(title)}</h2>${body}`;
  $('#you-note').hidden=false;noteOpen=true;engine?.setLocked(true);$('#you-note-title').focus({preventScroll:true});
}
$('#close-you-note').addEventListener('click',()=>closeNote());
$('#you-note').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeNote();}});
function discover(id) {
  const progress=Museum.discoverPiece(ROOM_ID,id);
  buzz(progress.newlyCompleted?[30,60,45]:14);
  updateProgress();
  if(progress.newlyCompleted)celebrate();
  return progress;
}
function photoCredit(piece) {
  return piece?.credit?`<details class="media-credit"><summary>Fotografía de ejemplo</summary><a href="${escape(piece.credit.url)}" target="_blank" rel="noopener noreferrer">${escape(piece.credit.author)} / Pexels</a></details>`:'';
}
// La cámara muestra el retrato; la nota conserva solo una frase breve.
function openPortrait(index,source=$('#you-stage')) {
  const piece=portraits[index];currentPortrait=index;
  discover(piece.id);
  const count=portraits.length;
  showNote({eyebrow:`RETRATO ${String(index+1).padStart(2,'0')} DE ${String(count).padStart(2,'0')}`,title:piece.title,source,body:`
    <p class="room-note-dedication">${escape(text(piece.phrase||piece.dedication||''))}</p>
    ${piece.audio?`<div class="optional-audio you-audio"><button id="you-play-audio" class="button secondary" type="button">▶ ${escape(text(piece.audioLabel||'Escuchar'))}</button><p id="you-audio-status" role="status"></p></div>`:''}
    ${photoCredit(piece)}
    ${count>1?`<div class="you-steps"><button id="you-note-prev" class="text-button" type="button">‹ Anterior</button><button id="you-note-next" class="text-button" type="button">Siguiente ›</button></div>`:''}`});
  const keep=returnPose;
  Museum.bindAudioButton($('#you-play-audio'),{src:piece.audio,title:piece.title,label:`▶ ${text(piece.audioLabel||'Escuchar')}`,status:$('#you-audio-status')});
  $('#you-note-prev')?.addEventListener('click',()=>{returnPose=keep;guidePortrait((index+count-1)%count,source);});
  $('#you-note-next')?.addEventListener('click',()=>{returnPose=keep;guidePortrait((index+1)%count,source);});
}
// La obra central: pendiente, lista para descubrirse o ya revelada.
function openCenter(source=$('#you-stage')) {
  if(!center)return;
  if(centerRevealed()){
    showNote({eyebrow:'LA OBRA CENTRAL',title:center.title,source,body:`<p class="room-note-dedication">Me encanta compartir mi vida contigo.</p>${photoCredit(center)}`});
      return;
  }
  const ready=portraitsFound()>=portraits.length;
  showNote({eyebrow:'LA OBRA CENTRAL',title:center.title,source,body:`<p class="room-note-description">${escape(text(center.plaque||''))}</p>
    ${ready?'<button id="you-reveal" class="button primary room-note-expand" type="button">Descubrir la obra</button>':`<p class="room-note-reward" role="status">Abre los ${portraits.length} retratos para descubrirla. Llevas ${portraitsFound()} de ${portraits.length}.</p>`}`});
  $('#you-reveal')?.addEventListener('click',()=>reveal(source));
}
function reveal(source) {
  if(revealing||centerRevealed())return;
  const pose=returnPose;closeNote(false,false);returnPose=pose;
  const finish=()=>{discover(center.id);openCenter(source);};
  if(!cloth||fallback){finish();return;}
  revealT=0;revealing=true;cloth.visible=true;engine?.setLocked(true);
  revealDone=()=>{engine?.setLocked(false);finish();};
}
function openSong(index,source=$('#you-stage')) {
  const song=songs[index];
  showNote({eyebrow:'CANCIÓN DEDICADA',title:song.title,source,body:`<p class="room-note-description">${escape(song.artist||'')}</p>
    ${song.cover?`<figure class="you-cover"><img src="${escape(song.cover)}" alt="Portada de ${escape(song.title)}" loading="lazy" decoding="async"></figure>`:''}
    <p class="room-note-dedication">${escape(text(song.dedication||''))}</p>
    <div class="optional-audio you-audio">${song.audio?`<button id="you-play-song" class="button secondary" type="button">▶ Escuchar</button>`:''}${song.link?`<a class="button ${song.audio?'text-button':'secondary'} you-song-link" href="${escape(song.link)}" target="_blank" rel="noopener noreferrer">Abrir canción <span aria-hidden="true">↗</span></a>`:''}<p id="you-song-status" role="status"></p></div>
    `});
  $('#you-note .you-cover img')?.addEventListener('error',event=>event.currentTarget.closest('figure').remove(),{once:true});
  Museum.bindAudioButton($('#you-play-song'),{src:song.audio,title:`${song.title} · ${song.artist}`,status:$('#you-song-status')});
}
function openClue(source=$('#you-stage')) {
  const added=Museum.findClue(room.clue.id);buzz(14);
  showNote({eyebrow:added?'PISTA ENCONTRADA':'UNA PISTA YA ENCONTRADA',title:'Una estrella diminuta',source,body:`<p class="room-note-description">Una pequeña estrella dorada, en la base del caballete.</p><p class="room-note-dedication">${escape(room.clue.message)}</p><p class="room-note-reward" role="status">Pistas encontradas: ${Museum.getProgress().clues.length} de ${config.clueIds.length}</p>`});
  updateProgress();
}
function celebrate() {
  const old=$('#you-screen .moments-stamp');old?.remove();
  const stamp=document.createElement('div');stamp.className='moments-stamp';stamp.setAttribute('role','status');
  stamp.innerHTML=`<div class="stamp-page" aria-hidden="true"><div class="new-stamp"><span>SALA 04</span><b>✧</b><span>ASÍ TE VEO YO</span></div></div><p>${escape(room.completionMessage)}</p><button class="text-button" type="button">Seguir explorando</button>`;
  $('#you-screen').append(stamp);
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
  else if(target.id==='easel')openCenter(source);
  else if(target.song!==undefined)openSong(target.song,source);
  else openPortrait(target.index,source);
}
function openHelp(source) {
  const panel=$('#you-help-panel');
  Museum.openContent({className:'room-help-sheet',source,html:'<div class="dialog-heading"><p class="eyebrow">SALA 04 · AYUDA</p><h2 id="dialog-title">Tu recorrido</h2></div><button class="button primary help-tutorial" type="button">Ver cómo moverse</button>',onClose:()=>{panel.hidden=true;$('#you-screen').append(panel);}});
  $('#dialog-content').append(panel);panel.hidden=false;
  $('#dialog-content .help-tutorial').addEventListener('click',()=>Museum.openTutorial('room',source));
}
function tourTarget(key) {
  if(key==='center')return {fn:()=>fallback||!engine?openCenter():goTo(easelTarget)};
  if(key.startsWith('s')){const i=Number(key.slice(1));return {fn:()=>fallback||!engine?openSong(i):goTo(stationTargets[i])};}
  return {fn:()=>guidePortrait(Number(key.slice(1)))};
}

Museum.registerRoom(ROOM_ID,enterRoom);
const step=offset=>{const from=focused&&focused.index!==undefined?focused.index:currentPortrait;guidePortrait(from<0?(offset>0?0:portraits.length-1):(from+offset+portraits.length)%portraits.length);};
$('#you-prev').addEventListener('click',()=>step(-1));
$('#you-next').addEventListener('click',()=>step(1));
$('#you-center').addEventListener('click',()=>tourTarget('center').fn());
$('#you-exit-door').addEventListener('click',event=>{if(fallback||!engine||!exitTarget){Museum.returnToLobby();return;}goTo(exitTarget,{source:event.currentTarget});});
$('#you-stage').addEventListener('keydown',event=>{
  if(event.target.closest('button')||noteOpen)return;
  const offset=event.key==='<'||event.key===','?-1:event.key==='>'||event.key==='.'?1:0;
  if(!offset)return;event.preventDefault();step(offset);
});
document.querySelectorAll('[data-you-tour]').forEach(button=>button.addEventListener('click',()=>{const action=tourTarget(button.dataset.youTour);Museum.closeOverlay();setTimeout(action.fn,0);}));
$('#you-help').addEventListener('click',event=>openHelp(event.currentTarget));
$('#you-back').addEventListener('click',()=>{closeNote(false,false);Museum.returnToLobby();});
$('#you-passport').addEventListener('click',event=>Museum.openPassport(event.currentTarget));
$('#you-clue-hint').addEventListener('click',()=>Museum.notify(room.clue.hint));
$('#you-accessible-clue').addEventListener('click',event=>openClue(event.currentTarget));
document.addEventListener('museum:progress',updateProgress);
document.addEventListener('museum:overlay',event=>{engine?.setPaused(event.detail);});
// Al salir se cierra la nota; la canción continúa en el reproductor compartido.
document.addEventListener('museum:screen',event=>{
  const here=event.detail===ROOM_ID;
  if(!here){closeNote(false,false);$('#you-screen .moments-stamp')?.remove();}
  engine?.setActive(here);
});
updateProgress();
