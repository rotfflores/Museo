/* Sala 03 · Pequeñas cosas, grandes recuerdos: una sala circular e íntima con seis vitrinas
   alrededor de la mesa «Nuestra colección». Mismo motor, gestos, notas, dock y puertas que las salas 01 y 02. */
import * as THREE from './vendor/three.module.min.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {Reflector} from './vendor/Reflector.js';
import {createGallery} from './gallery-engine.js';
import {isWalkable} from './navigation.mjs';

const Museum=window.Museum,config=window.MUSEUM_CONFIG,room=config.littleThingsRoom;
const ROOM_ID='little-things';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text=value=>String(value??'').replace(/\{(sender|recipient)\}/g,(_,key)=>config[key]);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
// Orden estable: por la posición configurada (1 a 6) alrededor de la mesa.
const objects=[...room.objects].sort((a,b)=>(a.position||99)-(b.position||99));
const TOTAL=()=>objects.length;

// Planta circular: radio 7, la entrada en z positivo; vitrinas en un anillo y la mesa al centro.
const RADIUS=7,WALL_H=4.6,RING=4.3,TABLE_R=1.15,FRONT=6.75;
const angleFor=index=>THREE.MathUtils.degToRad(-150+60*index);
const ringPoint=(index,r)=>({x:r*Math.sin(angleFor(index)),z:-r*Math.cos(angleFor(index))});
const BOUNDS={minX:-6.1,maxX:6.1,minZ:-6.1,maxZ:6.1};
const obstacles=[
  {minX:-TABLE_R-.15,maxX:TABLE_R+.15,minZ:-TABLE_R-.15,maxZ:TABLE_R+.15},
  ...objects.map((_,index)=>{const p=ringPoint(index,RING);return {minX:p.x-.55,maxX:p.x+.55,minZ:p.z-.55,maxZ:p.z+.55};}),
  // Las esquinas del rectángulo de paso quedan fuera del muro circular.
  ...[[1,1],[1,-1],[-1,1],[-1,-1]].flatMap(([sx,sz])=>[
    {minX:sx>0?4.7:-6.2,maxX:sx>0?6.2:-4.7,minZ:sz>0?3.4:-6.2,maxZ:sz>0?6.2:-3.4},
    {minX:sx>0?3.4:-6.2,maxX:sx>0?6.2:-3.4,minZ:sz>0?4.7:-6.2,maxZ:sz>0?6.2:-4.7}])
];

let engine=null,initialized=false,fallback=false,selected=null,currentPiece=0;
let focused=null,flyingTo=null,hoverTarget=null,ping=null,firstFrame=null,inspecting=null,returnPose=null;
let exitTarget=null,exitOpen=0,exitOpening=false,clueTarget=null,tableTarget=null,lastFrameTime=0;
const targets=[],pieceTargets=[],miniatures=new Map();

{const words=room.title.split(' '),last=words.pop();$('#little-title').innerHTML=words.length?`${escape(words.join(' '))} <em>${escape(last)}</em>`:escape(last);}
$('#little-subtitle').textContent=room.subtitle;
$('#little-tour').innerHTML=objects.map((piece,index)=>`<button class="tour-stop" data-little-tour="${index}" type="button"><span class="tour-number">${String(index+1).padStart(2,'0')}</span><span>${escape(piece.title)}<small>${escape(piece.date||'')}</small></span><span class="tour-check" aria-label="Sin descubrir">○</span></button>`).join('');

function updateProgress() {
  const progress=Museum.getProgress(),found=progress.discoveries[ROOM_ID]||[];
  const counter=`Objetos descubiertos: ${found.length} de ${TOTAL()}`;
  $('#little-counter').textContent=counter;$('#little-discovery-count').textContent=counter;
  $('#little-clue-count').textContent=`Pistas encontradas: ${progress.clues.length} de ${config.clueIds.length}`;
  $('#little-passport-count').textContent=`${progress.completed.length}/6`;
  $('#little-passport').setAttribute('aria-label',`Pasaporte de recuerdos, ${progress.completed.length} de 6 salas completadas`);
  for(const [id,mini] of miniatures)mini.group.visible=found.includes(id);
  for(const target of pieceTargets)if(target.seen)target.seen.visible=found.includes(target.id);
  document.querySelectorAll('[data-little-tour]').forEach(button=>{
    const done=found.includes(objects[Number(button.dataset.littleTour)].id);
    button.classList.toggle('discovered',done);
    const check=button.querySelector('.tour-check');check.textContent=done?'✧':'○';check.setAttribute('aria-label',done?'Descubierto':'Sin descubrir');
  });
}
function nameOf(target) {
  if(!target)return room.subtitle;
  if(target.id==='exit')return 'La puerta al vestíbulo';
  if(target.id==='clue')return 'Un pequeño detalle en la mesa';
  if(target.id==='table')return 'Nuestra colección';
  if(target.miniOf!==undefined)return `Miniatura: ${objects[target.miniOf].title}`;
  return objects[target.index].title;
}
function setTarget(target) {
  selected=target;
  $('#little-target-name').textContent=nameOf(target);
  syncExamine();
}
// Señal discreta: al enfocar un objeto aparece «Examinar recuerdo».
function syncExamine() {
  const button=$('#little-examine'),show=!!selected&&selected.index!==undefined&&!inspecting&&!flyingTo&&!$('#little-screen').hidden;
  button.hidden=!show;
  if(show)button.querySelector('span:last-child').textContent=`Examinar recuerdo · ${objects[selected.index].title}`;
}
function fallbackMode() {
  fallback=true;$('#little-fallback').hidden=false;$('#little-stage').classList.add('without-webgl');
  $('#little-accessible-clue').hidden=false;
}
function texture(width,height,paint) {
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;paint(canvas.getContext('2d'),width,height);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map;
}
function wrapText(g,value,x,y,maxWidth,lineHeight,maxLines=3) {
  const words=String(value).split(' ');let line='',lines=[];
  for(const word of words){const test=line?line+' '+word:word;if(g.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;}
  if(line)lines.push(line);
  if(lines.length>maxLines){lines=lines.slice(0,maxLines);lines[maxLines-1]=lines[maxLines-1].replace(/\s*\S*$/,'')+'…';}
  lines.forEach((l,i)=>g.fillText(l,x,y+i*lineHeight));
}

/* ===== Modelos de demostración: geometría sencilla, volumen y materiales cuidados ===== */
const M={
  ceramic:()=>new THREE.MeshStandardMaterial({color:'#f4ece0',roughness:.35}),
  terracotta:()=>new THREE.MeshStandardMaterial({color:'#c9805f',roughness:.4}),
  coffee:()=>new THREE.MeshStandardMaterial({color:'#4a2a17',roughness:.15}),
  gold:()=>new THREE.MeshStandardMaterial({color:'#d2ad66',metalness:1,roughness:.25}),
  leather:()=>new THREE.MeshStandardMaterial({color:'#7a4a2c',roughness:.55}),
  darkLeather:()=>new THREE.MeshStandardMaterial({color:'#3f2617',roughness:.6}),
  stem:()=>new THREE.MeshStandardMaterial({color:'#5f7a4c',roughness:.6}),
  petal:()=>new THREE.MeshStandardMaterial({color:'#e8918a',roughness:.45,side:THREE.DoubleSide}),
  glass:()=>new THREE.MeshStandardMaterial({color:'#eef5f2',transparent:true,opacity:.22,roughness:.05,metalness:.1}),
  wood:()=>new THREE.MeshStandardMaterial({color:'#4a2e1c',roughness:.5})
};
function paperTexture(width,height,paint){return texture(width,height,(g,w,h)=>{const grad=g.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#fbf4e4');grad.addColorStop(1,'#efe2c8');g.fillStyle=grad;g.fillRect(0,0,w,h);paint(g,w,h);});}
const BUILDERS={
  cups(){
    const group=new THREE.Group(),profile=[[0,0],[.075,0],[.085,.012],[.1,.11],[.104,.135],[.096,.135],[.088,.016],[0,.016]].map(([x,y])=>new THREE.Vector2(x,y));
    [[-.14,M.ceramic(),0],[.14,M.terracotta(),.35]].forEach(([x,material,turn])=>{
      const cup=new THREE.Group();cup.position.x=x;cup.rotation.y=turn;
      cup.add(new THREE.Mesh(new THREE.LatheGeometry(profile,28),material));
      const handle=new THREE.Mesh(new THREE.TorusGeometry(.035,.011,8,20,Math.PI),material);handle.position.set(.1,.07,0);handle.rotation.z=-Math.PI/2;cup.add(handle);
      const coffee=new THREE.Mesh(new THREE.CircleGeometry(.092,24),M.coffee());coffee.rotation.x=-Math.PI/2;coffee.position.y=.115;cup.add(coffee);
      const saucer=new THREE.Mesh(new THREE.CylinderGeometry(.15,.12,.015,32),material);saucer.position.y=-.008;cup.add(saucer);
      group.add(cup);
    });
    return group;
  },
  tickets(piece){
    const group=new THREE.Group();
    [['#f4c8a8',0],['#f2dfb0',1]].forEach(([tone,i])=>{
      const map=texture(512,224,(g,w,h)=>{g.fillStyle=tone;g.fillRect(0,0,w,h);g.strokeStyle='#8a5a3a';g.lineWidth=4;g.setLineDash([10,8]);g.strokeRect(14,14,w-28,h-28);g.setLineDash([]);
        g.fillStyle='#fbf3e2';for(let y=20;y<h;y+=28){g.beginPath();g.arc(w*.72,y,5,0,Math.PI*2);g.fill();}
        g.fillStyle='#5a3424';g.textAlign='center';g.font='bold 46px Georgia, serif';g.fillText('ADMIT ONE',w*.37,98);g.font='500 22px "Segoe UI", Arial, sans-serif';g.fillText(text(piece.ticketText||'CINE'),w*.37,146);
        g.font='bold 40px Georgia, serif';g.fillText(`Nº ${i?'0218':'0217'}`,w*.86,128);});
      const ticket=new THREE.Mesh(new THREE.BoxGeometry(.36,.158,.004),[M.ceramic(),M.ceramic(),M.ceramic(),M.ceramic(),new THREE.MeshStandardMaterial({map,roughness:.7}),new THREE.MeshStandardMaterial({map,roughness:.7})]);
      ticket.position.set(i*.07-.03,.09+i*.02,i*.03);ticket.rotation.set(-.35,0,i?-.18:.12);group.add(ticket);
    });
    const stand=new THREE.Mesh(new THREE.BoxGeometry(.34,.02,.12),M.wood());stand.position.y=.01;group.add(stand);
    return group;
  },
  flower(piece){
    const group=new THREE.Group();
    const vase=new THREE.Mesh(new THREE.CylinderGeometry(.06,.05,.16,24,1,true),M.glass());vase.position.y=.08;group.add(vase);
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.02,0),new THREE.Vector3(.02,.18,0),new THREE.Vector3(-.01,.34,.01),new THREE.Vector3(.01,.46,0)]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve,24,.007,6),M.stem()));
    const petal=M.petal();
    for(let i=0;i<7;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.05,14,10),petal);const a=i/7*Math.PI*2;p.scale.set(1,.32,.62);p.position.set(Math.cos(a)*.045+.01,.465,Math.sin(a)*.045);p.rotation.set(0,-a,.45);group.add(p);}
    const center=new THREE.Mesh(new THREE.SphereGeometry(.026,14,10),new THREE.MeshStandardMaterial({color:'#e6b24a',roughness:.5}));center.position.set(.01,.475,0);group.add(center);
    for(const [y,s] of [[.2,1],[.29,-1]]){const leaf=new THREE.Mesh(new THREE.SphereGeometry(.04,12,8),M.stem());leaf.scale.set(1.4,.18,.55);leaf.position.set(s*.04,y,0);leaf.rotation.z=s*.5;group.add(leaf);}
    const cardMap=paperTexture(256,160,(g,w,h)=>{g.fillStyle='#7a5a3a';g.textAlign='center';g.font='italic 36px Georgia, serif';wrapText(g,text(piece.cardText||''),w/2,70,w-30,40,2);});
    const card=new THREE.Mesh(new THREE.PlaneGeometry(.16,.1),new THREE.MeshStandardMaterial({map:cardMap,roughness:.8,side:THREE.DoubleSide}));card.position.set(.15,.05,.04);card.rotation.set(-.3,-.4,0);group.add(card);
    return group;
  },
  suitcase(piece){
    const group=new THREE.Group(),shape=new THREE.Shape(),w=.46,h=.32,r=.04;
    shape.moveTo(-w/2+r,0);shape.lineTo(w/2-r,0);shape.quadraticCurveTo(w/2,0,w/2,r);shape.lineTo(w/2,h-r);shape.quadraticCurveTo(w/2,h,w/2-r,h);shape.lineTo(-w/2+r,h);shape.quadraticCurveTo(-w/2,h,-w/2,h-r);shape.lineTo(-w/2,r);shape.quadraticCurveTo(-w/2,0,-w/2+r,0);
    const body=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.15,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:2}),M.leather());body.position.z=-.075;group.add(body);
    for(const x of [-.12,.12]){const strap=new THREE.Mesh(new THREE.BoxGeometry(.035,h+.02,.18),M.darkLeather());strap.position.set(x,h/2,0);group.add(strap);const buckle=new THREE.Mesh(new THREE.BoxGeometry(.045,.03,.01),M.gold());buckle.position.set(x,h*.62,.093);group.add(buckle);}
    for(const [x,y] of [[-1,0],[1,0],[-1,1],[1,1]]){const corner=new THREE.Mesh(new THREE.SphereGeometry(.022,10,8),M.gold());corner.position.set(x*(w/2-.005),y*h+(y?-.01:.01),.085);group.add(corner);}
    const handle=new THREE.Mesh(new THREE.TorusGeometry(.055,.012,8,20,Math.PI),M.darkLeather());handle.position.y=h+.01;group.add(handle);
    (piece.tags||[]).slice(0,3).forEach((label,i)=>{
      const map=paperTexture(256,150,(g,w,h)=>{g.fillStyle='#8a5a3a';g.beginPath();g.arc(28,h/2,10,0,Math.PI*2);g.fill();g.fillStyle='#4a3020';g.textAlign='center';g.font='500 18px "Segoe UI", Arial, sans-serif';g.fillText('DESTINO',w/2+12,46);let size=34;g.font=`italic ${size}px Georgia, serif`;while(g.measureText(label).width>w-60&&size>18){size-=2;g.font=`italic ${size}px Georgia, serif`;}g.fillText(text(label),w/2+12,98);});
      const tag=new THREE.Mesh(new THREE.PlaneGeometry(.12,.07),new THREE.MeshStandardMaterial({map,roughness:.8,side:THREE.DoubleSide}));
      tag.position.set(-.15+i*.13,h*.55-i*.035,.1);tag.rotation.z=(i-1)*.18;group.add(tag);
    });
    return group;
  },
  note(piece){
    const group=new THREE.Group();
    const map=paperTexture(512,360,(g,w,h)=>{g.strokeStyle='rgba(160,135,95,.25)';g.lineWidth=2;for(let y=70;y<h-20;y+=46){g.beginPath();g.moveTo(30,y);g.lineTo(w-30,y);g.stroke();}
      g.fillStyle='#5a4128';g.font='italic 34px Georgia, serif';g.textAlign='left';wrapText(g,text(piece.noteText||''),40,64,w-80,46,6);});
    const material=new THREE.MeshStandardMaterial({map,roughness:.85,side:THREE.DoubleSide});
    // Dos mitades de papel con el doblez en medio.
    const left=new THREE.Mesh(new THREE.PlaneGeometry(.24,.34,1,1),material);left.geometry.translate(-.12,0,0);
    const leftUv=left.geometry.attributes.uv;for(let i=0;i<leftUv.count;i++)leftUv.setX(i,leftUv.getX(i)*.5);
    const right=new THREE.Mesh(new THREE.PlaneGeometry(.24,.34,1,1),material);right.geometry.translate(.12,0,0);
    const rightUv=right.geometry.attributes.uv;for(let i=0;i<rightUv.count;i++)rightUv.setX(i,.5+rightUv.getX(i)*.5);
    left.rotation.y=.35;right.rotation.y=-.35;
    const fold=new THREE.Group();fold.add(left,right);fold.rotation.x=-1.1;fold.position.y=.08;group.add(fold);
    const seal=new THREE.Mesh(new THREE.CylinderGeometry(.03,.032,.012,20),new THREE.MeshStandardMaterial({color:'#9b2f2a',roughness:.4}));seal.position.set(.16,.006,.08);group.add(seal);
    return group;
  },
  keychain(){
    const group=new THREE.Group(),gold=M.gold();
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.42,10),M.wood());post.position.set(0,.21,-.03);group.add(post);
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,.12,10),M.wood());arm.rotation.x=Math.PI/2;arm.position.set(0,.42,.03);group.add(arm);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.09,.1,.02,24),M.wood());base.position.y=.01;group.add(base);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.045,.007,10,32),gold);ring.position.set(0,.37,.08);group.add(ring);
    for(let i=0;i<3;i++){const link=new THREE.Mesh(new THREE.TorusGeometry(.012,.004,6,14),gold);link.position.set(0,.315-i*.022,.08);link.rotation.y=i%2?Math.PI/2:0;group.add(link);}
    const heart=new THREE.Shape();heart.moveTo(0,-.05);heart.bezierCurveTo(-.06,-.01,-.06,.04,-.03,.045);heart.bezierCurveTo(-.012,.05,0,.035,0,.025);heart.bezierCurveTo(0,.035,.012,.05,.03,.045);heart.bezierCurveTo(.06,.04,.06,-.01,0,-.05);
    const charm=new THREE.Mesh(new THREE.ExtrudeGeometry(heart,{depth:.012,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:2}),new THREE.MeshStandardMaterial({color:'#e3a49a',metalness:.6,roughness:.3}));
    charm.position.set(0,.2,.074);group.add(charm);
    return group;
  },
  photo(piece){
    // Alternativa sin modelo: una fotografía enmarcada sobre un atril.
    const group=new THREE.Group(),frame=new THREE.Group();frame.rotation.x=-.18;frame.position.y=.2;group.add(frame);
    const picture=new THREE.Mesh(new THREE.PlaneGeometry(.3,.22),new THREE.MeshStandardMaterial({color:'#e6dccb',roughness:.9}));picture.position.z=.012;frame.add(picture);
    for(const [w,h,x,y] of [[.36,.03,0,.125],[.36,.03,0,-.125],[.03,.28,-.165,0],[.03,.28,.165,0]]){const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,.025),M.wood());b.position.set(x,y,0);frame.add(b);}
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.02,.24,.02),M.wood());leg.position.set(0,.11,-.08);leg.rotation.x=.35;group.add(leg);
    if(piece.photo)new THREE.TextureLoader().load(piece.photo,map=>{map.colorSpace=THREE.SRGBColorSpace;const img=map.image,ratio=img.width/img.height;let w=.3,h=w/ratio;if(h>.22){h=.22;w=h*ratio;}picture.geometry.dispose();picture.geometry=new THREE.PlaneGeometry(w,h);picture.material.dispose();picture.material=new THREE.MeshBasicMaterial({map,toneMapped:false});},undefined,()=>{});
    return group;
  }
};
// Ajusta cualquier objeto a un tamaño dado, centrado y apoyado en su base.
function normalize(object,size) {
  const holder=new THREE.Group();holder.add(object);
  const box=new THREE.Box3().setFromObject(object),dims=box.getSize(new THREE.Vector3()),scale=size/Math.max(dims.x,dims.y,dims.z,.001);
  object.scale.multiplyScalar(scale);
  const scaled=new THREE.Box3().setFromObject(object),center=scaled.getCenter(new THREE.Vector3());
  object.position.x-=center.x;object.position.z-=center.z;object.position.y-=scaled.min.y;
  return holder;
}
let gltfLoader=null;
function buildObject(piece,size) {
  const kind=BUILDERS[piece.object]?piece.object:piece.photo?'photo':'keychain';
  const holder=normalize(BUILDERS[kind](piece),size);
  // Modelo propio opcional (.glb/.gltf): sustituye al de demostración al cargarse.
  if(piece.model){
    (gltfLoader?Promise.resolve(gltfLoader):import('./vendor/GLTFLoader.js').then(({GLTFLoader})=>(gltfLoader=new GLTFLoader()))).then(loader=>loader.load(piece.model,gltf=>{
      const model=normalize(gltf.scene,size);holder.clear();holder.add(model);
    },undefined,()=>{/* Si el modelo falla, se queda el de demostración. */})).catch(()=>{});
  }
  return holder;
}

function buildRoom() {
  const test=document.createElement('canvas');
  if(!test.getContext('webgl2')){fallbackMode();return;}
  const small=innerWidth<600;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e9dccb');scene.fog=new THREE.Fog('#e9dccb',12,24);
  const camera=new THREE.PerspectiveCamera(60,1,.1,40);camera.position.set(0,1.65,5.5);
  const ivory=new THREE.MeshStandardMaterial({color:'#efe4d1',roughness:.95});
  const darkWood=new THREE.MeshStandardMaterial({color:'#3a2416',roughness:.45});
  const goldTrim=new THREE.MeshStandardMaterial({color:'#c9a564',metalness:1,roughness:.28});
  const glass=new THREE.MeshStandardMaterial({color:'#eef5f2',transparent:true,opacity:.08,roughness:.03,metalness:.1,depthWrite:false});
  const rand=(seed=>()=>(seed=(seed*16807)%2147483647)/2147483647)(31);
  const dotMap=texture(64,64,g=>{const grad=g.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(255,248,225,1)');grad.addColorStop(.35,'rgba(255,232,180,.55)');grad.addColorStop(1,'rgba(255,230,170,0)');g.fillStyle=grad;g.fillRect(0,0,64,64);});
  function box(width,height,depth,x,y,z,material=ivory) {const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);mesh.position.set(x,y,z);mesh.receiveShadow=true;scene.add(mesh);return mesh;}
  // Suelo de madera oscura en espiga con un medallón dorado bajo la mesa, sobre un espejo suave.
  const floorMap=texture(1024,1024,(g,w,h)=>{
    g.fillStyle='#5a3a26';g.fillRect(0,0,w,h);
    const plank=64,len=192;
    for(let y=-len;y<h+len;y+=plank)for(let x=-len;x<w+len;x+=plank*2){
      for(const flip of [0,1]){g.save();g.translate(x+flip*plank,y);g.rotate(flip?-Math.PI/4:Math.PI/4);const tone=60+rand()*30;g.fillStyle=`rgb(${tone+40},${tone+12},${tone-14})`;g.fillRect(0,0,len,plank-4);g.strokeStyle='rgba(20,10,4,.35)';g.lineWidth=2;g.strokeRect(0,0,len,plank-4);g.restore();}
    }
    g.strokeStyle='#c9a564';g.lineWidth=10;g.beginPath();g.arc(w/2,h/2,w*.2,0,Math.PI*2);g.stroke();g.lineWidth=3;g.beginPath();g.arc(w/2,h/2,w*.215,0,Math.PI*2);g.stroke();
    g.beginPath();g.arc(w/2,h/2,w*.48,0,Math.PI*2);g.lineWidth=8;g.stroke();
  });
  floorMap.anisotropy=4;
  const mirror=new Reflector(new THREE.CircleGeometry(RADIUS,64),{textureWidth:small?512:1024,textureHeight:small?512:1024,color:0x6a6058,clipBias:.003});
  mirror.rotation.x=-Math.PI/2;mirror.position.y=.001;scene.add(mirror);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(RADIUS,64),new THREE.MeshStandardMaterial({map:floorMap,transparent:true,opacity:.86,roughness:.4}));
  floor.rotation.x=-Math.PI/2;floor.position.y=.005;floor.receiveShadow=true;scene.add(floor);
  // Muro circular crema con zócalo de madera oscura, filete dorado, cornisa y techo con óculo.
  const wall=new THREE.Mesh(new THREE.CylinderGeometry(RADIUS,RADIUS,WALL_H,72,1,true),new THREE.MeshStandardMaterial({color:'#efe4d1',roughness:.95,side:THREE.BackSide}));wall.position.y=WALL_H/2;scene.add(wall);
  const wainscot=new THREE.Mesh(new THREE.CylinderGeometry(RADIUS-.04,RADIUS-.04,1.1,72,1,true),new THREE.MeshStandardMaterial({color:'#3f2819',roughness:.5,side:THREE.BackSide}));wainscot.position.y=.55;scene.add(wainscot);
  for(const [y,tube,material] of [[1.12,.025,goldTrim],[WALL_H-.2,.08,new THREE.MeshStandardMaterial({color:'#d8c6a6',roughness:.8})]]){const ring=new THREE.Mesh(new THREE.TorusGeometry(RADIUS-.06,tube,8,120),material);ring.rotation.x=Math.PI/2;ring.position.y=y;scene.add(ring);}
  const ceiling=new THREE.Mesh(new THREE.CircleGeometry(RADIUS,64),new THREE.MeshStandardMaterial({color:'#efe4d1',roughness:.95,side:THREE.BackSide}));ceiling.rotation.x=-Math.PI/2;ceiling.position.y=WALL_H;scene.add(ceiling);
  const oculus=new THREE.Mesh(new THREE.CircleGeometry(.9,40),new THREE.MeshBasicMaterial({color:'#fff8e8',toneMapped:false}));oculus.rotation.x=Math.PI/2;oculus.position.y=WALL_H-.01;scene.add(oculus);
  const oculusRing=new THREE.Mesh(new THREE.TorusGeometry(.94,.04,8,56),goldTrim);oculusRing.rotation.x=Math.PI/2;oculusRing.position.y=WALL_H-.02;scene.add(oculusRing);
  // Texto de bienvenida en el muro frente a la entrada.
  {
    const map=texture(1024,300,(g,w,h)=>{g.textAlign='center';g.fillStyle='#9a7b45';g.font='500 24px "Segoe UI", Arial, sans-serif';g.letterSpacing='12px';g.fillText('SALA 03',w/2,50);g.letterSpacing='0px';
      g.fillStyle='#4a3c2c';let size=66;g.font=`italic ${size}px Georgia, "Times New Roman", serif`;while(g.measureText(room.title).width>w-60){size-=3;g.font=`italic ${size}px Georgia, "Times New Roman", serif`;}g.fillText(room.title,w/2,130);
      g.strokeStyle='#b89b66';g.lineWidth=3;g.beginPath();g.moveTo(w/2-100,162);g.lineTo(w/2+100,162);g.stroke();
      g.fillStyle='#766750';g.font='28px Georgia, "Times New Roman", serif';wrapText(g,room.subtitle,w/2,210,w-140,38,2);});
    map.anisotropy=4;
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.6,1.05),new THREE.MeshBasicMaterial({map,transparent:true,toneMapped:false}));sign.position.set(0,2.75,-RADIUS+.75);scene.add(sign);
  }
  // Luz: cálida y dirigida a cada vitrina.
  scene.add(new THREE.HemisphereLight('#fff1d8','#7a5a40',.9));
  const center=new THREE.PointLight('#ffdcae',12,9,1.5);center.position.set(0,3.4,0);scene.add(center);
  // Placas como en las otras salas.
  function plaque(piece,index,width=.9) {
    const map=texture(1024,300,(g,w,h)=>{
      const grad=g.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#efe5d0');grad.addColorStop(1,'#e0d0b3');g.fillStyle=grad;g.fillRect(0,0,w,h);
      g.strokeStyle='#beaa85';g.lineWidth=4;g.strokeRect(2,2,w-4,h-4);g.strokeStyle='rgba(245,236,212,.7)';g.lineWidth=8;g.strokeRect(8,8,w-16,h-16);
      g.fillStyle='#a28b61';for(const [sx,sy] of [[24,24],[w-24,24],[24,h-24],[w-24,h-24]]){g.beginPath();g.arc(sx,sy,5,0,Math.PI*2);g.fill();}
      g.textAlign='center';g.fillStyle='#9a7b45';g.font='500 22px "Segoe UI", Arial, sans-serif';g.letterSpacing='5px';
      let eyebrow=`OBJETO ${String(index+1).padStart(2,'0')}${piece.date?'  ·  '+piece.date.toUpperCase():''}`;while(g.measureText(eyebrow).width>w-80)eyebrow=eyebrow.slice(0,-2);
      g.fillText(eyebrow,w/2,60);g.letterSpacing='0px';
      let size=58;g.font=`italic ${size}px Georgia, "Times New Roman", serif`;while(g.measureText(piece.title).width>w-90){size-=2;g.font=`italic ${size}px Georgia, "Times New Roman", serif`;}
      g.fillStyle='#4a3c2c';g.fillText(piece.title,w/2,138);
      g.strokeStyle='#b89b66';g.lineWidth=2;g.beginPath();g.moveTo(w/2-70,166);g.lineTo(w/2+70,166);g.stroke();
      g.font='28px Georgia, "Times New Roman", serif';g.fillStyle='#766750';wrapText(g,text(piece.description||''),w/2,212,w-120,36,2);
    });
    map.anisotropy=4;
    return new THREE.Mesh(new THREE.PlaneGeometry(width,width*300/1024),new THREE.MeshBasicMaterial({map,toneMapped:false}));
  }
  function marker(x,z,radius=.55) {
    const mesh=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.025,48),new THREE.MeshBasicMaterial({color:'#b89b66',transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.012,z);scene.add(mesh);return mesh;
  }
  // Seis vitrinas de madera oscura y cristal, cada una con su foco cálido.
  objects.forEach((piece,index)=>{
    const p=ringPoint(index,RING),group=new THREE.Group();group.position.set(p.x,0,p.z);group.lookAt(0,0,0);scene.add(group);
    const plinth=new THREE.Mesh(new THREE.BoxGeometry(.9,.95,.9),darkWood);plinth.position.y=.475;plinth.castShadow=plinth.receiveShadow=true;group.add(plinth);
    const band=new THREE.Mesh(new THREE.BoxGeometry(.93,.03,.93),goldTrim);band.position.y=.93;group.add(band);
    const base=new THREE.Mesh(new THREE.BoxGeometry(.98,.08,.98),darkWood);base.position.y=.04;group.add(base);
    const top=new THREE.Mesh(new THREE.BoxGeometry(.84,.02,.84),new THREE.MeshStandardMaterial({color:'#f3e8d6',roughness:.6}));top.position.y=.96;group.add(top);
    const case_=new THREE.Mesh(new THREE.BoxGeometry(.82,.72,.82),glass);case_.position.y=1.33;group.add(case_);
    for(const sx of [-.41,.41])for(const sz of [-.41,.41]){const edge=new THREE.Mesh(new THREE.BoxGeometry(.018,.72,.018),goldTrim);edge.position.set(sx,1.33,sz);group.add(edge);}
    const lid=new THREE.Mesh(new THREE.BoxGeometry(.86,.03,.86),goldTrim);lid.position.y=1.705;group.add(lid);
    const holder=buildObject(piece,.5);holder.position.y=.98;group.add(holder);
    const spot=new THREE.SpotLight('#ffdcaa',small?6:9,3.2,.55,.75,1.6);spot.position.set(0,2.6,.25);const aim=new THREE.Object3D();aim.position.set(0,1.1,0);group.add(spot,aim);spot.target=aim;
    const fixture=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,.1,16),goldTrim);fixture.position.set(0,WALL_H-.05,.25);group.add(fixture);
    const p2=plaque(piece,index);p2.position.set(0,.6,.456);p2.rotation.x=-.12;group.add(p2);
    const hit=new THREE.Mesh(new THREE.BoxGeometry(.9,.8,.9),new THREE.MeshBasicMaterial({visible:false}));hit.position.y=1.33;group.add(hit);
    const approach=ringPoint(index,2.45),focus=new THREE.Vector3(p.x,1.22,p.z);
    targets.push({id:piece.id,index,focus,approach,hits:[hit,p2],marker:marker(approach.x,approach.z),glow:[band.material===goldTrim?(band.material=goldTrim.clone()):band.material],lift:holder,rise:[0,.04,0],halo:[p.x*.97,1.25,p.z*.97,1.1],seen:[p.x,1.95,p.z],piece});
  });
  // Mesa central «Nuestra colección»: seis espacios que se llenan con miniaturas.
  {
    const tableTop=new THREE.Mesh(new THREE.CylinderGeometry(TABLE_R,TABLE_R,.07,64),darkWood);tableTop.position.y=.78;tableTop.castShadow=tableTop.receiveShadow=true;scene.add(tableTop);
    const apron=new THREE.Mesh(new THREE.CylinderGeometry(TABLE_R-.04,TABLE_R-.06,.12,64,1,true),darkWood);apron.position.y=.68;scene.add(apron);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(TABLE_R,.018,8,96),goldTrim);rim.rotation.x=Math.PI/2;rim.position.y=.815;scene.add(rim);
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,.62,24),darkWood);leg.position.y=.31;scene.add(leg);
    const foot=new THREE.Mesh(new THREE.CylinderGeometry(.5,.58,.06,40),darkWood);foot.position.y=.03;scene.add(foot);
    const inlay=new THREE.Mesh(new THREE.RingGeometry(.3,.32,48),new THREE.MeshBasicMaterial({color:'#c9a564'}));inlay.rotation.x=-Math.PI/2;inlay.position.y=.817;scene.add(inlay);
    const labelMap=texture(512,96,(g,w,h)=>{g.fillStyle='#c9a564';g.textAlign='center';g.font='500 30px "Segoe UI", Arial, sans-serif';g.letterSpacing='6px';g.fillText('NUESTRA COLECCIÓN',w/2,62);});
    const label=new THREE.Mesh(new THREE.PlaneGeometry(.66,.12),new THREE.MeshBasicMaterial({map:labelMap,transparent:true,toneMapped:false}));label.rotation.x=-Math.PI/2;label.position.set(0,.818,0);scene.add(label);
    const tableHit=new THREE.Mesh(new THREE.CylinderGeometry(TABLE_R+.05,TABLE_R+.05,.3,32),new THREE.MeshBasicMaterial({visible:false}));tableHit.position.y=.72;scene.add(tableHit);
    tableTarget={id:'table',focus:new THREE.Vector3(0,.8,0),approach:{x:0,z:2.35},hits:[tableHit,label],marker:null,glow:[],lift:label,rise:[0,0,0],halo:[0,.85,0,2.2]};
    targets.push(tableTarget);
    objects.forEach((piece,index)=>{
      const slot=ringPoint(index,.74);
      const ring=new THREE.Mesh(new THREE.RingGeometry(.15,.17,40),new THREE.MeshBasicMaterial({color:'#c9a564'}));ring.rotation.x=-Math.PI/2;ring.position.set(slot.x,.817,slot.z);scene.add(ring);
      const mini=buildObject(piece,.2);mini.position.set(slot.x,.815,slot.z);mini.lookAt(0,.815,0);mini.rotateY(Math.PI);mini.visible=false;scene.add(mini);
      const miniHit=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.24,16),new THREE.MeshBasicMaterial({visible:false}));miniHit.position.set(slot.x,.93,slot.z);scene.add(miniHit);
      const miniTarget={id:`mini-${piece.id}`,miniOf:index,focus:new THREE.Vector3(slot.x,.9,slot.z),approach:{x:slot.x*3.2,z:slot.z*3.2},hits:[miniHit],marker:null,glow:[],lift:mini,rise:[0,.03,0],halo:[slot.x,.95,slot.z,.5]};
      targets.push(miniTarget);miniatures.set(piece.id,{group:mini,target:miniTarget});
    });
  }
  // Tercera pista: una pequeña flor dorada en el costado de la mesa que mira hacia la derecha.
  {
    const flower=new THREE.Group(),gold=new THREE.MeshStandardMaterial({color:'#d9b46a',metalness:1,roughness:.25});
    for(let i=0;i<5;i++){const petal=new THREE.Mesh(new THREE.SphereGeometry(.018,10,8),gold);const a=i/5*Math.PI*2;petal.scale.set(1,1,.35);petal.position.set(Math.cos(a)*.02,Math.sin(a)*.02,0);flower.add(petal);}
    const middle=new THREE.Mesh(new THREE.SphereGeometry(.011,10,8),new THREE.MeshStandardMaterial({color:'#9b2f2a',roughness:.4}));middle.position.z=.006;flower.add(middle);
    flower.position.set(TABLE_R+.012,.66,0);flower.rotation.y=Math.PI/2;flower.scale.setScalar(2.6);scene.add(flower);
    const clueHit=new THREE.Mesh(new THREE.SphereGeometry(.3,12,8),new THREE.MeshBasicMaterial({visible:false}));clueHit.position.set(TABLE_R+.12,.66,0);scene.add(clueHit);
    clueTarget={id:'clue',focus:new THREE.Vector3(TABLE_R,.68,0),approach:{x:2.55,z:.0},hits:[clueHit],marker:null,glow:[gold],lift:flower,rise:[.02,0,0],halo:[TABLE_R+.04,.68,0,.45]};

    clueTarget.twinkle=new THREE.Sprite(new THREE.SpriteMaterial({map:dotMap,color:'#ffd98a',transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending}));
    clueTarget.twinkle.position.set(TABLE_R+.08,0.66,0);clueTarget.twinkle.scale.setScalar(0.55);scene.add(clueTarget.twinkle);
    targets.push(clueTarget);
  }
  // Puerta de regreso al vestíbulo: detrás de la cámara, por donde se entra (como en las salas 01 y 02).
  {
    const door=new THREE.Group();door.position.set(0,0,FRONT);door.rotation.y=Math.PI;scene.add(door);
    const W=1.4,H=2.45;
    const ring=(w,h,grow,inner)=>{const o=new THREE.Shape();o.moveTo(-w/2-grow,-.02);o.lineTo(w/2+grow,-.02);o.lineTo(w/2+grow,h+grow);o.lineTo(-w/2-grow,h+grow);o.lineTo(-w/2-grow,-.02);const i=new THREE.Path();i.moveTo(-w/2-inner,0);i.lineTo(-w/2-inner,h+inner);i.lineTo(w/2+inner,h+inner);i.lineTo(w/2+inner,0);i.lineTo(-w/2-inner,0);o.holes.push(i);return o;};
    const extrude=(shape,depth)=>new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:2,curveSegments:32});
    door.add(new THREE.Mesh(extrude(ring(W,H,.26,.12),.12),darkWood));door.add(new THREE.Mesh(extrude(ring(W,H,.12,0),.16),goldTrim));
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
    exitTarget={id:'exit',focus:new THREE.Vector3(0,1.45,FRONT+.05),approach:{x:0,z:FRONT-2.55},hits:[doorHit,...leaves.map(item=>item.leaf),plate,transom],marker:marker(0,FRONT-1,.55),glow:[leafMaterial],lift:plate,rise:[0,.04,0],halo:[0,1.5,FRONT-.2,2.6],leaves};
    targets.push(exitTarget);
  }
  pieceTargets.push(...targets.filter(target=>target.index!==undefined));
  const sparkle=texture(128,128,(g,w,h)=>{g.textAlign='center';g.textBaseline='middle';g.font='92px Georgia, "Segoe UI Symbol", serif';g.shadowColor='rgba(255,226,160,.9)';g.shadowBlur=18;g.fillStyle=g.strokeStyle='#c9a564';g.lineWidth=5;g.lineJoin='round';g.strokeText('✧',w/2,h/2+4);g.fillText('✧',w/2,h/2+4);});
  for(const target of targets){
    for(const material of target.glow){material.emissive=new THREE.Color('#c9a564');material.emissiveIntensity=0;}
    target.base=target.lift.position.clone();target.h=0;
    const [x,y,z,size]=target.halo;
    target.haloSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:dotMap,color:'#ffe2a8',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
    target.haloSprite.position.set(x,y,z);target.haloSprite.scale.setScalar(size);scene.add(target.haloSprite);
    if(Array.isArray(target.seen)){const star=new THREE.Sprite(new THREE.SpriteMaterial({map:sparkle,transparent:true,depthWrite:false,toneMapped:false}));star.position.set(...target.seen);star.scale.setScalar(.24);star.visible=false;scene.add(star);target.seen=star;}
  }
  ping=new THREE.Mesh(new THREE.RingGeometry(.18,.24,40),new THREE.MeshBasicMaterial({color:'#b89b66',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));ping.rotation.x=-Math.PI/2;ping.position.y=.012;ping.userData.t=1;scene.add(ping);
  const COUNT=small?110:200,dust=new Float32Array(COUNT*3),speeds=new Float32Array(COUNT);
  for(let i=0;i<COUNT;i++){const r=Math.sqrt(rand())*5.5,a=rand()*Math.PI*2;dust.set([Math.cos(a)*r,rand()*WALL_H,Math.sin(a)*r],i*3);speeds[i]=.04+rand()*.08;}
  const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(dust,3));
  const motes=new THREE.Points(dustGeometry,new THREE.PointsMaterial({map:dotMap,size:.03,transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending,color:'#ffe8bf'}));
  motes.frustumCulled=false;scene.add(motes);let lastDust=performance.now();
  motes.onBeforeRender=()=>{const now=performance.now(),dt=Math.min((now-lastDust)/1000,.05);lastDust=now;if(reducedMotion.matches)return;const p=dustGeometry.attributes.position;for(let i=0;i<COUNT;i++){let y=p.getY(i)+speeds[i]*dt;if(y>WALL_H)y=0;p.setY(i,y);}p.needsUpdate=true;};
  firstFrame=new Promise(resolve=>$('#little-stage').addEventListener('gallery:ready',resolve,{once:true}));
  engine=createGallery({container:$('#little-stage'),scene,camera,obstacles,targets,floor,bounds:BOUNDS,onTarget:setTarget,onActivate:target=>openTarget(target),onUnavailable:fallbackMode,onTap,onSwipe,onHover:target=>{hoverTarget=target;},onBack:()=>{if(inspecting)closeInspection();else if(focused)stepBack();},onFrame:animate});
  engine.renderer.toneMappingExposure=.9;
  const pmrem=new THREE.PMREMGenerator(engine.renderer),environment=new RoomEnvironment();
  scene.environment=pmrem.fromScene(environment,.04).texture;scene.environmentIntensity=.6;environment.dispose();pmrem.dispose();
  engine.setActive(true);
  setTarget(null);updateProgress();
}

async function enterRoom() {
  const cover=()=>{
    Museum.showView(ROOM_ID);
    if(!initialized){initialized=true;try{buildRoom();}catch(error){console.warn('Sala 03 sin 3D:',error);fallbackMode();}}
    engine?.setActive(true);updateProgress();
  };
  const opened=await Museum.playDoors({lines:['Abriendo las vitrinas…','Encendiendo las luces…','Las pequeñas cosas te esperan.'],cover,ready:()=>fallback?null:firstFrame,minimum:1500,variant:'room-03',plate:'03',label:'SALA 03 · PEQUEÑAS COSAS',title:room.title});
  if(!opened)cover();
  $('#little-title').setAttribute('tabindex','-1');$('#little-title').focus({preventScroll:true});
  if(!Museum.tutorialSeen('room'))Museum.openTutorial('room',$('#little-help'));
}
function buzz(pattern){try{if(matchMedia('(pointer: coarse)').matches)navigator.vibrate?.(pattern);}catch{/* Sin vibración. */}}
function resume(){if(!$('#museum-dialog').open)engine?.setPaused(false);}
function guideTo(index,source=null) {
  currentPiece=index;
  if(fallback||!engine){openInspection(index,source||undefined);return;}
  goTo(pieceTargets[index],{source});
}
function rememberPose() {
  if(!engine||returnPose)return;
  const position=engine.camera.position,direction=engine.camera.getWorldDirection(new THREE.Vector3());
  returnPose={x:position.x,z:position.z,focus:new THREE.Vector3(position.x+direction.x*4,1.65+direction.y*4,position.z+direction.z*4)};
}
function goTo(target,{open=true,source=null}={}) {
  closeNote(false);resume();
  if(target.index!==undefined){currentPiece=target.index;rememberPose();}
  if(focused===target&&!engine.isFlying()){if(open)openTarget(target,source||undefined);return;}
  const previous=$('#little-target-name').textContent;
  $('#little-target-name').textContent=`Hacia: ${nameOf(target)}`;
  flyingTo=target;focused=null;syncExamine();
  const ok=engine.guideTo(target,{onArrive:()=>{flyingTo=null;focused=target;syncExamine();if(open)openTarget(target,source||undefined);}});
  if(ok)return;
  flyingTo=null;$('#little-target-name').textContent=previous;syncExamine();
  if(open&&engine.camera.position.distanceTo(target.focus)<5)openTarget(target,source||undefined);
  else Museum.notify('Puedes acercarte al objeto caminando por la sala.');
}
function stepBack() {
  closeNote(false);
  if(!engine)return;
  resume();focused=null;flyingTo=null;returnPose=null;
  engine.guideTo({id:'overview',focus:new THREE.Vector3(0,1.2,0),approach:{x:0,z:4.8},hits:[],marker:null},{select:false});
}
function walkTo(point) {
  closeNote(false);
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
  if(inspecting)return;
  // Una miniatura todavía vacía cuenta como un toque sobre la mesa.
  if(target?.miniOf!==undefined&&!miniatures.get(objects[target.miniOf].id).group.visible)target=tableTarget;
  if(target)goTo(target);
  else if(point)walkTo(point);
  else if(focused)stepBack();
}
function onSwipe(direction,restoreView) {
  if(inspecting||!focused||focused.index===undefined)return;
  restoreView();
  if(direction==='down'){stepBack();return;}
  const count=pieceTargets.length;goTo(pieceTargets[(focused.index+(direction==='left'?1:count-1))%count]);
}
function animate(dt) {
  if(clueTarget?.twinkle){const found=Museum.getProgress().clues.includes(room.clue.id),t=performance.now()/1000;clueTarget.twinkle.material.opacity=found?.12:(reducedMotion.matches?.45:.3+.25*Math.sin(t*2.2));}
  lastFrameTime=dt;
  if(exitTarget){exitOpen+=((exitOpening?1:0)-exitOpen)*(reducedMotion.matches?1:Math.min(1,dt*4));for(const {hinge,side} of exitTarget.leaves)hinge.rotation.y=side*exitOpen*1.75;}
  const ease=reducedMotion.matches?1:Math.min(1,dt*8);
  for(const target of targets){
    const goal=!inspecting&&(hoverTarget===target||flyingTo===target)?1:0;
    target.h+=(goal-target.h)*ease;
    const h=target.h,[rx,ry,rz]=target.rise;
    target.lift.position.set(target.base.x+rx*h,target.base.y+ry*h,target.base.z+rz*h);
    for(const material of target.glow)material.emissiveIntensity=h*.32;
    target.haloSprite.material.opacity=h*.28;
    if(target.marker)target.marker.material.opacity=Math.max(engine.getSelected()===target?.9:.16,.16+h*.74);
  }
  if(ping&&ping.userData.t<1){ping.userData.t=Math.min(1,ping.userData.t+dt*1.4);const t=ping.userData.t;ping.scale.setScalar(1+t*2.2);ping.material.opacity=(1-t)*.8;}
  if(focused&&!inspecting&&!engine.isFlying()&&Math.hypot(engine.camera.position.x-focused.approach.x,engine.camera.position.z-focused.approach.z)>.6){focused=null;returnPose=null;}
}

/* ===== Notas laterales e inspección del objeto ===== */
let noteSource=null,noteClosing=null;
function closeNote(restoreFocus=true) {
  const note=$('#little-note');if(note.hidden)return;
  const done=noteClosing;noteClosing=null;done?.();
  note.hidden=true;note.classList.remove('inspecting');$('#little-note-content').replaceChildren();
  if(restoreFocus)(noteSource?.isConnected&&!noteSource.closest('[hidden]')?noteSource:$('#little-stage')).focus({preventScroll:true});
  noteSource=null;syncExamine();
}
function showNote({eyebrow,title,body,source=$('#little-stage'),onClose=null,inspect=false}) {
  closeNote(false);noteSource=source;noteClosing=onClose;
  $('#little-note-content').innerHTML=`${inspect?'':`<p class="eyebrow">${escape(eyebrow)}</p><h2 id="little-note-title" tabindex="-1">${escape(title)}</h2>`}${body}`;
  $('#little-note').classList.toggle('inspecting',inspect);
  $('#little-note').hidden=false;$('#little-note-title').focus({preventScroll:true});
}
$('#close-little-note').addEventListener('click',()=>{if(inspecting)closeInspection();else closeNote();});
$('#little-note').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(inspecting)closeInspection();else closeNote();return;}
  if(event.key!=='Tab'||!inspecting)return;
  const items=[...$('#little-note').querySelectorAll('button:not([hidden]),[tabindex="0"],a[href]')].filter(item=>item.offsetParent!==null);
  if(!items.length)return;
  const first=items[0],last=items.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
{
  let start=null;const note=$('#little-note');
  note.addEventListener('touchstart',event=>{start=inspecting&&event.touches.length===1&&!event.target.closest('.inspect-canvas,button,a,audio')?{y:event.touches[0].clientY,x:event.touches[0].clientX,time:performance.now(),scroll:event.target.closest('.inspect-band')?.scrollTop||0}:null;},{passive:true});
  note.addEventListener('touchend',event=>{if(!start)return;const t=event.changedTouches[0],dy=t.clientY-start.y,dx=t.clientX-start.x,quick=performance.now()-start.time<600,atTop=start.scroll<=0;start=null;if(quick&&atTop&&dy>80&&dy>Math.abs(dx)*1.4)closeInspection();},{passive:true});
}

// Visor del objeto: su propio lienzo, de modo que girar el objeto nunca mueve la cámara del museo.
const viewer={renderer:null,scene:null,camera:null,holder:null,raf:0,yaw:.5,pitch:-.25,distance:1.55,running:false};
const VIEW={yaw:.5,pitch:-.3,distance:1.1,min:.75,max:1.8};
function ensureViewer() {
  if(viewer.renderer)return viewer;
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.05,20);
  const pmrem=new THREE.PMREMGenerator(renderer),environment=new RoomEnvironment();scene.environment=pmrem.fromScene(environment,.04).texture;scene.environmentIntensity=.75;environment.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#fff3dc','#6b4a32',.8));
  const key=new THREE.DirectionalLight('#ffe2b8',1.6);key.position.set(1.5,2,1.8);scene.add(key);
  const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.42,.46,.06,48),new THREE.MeshStandardMaterial({color:'#3a2416',roughness:.45}));pedestal.position.y=-.03;scene.add(pedestal);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.43,.012,8,64),new THREE.MeshStandardMaterial({color:'#c9a564',metalness:1,roughness:.28}));rim.rotation.x=Math.PI/2;scene.add(rim);
  Object.assign(viewer,{renderer,scene,camera});
  return viewer;
}
function renderViewer() {
  if(!viewer.running)return;
  viewer.raf=requestAnimationFrame(renderViewer);
  const canvas=viewer.renderer.domElement,w=canvas.clientWidth,h=canvas.clientHeight;
  if(w&&h&&(canvas.width!==Math.round(w*viewer.renderer.getPixelRatio())||canvas.height!==Math.round(h*viewer.renderer.getPixelRatio()))){viewer.renderer.setSize(w,h,false);viewer.camera.aspect=w/h;viewer.camera.updateProjectionMatrix();}
  const c=Math.cos(viewer.pitch);
  viewer.camera.position.set(Math.sin(viewer.yaw)*c*viewer.distance,.24-Math.sin(viewer.pitch)*viewer.distance,Math.cos(viewer.yaw)*c*viewer.distance);
  viewer.camera.lookAt(0,.22,0);
  viewer.renderer.render(viewer.scene,viewer.camera);
}
function resetView(){viewer.yaw=VIEW.yaw;viewer.pitch=VIEW.pitch;viewer.distance=VIEW.distance;}
function rotateView(dy=0,dp=0,dz=0){viewer.yaw+=dy;viewer.pitch=THREE.MathUtils.clamp(viewer.pitch+dp,-.85,.35);viewer.distance=THREE.MathUtils.clamp(viewer.distance+dz,VIEW.min,VIEW.max);}
function mountViewer(piece,container) {
  const v=ensureViewer();
  if(v.holder){v.scene.remove(v.holder);v.holder.traverse(node=>{node.geometry?.dispose?.();});}
  v.holder=buildObject(piece,.55);v.scene.add(v.holder);resetView();
  const canvas=v.renderer.domElement;canvas.className='inspect-canvas';canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Modelo 3D de ${piece.title}. Usa las flechas para girarlo, + o − para acercarlo y 0 para restablecer la vista.`);
  container.prepend(canvas);
  let drag=null;const pointers=new Map();let pinch=null;
  canvas.onpointerdown=event=>{event.stopPropagation();try{canvas.setPointerCapture(event.pointerId);}catch{/* Puntero ya liberado. */}pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);}else drag={x:event.clientX,y:event.clientY,moved:0};hideHint();};
  canvas.onpointermove=event=>{event.stopPropagation();if(!pointers.has(event.pointerId))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===2&&pinch){const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);rotateView(0,0,(pinch-d)*.006);pinch=d;return;}
    if(drag){rotateView((event.clientX-drag.x)*-.012,(event.clientY-drag.y)*.008);drag.moved+=Math.abs(event.clientX-drag.x)+Math.abs(event.clientY-drag.y);drag.x=event.clientX;drag.y=event.clientY;}};
  let lastTap=0;
  canvas.onpointerup=canvas.onpointercancel=event=>{event.stopPropagation();
    // Doble toque o doble clic sin arrastrar: vuelve a la vista inicial.
    if(event.type==='pointerup'&&drag&&drag.moved<10&&pointers.size===1){const now=performance.now();if(now-lastTap<320){resetView();lastTap=0;}else lastTap=now;}
    pointers.delete(event.pointerId);if(pointers.size<2)pinch=null;if(!pointers.size)drag=null;};
  canvas.onwheel=event=>{event.preventDefault();hideHint();rotateView(0,0,Math.sign(event.deltaY)*.12);};
  canvas.onkeydown=event=>{const k=event.key;const map={ArrowLeft:[.3,0,0],ArrowRight:[-.3,0,0],ArrowUp:[0,-.2,0],ArrowDown:[0,.2,0],'+':[0,0,-.15],'=':[0,0,-.15],'-':[0,0,.15]};if(k==='0'||k==='r'||k==='R'){event.preventDefault();event.stopPropagation();resetView();return;}if(map[k]){event.preventDefault();event.stopPropagation();rotateView(...map[k]);}};
  v.running=true;cancelAnimationFrame(v.raf);v.raf=requestAnimationFrame(renderViewer);
}
// Pista breve de los gestos: aparece y se desvanece sola.
function hideHint(){const hint=$('#little-note .inspect-hint');if(hint)hint.classList.add('gone');}
function unmountViewer() {
  if(!viewer.renderer)return;
  viewer.running=false;cancelAnimationFrame(viewer.raf);viewer.renderer.domElement.remove();
}

function discover(piece) {
  const progress=Museum.discoverPiece(ROOM_ID,piece.id);
  buzz(progress.newlyCompleted?[30,60,45]:14);
  updateProgress();
  if(progress.newlyCompleted)celebrate();
  return progress;
}
// Examinar un recuerdo: el objeto ampliado y girable, su texto y la foto o el audio opcionales.
function openInspection(index,source=$('#little-stage')) {
  const piece=objects[index];currentPiece=index;
  discover(piece);
  inspecting=piece;engine?.setLocked(true);syncExamine();
  const photo=piece.photo&&piece.object!=='photo'?`<figure class="inspect-photo"><img src="${escape(piece.photo)}" alt="${escape(piece.photoAlt||piece.title)}" loading="lazy" decoding="async"></figure>`:'';
  const audio=piece.audio?`<div class="optional-audio inspect-audio"><button id="little-play-audio" class="button secondary" type="button">▶ ${escape(text(piece.audioLabel||'Escuchar este recuerdo'))}</button><p id="little-audio-status" role="status"></p></div>`:'';
  showNote({source,inspect:true,onClose:()=>{unmountViewer();},body:`
    <div class="inspect-view"><div class="inspect-stage" id="little-inspect-stage">${fallback?'<p class="inspect-fallback" aria-hidden="true">✧</p>':''}</div>
    ${fallback?'':`<p class="inspect-hint" aria-hidden="true">${matchMedia('(pointer: coarse)').matches?'Arrastra para girar · pellizca para acercar · toca dos veces para restablecer':'Arrastra para girar · usa la rueda para acercar · doble clic para restablecer'}</p><div class="inspect-sr-controls" role="group" aria-label="Girar el objeto">
      <button type="button" class="sr-only-focusable" data-view="left" aria-label="Girar a la izquierda">↺</button><button type="button" class="sr-only-focusable" data-view="up" aria-label="Inclinar hacia arriba">↑</button><button type="button" class="sr-only-focusable" data-view="down" aria-label="Inclinar hacia abajo">↓</button><button type="button" class="sr-only-focusable" data-view="right" aria-label="Girar a la derecha">↻</button><button type="button" class="sr-only-focusable" data-view="in" aria-label="Acercar">+</button><button type="button" class="sr-only-focusable" data-view="out" aria-label="Alejar">−</button>
      <button type="button" data-view="reset" class="sr-only-focusable">Restablecer vista</button></div>`}</div>
    <div class="inspect-band"><span class="inspect-grip" aria-hidden="true"></span><p class="eyebrow">OBJETO ${String(index+1).padStart(2,'0')}${piece.date?` · ${escape(piece.date)}`:''}</p>
    <h2 id="little-note-title" tabindex="-1">${escape(piece.title)}</h2>
    <p class="room-note-dedication">${escape(text(piece.description||''))}</p>
    ${piece.message?`<p class="room-note-description inspect-message">${escape(text(piece.message))}</p>`:''}
    ${photo}${audio}</div>`});
  if(!fallback){mountViewer(piece,$('#little-inspect-stage'));setTimeout(hideHint,reducedMotion.matches?6000:3800);}
  $('#little-note').querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
    const action=button.dataset.view;
    if(action==='reset')resetView();else rotateView(...{left:[-.4,0,0],right:[.4,0,0],up:[0,.2,0],down:[0,-.2,0],in:[0,0,-.2],out:[0,0,.2]}[action]);
  }));
  Museum.bindAudioButton($('#little-play-audio'),{src:piece.audio,title:piece.title,label:`▶ ${text(piece.audioLabel||'Escuchar')}`,status:$('#little-audio-status')});
}
// Al cerrar, el visitante vuelve a donde estaba antes de examinar.
function closeInspection() {
  if(!inspecting)return;
  inspecting=null;closeNote();engine?.setLocked(false);
  const pose=returnPose;returnPose=null;focused=null;
  if(engine&&pose){resume();engine.guideTo({id:'return',focus:pose.focus,approach:{x:pose.x,z:pose.z},hits:[],marker:null},{select:false});}
  syncExamine();
}
function openClue(source=$('#little-stage')) {
  const added=Museum.findClue(room.clue.id);buzz(14);
  showNote({eyebrow:added?'PISTA ENCONTRADA':'UNA PISTA YA ENCONTRADA',title:'Una flor diminuta',source,body:`<p class="room-note-description">Una pequeña flor dorada, grabada en el costado de la mesa central.</p><p class="room-note-dedication">${escape(room.clue.message)}</p><p class="room-note-reward" role="status">Pistas encontradas: ${Museum.getProgress().clues.length} de ${config.clueIds.length}</p>`});
  updateProgress();
}
function showCollection(source) {
  const found=Museum.getProgress().discoveries[ROOM_ID]||[];
  showNote({eyebrow:'MESA CENTRAL',title:'Nuestra colección',source,body:`<p class="room-note-description">Cada objeto que examinas deja aquí su miniatura. Toca una para volver a su recuerdo.</p><div class="collection-list">${objects.map((piece,index)=>`<button type="button" class="collection-item${found.includes(piece.id)?' found':''}" data-collection="${index}" ${found.includes(piece.id)?'':'disabled'}><span>${found.includes(piece.id)?'✧':String(index+1).padStart(2,'0')}</span>${escape(found.includes(piece.id)?piece.title:'Por descubrir')}</button>`).join('')}</div>`});
  $('#little-note').querySelectorAll('[data-collection]').forEach(button=>button.addEventListener('click',()=>{rememberPose();openInspection(Number(button.dataset.collection),button);}));
}
function celebrate() {
  const old=$('#little-screen .moments-stamp');old?.remove();
  const stamp=document.createElement('div');stamp.className='moments-stamp';stamp.setAttribute('role','status');
  stamp.innerHTML=`<div class="stamp-page" aria-hidden="true"><div class="new-stamp"><span>SALA 03</span><b>✧</b><span>PEQUEÑAS COSAS</span></div></div><p>${escape(room.completionMessage)}</p><button class="text-button" type="button">Seguir explorando</button>`;
  $('#little-screen').append(stamp);
  const close=()=>stamp.remove();
  stamp.querySelector('button').addEventListener('click',close);
  setTimeout(close,reducedMotion.matches?9000:7000);
}
function openExit() {
  closeNote(false);
  if(exitOpening)return;
  exitOpening=true;
  setTimeout(async()=>{await Museum.returnToLobby();exitOpening=false;exitOpen=0;},reducedMotion.matches?0:750);
}
function openTarget(target=selected,source){
  if(!target)return;
  if(target.id==='exit')openExit();
  else if(target.id==='clue')openClue(source);
  else if(target.id==='table')showCollection(source);
  else if(target.miniOf!==undefined){rememberPose();openInspection(target.miniOf,source);}
  else openInspection(target.index,source);
}
function openHelp(source) {
  const panel=$('#little-help-panel');
  Museum.openContent({className:'room-help-sheet',source,html:'<div class="dialog-heading"><p class="eyebrow">SALA 03 · AYUDA</p><h2 id="dialog-title">Tu recorrido</h2></div><button class="button primary help-tutorial" type="button">Ver cómo moverse</button>',onClose:()=>{panel.hidden=true;$('#little-screen').append(panel);}});
  $('#dialog-content').append(panel);panel.hidden=false;
  $('#dialog-content .help-tutorial').addEventListener('click',()=>Museum.openTutorial('room',source));
}

Museum.registerRoom(ROOM_ID,enterRoom);
$('#little-examine').addEventListener('click',event=>{if(selected)goTo(selected,{source:event.currentTarget});});
const step=offset=>guideTo(((focused&&focused.index!==undefined?focused.index:currentPiece)+offset+objects.length)%objects.length);
$('#little-prev').addEventListener('click',()=>step(-1));
$('#little-next').addEventListener('click',()=>step(1));
$('#little-exit-door').addEventListener('click',event=>{if(fallback||!engine||!exitTarget){Museum.returnToLobby();return;}goTo(exitTarget,{source:event.currentTarget});});
$('#little-stage').addEventListener('keydown',event=>{
  if(event.target.closest('button')||inspecting)return;
  const offset=event.key==='<'||event.key===','?-1:event.key==='>'||event.key==='.'?1:0;
  if(!offset)return;event.preventDefault();step(offset);
});
document.querySelectorAll('[data-little-tour]').forEach(button=>button.addEventListener('click',()=>{Museum.closeOverlay();setTimeout(()=>guideTo(Number(button.dataset.littleTour)),0);}));
$('#little-help').addEventListener('click',event=>openHelp(event.currentTarget));
$('#little-back').addEventListener('click',()=>{if(inspecting)closeInspection();Museum.returnToLobby();});
$('#little-passport').addEventListener('click',event=>Museum.openPassport(event.currentTarget));
$('#little-clue-hint').addEventListener('click',()=>Museum.notify(room.clue.hint));
$('#little-accessible-clue').addEventListener('click',event=>openClue(event.currentTarget));
document.addEventListener('museum:progress',updateProgress);
document.addEventListener('museum:overlay',event=>{if(event.detail){if(inspecting){inspecting=null;returnPose=null;engine?.setLocked(false);}closeNote(false);}engine?.setPaused(event.detail);});
// Al salir: se detiene el dibujo, el visor y cualquier audio.
document.addEventListener('museum:screen',event=>{
  const here=event.detail===ROOM_ID;
  if(!here){if(inspecting){inspecting=null;returnPose=null;engine?.setLocked(false);}closeNote(false);$('#little-screen .moments-stamp')?.remove();}
  engine?.setActive(here);syncExamine();
});
updateProgress();
