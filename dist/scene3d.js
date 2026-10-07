/* Vestíbulo en 3D: una rotonda con seis puertas-portal, un corazón de oro
   bajo un óculo de luz y polvo flotando. Si WebGL no está disponible,
   el dibujo ilustrado del vestíbulo se queda como está. */
import * as THREE from './vendor/three.module.min.js';
import { Reflector } from './vendor/Reflector.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const config = window.MUSEUM_CONFIG;
const Museum = window.Museum;
const sceneBox = document.querySelector('.museum-scene');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function announce(available) {
  window.MuseumScene = { ready: true, available };
  document.dispatchEvent(new CustomEvent('museum:scene-ready', { detail: { available } }));
}

function supportsWebGL() {
  try { const canvas = document.createElement('canvas'); return !!(canvas.getContext('webgl2') || canvas.getContext('webgl')); } catch { return false; }
}

if (config && Museum && sceneBox && supportsWebGL()) {
  try { build(); } catch (error) { console.warn('Vestíbulo 3D no disponible:', error); sceneBox.classList.remove('is-3d'); announce(false); }
} else announce(false);

function build() {
  const R = 9, WALL = 6.4, ARCH_W = 1.7, ARCH_H = 2.2;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'scene-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  sceneBox.prepend(canvas);
  sceneBox.classList.add('is-3d');


  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#efe6d6');
  scene.fog = new THREE.Fog('#efe6d6', 12, 26);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60);
  const clock = new THREE.Clock();
  const uniforms = { uTime: { value: 0 } };

  /* Luz */
  scene.add(new THREE.HemisphereLight('#fff4de', '#9c8466', 0.6));
  const sun = new THREE.SpotLight('#ffe6b8', 90, 16, 0.42, 0.65, 1.6);
  sun.position.set(0, WALL + R * 0.55, 0);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);
  const doorLight = new THREE.PointLight('#ffd49a', 22, 14, 1.7);
  doorLight.position.set(0, 3.2, -4.5);
  scene.add(doorLight);
  const keyLight = new THREE.PointLight('#ffe2b0', 9, 9, 1.5);
  keyLight.position.set(0.8, 2.8, 3.4);
  scene.add(keyLight);

  /* Texturas pintadas en canvas: nada se descarga de internet. */
  function canvasTexture(width, height, paint) {
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    paint(c.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
  }
  const rand = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(7);

  const floorTexture = canvasTexture(2048, 2048, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#eadfca'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(150,128,98,${0.05 + rand() * 0.08})`;
      g.lineWidth = 1 + rand() * 3;
      g.beginPath();
      let x = rand() * w, y = rand() * w; g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (rand() - 0.5) * 500; y += (rand() - 0.5) * 500; g.quadraticCurveTo(x + (rand() - 0.5) * 300, y + (rand() - 0.5) * 300, x, y); }
      g.stroke();
    }
    for (const [r, width, color] of [[980, 18, '#b59a6c'], [930, 4, '#c8b085'], [620, 10, '#b59a6c'], [600, 3, '#c8b085'], [250, 6, '#a88b5c']]) {
      g.strokeStyle = color; g.lineWidth = width; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke();
    }
    g.save(); g.translate(c, c);
    for (let i = 0; i < 12; i++) {
      g.rotate(Math.PI / 6);
      g.fillStyle = i % 2 ? 'rgba(160,128,84,.55)' : 'rgba(120,94,62,.45)';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(46, 140); g.lineTo(0, 600); g.lineTo(-46, 140); g.closePath(); g.fill();
    }
    g.restore();
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      g.fillStyle = 'rgba(168,139,92,.55)';
      g.beginPath(); g.arc(c + Math.cos(a) * 955, c + Math.sin(a) * 955, 9, 0, Math.PI * 2); g.fill();
    }
  });

  function labelTexture(number, title, state) {
    return canvasTexture(1024, 300, (g, w, h) => {
      g.textAlign = 'center';
      g.fillStyle = state === 'locked' ? '#8d7a5c' : '#9a7b45';
      g.font = '500 44px "Segoe UI", Arial, sans-serif';
      g.letterSpacing = '14px';
      g.fillText(`SALA ${number}${state === 'done' ? '  ✧' : ''}`, w / 2, 70);
      g.letterSpacing = '0px';
      g.fillStyle = '#4a3c2c';
      g.font = 'italic 82px Georgia, "Times New Roman", serif';
      let size = 82;
      while (g.measureText(title).width > w - 40 && size > 40) { size -= 4; g.font = `italic ${size}px Georgia, "Times New Roman", serif`; }
      g.fillText(title, w / 2, 190);
      g.strokeStyle = '#b89b66'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(w / 2 - 90, 245); g.lineTo(w / 2 + 90, 245); g.stroke();
    });
  }

  function dotTexture() {
    return canvasTexture(64, 64, (g) => {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,248,225,1)'); grad.addColorStop(0.35, 'rgba(255,232,180,.55)'); grad.addColorStop(1, 'rgba(255,230,170,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    });
  }

  /* Suelo: espejo pulido bajo un mármol con rosa de los vientos. */
  const mirror = new Reflector(new THREE.CircleGeometry(R, 96), {
    textureWidth: 1024, textureHeight: 1024, color: 0x8a8378, clipBias: 0.003
  });
  mirror.rotation.x = -Math.PI / 2;
  scene.add(mirror);
  const marble = new THREE.Mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshStandardMaterial({
    map: floorTexture, transparent: true, opacity: 0.8, roughness: 0.35, metalness: 0
  }));
  marble.rotation.x = -Math.PI / 2;
  marble.position.y = 0.004;
  marble.receiveShadow = true;
  scene.add(marble);

  /* Muros, zócalo, cornisa y cúpula. */
  const stone = new THREE.MeshStandardMaterial({ color: '#efe5d2', roughness: 0.9 });
  const stoneDark = new THREE.MeshStandardMaterial({ color: '#d8c6a6', roughness: 0.8 });
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a564', metalness: 1, roughness: 0.28 });
  const walls = new THREE.Mesh(new THREE.CylinderGeometry(R, R, WALL, 128, 1, true), new THREE.MeshStandardMaterial({ color: '#f1e8d6', roughness: 0.95, side: THREE.BackSide }));
  walls.position.y = WALL / 2;
  walls.receiveShadow = true;
  scene.add(walls);
  const skirting = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.03, R - 0.03, 0.9, 128, 1, true), new THREE.MeshStandardMaterial({ color: '#d9c7a7', roughness: 0.75, side: THREE.BackSide }));
  skirting.position.y = 0.45;
  scene.add(skirting);
  for (const [y, tube] of [[WALL, 0.16], [WALL - 0.32, 0.05], [0.92, 0.035]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R - 0.08, tube, 12, 160), y > 1 ? stoneDark : gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    scene.add(ring);
  }
  const domeTexture = canvasTexture(1024, 512, (g, w, h) => {
    g.fillStyle = '#ece1cc'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,135,95,.45)'; g.lineWidth = 3;
    for (let i = 0; i <= 24; i++) { const x = (i / 24) * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (const y of [0.18, 0.38, 0.58, 0.78]) { g.beginPath(); g.moveTo(0, y * h); g.lineTo(w, y * h); g.stroke(); }
    g.fillStyle = 'rgba(190,160,110,.35)';
    for (let i = 0; i < 24; i++) for (const y of [0.28, 0.48, 0.68]) { g.beginPath(); g.arc((i + 0.5) / 24 * w, y * h, 6, 0, Math.PI * 2); g.fill(); }
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 32, 0, Math.PI * 2, 0.11, Math.PI / 2 - 0.11), new THREE.MeshStandardMaterial({ map: domeTexture, roughness: 0.95, side: THREE.BackSide }));
  dome.scale.y = 0.55;
  dome.position.y = WALL;
  scene.add(dome);
  const oculusY = WALL + R * 0.55 * Math.cos(0.11);
  const oculus = new THREE.Mesh(new THREE.CircleGeometry(R * Math.sin(0.11) + 0.05, 48), new THREE.MeshBasicMaterial({ color: '#fff8e8', toneMapped: false }));
  oculus.rotation.x = Math.PI / 2;
  oculus.position.y = oculusY;
  scene.add(oculus);

  /* Haz de luz que baja del óculo. */
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(R * Math.sin(0.11), 2.4, oculusY, 64, 1, true), new THREE.ShaderMaterial({
    uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying float vFacing;
      void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vec3 n=normalize(normalMatrix*normal);
      vFacing=abs(dot(n,normalize(-mv.xyz))); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying float vFacing;
      void main(){ float rays=.65+.35*sin(vUv.x*62.+uTime*.35)*sin(vUv.x*23.-uTime*.21);
      float a=pow(vFacing,2.2)*smoothstep(0.,.55,vUv.y)*.11*rays;
      gl_FragColor=vec4(vec3(1.,.93,.78)*a,a); }`
  }));
  shaft.position.y = oculusY / 2;
  scene.add(shaft);

  /* Pedestal y corazón de oro. */
  const pedestal = new THREE.Group();
  const marbleMat = new THREE.MeshStandardMaterial({ color: '#f3ece0', roughness: 0.3 });
  for (const [r1, r2, h, y] of [[0.78, 0.86, 0.14, 0.07], [0.48, 0.56, 0.72, 0.5], [0.64, 0.58, 0.1, 0.91]]) {
    const part = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 64), marbleMat);
    part.position.y = y; part.castShadow = part.receiveShadow = true;
    pedestal.add(part);
  }
  const goldRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.022, 10, 96), gold);
  goldRing.rotation.x = Math.PI / 2; goldRing.position.y = 0.96;
  pedestal.add(goldRing);
  scene.add(pedestal);

  const heartShape = new THREE.Shape();
  heartShape.moveTo(5, 5);
  heartShape.bezierCurveTo(5, 5, 4, 0, 0, 0);
  heartShape.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  heartShape.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  heartShape.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  heartShape.bezierCurveTo(16, 7, 16, 0, 10, 0);
  heartShape.bezierCurveTo(7, 0, 5, 5, 5, 5);
  const heartGeometry = new THREE.ExtrudeGeometry(heartShape, { depth: 3.4, bevelEnabled: true, bevelSegments: 10, steps: 1, bevelSize: 1.6, bevelThickness: 1.8, curveSegments: 40 });
  heartGeometry.center();
  heartGeometry.rotateZ(Math.PI);
  heartGeometry.scale(0.031, 0.031, 0.031);
  const heart = new THREE.Mesh(heartGeometry, new THREE.MeshPhysicalMaterial({
    color: '#e2b86b', metalness: 1, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 2.4, emissive: '#6a4514', emissiveIntensity: 0.25
  }));
  heart.material.envMap = scene.environment;
  heart.castShadow = true;
  heart.position.y = 1.7;
  scene.add(heart);
  /* Zona de toque generosa alrededor del corazón, que gira y flota. */
  const heartHit = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), new THREE.MeshBasicMaterial({ visible: false }));
  heartHit.position.y = 1.7;
  heartHit.userData.kind = 'heart';
  scene.add(heartHit);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: '#ffe2a8', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(2.6);
  halo.position.y = 1.7;
  scene.add(halo);

  /* Seis puertas-portal en el arco del fondo; cada una anuncia su sala. */
  function archShape(width, straight, grow = 0) {
    const w = width / 2 + grow, shape = new THREE.Shape();
    shape.moveTo(-w, -grow);
    shape.lineTo(w, -grow);
    shape.lineTo(w, straight);
    shape.absarc(0, straight, w, 0, Math.PI, false);
    shape.lineTo(-w, -grow);
    return shape;
  }
  function rectShape(width, height, grow = 0, bottom = 0) {
    const w = width / 2 + grow, shape = new THREE.Shape();
    shape.moveTo(-w, bottom - grow); shape.lineTo(w, bottom - grow); shape.lineTo(w, height + grow); shape.lineTo(-w, height + grow); shape.lineTo(-w, bottom - grow);
    return shape;
  }
  function ovalShape(rx, ry, cy, grow = 0) {
    const shape = new THREE.Shape();
    shape.absellipse(0, cy, rx + grow, ry + grow, 0, Math.PI * 2, false, 0);
    return shape;
  }
  // Arco ojival: dos arcos que se encuentran en punta.
  function pointedShape(width, straight, grow = 0) {
    const w = width / 2 + grow, r = 2 * w, shape = new THREE.Shape();
    const apex = straight + Math.sqrt(r * r - w * w);
    shape.moveTo(-w, -grow); shape.lineTo(w, -grow); shape.lineTo(w, straight);
    shape.absarc(-w, straight, r, 0, Math.atan2(apex - straight, w), false);
    shape.absarc(w, straight, r, Math.PI - Math.atan2(apex - straight, w), Math.PI, false);
    shape.lineTo(-w, -grow);
    return shape;
  }
  function holed(outer, inner, depth, bevel = 0.02) {
    outer.holes.push(inner);
    return new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 48 });
  }
  const wood = new THREE.MeshStandardMaterial({ color: '#5b3a24', roughness: 0.55 });
  const brass = new THREE.MeshStandardMaterial({ color: '#d9b672', metalness: 1, roughness: 0.22 });
  const filmDark = new THREE.MeshStandardMaterial({ color: '#2b211a', roughness: 0.6 });
  const cream = new THREE.MeshStandardMaterial({ color: '#f6eddc', roughness: 0.5, emissive: '#fff1d4', emissiveIntensity: 0.25 });
  const rose = new THREE.MeshStandardMaterial({ color: '#e8b9a6', metalness: 0.4, roughness: 0.35 });
  // Medidas de cada abertura: ancho, alto total y dónde va la etiqueta.
  const DESIGNS = [
    { w: 1.7, h: 3.05, shape: g => archShape(1.7, 2.2, g), label: 3.8 },
    { w: 1.6, h: 3.4, shape: g => archShape(1.6, 2.6, g), label: 4.25 },
    { w: 1.5, h: 2.1, shape: g => archShape(1.5, 1.35, g), label: 3.05 },
    { w: 1.6, h: 3.0, shape: g => ovalShape(0.8, 1.4, 1.6, g), label: 3.75, bottom: 0.2 },
    { w: 1.6, h: 3.13, shape: g => pointedShape(1.6, 1.75, g), label: 3.95 },
    { w: 1.8, h: 2.7, shape: g => rectShape(1.8, 2.7, g), label: 4.2 }
  ];
  const portalVertex = `uniform vec2 uSize; uniform float uBottom; varying vec2 vP; void main(){ vP=vec2(position.x/uSize.x+.5,(position.y-uBottom)/uSize.y); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
  const portalFragment = `uniform float uTime,uHover,uLocked,uDone,uSeed,uStyle,uView; varying vec2 vP;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float box(vec2 p,vec2 c,vec2 s){vec2 d=abs(p-c)-s;return length(max(d,0.))+min(max(d.x,d.y),0.);}
    void main(){
      vec2 c=vP-vec2(.5,.42); float d=length(c*vec2(1.,.78));
      float t=uTime*(1.-uLocked*.7)+uSeed*7.;
      float glow=smoothstep(.72,0.,d);
      vec3 deep=vec3(.13,.08,.05), warm=vec3(1.,.78,.48), cream=vec3(1.,.95,.84);
      vec3 col;
      if(uStyle<.5){
        /* 01: puerta doble de madera tallada con una cerradura que brilla. */
        float grain=sin(vP.x*95.+sin(vP.y*9.+vP.x*20.)*2.5)*.5+.5;
        col=mix(vec3(.2,.11,.06),vec3(.36,.21,.12),grain*.55+.25);
        vec2 leaf=vec2(fract(vP.x*2.),vP.y);
        float e=smoothstep(.014,0.,abs(box(leaf,vec2(.5,.66),vec2(.3,.18))))+smoothstep(.014,0.,abs(box(leaf,vec2(.5,.28),vec2(.3,.14))));
        col=col*(1.-e*.45)+vec3(.85,.62,.32)*e*.18;
        float seam=smoothstep(.007,0.,abs(vP.x-.5));
        float key=smoothstep(.045,0.,length((vP-vec2(.5,.45))*vec2(1.,.55)));
        float pulse=.75+.25*sin(t*1.8);
        col+=vec3(1.,.72,.38)*(key*(1.3+uHover*1.6)*pulse+seam*(.35+uHover*.7)*glow);
        col+=warm*glow*.06*(1.+uHover);
      } else if(uStyle<1.5){
        /* 02: fotografías que flotan en una luz cálida. */
        col=mix(deep,warm,pow(glow,1.6));
        col+=cream*pow(glow,7.)*.5;
        for(int i=0;i<7;i++){
          float fi=float(i);
          vec2 p=vec2(.18+.64*hash(vec2(fi,1.)),fract(hash(vec2(fi,2.))+t*.03*(.6+hash(vec2(fi,3.))))*1.2-.1);
          float a=(hash(vec2(fi,4.))-.5)*.7; vec2 q=vP-p; q=mat2(cos(a),-sin(a),sin(a),cos(a))*(q*vec2(1.,1.7));
          float m=smoothstep(.004,0.,box(q,vec2(0.),vec2(.1,.08))), img=smoothstep(.004,0.,box(q,vec2(0.,.01),vec2(.083,.055)));
          vec3 photo=mix(vec3(.6,.48,.34),vec3(.86,.72,.52),hash(vec2(fi,5.)));
          col=mix(col,mix(vec3(.98,.94,.86),photo,img),m*(.7+uHover*.25));
        }
      } else if(uStyle<2.5){
        /* 03: luz rosada con pétalos que caen despacio. */
        col=mix(vec3(.2,.1,.09),vec3(1.,.8,.66),pow(glow,1.5));
        col+=cream*pow(glow,6.)*.45;
        for(int i=0;i<12;i++){
          float fi=float(i);
          vec2 p=vec2(fract(hash(vec2(fi,7.))+sin(t*.4+fi)*.05),1.1-fract(hash(vec2(fi,8.))+t*.05*(.5+hash(vec2(fi,9.))))*1.2);
          float a=t*.6+fi; vec2 q=vP-p; q=mat2(cos(a),-sin(a),sin(a),cos(a))*(q*vec2(1.,1.4));
          float petal=smoothstep(.022,.0,length(q*vec2(1.,2.2)));
          col=mix(col,mix(vec3(.96,.72,.66),vec3(.95,.82,.55),hash(vec2(fi,6.))),petal*(.8+uHover*.2));
        }
      } else if(uStyle<3.5){
        /* 04: espejo nacarado con un brillo que sigue la mirada. */
        col=mix(vec3(.8,.78,.76),vec3(.97,.95,.92),vP.y*.6+.3);
        float sheen=pow(sin((vP.x*1.6+vP.y*.9-uView*2.2)*3.1)*.5+.5,6.);
        col+=vec3(1.,.96,.9)*sheen*(.32+uHover*.3);
        col+=vec3(.06,.02,.08)*sin(vP.y*9.+uView*4.)+vec3(.02,.05,.06)*cos(vP.x*7.-uView*3.);
        col*=.82+.18*smoothstep(.62,.2,d);
        col+=cream*uHover*.12;
      } else if(uStyle<4.5){
        /* 05: noche estrellada que se desliza despacio. */
        col=mix(vec3(.05,.06,.14),vec3(.16,.12,.22),1.-vP.y);
        col+=vec3(1.,.72,.42)*pow(max(0.,.35-vP.y),2.)*1.6;
        vec2 g=vP*vec2(34.,52.)+vec2(t*.15,0.);
        vec2 id=floor(g),f=fract(g)-.5; float h=hash(id);
        float star=step(.93,h)*smoothstep(.16,0.,length(f))*(.55+.45*sin(t*2.6+h*60.));
        col+=mix(vec3(.9,.92,1.),vec3(1.,.85,.5),step(.985,h))*star*(1.4+uHover);
        col+=vec3(.5,.45,.7)*pow(glow,3.)*.12;
      } else {
        /* 06: un portal dorado y radiante, cuando ya se puede entrar. */
        float rays=pow(abs(sin(atan(c.y,c.x)*9.+t*.25)),8.)*glow;
        col=mix(vec3(.3,.2,.07),vec3(1.,.82,.42),pow(glow,1.2));
        col+=vec3(1.,.9,.6)*rays*.5+cream*pow(glow,5.)*.6+warm*uHover*.25*glow;
      }
      col+=vec3(1.,.86,.55)*uDone*.16;
      float silk=sin(vP.y*16.-t*1.1+sin(vP.x*7.+t*.6)*1.7)*.5+.5;
      vec3 vault=vec3(.10,.08,.07)+vec3(.55,.42,.24)*pow(glow,2.)*(.35+.15*silk);
      col=mix(col,vault,uLocked*.88);
      gl_FragColor=vec4(col,1.);
      ${THREE.ShaderChunk.tonemapping_fragment}
      ${THREE.ShaderChunk.colorspace_fragment}
    }`;
  uniforms.uView = { value: 0 };
  const instanced = (geometry, material, transforms) => {
    const mesh = new THREE.InstancedMesh(geometry, material, transforms.length), m = new THREE.Matrix4();
    transforms.forEach(([x, y, z, sx = 1, sy = 1, sz = 1, rz = 0], i) => mesh.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz)), new THREE.Vector3(sx, sy, sz))));
    return mesh;
  };
  // Arquitectura propia de cada puerta.
  function decorate(group, style, design) {
    const add = (mesh, z = 0) => { mesh.position.z += z; mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh; };
    const top = design.h;
    if (style === 0) {
      add(new THREE.Mesh(holed(archShape(1.7, 2.2, 0.22), archShape(1.7, 2.2), 0.3), wood), -0.05);
      add(new THREE.Mesh(holed(archShape(1.7, 2.2, 0.05), archShape(1.7, 2.2, -0.01), 0.34), gold), -0.06);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.36), stoneDark)).position.set(0, top + 0.14, 0.04);
      group.add(instanced(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 12), brass, [[-0.1, 1.25, 0.06], [0.1, 1.25, 0.06]]));
      add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.02), brass)).position.set(0, 1.36, 0.03);
    } else if (style === 1) {
      add(new THREE.Mesh(holed(rectShape(1.6, 3.4, 0.34), archShape(1.6, 2.6), 0.26, 0.04), gold), -0.05);
      add(new THREE.Mesh(holed(rectShape(1.6, 3.4, 0.12), rectShape(1.6, 3.4, 0.07), 0.3), stoneDark), -0.05);
      for (const side of [-1, 1]) {
        const x = side * (0.8 + 0.5);
        add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.1, 0.04), filmDark)).position.set(x, 1.6, 0.03);
        group.add(instanced(new THREE.BoxGeometry(0.06, 0.08, 0.02), cream, Array.from({ length: 12 }, (_, i) => [x, 0.18 + i * 0.25, 0.06])));
      }
    } else if (style === 2) {
      add(new THREE.Mesh(holed(archShape(1.5, 1.35, 0.2), archShape(1.5, 1.35), 0.28), stone), -0.05);
      add(new THREE.Mesh(holed(archShape(1.5, 1.35, 0.04), archShape(1.5, 1.35, -0.01), 0.32), gold), -0.06);
      const flowers = [], leaves = [];
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI * (i / 16), r = 0.75 + 0.2;
        const x = Math.cos(a) * r, y = 1.35 + Math.sin(a) * r;
        (i % 2 ? leaves : flowers).push(i % 2 ? [x, y, 0.27, 1.6, 0.7, 0.5, a] : [x, y, 0.28]);
      }
      for (const y of [0.35, 0.75, 1.1]) for (const side of [-1, 1]) flowers.push([side * 0.95, y, 0.28, 0.8, 0.8, 0.8]);
      group.add(instanced(new THREE.SphereGeometry(0.055, 12, 8), rose, flowers));
      group.add(instanced(new THREE.SphereGeometry(0.05, 10, 6), gold, leaves));
    } else if (style === 3) {
      add(new THREE.Mesh(holed(ovalShape(0.8, 1.4, 1.6, 0.1), ovalShape(0.8, 1.4, 1.6), 0.16, 0.03), gold), -0.04);
      add(new THREE.Mesh(holed(ovalShape(0.8, 1.4, 1.6, 0.2), ovalShape(0.8, 1.4, 1.6, 0.11), 0.1), stoneDark), -0.06);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.34), stoneDark)).position.set(0, 0.07, 0.08);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10), gold)).position.set(0, 3.13, 0.08);
    } else if (style === 4) {
      add(new THREE.Mesh(holed(pointedShape(1.6, 1.75, 0.22), pointedShape(1.6, 1.75), 0.3), stone), -0.05);
      add(new THREE.Mesh(holed(pointedShape(1.6, 1.75, 0.05), pointedShape(1.6, 1.75, -0.01), 0.34), gold), -0.06);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.025, 1.75, 0.03), gold)).position.set(0, 0.875, 0.04);
      const ring = add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.014, 8, 48), gold)); ring.position.set(0, 2.3, 0.04);
      for (const side of [-1, 1]) { const arc = add(new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.012, 8, 32, Math.PI), gold)); arc.position.set(side * 0.4, 1.75, 0.04); }
      add(new THREE.Mesh(new THREE.OctahedronGeometry(0.07), gold)).position.set(0, top + 0.18, 0.06);
    } else {
      add(new THREE.Mesh(holed(rectShape(1.8, 2.7, 0.24), rectShape(1.8, 2.7), 0.34, 0.04), gold), -0.05);
      for (const side of [-1, 1]) {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.0, 0.3), stone)).position.set(side * 1.32, 1.5, 0.05);
        add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.38), gold)).position.set(side * 1.32, 3.06, 0.05);
      }
      const pediment = new THREE.Shape(); pediment.moveTo(-1.6, 0); pediment.lineTo(1.6, 0); pediment.lineTo(0, 0.55); pediment.lineTo(-1.6, 0);
      add(new THREE.Mesh(new THREE.ExtrudeGeometry(pediment, { depth: 0.3, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 }), stoneDark)).position.set(0, 3.12, -0.04);
      add(new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.06, 0.36), gold)).position.set(0, 3.12, 0.08);
    }
  }

  const doors = [];
  const progress = () => new Set(Museum.getProgress().completed);
  config.rooms.forEach((room, index) => {
    const style = Math.min(index, DESIGNS.length - 1), design = DESIGNS[style];
    const angle = THREE.MathUtils.degToRad(-80 + index * 32);
    const group = new THREE.Group();
    group.position.set((R - 0.18) * Math.sin(angle), 0, -(R - 0.18) * Math.cos(angle));
    group.lookAt(0, 0, 0);
    const portalUniforms = { uTime: uniforms.uTime, uView: uniforms.uView, uHover: { value: 0 }, uLocked: { value: 0 }, uDone: { value: 0 }, uSeed: { value: index * 0.37 }, uStyle: { value: style }, uSize: { value: new THREE.Vector2(design.w, design.h - (design.bottom || 0)) }, uBottom: { value: design.bottom || 0 } };
    const portal = new THREE.Mesh(new THREE.ShapeGeometry(design.shape(0), 48), new THREE.ShaderMaterial({ uniforms: portalUniforms, vertexShader: portalVertex, fragmentShader: portalFragment }));
    portal.userData = { kind: 'door', index };
    group.add(portal);
    decorate(group, style, design);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.88), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }));
    label.position.set(0, design.label, 0.05);
    group.add(label);
    const lock = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 12, 48), gold);
    lock.position.set(0, 1.25, 0.08);
    group.add(lock);
    scene.add(group);
    doors.push({ room, index, group, portal, label, lock, labelY: design.label, uniforms: portalUniforms, hover: 0, state: '' });
  });
  function refreshDoors() {
    const done = progress();
    for (const door of doors) {
      const locked = !!door.room.requires && !door.room.requires.every(id => done.has(id));
      const state = locked ? 'locked' : done.has(door.room.id) ? 'done' : 'open';
      door.uniforms.uLocked.value = locked ? 1 : 0;
      door.uniforms.uDone.value = state === 'done' ? 1 : 0;
      door.lock.visible = locked;
      if (state !== door.state) {
        door.label.material.map?.dispose();
        door.label.material.map = labelTexture(String(door.index + 1).padStart(2, '0'), door.room.title, state);
        door.label.material.needsUpdate = true;
        door.state = state;
      }
    }
  }
  refreshDoors();
  document.addEventListener('museum:progress', refreshDoors);

  /* Columnas entre puertas. */
  const columnGeometry = new THREE.CylinderGeometry(0.2, 0.23, WALL - 0.7, 32);
  const capGeometry = new THREE.BoxGeometry(0.6, 0.18, 0.6);
  for (let i = 0; i < 7; i++) {
    const angle = THREE.MathUtils.degToRad(-96 + i * 32);
    const x = (R - 0.45) * Math.sin(angle), z = -(R - 0.45) * Math.cos(angle);
    const column = new THREE.Mesh(columnGeometry, marbleMat);
    column.position.set(x, (WALL - 0.7) / 2 + 0.2, z);
    column.castShadow = column.receiveShadow = true;
    scene.add(column);
    for (const y of [0.1, WALL - 0.42]) { const cap = new THREE.Mesh(capGeometry, stoneDark); cap.position.set(x, y, z); cap.rotation.y = -angle; scene.add(cap); }
    const sconce = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: '#ffd9a0', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    sconce.position.set(x * 0.97, 3.6, z * 0.97);
    sconce.scale.setScalar(0.9);
    scene.add(sconce);
  }

  /* Polvo dorado que flota en la luz. */
  const COUNT = 520, positions = new Float32Array(COUNT * 3), speeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const r = Math.sqrt(rand()) * 6.5, a = rand() * Math.PI * 2;
    positions.set([Math.cos(a) * r, rand() * WALL, Math.sin(a) * r], i * 3);
    speeds[i] = 0.05 + rand() * 0.12;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ map: dotTexture(), size: 0.07, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffe8bf' }));
  scene.add(dust);

  /* La entrada permanece en el mismo encuadre mientras se retira la puerta. */
  const home = new THREE.Vector3(0, 1.95, 6.6);
  const view = { yaw: 0, pitch: -0.005, targetYaw: 0, targetPitch: -0.005 };
  let flight = null, returnTimer = null, hovered = null, visible = false, running = false, announced = false;
  const portrait = () => sceneBox.clientWidth / sceneBox.clientHeight < 1.1;
  // A pantalla completa se puede recorrer con la mirada todo el arco de puertas.
  const yawLimit = () => (portrait() ? 1.1 : 0.62);

  function resize() {
    const w = sceneBox.clientWidth, h = sceneBox.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = portrait() ? 66 : 50;
    home.z = portrait() ? 4.8 : 6.6;
    for (const door of doors) door.label.scale.setScalar(portrait() ? 1.45 : 1);
    camera.updateProjectionMatrix();
    mirror.getRenderTarget().setSize(Math.round(w * renderer.getPixelRatio() * 0.6), Math.round(h * renderer.getPixelRatio() * 0.6));
  }
  new ResizeObserver(resize).observe(sceneBox);
  window.addEventListener('resize', resize);
  resize();

  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lookDirection = (yaw, pitch) => new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));

  function settleCamera() {
    clearTimeout(returnTimer);
    flight = null;
    sceneBox.classList.remove('flying','through');
    camera.position.copy(home);
    view.yaw = view.targetYaw;
    view.pitch = view.targetPitch;
    camera.lookAt(home.clone().add(lookDirection(view.yaw,view.pitch)));
  }

  function placeCamera(now) {
    if (flight) {
      const t = Math.min(1, (now - flight.start) / flight.duration), k = ease(t);
      camera.position.lerpVectors(flight.from, flight.to, k);
      const look = new THREE.Vector3().lerpVectors(flight.lookFrom, flight.lookTo, k);
      camera.lookAt(look);
      if (t === 1) { const done = flight.done; flight = null; done?.(); }
      return;
    }
    /* La mirada sólo cambia cuando la persona la mueve: sin deriva automática. */
    view.yaw += (view.targetYaw - view.yaw) * 0.08;
    view.pitch += (view.targetPitch - view.pitch) * 0.08;
    camera.position.copy(home);
    camera.lookAt(camera.position.clone().add(lookDirection(view.yaw, view.pitch)));
  }

  function flyTo(position, look, duration, done) {
    const lookFrom = camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(6));
    flight = { start: performance.now(), from: camera.position.clone(), to: position, lookFrom, lookTo: look, duration: reducedMotion.matches ? 1 : duration, done };
  }
  function homeLook() { return home.clone().add(lookDirection(view.yaw, view.pitch).multiplyScalar(6)); }

  function enterDoor(door) {
    if (flight) return;
    const center = door.group.position.clone().setY(1.55);
    const inward = center.clone().setY(0).normalize();
    const front = center.clone().sub(inward.clone().multiplyScalar(2.6)).setY(1.65);
    const through = center.clone().sub(inward.clone().multiplyScalar(0.35)).setY(1.5);
    sceneBox.classList.add('flying');
    flyTo(front, center, 1300, () => {
      if (door.uniforms.uLocked.value) {
        Museum.openRoom(door.room.id);
        shake = { door, start: performance.now() };
        returnHome(900);
        return;
      }
      sceneBox.classList.remove('through'); void sceneBox.offsetWidth; sceneBox.classList.add('through');
      flyTo(through, center.clone().sub(inward.clone().multiplyScalar(-2)), 650, () => {
        Museum.openRoom(door.room.id);
        returnHome(1200);
      });
    });
  }
  function returnHome(delay) {
    clearTimeout(returnTimer);
    returnTimer = setTimeout(() => {
      if(document.querySelector('#lobby').hidden){flight=null;sceneBox.classList.remove('flying','through');return;}
      view.targetYaw = view.yaw;
      flyTo(home.clone(), homeLook(), 1500, () => sceneBox.classList.remove('flying'));
    }, reducedMotion.matches ? 0 : delay);
  }
  let shake = null;

  /* Mirada: mouse, arrastre con el dedo o inclinación del teléfono. */
  const pointer = new THREE.Vector2(), raycaster = new THREE.Raycaster();
  const pickables = [...doors.map(d => d.portal), heartHit];
  let drag = null;
  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(pickables, false)[0]?.object || null;
  }
  canvas.addEventListener('pointermove', event => {
    if (drag) {
      const dx = event.clientX - drag.x;
      if (Math.abs(dx) > 6) drag.moved = true;
      if (drag.moved) view.targetYaw = THREE.MathUtils.clamp(drag.yaw + dx / sceneBox.clientWidth * 2.4, -yawLimit(), yawLimit());
    }
    if (event.pointerType === 'mouse') {
      const object = flight ? null : pick(event);
      hovered = object;
      canvas.style.cursor = object ? 'pointer' : '';
    }
  });
  canvas.addEventListener('pointerdown', event => {
    drag = { x: event.clientX, yaw: view.targetYaw, moved: false };
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Puntero ya liberado. */ }
  });
  canvas.addEventListener('pointerup', event => {
    const wasDrag = drag?.moved;
    drag = null;
    if (wasDrag || flight) return;
    const object = pick(event);
    if (!object) return;
    if (object.userData.kind === 'heart') { heartPulse = performance.now(); Museum.openPassport(); }
    else enterDoor(doors[object.userData.index]);
  });
  canvas.addEventListener('pointercancel', () => { drag = null; hovered = null; });
  canvas.addEventListener('pointerleave', () => { if (!drag) hovered = null; canvas.style.cursor = ''; });
  window.addEventListener('blur', () => { drag = null; hovered = null; });
  let heartPulse = -Infinity;

  /* Animación: sólo mientras el vestíbulo está visible en pantalla. */
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const now = performance.now(), dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    uniforms.uTime.value = reducedMotion.matches ? 2 : t;
    uniforms.uView.value = view.yaw;
    placeCamera(now);
    if (!reducedMotion.matches) {
      heart.rotation.y = Math.sin(t * 0.45) * 1.1;
      heart.position.y = 1.7 + Math.sin(t * 1.3) * 0.07;
      const beat = Math.max(0, 1 - (now - heartPulse) / 700);
      heart.scale.setScalar(1 + Math.sin(beat * Math.PI) * 0.18);
      halo.material.opacity = 0.45 + Math.sin(t * 1.3) * 0.08;
      const p = dustGeometry.attributes.position;
      for (let i = 0; i < COUNT; i++) {
        let y = p.getY(i) + speeds[i] * dt;
        if (y > WALL) y = 0;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(t * 0.3 + i) * 0.0008);
      }
      p.needsUpdate = true;
    }
    for (const door of doors) {
      const goal = hovered === door.portal ? 1 : 0;
      door.hover += (goal - door.hover) * 0.12;
      door.uniforms.uHover.value = door.hover;
      door.label.position.y = door.labelY + door.hover * 0.08;
      door.lock.rotation.z = 0;
      if (shake?.door === door) {
        const s = (now - shake.start) / 600;
        if (s < 1) door.lock.position.x = Math.sin(s * 40) * 0.05 * (1 - s); else { door.lock.position.x = 0; shake = null; }
      }
    }
    heart.material.emissiveIntensity = 0.15 + (hovered === heartHit ? 0.35 : 0);
    renderer.render(scene, camera);
    if (!announced) { announced = true; requestAnimationFrame(() => announce(true)); }
  }
  function setRunning() {
    const should = visible && !document.hidden && !document.querySelector('#lobby').hidden;
    if (should && !running) { running = true; clock.getDelta(); requestAnimationFrame(frame); }
    if (!should) running = false;
  }
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; setRunning(); }).observe(sceneBox);
  document.addEventListener('visibilitychange', setRunning);
  document.addEventListener('museum:screen', event => {
    if (event.detail === 'lobby') { refreshDoors(); resize(); settleCamera(); }
    else { clearTimeout(returnTimer); flight=null; }
    setRunning();
  });
  if (!document.querySelector('#lobby').hidden) settleCamera();
  setRunning();
}
