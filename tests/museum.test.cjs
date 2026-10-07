const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createStore}=require('../dist/progress.js');
const context={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/config.js'),'utf8'),context);
const config=JSON.parse(JSON.stringify(context.window.MUSEUM_CONFIG));
function memoryStorage(value=null){let current=value;return {getItem:()=>current,setItem:(_,value)=>{current=value;}};}

test('tres piezas únicas dan un sello; ni volver a abrirlas ni encontrar la llave lo duplica',()=>{
  const storage=memoryStorage(),store=createStore(config,storage);
  assert.equal(store.completeRoom('beginning'),false);
  assert.equal(store.findClue('beginning-key'),true);
  assert.deepEqual(store.getProgress().completed,[]);
  assert.equal(store.discoverPiece('beginning','message').newlyCompleted,false);
  assert.equal(store.discoverPiece('beginning','message').added,false);
  assert.equal(store.discoverPiece('beginning','first-date').newlyCompleted,false);
  assert.equal(store.discoverPiece('beginning','unknown').added,false);
  assert.equal(store.discoverPiece('beginning','together').newlyCompleted,true);
  assert.equal(store.discoverPiece('beginning','together').newlyCompleted,false);
  assert.equal(store.findClue('beginning-key'),false);
  assert.deepEqual(store.getProgress().completed,['beginning']);
  const restored=createStore(config,storage);
  assert.deepEqual(restored.getProgress(),store.getProgress());
  assert.equal(restored.getProgress().discoveries.beginning.length,3);
  assert.equal(restored.getProgress().clues.length,1);
});
test('el sello no necesita una pista; otras salas y el bloqueo final se conservan',()=>{
  const store=createStore(config,memoryStorage());
  for(const id of ['message','first-date','together'])store.discoverPiece('beginning',id);
  assert.deepEqual(store.getProgress().clues,[]);
  assert.equal(store.getProgress().completed.length,1);
  assert.equal(store.completeRoom('artwork'),false);
});
test('persiste un recorrido parcial junto con sonido y entrada; filtra datos desconocidos',()=>{
  const storage=memoryStorage(JSON.stringify({entered:true,soundPreferred:true,discoveries:{beginning:['message','message','fake']},completed:['fake','beginning'],clues:['beginning-key','fake']}));
  const store=createStore(config,storage);
  assert.deepEqual(store.getProgress().discoveries.beginning,['message']);
  assert.deepEqual(store.getProgress().completed,[]);
  assert.deepEqual(store.getProgress().clues,['beginning-key']);
  store.discoverPiece('beginning','first-date');
  const restored=createStore(config,storage);
  assert.equal(restored.state.entered,true);assert.equal(restored.state.soundPreferred,true);
  assert.equal(restored.getProgress().discoveries.beginning.length,2);
});
test('almacenamiento corrupto o bloqueado permite explorar y completar',()=>{
  for(const storage of [memoryStorage('{broken'),{getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}}]) {
    const store=createStore(config,storage);
    for(const id of ['message','first-date','together'])store.discoverPiece('beginning',id);
    assert.deepEqual(store.getProgress().completed,['beginning']);
  }
});
test('el movimiento no atraviesa una vitrina, ni con un desplazamiento grande',async()=>{
  const {moveWithCollisions,isWalkable}=await import('../dist/navigation.mjs');
  const boxes=[{minX:-1,maxX:1,minZ:-1,maxZ:1}];
  const stopped=moveWithCollisions({x:0,z:3},0,-8,boxes);
  assert.ok(stopped.z>=1.25);assert.ok(isWalkable(stopped.x,stopped.z,boxes));
  const wall=moveWithCollisions({x:0,z:3},100,0,boxes);assert.ok(wall.x<=5.35);
});
test('el recorrido guiado rodea los objetos y cada tramo queda dentro de los límites',async()=>{
  const {planPath,isWalkable}=await import('../dist/navigation.mjs');
  const boxes=[{minX:-4.6,maxX:-2.5,minZ:-2.2,maxZ:-.8},{minX:2.65,maxX:4.15,minZ:-2.05,maxZ:-.55}];
  const path=planPath({x:-3.55,z:3},{x:-3.55,z:-3.5},boxes);
  assert.ok(path.length>2);
  for(let i=1;i<path.length;i++)for(let j=0;j<=200;j++) {
    const x=path[i-1].x+(path[i].x-path[i-1].x)*j/200,z=path[i-1].z+(path[i].z-path[i-1].z)*j/200;
    assert.ok(isWalkable(x,z,boxes),`tramo ${i}: ${x}, ${z}`);
  }
});
