const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createStore,prepareConfig,LIMITS}=require('../dist/progress.js');
function freshConfig(){const context={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/config.js'),'utf8'),context);return JSON.parse(JSON.stringify(context.window.MUSEUM_CONFIG));}
function memoryStorage(value=null){let current=value;return {getItem:()=>current,setItem:(_,next)=>{current=next;}};}

test('la sala 03 se completa al examinar sus seis objetos, sin tocar las otras salas',()=>{
  const config=freshConfig(),storage=memoryStorage(),store=createStore(config,storage);
  const ids=config.littleThingsRoom.objects.map(piece=>piece.id);
  assert.equal(ids.length,6);
  assert.deepEqual(config.rooms.find(room=>room.id==='little-things').pieces,ids);
  store.discoverPiece('moments',config.momentsRoom.exhibits[0].id);
  ids.slice(0,5).forEach(id=>assert.equal(store.discoverPiece('little-things',id).newlyCompleted,false));
  assert.equal(store.discoverPiece('little-things',ids[5]).newlyCompleted,true);
  assert.equal(store.discoverPiece('little-things',ids[5]).newlyCompleted,false);
  assert.deepEqual(store.getProgress().completed,['little-things']);
  assert.equal(store.getProgress().discoveries.moments.length,1);
  const restored=createStore(freshConfig(),storage);
  assert.equal(restored.getProgress().discoveries['little-things'].length,6);
  assert.deepEqual(restored.getProgress().completed,['little-things']);
});
test('quitar objetos ajusta el total y no deja requisitos imposibles',()=>{
  const config=freshConfig();
  config.littleThingsRoom.objects=config.littleThingsRoom.objects.slice(0,4);
  const store=createStore(config,memoryStorage());
  for(const piece of config.littleThingsRoom.objects)store.discoverPiece('little-things',piece.id);
  assert.deepEqual(store.getProgress().completed,['little-things']);
});
test('las fotos complementarias cuentan en el límite global de 25 fotografías',()=>{
  const config=freshConfig();
  const used=config.beginningRoom.exhibits.reduce((sum,piece)=>sum+['screenshot','photo','chat'].filter(key=>piece[key]).length,0)+config.momentsRoom.exhibits.filter(piece=>piece.type==='photo').length;
  for(const piece of config.littleThingsRoom.objects)piece.photo='x.jpg';
  for(let i=0;i<30;i++)config.littleThingsRoom.objects.push({id:`extra-${i}`,object:'cups',title:'Extra',photo:'x.jpg'});
  const warn=console.warn;console.warn=()=>{};
  try{prepareConfig(config);}finally{console.warn=warn;}
  const photos=config.littleThingsRoom.objects.filter(piece=>piece.photo).length;
  assert.equal(used+photos,LIMITS.photos);
  assert.equal(config.littleThingsRoom.objects.length,36,'los objetos se conservan aunque pierdan su foto opcional');
});
test('la pista de la flor es única e independiente del sello y de la colección',()=>{
  const config=freshConfig(),store=createStore(config,memoryStorage());
  assert.ok(config.clueIds.includes(config.littleThingsRoom.clue.id));
  assert.equal(store.findClue('little-things-flower'),true);
  assert.equal(store.findClue('little-things-flower'),false);
  assert.deepEqual(store.getProgress().clues,['little-things-flower']);
  assert.deepEqual(store.getProgress().discoveries['little-things'],[]);
});
