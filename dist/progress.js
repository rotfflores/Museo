/* Almacenamiento compartido por las salas. No depende de Three.js ni del DOM. */
(function(root) {
  'use strict';
  /* Límite del paquete completo y piezas de cada sala calculadas desde su contenido:
     si se quita una pieza, el sello no pide algo imposible. */
  const LIMITS = {photos:25, videos:5, songs:5};
  function prepareConfig(config) {
    if(config.__prepared) return config;
    let photos=0, videos=0, songs=0;
    // Rutas ya usadas: reutilizar una imagen no vuelve a contar en el límite.
    const paths=new Set();
    for(const piece of config.beginningRoom?.exhibits||[]) {
      for(const key of ['screenshot','photo','chat']) if(piece[key]){ photos++; paths.add(piece[key]); }
      if(piece.video) videos++;
    }
    for(const room of config.rooms||[]) {
      const data=room.piecesFrom && config[room.piecesFrom];
      if(!data) continue;
      const seen=new Set(), dropped=[];
      // Sala de retratos: cada retrato es una pieza y la obra central, la última. Las canciones son opcionales.
      if(Array.isArray(data.portraits)) {
        const photo=item=>{ if(!item.photo) return; if(paths.has(item.photo)) return; if(photos<LIMITS.photos){photos++;paths.add(item.photo);} else {dropped.push(`${item.id} (foto)`);item.photo=null;} };
        data.portraits=data.portraits.filter(piece=>{ if(!piece||!piece.id||seen.has(piece.id)) return false; seen.add(piece.id); photo(piece); return true; });
        if(data.centerpiece?.id&&!seen.has(data.centerpiece.id)) photo(data.centerpiece); else if(data.centerpiece) data.centerpiece=null;
        data.songs=(Array.isArray(data.songs)?data.songs:[]).filter(song=>{ if(!song||!song.id||!(song.audio||song.link)) return false; if(songs>=LIMITS.songs){dropped.push(song.id);return false;} songs++; return true; });
        if(dropped.length && typeof console!=='undefined') console.warn(`Límites del museo: se omiten ${dropped.join(', ')}.`);
        room.pieces=[...data.portraits.map(piece=>piece.id),...(data.centerpiece?[data.centerpiece.id]:[])];
        continue;
      }
      // Sala de planes: cada plan es una pieza. Solo un plan conserva su invitación opcional.
      if(Array.isArray(data.plans)) {
        let invitation=false;
        data.plans=data.plans.filter(piece=>{
          if(!piece||!piece.id||seen.has(piece.id)) return false;
          seen.add(piece.id);
          if(piece.photo){ if(paths.has(piece.photo)) {} else if(photos<LIMITS.photos) {photos++;paths.add(piece.photo);} else {piece.photo=null;dropped.push(`${piece.id} (foto)`);} }
          const card=piece.invitation;
          const filled=card&&['date','time','place','message'].some(key=>String(card[key]||'').trim());
          piece.invitation=filled&&!invitation?card:null;
          if(filled) invitation=true;
          return true;
        });
        if(dropped.length && typeof console!=='undefined') console.warn(`Límite de ${LIMITS.photos} fotos: se omiten ${dropped.join(', ')}.`);
        room.pieces=data.plans.map(piece=>piece.id);
        continue;
      }
      // Salas de objetos: cada objeto es una pieza; su foto complementaria cuenta en el límite de fotos.
      if(Array.isArray(data.objects)) {
        data.objects=data.objects.filter(piece=>{
          if(!piece||!piece.id||seen.has(piece.id)) return false;
          const needsPhoto=piece.object==='photo';
          if(needsPhoto&&(!piece.photo||photos>=LIMITS.photos)){dropped.push(piece.id);return false;}
          if(piece.photo){ if(paths.has(piece.photo)) {} else if(photos<LIMITS.photos) {photos++;paths.add(piece.photo);} else {piece.photo=null;dropped.push(`${piece.id} (foto)`);} }
          seen.add(piece.id);
          return true;
        });
        if(dropped.length && typeof console!=='undefined') console.warn(`Límite de ${LIMITS.photos} fotos: se omiten ${dropped.join(', ')}.`);
        room.pieces=data.objects.map(piece=>piece.id);
        continue;
      }
      data.exhibits=(Array.isArray(data.exhibits)?data.exhibits:[]).filter(piece=>{
        if(!piece||!piece.id||seen.has(piece.id)||!['photo','video'].includes(piece.type)) return false;
        const isVideo=piece.type==='video';
        if(isVideo?videos>=LIMITS.videos:photos>=LIMITS.photos){dropped.push(piece.id);return false;}
        seen.add(piece.id); if(isVideo) videos++; else {photos++; if(piece.src) paths.add(piece.src);}
        return true;
      });
      if(dropped.length && typeof console!=='undefined') console.warn(`Límite de ${LIMITS.photos} fotos y ${LIMITS.videos} videos: se omiten ${dropped.join(', ')}.`);
      room.pieces=data.exhibits.map(piece=>piece.id);
    }
    Object.defineProperty(config,'__prepared',{value:true});
    return config;
  }
  function createStore(config, storage) {
    prepareConfig(config);
    const key = `museum-of-us:${config.id}:v1`;
    let saved = {};
    try { saved = JSON.parse(storage?.getItem(key) || '{}') || {}; } catch { /* La visita funciona sin almacenamiento. */ }
    const discoveries = {};
    for(const room of config.rooms) {
      const previous = saved.discoveries?.[room.id];
      discoveries[room.id] = new Set(Array.isArray(previous) ? previous.filter(id=>room.pieces?.includes(id)) : []);
    }
    const state = {
      entered:saved.entered===true,
      soundPreferred:saved.soundPreferred===true,
      tutorialSeen:saved.tutorialSeen===true,
      tutorialRoomSeen:saved.tutorialRoomSeen===true,
      discoveries,
      completed:new Set(Array.isArray(saved.completed) ? saved.completed.filter(id=>{
        const room=config.rooms.find(item=>item.id===id);
        return room && (!room.pieces || room.pieces.every(piece=>discoveries[id].has(piece)));
      }) : []),
      clues:new Set(Array.isArray(saved.clues) ? saved.clues.filter(id=>config.clueIds?.includes(id)) : [])
    };
    // Recupera un cierre inesperado después de guardar la tercera pieza.
    for(const room of config.rooms) if(room.pieces?.length && room.pieces.every(id=>discoveries[room.id].has(id))) state.completed.add(room.id);
    const finalRoom = config.rooms.find(room=>room.requires);
    const finalUnlocked = () => !!finalRoom && finalRoom.requires.every(id=>state.completed.has(id));
    const cluesComplete = () => !!config.clueIds?.length && config.clueIds.every(id=>state.clues.has(id));
    const getProgress = () => ({entered:state.entered,completed:[...state.completed],clues:[...state.clues],cluesComplete:cluesComplete(),finalUnlocked:finalUnlocked(),discoveries:Object.fromEntries(Object.entries(discoveries).map(([id,set])=>[id,[...set]]))});
    function save() {
      try { storage?.setItem(key,JSON.stringify({...getProgress(),soundPreferred:state.soundPreferred,tutorialSeen:state.tutorialSeen,tutorialRoomSeen:state.tutorialRoomSeen})); } catch { /* Memoria de sesión como alternativa. */ }
    }
    function completeRoom(id) {
      const room=config.rooms.find(item=>item.id===id);
      if(!room || state.completed.has(id) || (room.requires && !room.requires.every(required=>state.completed.has(required))) || (room.pieces && !room.pieces.every(piece=>discoveries[id].has(piece)))) return false;
      state.completed.add(id); save(); return true;
    }
    function discoverPiece(roomId,pieceId) {
      const room=config.rooms.find(item=>item.id===roomId);
      if(!room?.pieces?.includes(pieceId)) return {added:false,newlyCompleted:false};
      const added=!discoveries[roomId].has(pieceId);
      discoveries[roomId].add(pieceId);
      const newlyCompleted=completeRoom(roomId);
      save();
      return {added,newlyCompleted};
    }
    function findClue(id) {
      if(!config.clueIds?.includes(id) || state.clues.has(id)) return false;
      state.clues.add(id); save(); return true;
    }
    return {state,save,getProgress,discoverPiece,completeRoom,findClue,finalUnlocked,cluesComplete};
  }
  /* El próximo capítulo elegido en la sala 05: solo en este dispositivo y separado de piezas, sellos y pistas. */
  function createChoiceStore(config, storage) {
    const key = `museum-of-us:${config.id}:next-chapter:v1`;
    const valid = id => !!config.futureRoom?.plans?.some(plan=>plan.id===id);
    let current = null;
    try { const saved=storage?.getItem(key); current = valid(saved) ? saved : null; } catch { /* Sin almacenamiento: solo esta visita. */ }
    return {
      get: () => current,
      set(id) {
        current = valid(id) ? id : null;
        try { if(current) storage?.setItem(key,current); else storage?.removeItem?.(key); } catch { /* Memoria de sesión. */ }
        return current;
      }
    };
  }
  root.MuseumProgress={createStore,createChoiceStore,prepareConfig,LIMITS};
  if(typeof module!=='undefined' && module.exports) module.exports={createStore,createChoiceStore,prepareConfig,LIMITS};
})(globalThis);
