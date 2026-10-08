const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {prepareConfig}=require('../dist/progress.js');
const {build,shareText,whatsappUrl}=require('../dist/summary-data.js');
function config(){const context={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/config.js'),'utf8'),context);return prepareConfig(JSON.parse(JSON.stringify(context.window.MUSEUM_CONFIG)));}
function progress(c,full=false){return {completed:full?c.rooms.map(room=>room.id):[],discoveries:Object.fromEntries(c.rooms.map(room=>[room.id,full?room.pieces:[]])),clues:full?c.clueIds:[],cluesComplete:full,finalUnlocked:full};}
test('el resumen reúne el plan guardado, las canciones, la obra, la carta y la sorpresa',()=>{
  const c=config(),s=build(c,progress(c,true),c.futureRoom.plans[1].id),text=shareText(s,'https://rotfflores.github.io/Museo/');
  assert.equal(s.complete,true);assert.equal(s.plan.title,c.futureRoom.plans[1].title);assert.equal(s.rooms.length,6);
  assert.ok(text.includes(c.futureRoom.plans[1].dedication));
  for(const song of c.youRoom.songs.filter(song=>song.audio||song.link))assert.ok(text.includes(song.title));
  assert.ok(text.includes(c.artworkRoom.centerpiece.dedication));assert.ok(text.includes(c.artworkRoom.letter.body[0]));assert.ok(text.includes(c.artworkRoom.vitrine.message));
});
test('la imagen y WhatsApp no revelan la obra, la carta o la sorpresa antes de desbloquearlas',()=>{
  const c=config(),s=build(c,progress(c)),text=shareText(s,'https://example.com');
  assert.equal(s.plan,null);assert.equal(s.complete,false);assert.equal(s.giftUnlocked,false);
  assert.ok(!text.includes(c.artworkRoom.centerpiece.dedication));assert.ok(!text.includes(c.artworkRoom.letter.body[0]));assert.ok(!text.includes(c.artworkRoom.vitrine.message));
  assert.equal(s.sections[3].photo,null);assert.equal(s.sections[5].photo,null);
});
test('la sorpresa necesita todas las pistas y la última sala disponible',()=>{
  const c=config(),p=progress(c,true);p.cluesComplete=false;assert.equal(build(c,p).giftUnlocked,false);
  p.cluesComplete=true;p.finalUnlocked=false;assert.equal(build(c,p).giftUnlocked,false);
  p.finalUnlocked=true;assert.equal(build(c,p).giftUnlocked,true);
});
test('WhatsApp usa el número indicado y conserva acentos y contenido al codificar el resumen',()=>{
  const c=config(),s=build(c,progress(c,true),c.futureRoom.plans[0].id),url=new URL(whatsappUrl(s,'https://rotfflores.github.io/Museo/'));
  assert.equal(url.hostname,'wa.me');assert.equal(url.pathname,'/526182051723');assert.equal(url.searchParams.get('text'),shareText(s,'https://rotfflores.github.io/Museo/'));
});
