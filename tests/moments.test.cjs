const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createStore,prepareConfig,LIMITS}=require('../dist/progress.js');
function freshConfig(){const context={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/config.js'),'utf8'),context);return JSON.parse(JSON.stringify(context.window.MUSEUM_CONFIG));}
function memoryStorage(value=null){let current=value;return {getItem:()=>current,setItem:(_,next)=>{current=next;}};}

test('la sala 02 exige exactamente sus ocho piezas configuradas y da un solo sello',()=>{
  const config=freshConfig(),storage=memoryStorage(),store=createStore(config,storage);
  const ids=config.momentsRoom.exhibits.map(piece=>piece.id);
  assert.equal(ids.length,8);
  assert.deepEqual(config.rooms.find(room=>room.id==='moments').pieces,ids);
  ids.slice(0,7).forEach(id=>assert.equal(store.discoverPiece('moments',id).newlyCompleted,false));
  assert.deepEqual(store.getProgress().completed,[]);
  assert.equal(store.discoverPiece('moments',ids[7]).newlyCompleted,true);
  assert.equal(store.discoverPiece('moments',ids[0]).added,false);
  assert.deepEqual(store.getProgress().completed,['moments']);
  assert.deepEqual(store.getProgress().discoveries.beginning,[]);
  const restored=createStore(freshConfig(),storage);
  assert.equal(restored.getProgress().discoveries.moments.length,8);
  assert.deepEqual(restored.getProgress().completed,['moments']);
});
test('si se quitan piezas, el total se recalcula y no quedan requisitos imposibles',()=>{
  const config=freshConfig();
  config.momentsRoom.exhibits=config.momentsRoom.exhibits.filter(piece=>piece.type==='photo').slice(0,3);
  const store=createStore(config,memoryStorage());
  for(const piece of config.momentsRoom.exhibits)store.discoverPiece('moments',piece.id);
  assert.deepEqual(store.getProgress().completed,['moments']);
  assert.equal(store.discoverPiece('moments','sonaba').added,false);
});
test('el paquete respeta el límite global de 25 fotos y 5 videos',()=>{
  const config=freshConfig();
  for(let i=0;i<40;i++)config.momentsRoom.exhibits.push({id:`extra-photo-${i}`,type:'photo',zone:i%3,title:'Extra',date:'',src:'x.jpg'});
  for(let i=0;i<10;i++)config.momentsRoom.exhibits.push({id:`extra-video-${i}`,type:'video',zone:2,title:'Extra',date:'',src:'x.mp4'});
  const warn=console.warn;console.warn=()=>{};
  try{prepareConfig(config);}finally{console.warn=warn;}
  const room=config.momentsRoom.exhibits,beginning=config.beginningRoom.exhibits;
  const beginningPhotos=beginning.reduce((sum,piece)=>sum+['screenshot','photo','chat'].filter(key=>piece[key]).length,0);
  assert.equal(room.filter(piece=>piece.type==='photo').length+beginningPhotos,LIMITS.photos);
  assert.equal(room.filter(piece=>piece.type==='video').length,LIMITS.videos);
  assert.deepEqual(config.rooms.find(item=>item.id==='moments').pieces,room.map(piece=>piece.id));
});
test('la pista de la cámara se guarda una vez y no depende del sello',()=>{
  const config=freshConfig(),store=createStore(config,memoryStorage());
  assert.ok(config.clueIds.includes(config.momentsRoom.clue.id));
  assert.equal(store.findClue('moments-camera'),true);
  assert.equal(store.findClue('moments-camera'),false);
  assert.deepEqual(store.getProgress().clues,['moments-camera']);
  assert.deepEqual(store.getProgress().completed,[]);
});
