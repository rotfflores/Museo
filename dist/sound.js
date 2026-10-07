/* Un fondo continuo y un único medio en primer plano, compartidos por todo el museo. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MuseumSound=factory();})(typeof window==='object'?window:globalThis,()=>{
  function create({background,volume=.12,muted=false,fadeMs=650,onChange=()=>{},schedule=fn=>setTimeout(fn,25),cancel=clearTimeout,now=()=>Date.now()}) {
    let active=null,entered=false,unlocked=false,ramp=null,serial=0;
    const records=new WeakMap();
    background.loop=true;background.volume=0;background.muted=muted;
    const state=()=>({muted,entered,active:active?.element||null,title:active?.title||'',kind:active?.kind||'',playing:!!active&&!active.element.ended&&(!active.element.paused||active.pending)});
    function fade(target){
      if(ramp!==null)cancel(ramp);
      const from=background.volume,start=now();
      const tick=()=>{const t=fadeMs?Math.min(1,(now()-start)/fadeMs):1;background.volume=from+(target-from)*t;if(t<1)ramp=schedule(tick);else ramp=null;};
      tick();
    }
    function sync(){fade(entered&&!muted&&!state().playing?volume:0);onChange(state());}
    function register(element,options={}){
      let record=records.get(element);
      if(record){Object.assign(record,options);return record;}
      record={element,title:'',kind:'audio',pending:false,localMuted:element.muted,...options};records.set(element,record);
      element.muted=muted||record.localMuted;
      for(const type of ['playing','pause','ended','error'])element.addEventListener(type,()=>{
        if(active!==record)return;
        if(type==='error'){stop();return;}
        if(type!=='playing')record.pending=false;
        sync();
      });
      return record;
    }
    async function unlock(){
      if(unlocked)return;
      unlocked=true;
      try{await background.play();}catch{unlocked=false;}
      sync();
    }
    function enter(){entered=true;unlock();sync();}
    function leave(){entered=false;stop();background.pause();unlocked=false;sync();}
    async function play(element,options={}){
      const record=register(element,options),ticket=++serial,previous=active;
      active=record;record.pending=true;element.muted=muted||record.localMuted;
      if(previous&&previous!==record){previous.pending=false;previous.element.pause();previous.onStop?.();}
      sync();
      // play() se llama dentro del gesto, antes de esperar cualquier fundido o promesa.
      const playing=element.play();unlock();
      try{await playing;if(ticket!==serial||active!==record){if(active!==record)element.pause();return null;}record.pending=false;sync();return true;}
      catch{if(active===record&&ticket===serial){record.pending=false;sync();}return false;}
    }
    function pause(element=active?.element){element?.pause();if(active?.element===element){active.pending=false;serial++;sync();}}
    function release(element){if(active?.element!==element)return;active=null;serial++;sync();}
    function stop(){const previous=active;active=null;serial++;if(previous){previous.pending=false;previous.element.pause();previous.onStop?.();}sync();}
    function setMuted(value){muted=!!value;background.muted=muted;if(active)active.element.muted=muted||active.localMuted;sync();}
    function toggleMediaMuted(element){const record=register(element);record.localMuted=!record.localMuted;element.muted=muted||record.localMuted;onChange(state());}
    return {state,unlock,enter,leave,play,pause,release,stop,setMuted,toggleMediaMuted};
  }
  return {create};
});
