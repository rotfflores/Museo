const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createStore,prepareConfig,LIMITS}=require('../dist/progress.js');
function freshConfig(){const context={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/config.js'),'utf8'),context);return JSON.parse(JSON.stringify(context.window.MUSEUM_CONFIG));}
function memoryStorage(value=null){let current=value;return {getItem:()=>current,setItem:(_,next)=>{current=next;}};}

test('la sala 04 pide los cinco retratos y la obra central, y se completa solo al revelarla',()=>{
  const config=freshConfig(),storage=memoryStorage(),store=createStore(config,storage);
  const ids=config.youRoom.portraits.map(piece=>piece.id);
  assert.equal(ids.length,5);
  assert.deepEqual(config.rooms.find(room=>room.id==='you').pieces,[...ids,'obra-central']);
  ids.forEach(id=>assert.equal(store.discoverPiece('you',id).newlyCompleted,false));
  assert.deepEqual(store.getProgress().completed,[]);
  assert.equal(store.discoverPiece('you','obra-central').newlyCompleted,true);
  assert.equal(store.discoverPiece('you','obra-central').newlyCompleted,false,'sin sello duplicado');
  const restored=createStore(freshConfig(),storage);
  assert.ok(restored.getProgress().discoveries.you.includes('obra-central'));
  assert.deepEqual(restored.getProgress().completed,['you']);
});
test('quitar retratos ajusta el requisito',()=>{
  const config=freshConfig();config.youRoom.portraits=config.youRoom.portraits.slice(0,3);
  const store=createStore(config,memoryStorage());
  for(const piece of config.youRoom.portraits)store.discoverPiece('you',piece.id);
  assert.deepEqual(store.getProgress().completed,[]);
  store.discoverPiece('you','obra-central');
  assert.deepEqual(store.getProgress().completed,['you']);
});
test('las fotos reutilizadas no cuentan y el límite global se respeta',()=>{
  const config=freshConfig(),reused=config.beginningRoom.exhibits.find(piece=>piece.photo).photo;
  config.youRoom.portraits[0].photo=reused;
  for(let i=0;i<30;i++)config.youRoom.portraits.push({id:`extra-${i}`,title:'Extra',photo:`extra-${i}.jpg`});
  const warn=console.warn;console.warn=()=>{};
  try{prepareConfig(config);}finally{console.warn=warn;}
  assert.equal(config.youRoom.portraits[0].photo,reused);
  assert.ok(config.youRoom.portraits.some(piece=>piece.photo===null),'las fotos de más se omiten');
});
test('las canciones sin audio ni enlace se ocultan y el máximo es 5',()=>{
  const config=freshConfig();
  config.youRoom.songs.push({id:'vacia',title:'Sin recurso'});
  for(let i=0;i<5;i++)config.youRoom.songs.push({id:`s${i}`,title:'X',link:'https://example.com'});
  const warn=console.warn;console.warn=()=>{};
  try{prepareConfig(config);}finally{console.warn=warn;}
  assert.ok(!config.youRoom.songs.some(song=>song.id==='vacia'));
  assert.equal(config.youRoom.songs.length,LIMITS.songs);
});
test('la estrella es una pista única e independiente del desbloqueo',()=>{
  const config=freshConfig(),store=createStore(config,memoryStorage());
  assert.equal(config.youRoom.clue.id,'you-star');
  assert.equal(config.clueIds.filter(id=>id==='you-star').length,1);
  assert.equal(store.findClue('you-star'),true);
  assert.equal(store.findClue('you-star'),false);
  assert.deepEqual(store.getProgress().discoveries.you,[]);
});
