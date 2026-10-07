const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../dist/sound.js');
class Media extends EventTarget {
  constructor(){super();this.paused=true;this.ended=false;this.volume=1;this.muted=false;this.starts=0;}
  async play(){this.starts++;this.paused=false;this.ended=false;this.dispatchEvent(new Event('playing'));}
  pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
  end(){this.ended=true;this.paused=true;this.dispatchEvent(new Event('ended'));}
}
function setup(){let time=0,next=0;const tasks=new Map(),background=new Media();const sound=create({background,volume:.2,fadeMs:100,now:()=>time,schedule:fn=>{tasks.set(++next,fn);return next;},cancel:id=>tasks.delete(id)});function advance(ms){for(let n=0;n<ms;n+=25){time+=25;const pending=[...tasks.values()];tasks.clear();pending.forEach(fn=>fn());}}return {sound,background,advance};}
test('el fondo inicia en el vestíbulo, se desvanece con un medio y vuelve al pausar o terminar',async()=>{
  const {sound,background,advance}=setup();await sound.unlock();assert.equal(background.volume,0);sound.enter();advance(50);assert.ok(background.volume>0&&background.volume<.2);advance(50);assert.equal(background.volume,.2);
  const song=new Media();await sound.play(song,{title:'Canción'});advance(100);assert.equal(background.volume,0);sound.pause(song);advance(100);assert.equal(background.volume,.2);
  await sound.play(song);advance(100);song.end();advance(100);assert.equal(background.volume,.2);assert.equal(sound.state().playing,false);
});
test('el nuevo reproductor tiene prioridad y no se recupera un medio anterior',async()=>{
  const {sound,background,advance}=setup();sound.enter();const first=new Media(),second=new Media();let disposed=0;await sound.play(first,{onStop:()=>disposed++});await sound.play(second);advance(100);
  assert.equal(first.paused,true);assert.equal(second.paused,false);assert.equal(sound.state().active,second);assert.equal(disposed,1);assert.equal(background.volume,0);
  first.end();assert.equal(sound.state().active,second);sound.stop();advance(100);assert.equal(second.paused,true);assert.equal(background.volume,.2);
});
test('silencio cubre el fondo, canciones y videos sin reiniciar su reproducción',async()=>{
  const {sound,background}=setup();sound.enter();const video=new Media();await sound.play(video,{kind:'video'});sound.setMuted(true);assert.equal(background.muted,true);assert.equal(video.muted,true);assert.equal(video.paused,false);
  sound.setMuted(false);assert.equal(video.muted,false);assert.equal(video.starts,1);sound.toggleMediaMuted(video);sound.setMuted(true);sound.setMuted(false);assert.equal(video.muted,true,'conserva el silencio propio del video');
});
test('un play pendiente anterior no puede interrumpir la nueva canción',async()=>{
  const {sound}=setup();const first=new Media(),second=new Media();let resolve;first.play=()=>new Promise(done=>{resolve=done;});const pending=sound.play(first);await sound.play(second);first.paused=false;resolve();assert.equal(await pending,null);assert.equal(first.paused,true);assert.equal(second.paused,false);
});
test('un fallo de reproducción libera el fondo',async()=>{
  const {sound,background,advance}=setup();sound.enter();const audio=new Media();audio.play=()=>Promise.reject(new Error('autoplay'));assert.equal(await sound.play(audio),false);advance(100);assert.equal(background.volume,.2);audio.dispatchEvent(new Event('error'));assert.equal(sound.state().active,null);
});
