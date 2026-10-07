/* Almacenamiento compartido por las salas. No depende de Three.js ni del DOM. */
(function(root) {
  'use strict';
  function createStore(config, storage) {
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
      discoveries,
      completed:new Set(Array.isArray(saved.completed) ? saved.completed.filter(id=>{
        const room=config.rooms.find(item=>item.id===id);
        return room && (!room.pieces || room.pieces.every(piece=>discoveries[id].has(piece)));
      }) : []),
      clues:new Set(Array.isArray(saved.clues) ? saved.clues.filter(id=>config.clueIds?.includes(id)) : [])
    };
    // Recupera un cierre inesperado después de guardar la tercera pieza.
    for(const room of config.rooms) if(room.pieces?.length && room.pieces.every(id=>discoveries[room.id].has(id))) state.completed.add(room.id);
    const getProgress = () => ({entered:state.entered,completed:[...state.completed],clues:[...state.clues],discoveries:Object.fromEntries(Object.entries(discoveries).map(([id,set])=>[id,[...set]]))});
    function save() {
      try { storage?.setItem(key,JSON.stringify({...getProgress(),soundPreferred:state.soundPreferred,tutorialSeen:state.tutorialSeen})); } catch { /* Memoria de sesión como alternativa. */ }
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
    return {state,save,getProgress,discoverPiece,completeRoom,findClue};
  }
  root.MuseumProgress={createStore};
  if(typeof module!=='undefined' && module.exports) module.exports={createStore};
})(globalThis);
