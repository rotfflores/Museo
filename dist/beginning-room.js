import * as THREE from './vendor/three.module.min.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {Reflector} from './vendor/Reflector.js';
import {createGallery,focusArtwork} from './gallery-engine.js';
import {isWalkable,WALK_BOUNDS} from './navigation.mjs';

const Museum=window.Museum,config=window.MUSEUM_CONFIG,room=config.beginningRoom;
const $=selector=>document.querySelector(selector);
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text=value=>value.replace(/\{(sender|recipient)\}/g,(_,key)=>config[key]);
let engine=null,initialized=false,selected=null,currentPiece=0,fallback=false;
const targets=[],pieceTargets=[];
let exitTarget=null,exitOpen=0,exitOpening=false;
// Estado de la mirada: la pieza que se contempla, hacia dónde vuela la cámara y qué brilla bajo el dedo o el mouse.
let focused=null,flyingTo=null,hoverTarget=null,ping=null;
const overview={id:'overview',focus:new THREE.Vector3(0,1.9,-5.6),approach:{x:0,z:3.4},hits:[],marker:null};
const obstacles=[{minX:-4.6,maxX:-2.5,minZ:-2.2,maxZ:-.8},{minX:2.65,maxX:4.15,minZ:-2.05,maxZ:-.55},{minX:-5.55,maxX:-4.8,minZ:-5.8,maxZ:-4.9},{minX:4.8,maxX:5.55,minZ:-5.8,maxZ:-4.9}];

{const words=room.title.split(' '),last=words.pop();$('#room-title').innerHTML=words.length?`${escape(words.join(' '))} <em>${escape(last)}</em>`:escape(last);}
$('#room-subtitle').textContent=room.subtitle;
$('#gallery-caption-text').textContent=room.introduction;
$('.exhibit-tour').innerHTML=room.exhibits.map((piece,index)=>`<button class="tour-stop" data-tour="${index}"><span class="tour-number">0${index+1}</span><span>${escape(piece.title)}<small>${escape(piece.date)}</small></span><span class="tour-check" aria-label="Sin descubrir">○</span></button>`).join('');

function updateProgress() {
  const progress=Museum.getProgress(),discovered=progress.discoveries.beginning||[];
  $('#room-discovery-count').textContent=`Recuerdos descubiertos: ${discovered.length} de 3`;
  $('#room-clue-count').textContent=`Pistas encontradas: ${progress.clues.length} de 5`;
  $('#room-passport-count').textContent=`${progress.completed.length}/6`;
  $('#room-passport').setAttribute('aria-label',`Pasaporte de recuerdos, ${progress.completed.length} de 6 salas completadas`);
  for(const target of pieceTargets)target.seen.visible=discovered.includes(target.id);
  document.querySelectorAll('[data-tour]').forEach(button=>{
    const done=discovered.includes(room.exhibits[Number(button.dataset.tour)].id);
    button.classList.toggle('discovered',done);
    const check=button.querySelector('.tour-check');check.textContent=done?'✧':'○';check.setAttribute('aria-label',done?'Descubierto':'Sin descubrir');
  });
}
function setTarget(target) {
  selected=target;
  // Sin pieza a la vista, la píldora muestra la introducción de la sala.
  $('#target-name').textContent=target ? target.id==='key' ? 'Un pequeño detalle dorado' : target.id==='exit' ? 'La puerta al vestíbulo' : room.exhibits[target.index].title : room.introduction;
  $('#view-memory').textContent=target?target.id==='key'?'Recoger la llave':target.id==='exit'?'Volver al vestíbulo':`Ver el recuerdo: ${room.exhibits[target.index].title}`:'Ir al recuerdo más cercano';
  $('#gallery-stage').dataset.target=target?.id||'';
}
function fallbackMode() {
  fallback=true;$('#gallery-fallback').hidden=false;$('#gallery-stage').classList.add('without-webgl');
  $('#accessible-decoration').hidden=false;
  document.querySelectorAll('.gallery-navigation button').forEach(button=>button.disabled=true);
  $('#gallery-hint').hidden=true;
  setTarget(targets[0]||{id:'message',index:0});
}
function texture(width,height,paint) {
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;paint(canvas.getContext('2d'),width,height);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map;
}
function buildRoom() {
  const test=document.createElement('canvas');
  if(!test.getContext('webgl2')){fallbackMode();return;}
  // Misma luz, piedra y oro que la rotonda del vestíbulo (scene3d.js).
  const scene=new THREE.Scene();scene.background=new THREE.Color('#efe6d6');scene.fog=new THREE.Fog('#efe6d6',14,30);
  const camera=new THREE.PerspectiveCamera(60,1,.1,35);camera.position.set(0,1.65,4.8);
  const ivory=new THREE.MeshStandardMaterial({color:'#f1e8d6',roughness:.95});
  const trim=new THREE.MeshStandardMaterial({color:'#d8c6a6',roughness:.8});
  const wood=new THREE.MeshStandardMaterial({color:'#4c3828',roughness:.5});
  const marble=new THREE.MeshStandardMaterial({color:'#f3ece0',roughness:.3});
  const goldTrim=new THREE.MeshStandardMaterial({color:'#c9a564',metalness:1,roughness:.28});
  const gold=new THREE.MeshStandardMaterial({color:room.symbolicObject.color,metalness:1,roughness:.24});
  const rand=(seed=>()=>(seed=(seed*16807)%2147483647)/2147483647)(11);
  const dot=()=>texture(64,64,g=>{
    const grad=g.createRadialGradient(32,32,0,32,32,32);
    grad.addColorStop(0,'rgba(255,248,225,1)');grad.addColorStop(.35,'rgba(255,232,180,.55)');grad.addColorStop(1,'rgba(255,230,170,0)');
    g.fillStyle=grad;g.fillRect(0,0,64,64);
  });
  // Mármol veteado con losas y una rosa de los vientos, como la rotonda.
  const floorMap=texture(2048,2048,(g,w)=>{
    const c=w/2;g.fillStyle='#eadfca';g.fillRect(0,0,w,w);
    for(let i=0;i<60;i++){
      g.strokeStyle=`rgba(150,128,98,${.05+rand()*.08})`;g.lineWidth=1+rand()*3;g.beginPath();
      let x=rand()*w,y=rand()*w;g.moveTo(x,y);
      for(let k=0;k<4;k++){x+=(rand()-.5)*500;y+=(rand()-.5)*500;g.quadraticCurveTo(x+(rand()-.5)*300,y+(rand()-.5)*300,x,y);}
      g.stroke();
    }
    g.strokeStyle='rgba(181,154,108,.45)';g.lineWidth=3;
    for(let i=1;i<6;i++){g.beginPath();g.moveTo(i*w/6,0);g.lineTo(i*w/6,w);g.stroke();g.beginPath();g.moveTo(0,i*w/6);g.lineTo(w,i*w/6);g.stroke();}
    g.strokeStyle='#b59a6c';g.lineWidth=16;g.strokeRect(70,70,w-140,w-140);g.strokeStyle='#c8b085';g.lineWidth=4;g.strokeRect(110,110,w-220,w-220);
    for(const [r,width,color] of [[520,10,'#b59a6c'],[500,3,'#c8b085'],[200,6,'#a88b5c']]){g.strokeStyle=color;g.lineWidth=width;g.beginPath();g.arc(c,c,r,0,Math.PI*2);g.stroke();}
    g.save();g.translate(c,c);
    for(let i=0;i<12;i++){g.rotate(Math.PI/6);g.fillStyle=i%2?'rgba(160,128,84,.5)':'rgba(120,94,62,.4)';g.beginPath();g.moveTo(0,0);g.lineTo(38,115);g.lineTo(0,500);g.lineTo(-38,115);g.closePath();g.fill();}
    g.restore();
  });
  function box(width,height,depth,x,y,z,material=ivory) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);mesh.position.set(x,y,z);mesh.receiveShadow=true;scene.add(mesh);return mesh;
  }
  // Suelo: espejo pulido bajo el mármol.
  box(12,.12,12,0,-.061,0,new THREE.MeshStandardMaterial({color:'#8a8378',roughness:.4}));
  const small=innerWidth<600;
  const mirror=new Reflector(new THREE.PlaneGeometry(12,12),{textureWidth:small?512:1024,textureHeight:small?512:1024,color:0x8a8378,clipBias:.003});
  mirror.rotation.x=-Math.PI/2;mirror.position.y=.001;scene.add(mirror);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.MeshStandardMaterial({map:floorMap,transparent:true,opacity:.8,roughness:.35}));
  floor.material.map.anisotropy=8;floor.rotation.x=-Math.PI/2;floor.position.y=.005;floor.receiveShadow=true;scene.add(floor);
  box(12,5.5,.18,0,2.75,-6);box(.18,5.5,12,-6,2.75,0);box(.18,5.5,12,6,2.75,0);box(12,5.5,.18,0,2.75,6);
  box(12,.14,12,0,5.45,0);
  const skirting=new THREE.MeshStandardMaterial({color:'#d9c7a7',roughness:.75});
  for(const height of [.25,4.85,5.05]){
    const material=height===.25?skirting:trim,size=height===.25?.45:.12;
    box(12,size,.12,0,height,-5.85,material);box(.12,size,12,-5.85,height,0,material);box(.12,size,12,5.85,height,0,material);
  }
  // Filete de oro sobre el zócalo, como el anillo dorado de la rotonda.
  box(11.7,.035,.035,0,.49,-5.78,goldTrim);box(.035,.035,11.7,-5.78,.49,0,goldTrim);box(.035,.035,11.7,5.78,.49,0,goldTrim);
  // Molduras finas en oro: el contenido ocupa las paredes, como en el vestíbulo.
  for(const x of [-4.2,0,4.2]) {
    box(3.6,.02,.025,x,4.15,-5.82,goldTrim);box(3.6,.02,.025,x,.9,-5.82,goldTrim);
    for(const side of [-1.8,1.8])box(.02,3.25,.025,x+side,2.52,-5.82,goldTrim);
  }
  for(const x of [-5.2,5.2]) {
    const column=new THREE.Mesh(new THREE.CylinderGeometry(.22,.26,4.8,32),marble);column.position.set(x,2.4,-5.25);column.castShadow=column.receiveShadow=true;scene.add(column);
    box(.7,.15,.7,x,.075,-5.25,trim);box(.7,.15,.7,x,4.8,-5.25,trim);
    const band=new THREE.Mesh(new THREE.TorusGeometry(.245,.018,8,40),goldTrim);band.rotation.x=Math.PI/2;band.position.set(x,4.62,-5.25);scene.add(band);
    const sconce=new THREE.Sprite(new THREE.SpriteMaterial({map:dot(),color:'#ffd9a0',transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));
    sconce.position.set(x*.93,3.6,-5.05);sconce.scale.setScalar(.9);scene.add(sconce);
  }
  // Techo con un óculo de luz al centro, igual que la cúpula.
  const ceilingFrame=box(7,.035,7,0,5.32,0,trim);ceilingFrame.material=new THREE.MeshStandardMaterial({color:'#d8c6a6',roughness:.8});
  box(6.8,.05,6.8,0,5.28,0,ivory);
  const OCULUS_Y=5.24,OCULUS_R=.95;
  const oculus=new THREE.Mesh(new THREE.CircleGeometry(OCULUS_R,48),new THREE.MeshBasicMaterial({color:'#fff8e8',toneMapped:false}));
  oculus.rotation.x=Math.PI/2;oculus.position.set(0,OCULUS_Y,-.6);scene.add(oculus);
  const oculusRing=new THREE.Mesh(new THREE.TorusGeometry(OCULUS_R+.04,.04,10,72),goldTrim);oculusRing.rotation.x=Math.PI/2;oculusRing.position.set(0,OCULUS_Y,-.6);scene.add(oculusRing);
  const shaftTime={value:0};
  const lightShaft=new THREE.Mesh(new THREE.CylinderGeometry(OCULUS_R,2.1,OCULUS_Y,64,1,true),new THREE.ShaderMaterial({
    uniforms:{uTime:shaftTime},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`varying vec2 vUv; varying float vFacing;
      void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vec3 n=normalize(normalMatrix*normal);
      vFacing=abs(dot(n,normalize(-mv.xyz))); gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`uniform float uTime; varying vec2 vUv; varying float vFacing;
      void main(){ float rays=.65+.35*sin(vUv.x*62.+uTime*.35)*sin(vUv.x*23.-uTime*.21);
      float a=pow(vFacing,2.2)*smoothstep(0.,.55,vUv.y)*.09*rays;
      gl_FragColor=vec4(vec3(1.,.93,.78)*a,a); }`
  }));
  lightShaft.position.set(0,OCULUS_Y/2,-.6);scene.add(lightShaft);
  // Luz cálida: cielo suave, haz del óculo con sombras y focos sobre cada pieza.
  scene.add(new THREE.HemisphereLight('#fff4de','#9c8466',1.1));
  const sun=new THREE.SpotLight('#ffe6b8',70,14,.95,.7,1.4);sun.position.set(0,OCULUS_Y,-.6);sun.target.position.set(0,0,-1.6);
  sun.castShadow=true;sun.shadow.mapSize.set(small?512:1024,small?512:1024);sun.shadow.bias=-.0004;scene.add(sun,sun.target);
  const fill=new THREE.PointLight('#ffe2b0',10,12,1.5);fill.position.set(0,3,3.6);scene.add(fill);
  const pictureLight=new THREE.SpotLight('#ffe6b8',30,10,.48,.7,1.5);pictureLight.position.set(0,4.5,-3.2);pictureLight.target.position.set(0,2.3,-5.7);scene.add(pictureLight,pictureLight.target);
  for(const x of [-3.55,3.4]) {
    const lamp=new THREE.SpotLight('#ffd49a',16,6,.5,.8,1.6);lamp.position.set(x,4.2,-1.5);lamp.target.position.set(x,1,-1.5);scene.add(lamp,lamp.target);
    const glow=new THREE.Mesh(new THREE.ConeGeometry(1.45,3.8,24,1,true),new THREE.MeshBasicMaterial({color:'#ffe8b1',transparent:true,opacity:.035,side:THREE.DoubleSide,depthWrite:false}));glow.position.set(x,2.3,-1.5);scene.add(glow);
    box(.32,.045,.35,x,4.25,-1.5,goldTrim);
  }
  // Placas como las de la rotonda: papel cálido, filete dorado y tornillos.
  function plaque(piece,index,x,y,z,width=2.15) {
    const map=texture(1024,256,(g,w,h)=>{
      const grad=g.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#efe5d0');grad.addColorStop(1,'#e0d0b3');g.fillStyle=grad;g.fillRect(0,0,w,h);
      g.strokeStyle='#beaa85';g.lineWidth=4;g.strokeRect(2,2,w-4,h-4);g.strokeStyle='rgba(245,236,212,.7)';g.lineWidth=8;g.strokeRect(8,8,w-16,h-16);
      g.fillStyle='#a28b61';for(const [sx,sy] of [[24,24],[w-24,24],[24,h-24],[w-24,h-24]]){g.beginPath();g.arc(sx,sy,5,0,Math.PI*2);g.fill();}
      g.textAlign='center';g.fillStyle='#9a7b45';g.font='500 20px "Segoe UI", Arial, sans-serif';g.letterSpacing='6px';
      g.fillText(`PIEZA 0${index+1}  ·  ${piece.date.toUpperCase()}`,w/2,56);g.letterSpacing='0px';
      let size=50;g.font=`italic ${size}px Georgia, "Times New Roman", serif`;while(g.measureText(piece.title).width>w-90){size-=2;g.font=`italic ${size}px Georgia, "Times New Roman", serif`;}
      g.fillStyle='#4a3c2c';g.fillText(piece.title,w/2,124);
      g.strokeStyle='#b89b66';g.lineWidth=2;g.beginPath();g.moveTo(w/2-70,150);g.lineTo(w/2+70,150);g.stroke();
      g.font='22px Georgia, "Times New Roman", serif';g.fillStyle='#766750';g.fillText(piece.description.length>70?piece.description.slice(0,67)+'…':piece.description,w/2,200);
    });
    map.anisotropy=8;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map,toneMapped:false}));mesh.position.set(x,y,z);scene.add(mesh);return mesh;
  }
  function marker(x,z,radius=.85) {
    const mesh=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.025,48),new THREE.MeshBasicMaterial({color:'#b89b66',transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.01,z);scene.add(mesh);return mesh;
  }
  // Pieza 01: vitrina con una conversación de papel, sin marcas de aplicaciones.
  box(2.1,.16,1.4,-3.55,.92,-1.5,wood).castShadow=true;box(1.6,.88,1,-3.55,.44,-1.5,marble).castShadow=true;
  box(1.7,.07,1.05,-3.55,.14,-1.5,trim);box(1.7,.05,1.05,-3.55,.87,-1.5,goldTrim);
  const glassMaterial=new THREE.MeshStandardMaterial({color:'#e6efe9',transparent:true,opacity:.1,roughness:.05,metalness:.1,depthWrite:false});
  const glass=box(2,.95,1.3,-3.55,1.48,-1.5,glassMaterial);glass.receiveShadow=false;
  for(const x of [-4.5,-2.6]) for(const z of [-2.12,-.88])box(.025,.95,.025,x,1.48,z,goldTrim);
  // Un borde abierto deja visible la captura al acercar la cámara a la vitrina.
  for(const z of [-2.16,-.84])box(2.05,.025,.025,-3.55,1.96,z,goldTrim);
  for(const x of [-4.56,-2.54])box(.025,.025,1.35,x,1.96,-1.5,goldTrim);
  const conversation=texture(512,640,(g,w,h)=>{
    g.fillStyle='#faf2df';g.fillRect(0,0,w,h);g.fillStyle='#93764b';g.font='20px Georgia';g.textAlign='center';g.fillText('nuestro primer mensaje',w/2,56);
    room.exhibits[0].messages.slice(0,4).forEach((message,index)=>{
      g.fillStyle=message.from==='sender'?'#e4d4b0':'#ece4d3';const x=message.from==='sender'?95:28,y=95+index*115;g.fillRect(x,y,370,87);
      g.fillStyle='#6b5b41';g.font='21px Georgia';g.textAlign='left';const words=text(message.text).split(' ');let line='',row=0;
      for(const word of words){if(g.measureText(line+word).width>327){g.fillText(line,x+17,y+30+row*27);line='';row++;}line+=word+' ';if(row>1)break;}if(row<3)g.fillText(line,x+17,y+30+row*27);
    });
  });
  const letter=new THREE.Mesh(new THREE.PlaneGeometry(1.08,1.35),new THREE.MeshStandardMaterial({map:conversation,roughness:1,side:THREE.DoubleSide}));letter.position.set(-3.55,1.34,-1.55);letter.rotation.x=-.6;scene.add(letter);
  if(room.exhibits[0].screenshot)new THREE.TextureLoader().load(room.exhibits[0].screenshot,map=>{
    const original=map.image,raster=document.createElement('canvas');raster.height=Math.min(1024,original.height);raster.width=Math.round(raster.height*original.width/original.height);
    raster.getContext('2d').drawImage(original,0,0,raster.width,raster.height);
    const sceneMap=new THREE.CanvasTexture(raster);sceneMap.colorSpace=THREE.SRGBColorSpace;
    letter.geometry.dispose();letter.geometry=new THREE.PlaneGeometry(1.35*original.width/original.height,1.35);
    letter.material.map=sceneMap;letter.material.needsUpdate=true;conversation.dispose();map.dispose();
  },undefined,()=>{/* La conversación configurada permanece si falta la captura. */});
  const casePlaque=plaque(room.exhibits[0],0,-3.55,.67,-.77,2);
  targets.push({id:'message',index:0,artwork:{x:-3.55,y:1.45,z:-1.5,width:.85,height:1.5,out:[0,0,1]},focus:new THREE.Vector3(-3.55,1.45,-1.5),approach:{x:-3.55,z:1.1},hits:[glass,letter,casePlaque],marker:marker(-3.55,-1.5,1.05),glow:[letter.material],lift:letter,rise:[0,.06,0],halo:[-3.55,1.4,-1.5,1.9],seen:[-3.55,2.25,-1.5]});
  // Pieza 02: una obra enmarcada. Su foto sólo se carga cuando se entra en la sala.
  const placeholder=texture(768,512,(g,w,h)=>{
    const grad=g.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#b7bba6');grad.addColorStop(1,'#e8c897');g.fillStyle=grad;g.fillRect(0,0,w,h);
    g.fillStyle='#f7deb0';g.beginPath();g.arc(w*.72,h*.28,48,0,Math.PI*2);g.fill();g.fillStyle='#8e987d';g.beginPath();g.moveTo(0,h*.52);g.quadraticCurveTo(w*.3,h*.3,w*.55,h*.55);g.quadraticCurveTo(w*.8,h*.6,w,h*.42);g.lineTo(w,h);g.lineTo(0,h);g.fill();
    g.fillStyle='#c4a576';g.fillRect(0,h*.74,w,h*.26);g.strokeStyle='#6f593a';g.lineWidth=7;
    for(const x of [w*.3,w*.7]){g.strokeRect(x-32,h*.64,64,68);g.beginPath();g.moveTo(x-32,h*.78);g.lineTo(x-38,h*.9);g.moveTo(x+32,h*.78);g.lineTo(x+38,h*.9);g.stroke();}
    g.fillStyle='#f1dfb8';g.beginPath();g.ellipse(w/2,h*.75,100,13,0,0,Math.PI*2);g.fill();g.fillStyle='#756042';g.fillRect(w/2-3,h*.77,6,65);
    g.fillStyle='#fff3d3';g.fillRect(w*.43,h*.69,13,21);g.fillRect(w*.56,h*.69,13,21);
  });
  const picture=new THREE.Mesh(new THREE.PlaneGeometry(3.3,2.2),new THREE.MeshStandardMaterial({map:placeholder,roughness:.9}));picture.position.set(0,2.5,-5.78);scene.add(picture);
  for(const x of [-1.76,1.76])box(.19,2.58,.15,x,2.5,-5.75,wood);
  for(const y of [1.28,3.72])box(3.7,.19,.15,0,y,-5.75,wood);
  for(const x of [-1.65,1.65])box(.025,2.26,.17,x,2.5,-5.64,goldTrim);
  for(const y of [1.39,3.61])box(3.33,.025,.17,0,y,-5.64,goldTrim);
  box(1.2,.06,.22,0,3.98,-5.35,goldTrim);
  const photoPlaque=plaque(room.exhibits[1],1,0,.87,-5.72,3);
  targets.push({id:'first-date',index:1,artwork:{x:0,y:2.5,z:-5.75,width:3.7,height:2.6,out:[0,0,1]},focus:new THREE.Vector3(0,2.3,-5.75),approach:{x:0,z:-2.65},hits:[picture,photoPlaque],marker:marker(0,-3.95,.5),glow:[picture.material],lift:picture,rise:[0,.03,.04],halo:[0,2.5,-5.5,3.2],seen:[0,4.4,-5.6]});
  const pictureUrl=room.exhibits[1].photo||room.exhibits[1].placeholder;
  if(pictureUrl)new THREE.TextureLoader().load(pictureUrl,map=>{
    const original=map.image;
    // Rasteriza SVG y limita la resolución de las fotos dentro de la escena.
    const raster=document.createElement('canvas');
    raster.width=Math.min(innerWidth<600?768:1024,original.naturalWidth||original.width);
    raster.height=Math.round(raster.width*(original.naturalHeight||original.height)/(original.naturalWidth||original.width));
    raster.getContext('2d').drawImage(original,0,0,raster.width,raster.height);
    const sceneMap=new THREE.CanvasTexture(raster);sceneMap.colorSpace=THREE.SRGBColorSpace;
    // Ajusta la geometría a la foto; no se estira ni se recorta el recuerdo.
    const ratio=map.image.width/map.image.height,w=Math.min(3.3,2.2*ratio),h=w/ratio;
    picture.geometry.dispose();picture.geometry=new THREE.PlaneGeometry(w,h);
    picture.material.map=sceneMap;picture.material.needsUpdate=true;placeholder.dispose();map.dispose();
  },undefined,()=>{/* La composición pintada permanece si falta la foto. */});
  // Pieza 03: dos pequeñas piezas entrelazadas sobre un pedestal de mármol.
  box(1.5,.12,1.5,3.4,.06,-1.3,trim);box(1.18,1.05,1.18,3.4,.64,-1.3,marble).castShadow=true;box(1.5,.1,1.5,3.4,1.21,-1.3,marble).castShadow=true;box(1.52,.025,1.52,3.4,1.15,-1.3,goldTrim);
  const rings=new THREE.Group();rings.position.set(3.4,1.73,-1.3);
  const loopGeometry=room.symbolicObject.type==='interlocked-links'?new THREE.TorusGeometry(.29,.07,12,32):new THREE.TorusGeometry(.28,.065,12,40);
  const ringA=new THREE.Mesh(loopGeometry,gold.clone());ringA.position.x=-.17;ringA.rotation.y=.45;ringA.rotation.z=.22;
  const ringB=new THREE.Mesh(loopGeometry,new THREE.MeshStandardMaterial({color:room.symbolicObject.secondColor,metalness:.9,roughness:.3}));ringB.position.x=.17;ringB.rotation.y=-.85;ringB.rotation.z=-.3;ringA.castShadow=ringB.castShadow=true;rings.add(ringA,ringB);scene.add(rings);
  const symbolPlaque=plaque(room.exhibits[2],2,3.4,.81,-.52,1.9);
  const symbolHit=box(1.15,1.05,.8,3.4,1.58,-1.3,new THREE.MeshBasicMaterial({visible:false}));
  targets.push({id:'together',index:2,focus:new THREE.Vector3(3.4,1.6,-1.3),approach:{x:3.4,z:1.15},hits:[symbolHit,symbolPlaque],marker:marker(3.4,-1.3,.88),glow:[ringA.material,ringB.material],lift:rings,rise:[0,.08,0],halo:[3.4,1.73,-1.3,1.5],seen:[3.4,2.3,-1.3]});
  // Llave pequeña, integrada en el detalle de una columna; siempre accesible.
  const position=room.clue.position;
  const keyGroup=new THREE.Group();keyGroup.position.set(THREE.MathUtils.clamp(position[0],-4.7,4.7),THREE.MathUtils.clamp(position[1],.9,2.1),THREE.MathUtils.clamp(position[2],-4.75,4.5));
  const keyBow=new THREE.Mesh(new THREE.TorusGeometry(.09,.018,8,20),gold);keyBow.position.y=.17;keyGroup.add(keyBow);
  const shaft=new THREE.Mesh(new THREE.BoxGeometry(.027,.25,.025),gold);shaft.position.y=-.02;keyGroup.add(shaft);
  for(const y of [-.09,-.14]){const tooth=new THREE.Mesh(new THREE.BoxGeometry(.075,.026,.025),gold);tooth.position.set(.03,y,0);keyGroup.add(tooth);}
  scene.add(keyGroup);
  const keyHit=new THREE.Mesh(new THREE.SphereGeometry(.3,12,8),new THREE.MeshBasicMaterial({visible:false}));keyHit.position.copy(keyGroup.position);scene.add(keyHit);
  const keyTarget={id:'key',focus:keyGroup.position.clone(),approach:{x:keyGroup.position.x*.77,z:keyGroup.position.z+1.3},hits:[keyHit],marker:null,glow:[gold],lift:keyGroup,rise:[0,.04,0],halo:[keyGroup.position.x,keyGroup.position.y,keyGroup.position.z,.7]};targets.push(keyTarget);
  // Puerta de regreso al vestíbulo: detrás de la cámara, en el muro por donde se entra.
  {
    const door=new THREE.Group();door.position.set(0,0,5.76);door.rotation.y=Math.PI;scene.add(door);
    const W=1.4,H=2.45;
    const ring=(w,h,grow,inner)=>{const o=new THREE.Shape();o.moveTo(-w/2-grow,-.02);o.lineTo(w/2+grow,-.02);o.lineTo(w/2+grow,h+grow);o.lineTo(-w/2-grow,h+grow);o.lineTo(-w/2-grow,-.02);const i=new THREE.Path();i.moveTo(-w/2-inner,0);i.lineTo(-w/2-inner,h+inner);i.lineTo(w/2+inner,h+inner);i.lineTo(w/2+inner,0);i.lineTo(-w/2-inner,0);o.holes.push(i);return o;};
    const extrude=(shape,depth)=>new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:2,curveSegments:32});
    const outer=new THREE.Mesh(extrude(ring(W,H,.26,.12),.12),wood);outer.castShadow=outer.receiveShadow=true;door.add(outer);
    const trimRing=new THREE.Mesh(extrude(ring(W,H,.12,.0),.16),goldTrim);door.add(trimRing);
    // Luz cálida detrás de las hojas y en el montante de medio punto.
    const beyond=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.MeshBasicMaterial({color:'#ffe4b4',toneMapped:false}));beyond.position.set(0,H/2,.004);door.add(beyond);
    const transomShape=new THREE.Shape();transomShape.moveTo(-W/2,0);transomShape.absarc(0,0,W/2,Math.PI,0,true);transomShape.lineTo(-W/2,0);
    const transom=new THREE.Mesh(new THREE.ShapeGeometry(transomShape,32),new THREE.MeshBasicMaterial({color:'#ffe0a8',toneMapped:false}));transom.position.set(0,H+.12,.02);door.add(transom);
    const transomRim=new THREE.Mesh(new THREE.TorusGeometry(W/2+.04,.035,10,48,Math.PI),goldTrim);transomRim.position.set(0,H+.12,.05);door.add(transomRim);
    for(let i=1;i<4;i++){const bar=new THREE.Mesh(new THREE.BoxGeometry(.018,W/2,.02),goldTrim);const a=Math.PI*i/4;bar.position.set(Math.cos(a)*W/4,H+.12+Math.sin(a)*W/4,.04);bar.rotation.z=a-Math.PI/2;door.add(bar);}
    // Hojas de madera tallada que giran sobre sus bisagras.
    const leafMap=texture(256,512,(g,w,h)=>{
      const grad=g.createLinearGradient(0,0,w,0);grad.addColorStop(0,'#3e2516');grad.addColorStop(.5,'#5e3a22');grad.addColorStop(1,'#3e2516');g.fillStyle=grad;g.fillRect(0,0,w,h);
      for(let i=0;i<70;i++){g.strokeStyle=`rgba(30,16,8,${.08+rand()*.12})`;g.lineWidth=1;g.beginPath();const x=rand()*w;g.moveTo(x,0);g.bezierCurveTo(x+(rand()-.5)*20,h*.33,x+(rand()-.5)*20,h*.66,x+(rand()-.5)*14,h);g.stroke();}
      for(const [y,ph] of [[40,230],[300,170]]){g.strokeStyle='#b38a4e';g.lineWidth=3;g.strokeRect(34,y,w-68,ph);g.strokeStyle='rgba(20,10,5,.55)';g.lineWidth=6;g.strokeRect(44,y+10,w-88,ph-20);}
    });
    const leafMaterial=new THREE.MeshStandardMaterial({map:leafMap,roughness:.55});
    const leaves=[];
    for(const side of [-1,1]) {
      const hinge=new THREE.Group();hinge.position.set(side*W/2,0,.03);door.add(hinge);
      const leaf=new THREE.Mesh(new THREE.BoxGeometry(W/2-.01,H-.01,.06),leafMaterial);leaf.position.set(-side*(W/4),H/2,0);leaf.castShadow=true;hinge.add(leaf);
      const handle=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.34,10),goldTrim);handle.position.set(-side*(W/2-.12),1.2,.06);hinge.add(handle);
      leaves.push({hinge,side,leaf});
    }
    // Placa "Vestíbulo" con tornillos, como las de las piezas.
    const plateMap=texture(512,160,(g,w,h)=>{
      const grad=g.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#efe5d0');grad.addColorStop(1,'#e0d0b3');g.fillStyle=grad;g.fillRect(0,0,w,h);
      g.strokeStyle='#beaa85';g.lineWidth=4;g.strokeRect(2,2,w-4,h-4);g.fillStyle='#a28b61';for(const [x,y] of [[18,18],[w-18,18],[18,h-18],[w-18,h-18]]){g.beginPath();g.arc(x,y,5,0,Math.PI*2);g.fill();}
      g.textAlign='center';g.fillStyle='#9a7b45';g.font='500 18px "Segoe UI", Arial, sans-serif';g.letterSpacing='6px';g.fillText('SALIDA',w/2,52);g.letterSpacing='0px';
      g.fillStyle='#4a3c2c';g.font='italic 54px Georgia, "Times New Roman", serif';g.fillText('Vestíbulo',w/2,118);
    });
    plateMap.anisotropy=8;
    const plate=new THREE.Mesh(new THREE.PlaneGeometry(1.15,.36),new THREE.MeshBasicMaterial({map:plateMap,toneMapped:false}));plate.position.set(0,H+1.05,.06);door.add(plate);
    const lamp=new THREE.PointLight('#ffd9a0',1.6,4,1.6);lamp.position.set(0,3.9,.9);door.add(lamp);
    // Zona de toque invisible que cubre toda la puerta: el centro cae justo entre las dos hojas.
    const doorHit=new THREE.Mesh(new THREE.BoxGeometry(W+.3,H+1.4,.12),new THREE.MeshBasicMaterial({visible:false}));doorHit.position.set(0,(H+1.4)/2,.1);door.add(doorHit);
    const hits=[doorHit,...leaves.map(item=>item.leaf),plate,transom];
    exitTarget={id:'exit',focus:new THREE.Vector3(0,1.45,5.8),approach:{x:0,z:3.3},hits,marker:marker(0,5.0,.62),glow:[leafMaterial],lift:plate,rise:[0,.04,0],halo:[0,1.5,5.62,2.6],leaves};
    targets.push(exitTarget);
  }
  pieceTargets.push(...targets.filter(target=>target.index!==undefined));
  // Brillo dorado, un halo y una pequeña ✧ sobre las piezas ya vistas.
  const sparkle=texture(128,128,(g,w,h)=>{g.textAlign='center';g.textBaseline='middle';g.font='92px Georgia, "Segoe UI Symbol", serif';g.shadowColor='rgba(255,226,160,.9)';g.shadowBlur=18;g.fillStyle=g.strokeStyle='#c9a564';g.lineWidth=5;g.lineJoin='round';g.strokeText('✧',w/2,h/2+4);g.fillText('✧',w/2,h/2+4);});
  for(const target of targets) {
    for(const material of target.glow){material.emissive=new THREE.Color('#c9a564');material.emissiveIntensity=0;}
    target.base=target.lift.position.clone();target.h=0;
    const [x,y,z,size]=target.halo;
    target.haloSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:dot(),color:'#ffe2a8',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
    target.haloSprite.position.set(x,y,z);target.haloSprite.scale.setScalar(size);scene.add(target.haloSprite);
    if(target.seen){const star=new THREE.Sprite(new THREE.SpriteMaterial({map:sparkle,transparent:true,depthWrite:false,toneMapped:false}));star.position.set(...target.seen);star.scale.setScalar(.32);star.visible=false;scene.add(star);target.seen=star;}
  }
  ping=new THREE.Mesh(new THREE.RingGeometry(.18,.24,40),new THREE.MeshBasicMaterial({color:'#b89b66',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));ping.rotation.x=-Math.PI/2;ping.position.y=.012;ping.userData.t=1;scene.add(ping);
  // Polvo dorado que flota bajo el óculo; se mueve sólo mientras la sala se dibuja.
  const COUNT=small?220:360,dust=new Float32Array(COUNT*3),speeds=new Float32Array(COUNT);
  for(let i=0;i<COUNT;i++){const r=Math.sqrt(rand())*4.6,a=rand()*Math.PI*2;dust.set([Math.cos(a)*r,rand()*5.2,Math.sin(a)*r-.6],i*3);speeds[i]=.05+rand()*.12;}
  const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(dust,3));
  const motes=new THREE.Points(dustGeometry,new THREE.PointsMaterial({map:dot(),size:.035,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending,color:'#ffe8bf'}));
  motes.frustumCulled=false;scene.add(motes);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let lastDust=performance.now();
  motes.onBeforeRender=()=>{
    const now=performance.now(),dt=Math.min((now-lastDust)/1000,.05),t=now/1000;lastDust=now;
    if(reduced.matches){shaftTime.value=2;return;}
    shaftTime.value=t;
    const p=dustGeometry.attributes.position;
    for(let i=0;i<COUNT;i++){let y=p.getY(i)+speeds[i]*dt;if(y>5.2)y=0;p.setY(i,y);p.setX(i,p.getX(i)+Math.sin(t*.3+i)*.0008);}
    p.needsUpdate=true;
  };
  firstFrame=new Promise(resolve=>$('#gallery-stage').addEventListener('gallery:ready',resolve,{once:true}));
  engine=createGallery({container:$('#gallery-stage'),scene,camera,obstacles,targets,floor,onTarget:setTarget,onActivate:target=>openTarget(target),onUnavailable:fallbackMode,onTap,onSwipe,onHover:target=>{hoverTarget=target;},onBack:()=>{if(focused)stepBack();},onFrame:animate});
  engine.renderer.toneMappingExposure=.88;engine.renderer.shadowMap.enabled=true;engine.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const pmrem=new THREE.PMREMGenerator(engine.renderer),environment=new RoomEnvironment();
  scene.environment=pmrem.fromScene(environment,.04).texture;scene.environmentIntensity=.55;environment.dispose();pmrem.dispose();
  engine.setActive(true);
  setTarget(null);
}

let firstFrame=null;
async function enterRoom() {
  const cover=()=>{
    Museum.showRoom();
    if(!initialized) {
      initialized=true;
      try{buildRoom();}catch{fallbackMode();}
    }
    engine?.setActive(true);updateProgress();
    if(fallback)setTarget({id:room.exhibits[currentPiece].id,index:currentPiece});
  };
  const opened=await Museum.playDoors({lines:['Preparando la sala…','Iluminando los recuerdos…','La sala está lista para ti.'],cover,ready:()=>fallback?null:firstFrame,minimum:1500,variant:'room-01',plate:'01'});
  if(!opened)cover();
  $('#room-title').focus({preventScroll:true});
  if(!Museum.tutorialSeen('room'))Museum.openTutorial('room',$('#room-help'));
}
function guideTo(index,source=null) {
  currentPiece=index;
  if(fallback||!engine){setTarget({id:room.exhibits[index].id,index});openPiece(index,source||undefined);return;}
  source?.classList.add('guiding-stop');
  goTo(pieceTargets[index],{source});
}
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
function buzz(pattern){try{if(matchMedia('(pointer: coarse)').matches)navigator.vibrate?.(pattern);}catch{/* Sin vibración disponible. */}}
function resume(){if(!$('#museum-dialog').open)engine?.setPaused(false);}
// La cámara se desliza hasta la pieza y el recuerdo se abre al llegar.
function goTo(target,{open=true,source=null}={}) {
  closeNote(false);
  resume();
  focusArtwork(engine.camera,target,WALK_BOUNDS);$('#room-screen').classList.toggle('viewing-art',!!target.artwork);
  if(target.id!=='key')currentPiece=target.index;
  if(focused===target&&!engine.isFlying()){if(open)openTarget(target,source||undefined);return;}
  const previous=$('#target-name').textContent;
  if(target.id!=='key')$('#target-name').textContent=target.id==='exit'?'Hacia: el vestíbulo':`Hacia: ${room.exhibits[target.index].title}`;
  flyingTo=target;focused=null;
  const ok=engine.guideTo(target,{onArrive:()=>{flyingTo=null;focused=target;if(open)openTarget(target,source||undefined);}});
  if(ok)return;
  flyingTo=null;$('#target-name').textContent=previous;
  if(open&&engine.camera.position.distanceTo(target.focus)<5)openTarget(target,source||undefined);
  else Museum.notify('Puedes acercarte a la pieza con los controles de la sala.');
}
function stepBack() {
  closeNote(false);
  if(!engine)return;
  resume();focused=null;flyingTo=null;
  engine.guideTo(overview,{select:false});
}
// Tocar el suelo: caminar hasta ese punto rodeando los muebles.
function walkTo(point) {
  closeNote(false);
  const camera=engine.camera.position;
  let x=THREE.MathUtils.clamp(point.x,WALK_BOUNDS.minX,WALK_BOUNDS.maxX),z=THREE.MathUtils.clamp(point.z,WALK_BOUNDS.minZ,WALK_BOUNDS.maxZ);
  for(let i=0;i<14&&!isWalkable(x,z,obstacles);i++){x+=(camera.x-x)*.22;z+=(camera.z-z)*.22;}
  const dx=x-camera.x,dz=z-camera.z,length=Math.hypot(dx,dz);
  if(!isWalkable(x,z,obstacles)||length<.3)return;
  resume();focused=null;flyingTo=null;
  if(ping){ping.position.x=x;ping.position.z=z;ping.userData.t=0;}
  engine.guideTo({id:'floor',focus:new THREE.Vector3(x+dx/length*4,1.65,z+dz/length*4),approach:{x,z},hits:[],marker:null},{select:false});
}
function onTap(target,point) {
  interacted();
  if(target)goTo(target);
  else if(point)walkTo(point);
  else if(focused)stepBack();
}
function onSwipe(direction,restoreView) {
  interacted();
  if(!focused||focused.index===undefined)return;
  restoreView();
  if(direction==='down'){stepBack();return;}
  goTo(pieceTargets[(focused.index+(direction==='left'?1:2))%3]);
}
function animate(dt) {
  if(exitTarget){exitOpen+=((exitOpening?1:0)-exitOpen)*(reducedMotion.matches?1:Math.min(1,dt*4));for(const {hinge,side} of exitTarget.leaves)hinge.rotation.y=side*exitOpen*1.75;}
  const ease=reducedMotion.matches?1:Math.min(1,dt*8);
  for(const target of targets) {
    const goal=hoverTarget===target||flyingTo===target?1:0;
    target.h+=(goal-target.h)*ease;
    const h=target.h,[rx,ry,rz]=target.rise;
    target.lift.position.set(target.base.x+rx*h,target.base.y+ry*h,target.base.z+rz*h);
    for(const material of target.glow)material.emissiveIntensity=h*.32;
    target.haloSprite.material.opacity=h*.32;
    if(target.marker)target.marker.material.opacity=Math.max(engine.getSelected()===target?.9:.16,.16+h*.74);
  }
  if(ping&&ping.userData.t<1){ping.userData.t=Math.min(1,ping.userData.t+dt*1.4);const t=ping.userData.t;ping.scale.setScalar(1+t*2.2);ping.material.opacity=(1-t)*.8;}
  if(focused&&!engine.isFlying()&&Math.hypot(engine.camera.position.x-focused.approach.x,engine.camera.position.z-focused.approach.z)>.6)focused=null;
}
// Pista de un solo uso, con el estilo de la del vestíbulo.
const HINT_KEY='museum-of-us:room-hint-seen';
function interacted() {
  const hint=$('#gallery-hint');if(hint.classList.contains('gone'))return;
  hint.classList.add('gone');try{localStorage.setItem(HINT_KEY,'1');}catch{/* Sin almacenamiento: la pista sólo se oculta en esta visita. */}
}

function conversationMarkup(piece) {
  if(piece.screenshot)return `<figure class="conversation-capture"><img src="${escape(piece.screenshot)}" alt="${escape(piece.screenshotAlt)}" decoding="async"></figure>`;
  return `<div class="conversation-paper"><div class="conversation-header"><span>${escape(config.couple)}</span><small>${escape(piece.date)}</small></div>${piece.messages.map(message=>`<div class="message-bubble ${message.from==='sender'?'sent':'received'}"><span>${escape(config[message.from]||message.from)}</span><p>${escape(text(message.text))}</p><small>${escape(message.time||'')}</small></div>`).join('')}<p class="conversation-note">Conversación de demostración</p></div>`;
}
let noteSource=null;
function closeNote(restoreFocus=true) {
  const note=$('#room-note');$('#room-screen').classList.remove('viewing-art');if(note.hidden)return;
  note.querySelectorAll('video').forEach(video=>{Museum.pauseMedia(video);Museum.releaseMedia(video);video.removeAttribute('src');video.load();});
  note.hidden=true;$('#room-note-content').replaceChildren();
  if(restoreFocus)(noteSource?.isConnected&&!noteSource.closest('[hidden]')?noteSource:$('#gallery-stage')).focus({preventScroll:true});
  noteSource=null;
}
function showNote({eyebrow,title,body,source=$('#gallery-stage')}) {
  closeNote(false);noteSource=source;
  $('#room-note-content').innerHTML=`<p class="eyebrow">${escape(eyebrow)}</p><h2 id="room-note-title" tabindex="-1">${escape(title)}</h2>${body}`;
  $('#room-note').hidden=false;$('#room-note-title').focus({preventScroll:true});
}
$('#close-room-note').addEventListener('click',()=>closeNote());
$('#room-note').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeNote();}});
function showPieceNote(piece,index,progress,source) {
  const video=piece.video?`<div class="optional-video"><button id="play-memory-video" class="button secondary">▶ Reproducir video</button><video id="memory-video" preload="none" playsinline ${piece.videoPoster?`poster="${escape(piece.videoPoster)}"`:''} hidden></video></div>`:'';
  showNote({eyebrow:piece.date,title:piece.title,source,body:`<p class="room-note-dedication">${escape(piece.description)}</p>${piece.audio?'<div class="optional-audio"><button id="play-memory-audio" class="button secondary">▶ Escuchar</button><p id="media-status" role="status"></p></div>':''}${video}`});
  $('#room-screen').classList.toggle('viewing-art',index<2);
  Museum.bindAudioButton($('#play-memory-audio'),{src:piece.audio,title:piece.title,label:`▶ ${text(piece.audioLabel||'Escuchar')}`,status:$('#media-status')});
  $('#play-memory-video')?.addEventListener('click',async event=>{
    const element=$('#memory-video'),button=event.currentTarget;if(!element.paused){Museum.pauseMedia(element);button.textContent='▶ Reproducir video';return;}
    element.hidden=false;element.controls=true;element.src=piece.video;
    const started=await Museum.playMedia(element,{title:piece.title,kind:'video',onStop:()=>{element.pause();element.removeAttribute('src');element.load();}});
    if(started&&button.isConnected)button.textContent='Ⅱ Pausar';
  });
}
function openPiece(index,source=$('#gallery-stage')) {
  closeNote(false);
  const piece=room.exhibits[index];currentPiece=index;
  const progress=Museum.discoverPiece('beginning',piece.id);
  buzz(progress.newlyCompleted?[30,60,45]:14);
  showPieceNote(piece,index,progress,source);
  updateProgress();
}
function openKey(source=$('#gallery-stage')) {
  const added=Museum.findClue(room.clue.id);buzz(14);
  showNote({eyebrow:added?'PISTA ENCONTRADA':'TU PRIMERA LLAVE',title:'La llave del comienzo',source,body:`<p class="room-note-description">Una pequeña llave dorada: la primera de cinco pistas para la vitrina secreta.</p><p class="room-note-dedication">${escape(room.clue.message)}</p><p class="room-note-reward" role="status">Pistas encontradas: ${Museum.getProgress().clues.length} de 5</p>`});
  updateProgress();
}
// Al llegar a la puerta, las hojas se abren y la misma transición del botón Vestíbulo lleva de regreso.
function openExit() {
  closeNote(false);
  if(exitOpening)return;
  exitOpening=true;
  setTimeout(async()=>{await Museum.returnToLobby();exitOpening=false;exitOpen=0;},reducedMotion.matches?0:750);
}
function openTarget(target=selected,source){if(!target)return;if(target.id==='exit')openExit();else if(target.id==='key')openKey(source);else openPiece(target.index,source);}
$('#exit-door').addEventListener('click',event=>{if(fallback||!engine||!exitTarget){Museum.returnToLobby();return;}goTo(exitTarget,{source:event.currentTarget});});
Museum.registerRoom('beginning',enterRoom);
// "Recuerdo" abre la pieza que se mira o, si no hay ninguna, lleva a la más cercana.
$('#view-memory').addEventListener('click',event=>{
  if(selected){openTarget(selected,event.currentTarget);return;}
  if(fallback||!engine){guideTo(currentPiece,event.currentTarget);return;}
  const camera=engine.camera.position,nearest=[...pieceTargets].sort((a,b)=>camera.distanceTo(a.focus)-camera.distanceTo(b.focus))[0];
  goTo(nearest,{source:event.currentTarget});
});
// "?" abre una hoja con el tutorial, el progreso, las tres paradas y la pista.
function openHelp(source) {
  const panel=$('#room-help-panel');
  Museum.openContent({className:'room-help-sheet',source,html:'<div class="dialog-heading"><p class="eyebrow">SALA 01 · AYUDA</p><h2 id="dialog-title">Tu recorrido</h2></div><button class="button primary help-tutorial" type="button">Ver cómo moverse</button>',onClose:()=>{panel.hidden=true;$('#room-screen').append(panel);}});
  $('#dialog-content').append(panel);panel.hidden=false;
  $('#dialog-content .help-tutorial').addEventListener('click',()=>Museum.openTutorial('room',source));
}
$('#room-help').addEventListener('click',event=>openHelp(event.currentTarget));
// Atajos de teclado: < y > (o , y .) cambian de pieza.
$('#gallery-stage').addEventListener('keydown',event=>{
  if(event.target.closest('button'))return;
  const step=event.key==='<'||event.key===','?2:event.key==='>'||event.key==='.'?1:0;
  if(!step)return;
  event.preventDefault();
  guideTo(((focused&&focused.index!==undefined?focused.index:currentPiece)+step)%3);
});
$('#step-prev').addEventListener('click',event=>guideTo(((focused&&focused.index!==undefined?focused.index:currentPiece)+2)%3,event.currentTarget));
$('#step-next').addEventListener('click',event=>guideTo(((focused&&focused.index!==undefined?focused.index:currentPiece)+1)%3,event.currentTarget));
{
  const coarse=matchMedia('(pointer: coarse)').matches,parts=coarse?['Toca una pieza','Desliza para avanzar']:['Haz clic en una pieza','Arrastra para mirar'];
  $('#gallery-hint').replaceChildren(...[['span',parts[0]],['b','·'],['span',parts[1]]].map(([tag,value])=>{const part=document.createElement(tag);part.textContent=value;return part;}));
  let seen=false;try{seen=localStorage.getItem(HINT_KEY)==='1';}catch{/* Sin almacenamiento. */}
  if(seen)$('#gallery-hint').classList.add('gone');
}
// Las paradas viven en la hoja de ayuda: se cierra y la cámara va a la pieza.
document.querySelectorAll('[data-tour]').forEach(button=>button.addEventListener('click',()=>{Museum.closeOverlay();setTimeout(()=>guideTo(Number(button.dataset.tour)),0);}));
$('#gallery-stage').addEventListener('gallery:arrived',()=>{document.querySelectorAll('.guiding-stop').forEach(button=>button.classList.remove('guiding-stop'));});
$('#room-back').addEventListener('click',Museum.returnToLobby);
$('#room-passport').addEventListener('click',event=>Museum.openPassport(event.currentTarget));
$('#clue-hint').addEventListener('click',()=>Museum.notify(room.clue.hint));
$('#accessible-decoration').addEventListener('click',event=>openKey(event.currentTarget));
document.addEventListener('museum:progress',updateProgress);
document.addEventListener('museum:overlay',event=>{if(event.detail)closeNote(false);engine?.setPaused(event.detail);});
document.addEventListener('museum:screen',event=>{if(event.detail!=='room')closeNote(false);engine?.setActive(event.detail==='room');});
updateProgress();
