import * as THREE from './vendor/three.module.min.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {createGallery} from './gallery-engine.js';

const Museum=window.Museum,config=window.MUSEUM_CONFIG,room=config.beginningRoom;
const $=selector=>document.querySelector(selector);
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text=value=>value.replace(/\{(sender|recipient)\}/g,(_,key)=>config[key]);
let engine=null,initialized=false,selected=null,currentPiece=0,fallback=false;
const targets=[];
const obstacles=[{minX:-4.6,maxX:-2.5,minZ:-2.2,maxZ:-.8},{minX:2.65,maxX:4.15,minZ:-2.05,maxZ:-.55},{minX:-5.55,maxX:-4.8,minZ:-5.8,maxZ:-4.9},{minX:4.8,maxX:5.55,minZ:-5.8,maxZ:-4.9}];

$('#room-title').textContent=room.title;
$('#room-subtitle').textContent=room.subtitle;
$('#gallery-caption-text').textContent=room.introduction;
$('.exhibit-tour').innerHTML=room.exhibits.map((piece,index)=>`<button class="tour-stop" data-tour="${index}"><span class="tour-number">0${index+1}</span><span>${escape(piece.title)}<small>${escape(piece.date)}</small></span><span class="tour-check" aria-label="Sin descubrir">○</span></button>`).join('');

function updateProgress() {
  const progress=Museum.getProgress(),discovered=progress.discoveries.beginning||[];
  $('#room-discovery-count').textContent=`Recuerdos descubiertos: ${discovered.length} de 3`;
  $('#room-clue-count').textContent=`Pistas encontradas: ${progress.clues.length} de 5`;
  $('#room-completed').hidden=!progress.completed.includes('beginning');
  document.querySelectorAll('[data-tour]').forEach(button=>{
    const done=discovered.includes(room.exhibits[Number(button.dataset.tour)].id);
    button.classList.toggle('discovered',done);
    const check=button.querySelector('.tour-check');check.textContent=done?'✧':'○';check.setAttribute('aria-label',done?'Descubierto':'Sin descubrir');
  });
}
function setTarget(target) {
  selected=target;
  $('#target-name').textContent=target ? target.id==='key' ? 'Un pequeño detalle dorado' : room.exhibits[target.index].title : 'Acércate a una pieza para descubrirla';
  $('#view-memory').textContent=target?.id==='key'?'Recoger llave':'Ver recuerdo';
  $('#view-memory').disabled=!target;
  $('#gallery-stage').dataset.target=target?.id||'';
}
function fallbackMode() {
  fallback=true;$('#gallery-fallback').hidden=false;$('#gallery-stage').classList.add('without-webgl');
  $('#accessible-decoration').hidden=false;
  document.querySelectorAll('.gallery-navigation button').forEach(button=>button.disabled=true);
  setTarget(targets[0]||{id:'message',index:0});
}
function texture(width,height,paint) {
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;paint(canvas.getContext('2d'),width,height);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map;
}
function buildRoom() {
  const test=document.createElement('canvas');
  if(!test.getContext('webgl2')){fallbackMode();return;}
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e9dfcc');scene.fog=new THREE.Fog('#e9dfcc',15,32);
  const camera=new THREE.PerspectiveCamera(60,1,.1,35);camera.position.set(0,1.65,4.8);
  const ivory=new THREE.MeshStandardMaterial({color:'#eee5d3',roughness:.92});
  const trim=new THREE.MeshStandardMaterial({color:'#d4c3a2',roughness:.75});
  const wood=new THREE.MeshStandardMaterial({color:'#4a3223',roughness:.57});
  const gold=new THREE.MeshStandardMaterial({color:room.symbolicObject.color,metalness:.85,roughness:.28});
  const paper=new THREE.MeshStandardMaterial({color:'#fbf2dc',roughness:.7});
  const floorMap=texture(512,512,(g,w,h)=>{
    g.fillStyle='#dfcfb3';g.fillRect(0,0,w,h);g.strokeStyle='#c9b693';g.lineWidth=2;
    for(let i=0;i<=8;i++){g.beginPath();g.moveTo(i*w/8,0);g.lineTo(i*w/8,h);g.stroke();g.beginPath();g.moveTo(0,i*h/8);g.lineTo(w,i*h/8);g.stroke();}
    g.strokeStyle='#a78b57';g.lineWidth=4;g.strokeRect(32,32,w-64,h-64);g.lineWidth=1;g.strokeRect(42,42,w-84,h-84);
  });
  function box(width,height,depth,x,y,z,material=ivory) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);mesh.position.set(x,y,z);scene.add(mesh);return mesh;
  }
  box(12,.12,12,0,-.06,0,new THREE.MeshStandardMaterial({map:floorMap,roughness:.47}));
  box(12,5.5,.18,0,2.75,-6);box(.18,5.5,12,-6,2.75,0);box(.18,5.5,12,6,2.75,0);box(12,5.5,.18,0,2.75,6);
  box(12,.14,12,0,5.45,0);
  for(const height of [.25,4.85,5.05]){
    box(12,height===.25?.45:.12,.12,0,height,-5.85,trim);
    box(.12,height===.25?.45:.12,12,-5.85,height,0,trim);box(.12,height===.25?.45:.12,12,5.85,height,0,trim);
  }
  // Molduras finas: el contenido ocupa las paredes, como en el vestíbulo.
  for(const x of [-4.2,0,4.2]) {
    box(3.6,.025,.03,x,4.15,-5.82,trim);box(3.6,.025,.03,x,.9,-5.82,trim);
    for(const side of [-1.8,1.8])box(.025,3.25,.03,x+side,2.52,-5.82,trim);
  }
  for(const x of [-5.2,5.2]) {
    const column=new THREE.Mesh(new THREE.CylinderGeometry(.22,.26,4.8,20),ivory);column.position.set(x,2.4,-5.25);scene.add(column);
    box(.7,.15,.7,x,.075,-5.25,trim);box(.7,.15,.7,x,4.8,-5.25,trim);
  }
  const ceilingFrame=box(7,.035,7,0,5.32,0,trim);ceilingFrame.material=new THREE.MeshStandardMaterial({color:'#dac8a7'});
  box(6.8,.05,6.8,0,5.28,0,ivory);
  scene.add(new THREE.HemisphereLight('#fff2d9','#ab9271',2.1));
  const mainLight=new THREE.DirectionalLight('#ffe7bd',2.1);mainLight.position.set(3,5,4);scene.add(mainLight);
  const pictureLight=new THREE.SpotLight('#fff0c8',28,10,.48,.7,1.5);pictureLight.position.set(0,4.5,-3.2);pictureLight.target.position.set(0,2.3,-5.7);scene.add(pictureLight,pictureLight.target);
  // Unos conos translúcidos sugieren la iluminación sin mapas de sombras.
  for(const x of [-3.55,3.4]) {
    const glow=new THREE.Mesh(new THREE.ConeGeometry(1.45,3.8,24,1,true),new THREE.MeshBasicMaterial({color:'#ffe8b1',transparent:true,opacity:.035,side:THREE.DoubleSide,depthWrite:false}));glow.position.set(x,2.3,-1.5);scene.add(glow);
    box(.32,.045,.35,x,4.25,-1.5,gold);
  }
  function plaque(piece,index,x,y,z,width=2.15) {
    const map=texture(1024,256,(g,w,h)=>{
      g.fillStyle='#e8d9bc';g.fillRect(0,0,w,h);g.strokeStyle='#b69b67';g.lineWidth=5;g.strokeRect(10,10,w-20,h-20);
      g.fillStyle='#8a7046';g.textAlign='center';g.font='21px Arial';g.fillText(`PIEZA 0${index+1}   ·   ${piece.date}`,w/2,59);
      let size=48;g.font=`${size}px Georgia`;while(g.measureText(piece.title).width>w-70){size-=2;g.font=`${size}px Georgia`;}
      g.fillStyle='#4b3e2b';g.fillText(piece.title,w/2,130);
      g.font='23px Georgia';g.fillStyle='#78664a';g.fillText(piece.description.length>70?piece.description.slice(0,67)+'…':piece.description,w/2,192);
    });
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map,toneMapped:false}));mesh.position.set(x,y,z);scene.add(mesh);return mesh;
  }
  function marker(x,z,radius=.85) {
    const mesh=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.025,40),new THREE.MeshBasicMaterial({color:'#ac874b',transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.008,z);scene.add(mesh);return mesh;
  }
  // Pieza 01: vitrina con una conversación de papel, sin marcas de aplicaciones.
  box(2.1,.16,1.4,-3.55,.92,-1.5,wood);box(1.6,.88,1,-3.55,.44,-1.5,ivory);
  box(1.7,.07,1.05,-3.55,.14,-1.5,trim);box(1.7,.05,1.05,-3.55,.87,-1.5,trim);
  const glassMaterial=new THREE.MeshStandardMaterial({color:'#d0e6e0',transparent:true,opacity:.12,roughness:.1,metalness:.1,depthWrite:false});
  const glass=box(2,.95,1.3,-3.55,1.48,-1.5,glassMaterial);
  for(const x of [-4.5,-2.6]) for(const z of [-2.12,-.88])box(.025,.95,.025,x,1.48,z,gold);
  box(2.05,.035,1.35,-3.55,1.96,-1.5,gold);
  const conversation=texture(512,640,(g,w,h)=>{
    g.fillStyle='#faf2df';g.fillRect(0,0,w,h);g.fillStyle='#93764b';g.font='20px Georgia';g.textAlign='center';g.fillText('nuestro primer mensaje',w/2,56);
    room.exhibits[0].messages.slice(0,4).forEach((message,index)=>{
      g.fillStyle=message.from==='sender'?'#e4d4b0':'#ece4d3';const x=message.from==='sender'?95:28,y=95+index*115;g.fillRect(x,y,370,87);
      g.fillStyle='#6b5b41';g.font='21px Georgia';g.textAlign='left';const words=text(message.text).split(' ');let line='',row=0;
      for(const word of words){if(g.measureText(line+word).width>327){g.fillText(line,x+17,y+30+row*27);line='';row++;}line+=word+' ';if(row>1)break;}if(row<3)g.fillText(line,x+17,y+30+row*27);
    });
  });
  const letter=new THREE.Mesh(new THREE.PlaneGeometry(1.08,1.35),new THREE.MeshStandardMaterial({map:conversation,roughness:1,side:THREE.DoubleSide}));letter.position.set(-3.55,1.34,-1.55);letter.rotation.x=-.6;scene.add(letter);
  const casePlaque=plaque(room.exhibits[0],0,-3.55,.67,-.77,2);
  targets.push({id:'message',index:0,focus:new THREE.Vector3(-3.55,1.45,-1.5),approach:{x:-3.55,z:1.1},hits:[glass,letter,casePlaque],marker:marker(-3.55,-1.5,1.05)});
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
  for(const x of [-1.65,1.65])box(.025,2.26,.17,x,2.5,-5.64,gold);
  for(const y of [1.39,3.61])box(3.33,.025,.17,0,y,-5.64,gold);
  box(1.2,.06,.22,0,3.98,-5.35,gold);
  const photoPlaque=plaque(room.exhibits[1],1,0,.87,-5.72,3);
  targets.push({id:'first-date',index:1,focus:new THREE.Vector3(0,2.3,-5.75),approach:{x:0,z:-2.65},hits:[picture,photoPlaque],marker:marker(0,-3.95,.5)});
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
  box(1.5,.12,1.5,3.4,.06,-1.3,trim);box(1.18,1.05,1.18,3.4,.64,-1.3,ivory);box(1.5,.1,1.5,3.4,1.21,-1.3,paper);
  const rings=new THREE.Group();rings.position.set(3.4,1.73,-1.3);
  const loopGeometry=room.symbolicObject.type==='interlocked-links'?new THREE.TorusGeometry(.29,.07,12,32):new THREE.TorusGeometry(.28,.065,12,40);
  const ringA=new THREE.Mesh(loopGeometry,gold);ringA.position.x=-.17;ringA.rotation.y=.45;ringA.rotation.z=.22;
  const ringB=new THREE.Mesh(loopGeometry,new THREE.MeshStandardMaterial({color:room.symbolicObject.secondColor,metalness:.9,roughness:.3}));ringB.position.x=.17;ringB.rotation.y=-.85;ringB.rotation.z=-.3;rings.add(ringA,ringB);scene.add(rings);
  const symbolPlaque=plaque(room.exhibits[2],2,3.4,.81,-.52,1.9);
  const symbolHit=box(1.15,1.05,.8,3.4,1.58,-1.3,new THREE.MeshBasicMaterial({visible:false}));
  targets.push({id:'together',index:2,focus:new THREE.Vector3(3.4,1.6,-1.3),approach:{x:3.4,z:1.15},hits:[symbolHit,symbolPlaque],marker:marker(3.4,-1.3,.88)});
  // Llave pequeña, integrada en el detalle de una columna; siempre accesible.
  const position=room.clue.position;
  const keyGroup=new THREE.Group();keyGroup.position.set(THREE.MathUtils.clamp(position[0],-4.7,4.7),THREE.MathUtils.clamp(position[1],.9,2.1),THREE.MathUtils.clamp(position[2],-4.75,4.5));
  const keyBow=new THREE.Mesh(new THREE.TorusGeometry(.09,.018,8,20),gold);keyBow.position.y=.17;keyGroup.add(keyBow);
  const shaft=new THREE.Mesh(new THREE.BoxGeometry(.027,.25,.025),gold);shaft.position.y=-.02;keyGroup.add(shaft);
  for(const y of [-.09,-.14]){const tooth=new THREE.Mesh(new THREE.BoxGeometry(.075,.026,.025),gold);tooth.position.set(.03,y,0);keyGroup.add(tooth);}
  scene.add(keyGroup);
  const keyHit=new THREE.Mesh(new THREE.SphereGeometry(.3,12,8),new THREE.MeshBasicMaterial({visible:false}));keyHit.position.copy(keyGroup.position);scene.add(keyHit);
  const keyTarget={id:'key',focus:keyGroup.position.clone(),approach:{x:keyGroup.position.x*.77,z:keyGroup.position.z+1.3},hits:[keyHit],marker:null};targets.push(keyTarget);
  engine=createGallery({container:$('#gallery-stage'),scene,camera,obstacles,targets,onTarget:setTarget,onActivate:openTarget,onUnavailable:fallbackMode});
  const pmrem=new THREE.PMREMGenerator(engine.renderer),environment=new RoomEnvironment();
  scene.environment=pmrem.fromScene(environment,.04).texture;scene.environmentIntensity=.5;environment.dispose();pmrem.dispose();
  engine.setActive(true);
  setTarget(null);
}

function enterRoom() {
  Museum.showRoom();
  if(!initialized) {
    initialized=true;
    try{buildRoom();}catch{fallbackMode();}
  }
  engine?.setActive(true);updateProgress();
  if(fallback)setTarget({id:room.exhibits[currentPiece].id,index:currentPiece});
}
function guideTo(index,source=null) {
  currentPiece=index;
  if(fallback){setTarget({id:room.exhibits[index].id,index});return;}
  const target=targets[index];
  if(target && engine?.guideTo(target)) {
    $('#target-name').textContent=`Hacia: ${room.exhibits[index].title}`;
    source?.classList.add('guiding-stop');
  } else Museum.notify('Puedes acercarte a la pieza con los controles de la sala.');
}
function placeholderPhoto(piece) {
  return `<figure class="memory-photo"><img src="${escape(piece.photo||piece.placeholder)}" alt="${escape(piece.photo?piece.photoAlt:'Ilustración provisional de una terraza con dos cafés')}" decoding="async"><figcaption>${piece.photo?escape(piece.description):'Una primera salida · composición provisional'}</figcaption></figure>`;
}
function conversationMarkup(piece) {
  if(piece.screenshot)return `<figure class="conversation-capture"><img src="${escape(piece.screenshot)}" alt="${escape(piece.screenshotAlt)}" decoding="async"></figure>`;
  return `<div class="conversation-paper"><div class="conversation-header"><span>${escape(config.couple)}</span><small>${escape(piece.date)}</small></div>${piece.messages.map(message=>`<div class="message-bubble ${message.from==='sender'?'sent':'received'}"><span>${escape(config[message.from]||message.from)}</span><p>${escape(text(message.text))}</p><small>${escape(message.time||'')}</small></div>`).join('')}<p class="conversation-note">Conversación de demostración</p></div>`;
}
function symbolMarkup() {return '<div class="symbol-composition" aria-label="Dos piezas entrelazadas"><span></span><span></span><i aria-hidden="true">✧</i></div>';}
function rewardMarkup(){return `<div class="stamp-reward" role="status"><div class="new-stamp"><span>SALA 01</span><b>✧</b><span>AQUÍ COMENZÓ TODO</span></div><p>${escape(room.completionMessage)}</p><div><button data-completion="lobby" class="text-button">Volver al vestíbulo</button><button data-completion="map" class="button primary">Seguir explorando ↗</button></div></div>`;}
function openPiece(index,source=$('#view-memory')) {
  const piece=room.exhibits[index];currentPiece=index;
  const progress=Museum.discoverPiece('beginning',piece.id);
  const artwork=index===0?conversationMarkup(piece):index===1?placeholderPhoto(piece):symbolMarkup();
  let media='';
  if(piece.audio)media=`<div class="optional-audio"><button id="play-memory-audio" class="button secondary">▶ ${escape(text(piece.audioLabel))}</button><audio id="memory-audio" preload="none" src="${escape(piece.audio)}"></audio><p id="media-status" role="status"></p></div>`;
  if(piece.video)media=`<div class="optional-video"><button id="play-memory-video" class="button secondary">▶ Ver nuestro video</button><video id="memory-video" preload="none" playsinline ${piece.videoPoster?`poster="${escape(piece.videoPoster)}"`:''} src="${escape(piece.video)}" hidden></video><p id="media-status" role="status"></p></div>`;
  Museum.openContent({className:'memory-overlay',source,html:`<div class="memory-heading"><p class="eyebrow">PIEZA 0${index+1} · ${escape(piece.date)}</p><h2 id="dialog-title">${escape(piece.title)}</h2></div>${artwork}<blockquote class="memory-dedication">“${escape(piece.dedication)}”</blockquote>${media}${progress.newlyCompleted?rewardMarkup():''}<div class="memory-footer"><p>${escape(config.sender)} <span>para</span> ${escape(config.recipient)}</p><button id="next-piece" class="text-button">${index<2?'Ir a la siguiente pieza':'Volver a la primera pieza'} →</button></div>`});
  $('#next-piece').addEventListener('click',()=>{Museum.closeOverlay();setTimeout(()=>guideTo((index+1)%3),0);});
  document.querySelectorAll('[data-completion]').forEach(button=>button.addEventListener('click',()=>{
    if(button.dataset.completion==='map')Museum.openMap($('#room-map'));
    else{Museum.closeOverlay();Museum.returnToLobby();}
  }));
  document.querySelectorAll('.memory-overlay img').forEach(image=>image.addEventListener('error',()=>{
    const replacement=document.createElement('div');replacement.className='missing-memory-image';replacement.textContent='Este recuerdo espera su imagen. Por ahora, conserva estas palabras.';image.replaceWith(replacement);
  }));
  if(piece.audio) {
    const audio=$('#memory-audio'),button=$('#play-memory-audio');
    button.addEventListener('click',async()=>{try{if(audio.paused){await audio.play();button.textContent='Ⅱ Pausar audio';}else{audio.pause();button.textContent=`▶ ${text(piece.audioLabel)}`;}}catch{$('#media-status').textContent='No se pudo reproducir el audio. Puedes seguir disfrutando del recuerdo.';}});
    audio.addEventListener('ended',()=>{button.textContent=`▶ ${text(piece.audioLabel)}`;});
    audio.addEventListener('error',()=>{$('#media-status').textContent='Este audio no está disponible por ahora.';button.hidden=true;});
  }
  if(piece.video) {
    const video=$('#memory-video'),button=$('#play-memory-video');
    button.addEventListener('click',async()=>{video.hidden=false;video.controls=true;try{await video.play();button.hidden=true;}catch{$('#media-status').textContent='No se pudo reproducir el video. La dedicatoria sigue aquí para ti.';}});
    video.addEventListener('error',()=>{video.hidden=true;button.hidden=true;$('#media-status').textContent='Este video no está disponible por ahora.';});
  }
  updateProgress();
}
function openKey(source=$('#view-memory')) {
  const added=Museum.findClue(room.clue.id);
  Museum.openContent({className:'key-overlay',source,html:`<div class="dialog-heading"><p class="eyebrow">${added?'LA PRIMERA PISTA':'TU PRIMERA LLAVE'}</p><h2 id="dialog-title">La llave del comienzo</h2></div><div class="collectible-key" aria-hidden="true"><span></span><i></i></div><blockquote class="memory-dedication">“${escape(room.clue.message)}”</blockquote><p class="key-counter">Pistas encontradas: ${Museum.getProgress().clues.length} de 5</p><p class="key-note">Una de las cinco llaves de la vitrina secreta. Tu sello y tus pistas cuentan su propia historia.</p>`});
  updateProgress();
}
function openTarget(target=selected){if(!target)return;if(target.id==='key')openKey();else openPiece(target.index);}
Museum.registerRoom('beginning',enterRoom);
$('#view-memory').addEventListener('click',()=>openTarget());
document.querySelectorAll('[data-tour]').forEach(button=>button.addEventListener('click',()=>guideTo(Number(button.dataset.tour),button)));
$('#gallery-stage').addEventListener('gallery:arrived',()=>{document.querySelectorAll('.guiding-stop').forEach(button=>button.classList.remove('guiding-stop'));});
$('#room-back').addEventListener('click',Museum.returnToLobby);
$('#room-map').addEventListener('click',event=>Museum.openMap(event.currentTarget));
$('#room-passport').addEventListener('click',event=>Museum.openPassport(event.currentTarget));
$('#clue-hint').addEventListener('click',()=>Museum.notify(room.clue.hint));
$('#accessible-decoration').addEventListener('click',event=>openKey(event.currentTarget));
$('#completed-lobby').addEventListener('click',Museum.returnToLobby);
$('#completed-map').addEventListener('click',event=>Museum.openMap(event.currentTarget));
document.addEventListener('museum:progress',updateProgress);
document.addEventListener('museum:overlay',event=>engine?.setPaused(event.detail));
document.addEventListener('museum:screen',event=>{engine?.setActive(event.detail==='room');document.body.classList.toggle('room-view',event.detail==='room');});
updateProgress();
