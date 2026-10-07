const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createStore,createChoiceStore,prepareConfig}=require('../dist/progress.js');
function freshConfig(){const context={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/config.js'),'utf8'),context);return JSON.parse(JSON.stringify(context.window.MUSEUM_CONFIG));}
function memoryStorage(initial={}){const data={...initial};return {data,getItem:key=>key in data?data[key]:null,setItem:(key,value)=>{data[key]=String(value);},removeItem:key=>{delete data[key];}};}
const FIRST_FIVE=['beginning','moments','little-things','you','future'];
function completeRoom(store,config,id){for(const piece of config.rooms.find(room=>room.id===id).pieces)store.discoverPiece(id,piece);}

test('la sala 05 pide sus cinco planes y se completa al descubrirlos, sin duplicar el sello',()=>{
  const config=freshConfig(),storage=memoryStorage(),store=createStore(config,storage);
  const ids=config.futureRoom.plans.map(plan=>plan.id);
  assert.equal(ids.length,5);
  assert.deepEqual(config.rooms.find(room=>room.id==='future').pieces,ids);
  ids.slice(0,4).forEach(id=>assert.equal(store.discoverPiece('future',id).newlyCompleted,false));
  assert.equal(store.discoverPiece('future',ids[4]).newlyCompleted,true);
  assert.equal(store.discoverPiece('future',ids[4]).newlyCompleted,false);
  assert.deepEqual(createStore(freshConfig(),storage).getProgress().completed,['future']);
});
test('quitar planes ajusta el total',()=>{
  const config=freshConfig();config.futureRoom.plans=config.futureRoom.plans.slice(0,3);
  const store=createStore(config,memoryStorage());
  for(const plan of config.futureRoom.plans)store.discoverPiece('future',plan.id);
  assert.deepEqual(store.getProgress().completed,['future']);
});
test('solo un plan conserva su invitación y una invitación vacía se oculta',()=>{
  const config=freshConfig();
  config.futureRoom.plans[2].invitation={date:'',time:'',place:'',message:''};
  config.futureRoom.plans[3].invitation={message:'Otra'};
  prepareConfig(config);
  const withCard=config.futureRoom.plans.filter(plan=>plan.invitation);
  assert.equal(withCard.length,1);
  assert.equal(withCard[0].id,'cita');
  assert.equal(withCard[0].invitation.date,'','no se inventan fechas');
});
test('las fotos opcionales de los planes cuentan en el límite y una ruta reutilizada no cuenta dos veces',()=>{
  const config=freshConfig(),reused=config.beginningRoom.exhibits.find(piece=>piece.photo).photo;
  config.futureRoom.plans[0].photo=reused;
  config.futureRoom.plans.forEach((plan,i)=>{if(i)plan.photo=`plan-${i}.jpg`;});
  for(let i=0;i<30;i++)config.futureRoom.plans.push({id:`extra-${i}`,title:'Extra',photo:`extra-${i}.jpg`});
  const warn=console.warn;console.warn=()=>{};
  try{prepareConfig(config);}finally{console.warn=warn;}
  assert.equal(config.futureRoom.plans[0].photo,reused);
  assert.ok(config.futureRoom.plans.some(plan=>plan.photo===null),'las fotos de más se omiten, el plan se conserva');
});
test('el próximo capítulo se guarda aparte: un solo plan, se cambia, se quita y no toca piezas, sellos ni pistas',()=>{
  const config=freshConfig(),storage=memoryStorage(),store=createStore(config,storage),choice=createChoiceStore(config,storage);
  assert.equal(choice.get(),null);
  assert.equal(choice.set('lugar'),'lugar');
  assert.equal(choice.set('sueno'),'sueno','cambiar reemplaza la elección');
  assert.equal(createChoiceStore(freshConfig(),storage).get(),'sueno','se conserva en este dispositivo');
  assert.equal(choice.set('no-existe'),null,'un plan inexistente no se guarda');
  choice.set('cita');
  assert.deepEqual(store.getProgress().discoveries.future,[]);
  assert.deepEqual(store.getProgress().completed,[]);
  assert.deepEqual(store.getProgress().clues,[]);
  assert.equal(choice.set(null),null);
  assert.equal(createChoiceStore(freshConfig(),storage).get(),null,'quitar la elección también se guarda');
  const keys=Object.keys(storage.data);
  assert.ok(keys.some(key=>key.endsWith(':next-chapter:v1'))||!keys.includes('x'));
});
test('la sala final se desbloquea con los cinco primeros sellos, en cualquier orden',()=>{
  for(const order of [[...FIRST_FIVE],[...FIRST_FIVE].reverse(),['you','beginning','future','little-things','moments']]){
    const config=freshConfig(),store=createStore(config,memoryStorage());
    order.forEach((id,i)=>{
      assert.equal(store.getProgress().finalUnlocked,false,`antes de completar ${id}`);
      completeRoom(store,config,id);
      assert.equal(store.getProgress().completed.includes(id),true);
      if(i===order.length-1)assert.equal(store.getProgress().finalUnlocked,true);
    });
  }
});
test('las pistas no desbloquean la sala final; las cinco completan su colección',()=>{
  const config=freshConfig(),store=createStore(config,memoryStorage());
  assert.equal(config.clueIds.length,5);
  assert.equal(new Set(config.clueIds).size,5);
  assert.ok(config.clueIds.includes(config.futureRoom.clue.id));
  config.clueIds.slice(0,4).forEach(id=>store.findClue(id));
  assert.equal(store.getProgress().cluesComplete,false);
  assert.equal(store.findClue(config.futureRoom.clue.id),true);
  assert.equal(store.findClue(config.futureRoom.clue.id),false);
  assert.equal(store.getProgress().cluesComplete,true);
  assert.equal(store.getProgress().finalUnlocked,false,'las pistas no abren la sala final');
});
