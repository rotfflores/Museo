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

function supportsWebGL() {
  try { const canvas = document.createElement('canvas'); return !!(canvas.getContext('webgl2') || canvas.getContext('webgl')); } catch { return false; }
}

if (config && Museum && sceneBox && supportsWebGL()) {
  try { build(); } catch (error) { console.warn('Vestíbulo 3D no disponible:', error); sceneBox.classList.remove('is-3d'); }
}

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

  const hint = document.createElement('div');
  hint.className = 'scene-hint';
  hint.setAttribute('aria-hidden', 'true');
  for (const [tag, text] of [['span', 'Arrastra para mirar'], ['b', '·'], ['span', 'Toca una puerta o el corazón']]) {
    const part = document.createElement(tag);
    part.textContent = text;
    hint.append(part);
  }
  sceneBox.append(hint);

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

  /* Seis puertas-portal en el arco del fondo. */
  function archShape(width, straight, grow = 0) {
    const w = width / 2 + grow, shape = new THREE.Shape();
    shape.moveTo(-w, -grow);
    shape.lineTo(w, -grow);
    shape.lineTo(w, straight);
    shape.absarc(0, straight, w, 0, Math.PI, false);
    shape.lineTo(-w, -grow);
    return shape;
  }
  function frameGeometry(inner, outer, depth) {
    const shape = archShape(ARCH_W, ARCH_H, outer);
    shape.holes.push(archShape(ARCH_W, ARCH_H, inner));
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 48 });
  }
  const portalVertex = `varying vec2 vP; void main(){ vP=vec2(position.x/${ARCH_W.toFixed(2)}+.5, position.y/${(ARCH_H + ARCH_W / 2).toFixed(3)}); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
  const portalFragment = `uniform float uTime,uHover,uLocked,uDone,uSeed; varying vec2 vP;
    void main(){
      vec2 c=vP-vec2(.5,.4); float d=length(c*vec2(1.,.78));
      float t=uTime*(1.-uLocked*.7)+uSeed*7.;
      float glow=smoothstep(.72,0.,d);
      float corridor=pow(abs(sin(d*15.-t*.9)),30.)*glow;
      float silk=sin(vP.y*16.-t*1.1+sin(vP.x*7.+t*.6)*1.7)*.5+.5;
      vec3 deep=vec3(.13,.08,.05), warm=vec3(1.,.78,.48), cream=vec3(1.,.95,.84);
      vec3 col=mix(deep,warm,pow(glow,1.8)+silk*.1*glow);
      col+=cream*pow(glow,7.)*.7;
      col+=warm*corridor*(.35+uHover*.6);
      col+=cream*uHover*.28*glow;
      col+=vec3(1.,.86,.55)*uDone*.18;
      vec3 vault=vec3(.10,.08,.07)+vec3(.55,.42,.24)*pow(glow,2.)*(.35+.15*silk);
      col=mix(col,vault,uLocked*.88);
      gl_FragColor=vec4(col,1.);
      ${THREE.ShaderChunk.tonemapping_fragment}
      ${THREE.ShaderChunk.colorspace_fragment}
    }`;

  const doors = [];
  const progress = () => new Set(Museum.getProgress().completed);
  config.rooms.forEach((room, index) => {
    const angle = THREE.MathUtils.degToRad(-80 + index * 32);
    const group = new THREE.Group();
    group.position.set((R - 0.18) * Math.sin(angle), 0, -(R - 0.18) * Math.cos(angle));
    group.lookAt(0, 0, 0);
    const portalUniforms = { uTime: uniforms.uTime, uHover: { value: 0 }, uLocked: { value: 0 }, uDone: { value: 0 }, uSeed: { value: index * 0.37 } };
    const portal = new THREE.Mesh(new THREE.ShapeGeometry(archShape(ARCH_W, ARCH_H), 48), new THREE.ShaderMaterial({ uniforms: portalUniforms, vertexShader: portalVertex, fragmentShader: portalFragment }));
    portal.userData = { kind: 'door', index };
    group.add(portal);
    const frame = new THREE.Mesh(frameGeometry(0, 0.24, 0.3), stone);
    frame.position.z = -0.05; frame.castShadow = frame.receiveShadow = true;
    group.add(frame);
    const trim = new THREE.Mesh(frameGeometry(-0.01, 0.05, 0.34), gold);
    trim.position.z = -0.06;
    group.add(trim);
    const keystone = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.36), stoneDark);
    keystone.position.set(0, ARCH_H + ARCH_W / 2 + 0.14, 0.04);
    group.add(keystone);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.88), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }));
    label.position.set(0, ARCH_H + ARCH_W / 2 + 0.75, 0.05);
    group.add(label);
    const lock = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 12, 48), gold);
    lock.position.set(0, 1.25, 0.08);
    group.add(lock);
    scene.add(group);
    doors.push({ room, index, group, portal, label, lock, uniforms: portalUniforms, hover: 0, state: '' });
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

  /* Cámara: entra por la puerta del museo y luego sigue tu mirada. */
  const home = new THREE.Vector3(0, 1.95, 6.6);
  const view = { yaw: 0, pitch: -0.05, targetYaw: 0, targetPitch: -0.05, hoverX: 0, hoverY: 0 };
  let flight = null, intro = null, lastInteraction = -Infinity, hovered = null, visible = false, running = false;
  const portrait = () => sceneBox.clientWidth / sceneBox.clientHeight < 1.1;
  const yawLimit = () => (portrait() ? 1.05 : 0.38);

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
  resize();

  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lookDirection = (yaw, pitch) => new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));

  function startIntro() {
    if (reducedMotion.matches) { intro = null; return; }
    intro = { start: performance.now(), from: new THREE.Vector3(0, 2.6, 15.5), duration: 2600 };
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
    if (intro) {
      const t = Math.min(1, (now - intro.start) / intro.duration), k = ease(t);
      camera.position.lerpVectors(intro.from, home, k);
      camera.lookAt(new THREE.Vector3(0, 1.9, -3));
      if (t === 1) intro = null;
      return;
    }
    if (now - lastInteraction > 4000 && !reducedMotion.matches) {
      view.targetYaw = Math.sin(now / 7000) * yawLimit() * 0.45;
      view.targetPitch = -0.05 + Math.sin(now / 9000) * 0.03;
    }
    /* El mouse sólo inclina un poco la mirada, para que las puertas no se escapen del cursor. */
    view.yaw += (view.targetYaw + view.hoverX * 0.06 - view.yaw) * 0.05;
    view.pitch += (view.targetPitch - view.hoverY * 0.025 - view.pitch) * 0.05;
    const sway = reducedMotion.matches ? 0 : Math.sin(now / 2600) * 0.025;
    camera.position.set(home.x + view.yaw * 0.6, home.y + sway, home.z);
    camera.lookAt(camera.position.clone().add(lookDirection(view.yaw, view.pitch)));
  }

  function flyTo(position, look, duration, done) {
    const lookFrom = camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(6));
    flight = { start: performance.now(), from: camera.position.clone(), to: position, lookFrom, lookTo: look, duration: reducedMotion.matches ? 1 : duration, done };
  }
  function homeLook() { return home.clone().add(lookDirection(view.yaw, view.pitch).multiplyScalar(6)); }

  function enterDoor(door) {
    if (flight || intro) return;
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
    setTimeout(() => {
      if(document.querySelector('#lobby').hidden){flight=null;sceneBox.classList.remove('flying','through');return;}
      view.targetYaw = view.yaw - view.hoverX * 0.06;
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
  function interacted() { lastInteraction = performance.now(); hint.classList.add('gone'); }
  canvas.addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse' && !drag) {
      const rect = canvas.getBoundingClientRect();
      view.hoverX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      view.hoverY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      lastInteraction = performance.now();
    }
    if (drag) {
      const dx = event.clientX - drag.x;
      view.targetYaw = THREE.MathUtils.clamp(drag.yaw - dx / sceneBox.clientWidth * 2.2, -yawLimit(), yawLimit());
      if (Math.abs(dx) > 6) { drag.moved = true; interacted(); }
    }
    if (event.pointerType === 'mouse') {
      const object = flight ? null : pick(event);
      hovered = object;
      canvas.style.cursor = object ? 'pointer' : '';
    }
  });
  canvas.addEventListener('pointerdown', event => {
    drag = { x: event.clientX, yaw: view.targetYaw, moved: false };
  });
  canvas.addEventListener('pointerup', event => {
    const wasDrag = drag?.moved;
    drag = null;
    if (wasDrag || flight || intro) return;
    interacted();
    const object = pick(event);
    if (!object) return;
    if (object.userData.kind === 'heart') { heartPulse = performance.now(); Museum.openPassport(); }
    else enterDoor(doors[object.userData.index]);
  });
  canvas.addEventListener('pointerleave', () => { drag = null; hovered = null; view.hoverX = view.hoverY = 0; });
  let heartPulse = -Infinity;
  window.addEventListener('deviceorientation', event => {
    if (event.gamma === null || drag || !portrait()) return;
    view.targetYaw = THREE.MathUtils.clamp(-event.gamma / 30, -1, 1) * yawLimit();
    lastInteraction = performance.now();
  });

  /* Animación: sólo mientras el vestíbulo está visible en pantalla. */
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const now = performance.now(), dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    uniforms.uTime.value = reducedMotion.matches ? 2 : t;
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
      door.label.position.y = ARCH_H + ARCH_W / 2 + 0.75 + door.hover * 0.08;
      door.lock.rotation.z = 0;
      if (shake?.door === door) {
        const s = (now - shake.start) / 600;
        if (s < 1) door.lock.position.x = Math.sin(s * 40) * 0.05 * (1 - s); else { door.lock.position.x = 0; shake = null; }
      }
    }
    heart.material.emissiveIntensity = 0.15 + (hovered === heartHit ? 0.35 : 0);
    renderer.render(scene, camera);
  }
  function setRunning() {
    const should = visible && !document.hidden && !document.querySelector('#lobby').hidden;
    if (should && !running) { running = true; clock.getDelta(); requestAnimationFrame(frame); }
    if (!should) running = false;
  }
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; setRunning(); }).observe(sceneBox);
  document.addEventListener('visibilitychange', setRunning);
  document.addEventListener('museum:screen', event => {
    if (event.detail === 'lobby') { refreshDoors(); resize(); startIntro(); }
    setRunning();
  });
  if (!document.querySelector('#lobby').hidden) startIntro();
  setRunning();
}
