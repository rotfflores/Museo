const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createStore,createFlagStore,prepareConfig,LIMITS}=require('../dist/progress.js');
function freshConfig(){const context={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/config.js'),'utf8'),context);return JSON.parse(JSON.stringify(context.window.MUSEUM_CONFIG));}
function memoryStorage(){const data={};return {data,getItem:key=>key in data?data[key]:null,setItem:(key,value)=>{data[key]=String(value);},removeItem:key=>{delete data[key];}};}
const FIRST_FIVE=['beginning','moments','little-things','you','future'];
function completeRoom(store,config,id){for(const piece of config.rooms.find(room=>room.id===id).pieces)store.discoverPiece(id,piece);}

test('la sala final pide revelar la obra y abrir la carta, y da un solo sello',()=>{
  const config=freshConfig(),storage=memoryStorage(),store=createStore(config,storage);
  assert.deepEqual(config.rooms.find(room=>room.id==='artwork').pieces,['obra-final','carta']);
  FIRST_FIVE.forEach(id=>completeRoom(store,config,id));
  assert.equal(store.getProgress().finalUnlocked,true);
  assert.equal(store.discoverPiece('artwork','obra-final').newlyCompleted,false,'solo la obra no basta');
  assert.equal(store.discoverPiece('artwork','carta').newlyCompleted,true);
  assert.equal(store.discoverPiece('artwork','carta').newlyCompleted,false,'sin sello duplicado');
  const restored=createStore(freshConfig(),storage).getProgress();
  assert.equal(restored.completed.length,6);
  assert.deepEqual(restored.discoveries.artwork.sort(),['carta','obra-final']);
});
test('la carta y la obra no dan el sello mientras falten salas, aunque estén todas las pistas',()=>{
  const config=freshConfig(),store=createStore(config,memoryStorage());
  config.clueIds.forEach(id=>store.findClue(id));
  ['beginning','you','future','moments'].forEach(id=>completeRoom(store,config,id));
  assert.equal(store.getProgress().finalUnlocked,false,'las pistas no abren la sala final');
  store.discoverPiece('artwork','obra-final');
  assert.equal(store.discoverPiece('artwork','carta').newlyCompleted,false);
  assert.ok(!store.getProgress().completed.includes('artwork'));
});
test('la sala se completa sin pistas: video, narración y vitrina son opcionales',()=>{
  const config=freshConfig(),store=createStore(config,memoryStorage());
  assert.equal(config.artworkRoom.video,null);
  assert.equal(config.artworkRoom.letter.audio,null);
  [...FIRST_FIVE].reverse().forEach(id=>completeRoom(store,config,id));
  completeRoom(store,config,'artwork');
  assert.equal(store.getProgress().completed.length,6);
  assert.deepEqual(store.getProgress().clues,[]);
});
test('la vitrina abierta se guarda aparte de piezas, sellos y pistas',()=>{
  const config=freshConfig(),storage=memoryStorage(),store=createStore(config,storage),vitrine=createFlagStore(config,storage,'final-vitrine');
  assert.equal(vitrine.get(),false);
  vitrine.set(true);
  assert.equal(createFlagStore(freshConfig(),storage,'final-vitrine').get(),true);
  assert.deepEqual(store.getProgress().completed,[]);
  assert.deepEqual(store.getProgress().clues,[]);
  assert.ok(Object.keys(storage.data).some(key=>key.endsWith(':final-vitrine:v1')));
});
test('la foto y el video de la sala final cuentan en los límites globales',()=>{
  const config=freshConfig();
  config.artworkRoom.video={src:'assets/sala06/dedicatoria.mp4'};
  const used=config.beginningRoom.exhibits.filter(piece=>piece.video).length+config.momentsRoom.exhibits.filter(piece=>piece.type==='video').length;
  prepareConfig(config);
  assert.equal(used<LIMITS.videos?!!config.artworkRoom.video:!config.artworkRoom.video,true);
  const crowded=freshConfig();
  for(let i=0;i<LIMITS.videos;i++)crowded.momentsRoom.exhibits.push({id:`v${i}`,type:'video',src:`v${i}.mp4`,zone:0});
  crowded.artworkRoom.video={src:'final.mp4'};
  const warn=console.warn;console.warn=()=>{};
  try{prepareConfig(crowded);}finally{console.warn=warn;}
  assert.equal(crowded.artworkRoom.video,null,'un video de más se omite sin bloquear la sala');
  assert.deepEqual(crowded.rooms.find(room=>room.id==='artwork').pieces,['obra-final','carta']);
});
test('reutilizar una fotografía ya usada no cuenta dos veces',()=>{
  const config=freshConfig(),reused=config.youRoom.centerpiece.photo;
  config.artworkRoom.centerpiece.photo=reused;
  prepareConfig(config);
  assert.equal(config.artworkRoom.centerpiece.photo,reused);
});
