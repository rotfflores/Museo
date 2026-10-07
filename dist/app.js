(() => {
  'use strict';
  const config = window.MUSEUM_CONFIG;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const format = text => text.replace(/\{(sender|recipient)\}/g, (_, name) => config[name]);
  let storage;
  try { storage=window.localStorage; } catch { /* Acceso restringido: conservar en memoria. */ }
  const progressStore=window.MuseumProgress.createStore(config,storage);
  const state=progressStore.state;
  let screen = 'invitation', transitioning = false, opener = null, noticeTimer, invitationTimer;
  const roomHandlers = new Map();
  function save() {
    progressStore.save();
  }
  const sharedDock=$('#lobby-dock');$('#main').append(sharedDock);
  const miniPlayer=document.createElement('section');miniPlayer.className='museum-player';miniPlayer.hidden=true;miniPlayer.setAttribute('aria-label','Canción en reproducción');
  miniPlayer.innerHTML='<span id="museum-player-title"></span><button id="museum-player-toggle" type="button" aria-label="Pausar canción">Ⅱ</button><button id="museum-player-stop" type="button" aria-label="Detener canción">×</button>';
  $('#main').append(miniPlayer);
  function updatePassportCount() {
    $('#passport-preview-count').textContent=`${state.completed.size}/6`;
    $('#open-passport').setAttribute('aria-label',`Pasaporte de recuerdos, ${state.completed.size} de 6 salas completadas`);
  }
  function progressChanged() {
    updatePassportCount();
    document.dispatchEvent(new CustomEvent('museum:progress'));
  }
  function notify(message) {
    clearTimeout(noticeTimer);
    (dialog.open ? dialog : document.body).append($('#notice'));
    $('#notice-text').textContent = message;
    $('#notice').hidden = false;
    noticeTimer = setTimeout(() => { $('#notice').hidden = true; }, 7000);
  }
  function showScreen(next, focus = true) {
    clearTimeout(invitationTimer);
    screen = next;
    const inMuseum=['lobby','room','moments','little-things','you'].includes(next);
    sharedDock.hidden=!inMuseum;$('#museum-back').hidden=next==='lobby';sharedDock.setAttribute('aria-label','Navegación del museo');
    if(next==='lobby')sound.enter();else if(!inMuseum)sound.leave();
    miniPlayer.hidden=!inMuseum||sound.state().kind!=='audio'||!sound.state().active;
    for (const [name, id] of [['invitation','invitation'],['ticket','ticket-screen'],['lobby','lobby'],['room','room-screen'],['moments','moments-screen'],['little-things','little-screen'],['you','you-screen']]) $(`#${id}`).hidden = name !== next;
    const labels = {invitation:'01 <span class="footer-line"></span> LA INVITACIÓN',ticket:'02 <span class="footer-line"></span> TU ENTRADA',lobby:'03 <span class="footer-line"></span> EL VESTÍBULO'};
    labels.room='04 <span class="footer-line"></span> AQUÍ COMENZÓ TODO';
    labels.moments='05 <span class="footer-line"></span> MOMENTOS QUE SE QUEDARON';
    labels.you='07 <span class="footer-line"></span> ASÍ TE VEO YO';
    labels['little-things']='06 <span class="footer-line"></span> PEQUEÑAS COSAS, GRANDES RECUERDOS';
    $('#stage-label').innerHTML = labels[next];
    document.body.classList.toggle('lobby-view',next==='lobby');
    // Las salas comparten el mismo diseño a pantalla completa.
    document.body.classList.toggle('room-view',next==='room'||next==='moments'||next==='little-things'||next==='you');
    window.scrollTo({top:0,behavior:'instant'});
    document.dispatchEvent(new CustomEvent('museum:screen',{detail:next}));
    if (focus) {
      const heading = $(`#${next === 'ticket' ? 'ticket-screen' : next === 'room' ? 'room-screen' : next === 'moments' ? 'moments-screen' : next === 'little-things' ? 'little-screen' : next === 'you' ? 'you-screen' : next} h1`);
      heading.setAttribute('tabindex','-1');
      heading.focus({preventScroll:true});
    }
  }
  function resetInvitation(showResume = true) {
    clearTimeout(invitationTimer);
    $('#invitation').classList.remove('has-letter');
    $('#envelope-wrap').classList.remove('opening');
    $('#envelope').disabled = false;
    $('#envelope').setAttribute('aria-expanded','false');
    $('#letter').hidden = true;
    $('#return-visit').hidden = !(showResume && state.entered);
    $('#envelope-wrap').hidden = showResume && state.entered;
    showScreen('invitation');
  }
  function openInvitation() {
    $('#envelope').disabled = true;
    $('#envelope').setAttribute('aria-expanded','true');
    $('#envelope-wrap').classList.add('opening');
    invitationTimer = setTimeout(() => {
      $('#envelope-wrap').hidden = true;
      $('#invitation').classList.add('has-letter');
      $('#letter').hidden = false;
      $('#letter').focus({preventScroll:true});
    }, reducedMotion.matches ? 0 : 1350);
  }
  function ticketMarkup() {
    return `<article class="ticket" aria-label="Boleto personalizado"><div class="ticket-main"><div class="ticket-top"><span>EXPOSICIÓN PRIVADA · ENTRADA PERSONAL</span><svg class="icon" aria-hidden="true"><use href="#icon-ticket"/></svg></div><h2>El Museo de Nosotros</h2><p class="ticket-description">${escape(config.texts.ticketDescription)}</p><p class="ticket-couple">${escape(config.couple)}</p><div class="ticket-details"><p><small>CELEBRAMOS</small>${escape(config.celebration)}</p><p><small>FECHA</small>${escape(config.date)}</p></div><p class="ticket-admission">${escape(config.texts.ticketAdmission)}</p></div><div class="ticket-stub"><span class="eyebrow">UNA HISTORIA IRREPETIBLE</span><span class="stub-monogram">${escape(config.initials)}</span><span class="barcode" aria-hidden="true"></span><span class="ticket-number">Nº ${escape(config.ticketNumber)}</span></div></article>`;
  }
  const doorLines=['Preparando tu visita…','Encendiendo las luces…','Todo está listo para ti.'];
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  // La escena avisa tras su primer cuadro; si no hay 3D, el aviso llega de inmediato o se espera como máximo 4 s.
  function sceneReady() {
    if(window.MuseumScene?.ready) return Promise.resolve();
    return Promise.race([new Promise(resolve=>document.addEventListener('museum:scene-ready',resolve,{once:true})),wait(4000)]);
  }
  // Puertas con nota: cubren la pantalla, cambian lo que hay detrás y se abren cuando la escena está lista (máximo 4 s).
  let doorsBusy=false;
  async function playDoors({lines,cover,ready,minimum=1900,variant='',plate=null,label=null,title=null}) {
    if(doorsBusy) return false;
    doorsBusy=true;
    const doors = $('#door-transition'), line=$('#door-note-line');
    doors.classList.remove('open','ready','loading');
    // Cada sala puede tener su propia puerta y su propia placa.
    doors.dataset.variant=variant;
    $('#door-monogram').textContent=plate||config.initials;
    $('#door-room-label').textContent=label||(variant==='room-01'?'SALA 01 · LOS COMIENZOS':'EL MUSEO DE NOSOTROS');
    $('#door-room-title').textContent=title||(variant==='room-01'?config.beginningRoom.title:'Una historia para recorrer.');
    line.textContent=lines[0];
    doors.hidden = false;
    $('#main').inert = true;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    doors.classList.add('loading');
    try { await cover?.(); } catch { /* La escena detrás de las puertas tiene su propia alternativa. */ }
    let index=0;
    const ticker=setInterval(()=>{index=Math.min(index+1,lines.length-1);line.textContent=lines[index];},900);
    await Promise.all([Promise.race([Promise.resolve(ready?.()),wait(4000)]),wait(reducedMotion.matches?300:minimum)]);
    clearInterval(ticker);
    line.textContent=lines[lines.length-1];
    doors.classList.add('ready');
    await wait(reducedMotion.matches?0:450);
    doors.classList.add('open');
    await wait(reducedMotion.matches?0:1700);
    doors.hidden = true;
    doors.classList.remove('open','ready','loading');
    $('#main').inert = false;
    doorsBusy=false;
    return true;
  }
  // Volver desde una sala: la puerta del museo se cierra, cambia la escena y se abre en el vestíbulo.
  async function returnToLobby() {
    if(screen!=='room'&&screen!=='moments'&&screen!=='little-things'&&screen!=='you'){showScreen('lobby');return;}
    if(dialog.open) closeDialog();
    const opened=await playDoors({lines:['Cerrando la sala…','Volviendo al vestíbulo…','Bienvenida de nuevo.'],cover:()=>showScreen('lobby',false),ready:()=>null,minimum:1100,label:'EL MUSEO DE NOSOTROS',title:'El vestíbulo'});
    if(opened){$('#lobby-title').setAttribute('tabindex','-1');$('#lobby-title').focus({preventScroll:true});} else showScreen('lobby');
  }
  async function enterMuseum() {
    if (transitioning) return;
    transitioning = true;
    $('#enter-museum').disabled = true;
    sound.unlock();
    state.entered = true;
    save();
    await playDoors({lines:doorLines,cover:()=>showScreen('lobby', false),ready:sceneReady});
    $('#enter-museum').disabled = false;
    transitioning = false;
    showScreen('lobby');
    if(!state.tutorialSeen) openTutorial($('#replay-tutorial'));
  }
  function noteMarkup() {
    return `<article class="welcome-plaque note-plaque"><span class="plaque-screw top-left"></span><span class="plaque-screw top-right"></span><p class="eyebrow">UNA NOTA PARA TI</p><h2 id="dialog-title">${escape(format(config.texts.welcomeTitle))}</h2><p>${escape(format(config.texts.welcomeBody))}</p><p class="signature">${escape(format(config.texts.welcomeSignature))}</p><span class="plaque-screw bottom-left"></span><span class="plaque-screw bottom-right"></span></article>`;
  }
  // Mini tutorial de gestos: tres pasos con una mano animada.
  const coarsePointer=window.matchMedia('(pointer: coarse)');
  function tutorialSteps(kind) {
    const touch=coarsePointer.matches;
    if(kind==='room') return [
      {scene:'piece',title:'Toca una pieza para acercarte',text:'La cámara se desliza hasta la vitrina, el cuadro o los anillos, y el recuerdo se abre al llegar.'},
      {scene:'floor',title:'Toca el suelo para caminar',text:touch?'Llegas a ese punto rodeando los muebles. Arrastra para mirar y desliza hacia abajo para dar un paso atrás.':'Llegas a ese punto rodeando los muebles. También puedes usar W, A, S, D o las flechas; Escape da un paso atrás.'},
      {scene:'swipe',title:'Muévete a tu ritmo',text:touch?'Mientras contemplas una pieza, desliza hacia la izquierda para avanzar o hacia la derecha para volver.':'Arrastra para desplazar la escena, como una fotografía. Usa < y > para cambiar de pieza.'}
    ];
    return [
      {scene:'look',title:'Arrastra para mirar alrededor',text:touch?'Arrastra para desplazar la escena, como una fotografía. La escena sigue el movimiento de tu dedo.':'Mantén pulsado el mouse y arrastra: la escena sigue tu movimiento.'},
      {scene:'door',title:'Toca una puerta para entrar a una sala',text:'La cámara vuela hasta ella y la cruza contigo. Dentro, toca una pieza para acercarte.'},
      {scene:'heart',title:'Toca el corazón para ver tu pasaporte',text:touch?'Ahí se guardan los sellos de cada sala. Desliza hacia arriba desde el menú inferior para abrir el mapa.':'Ahí se guardan los sellos de cada sala. El menú inferior tiene tu nota, el mapa y tu boleto.'}
    ];
  }
  const tutorialArt={
    look:'<svg viewBox="0 0 220 120"><path d="M20 108V58a22 22 0 0 1 44 0v50M88 108V48a22 22 0 0 1 44 0v60M156 108V58a22 22 0 0 1 44 0v50"/><path class="tutorial-floor" d="M6 108h208"/></svg>',
    door:'<svg viewBox="0 0 220 120"><path d="M80 110V50a30 30 0 0 1 60 0v60"/><path class="tutorial-glow" d="M90 110V52a20 20 0 0 1 40 0v58Z"/><path class="tutorial-floor" d="M30 110h160"/></svg>',
    piece:'<svg viewBox="0 0 220 120"><path d="M84 110V78h52v32M78 78h64M86 78V46h48v32"/><path class="tutorial-glow" d="M90 76V50h40v26Z"/><path class="tutorial-floor" d="M30 110h160"/></svg>',
    floor:'<svg viewBox="0 0 220 120"><path d="M40 40h140M40 40v60M180 40v60"/><ellipse class="tutorial-floor" cx="110" cy="100" rx="86" ry="14"/><ellipse class="tutorial-glow" cx="110" cy="100" rx="18" ry="5"/></svg>',
    swipe:'<svg viewBox="0 0 220 120"><path d="M22 34h50v50H22ZM85 26h50v66H85ZM148 34h50v50h-50Z"/><path class="tutorial-floor" d="M14 108h192"/></svg>',
    heart:'<svg viewBox="0 0 220 120"><path class="tutorial-heart" d="M110 92c-26-17-38-30-38-45 0-11 8-19 18-19 9 0 15 5 20 13 5-8 11-13 20-13 10 0 18 8 18 19 0 15-12 28-38 45Z"/><path class="tutorial-floor" d="M70 108h80"/></svg>'
  };
  function tutorialSeen(kind){return kind==='room'?state.tutorialRoomSeen:state.tutorialSeen;}
  function openTutorial(source,kind='lobby') {
    const steps=tutorialSteps(kind);let step=0;
    const render=()=>{
      const item=steps[step],last=step===steps.length-1;
      $('#dialog-content').innerHTML=`<div class="tutorial" data-scene="${item.scene}"><p class="eyebrow">CÓMO MOVERTE · ${step+1} DE ${steps.length}</p><div class="tutorial-stage" aria-hidden="true">${tutorialArt[item.scene]}<span class="tutorial-finger"><i></i></span></div><h2 id="dialog-title">${item.title}</h2><p class="tutorial-text">${item.text}</p><div class="tutorial-dots" aria-hidden="true">${steps.map((_,index)=>`<i class="${index===step?'on':''}"></i>`).join('')}</div><div class="tutorial-actions"><button class="text-button" data-tutorial="skip" type="button">Saltar</button><button class="button primary" data-tutorial="${last?'done':'next'}" type="button">${last?'Entendido':'Siguiente'}</button></div></div>`;
      $('[data-tutorial="next"],[data-tutorial="done"]',dialog).focus();
    };
    openContent({className:'tutorial-dialog',source,html:'',onClose:()=>{if(kind==='room')state.tutorialRoomSeen=true;else state.tutorialSeen=true;save();}});
    render();
    $('#dialog-content').onclick=event=>{
      const action=event.target.closest('[data-tutorial]')?.dataset.tutorial;
      if(action==='next'){step++;render();}
      else if(action==='skip'||action==='done')closeDialog();
    };
  }
  function passportMarkup() {
    const count = state.completed.size;
    return `<div class="dialog-heading"><h2 id="dialog-title">Pasaporte de recuerdos</h2><p>Lo que vivimos, para llevarlo siempre contigo.</p></div><div class="passport-spread"><div class="passport-page"><p class="eyebrow">ESTE PASAPORTE PERTENECE A</p><svg class="passport-flower" aria-hidden="true"><use href="#icon-flower"/></svg><p class="passport-name">${escape(config.recipient)}</p><p class="passport-pair">${escape(config.couple)}</p><p class="passport-date">${escape(config.date)}</p><p class="passport-count">${count} de 6 salas completadas</p><p class="passport-message">${escape(config.texts.passportMessage)}</p></div><div class="passport-page"><p class="eyebrow">LOS SELLOS DE NUESTRA HISTORIA</p><div class="stamp-grid">${config.rooms.map((room,i) => `<div class="stamp-slot ${state.completed.has(room.id)?'completed':''}"><div class="stamp-outline" aria-label="Sala ${i+1}: ${state.completed.has(room.id)?'completada':'sin sello'}">${state.completed.has(room.id)?'✧':String(i+1).padStart(2,'0')}</div><small>${escape(room.title)}</small></div>`).join('')}</div></div></div>`;
  }
  function mapMarkup() {
    return `<div class="dialog-heading"><h2 id="dialog-title">Mapa del museo</h2><p>Todos los caminos nos llevan a nosotros.</p></div><div class="map-sheet"><div class="map-north" aria-hidden="true">N<br>↑</div><div class="floorplan">${config.rooms.map((room,i) => `<button class="room-access ${room.requires && !room.requires.every(id=>state.completed.has(id)) ? 'locked':''}" data-room="${escape(room.id)}" ${room.requires ? `aria-describedby="room-lock-explanation"` : ''}><span class="room-number">${String(i+1).padStart(2,'0')}</span><span>${escape(room.title)}</span>${room.requires && !room.requires.every(id=>state.completed.has(id)) ? '<svg class="icon" aria-hidden="true"><use href="#icon-lock"/></svg>' : ''}</button>`).join('')}<div class="you-are-here"><b aria-hidden="true"></b>ESTÁS AQUÍ<span>Vestíbulo</span></div></div><p class="map-legend" id="room-lock-explanation"><svg class="icon" aria-hidden="true"><use href="#icon-lock"/></svg><span>Sala 06 · ${escape(config.texts.lockedRoom)}</span></p></div><p class="map-footnote">Las salas abrirán pronto. Por ahora, disfruta del comienzo.</p>`;
  }
  const dialog = $('#museum-dialog');
  let dialogCleanup=null;
  function cleanupDialog() {
    $('#dialog-content').onclick=null;
    dialog.querySelectorAll('audio,video').forEach(media=>{media.pause();try{media.currentTime=0;}catch{}});
    const callback=dialogCleanup; dialogCleanup=null; callback?.();
  }
  function openContent({html,className='',source=null,onClose=null}) {
    cleanupDialog(); opener=source; dialogCleanup=onClose;
    $('#dialog-content').className=className;
    $('#dialog-content').innerHTML=html;
    if(!dialog.open) dialog.showModal();
    document.dispatchEvent(new CustomEvent('museum:overlay',{detail:true}));
    dialog.scrollTop=0;
    $('#close-dialog').focus();
  }
  function openDialog(type, source) {
    cleanupDialog();
    opener = source;
    $('#dialog-content').className = type === 'ticket' ? 'dialog-ticket' : '';
    $('#dialog-content').innerHTML = type === 'map' ? mapMarkup() : type === 'passport' ? passportMarkup() : `<div class="dialog-heading"><h2 id="dialog-title">Tu entrada, para siempre</h2><p>Esta historia tiene un lugar reservado para ti.</p></div>${ticketMarkup()}`;
    if(type==='map') {
      $('.you-are-here span',dialog).textContent=screen==='room'?'Sala 01 · Aquí comenzó todo':screen==='moments'?'Sala 02 · Momentos que se quedaron':screen==='little-things'?'Sala 03 · Pequeñas cosas, grandes recuerdos':screen==='you'?'Sala 04 · Así te veo yo':'Vestíbulo';
      const open=config.rooms.filter(room=>roomHandlers.has(room.id)).map(room=>room.title.replace(/\.$/,''));
      $('.map-footnote',dialog).textContent=open.length>1?`${open.slice(0,-1).join(', ')} y ${open.at(-1)} están abiertas. Las otras salas abrirán pronto.`:`${open[0]||'La primera sala'} está abierta. Las otras salas abrirán pronto.`;
      dialog.querySelectorAll('[data-room]').forEach(button=>{
        if(roomHandlers.has(button.dataset.room)) {
          button.classList.add('available');
          $('.room-number',button).textContent+=state.completed.has(button.dataset.room)?' · ✧':' · ABIERTA';
        }
      });
    }
    if(type==='passport') {
      const counter=document.createElement('p');counter.className='passport-clues';counter.textContent=`Pistas encontradas: ${state.clues.size} de 5`;
      $('.passport-page',dialog).append(counter);
    }
    if(!dialog.open) dialog.showModal();
    document.dispatchEvent(new CustomEvent('museum:overlay',{detail:true}));
    dialog.scrollTop = 0;
    $('#close-dialog').focus();
  }
  function closeDialog() { dialog.close(); }
  dialog.addEventListener('close',()=> {
    if(dialog.open) return;
    cleanupDialog();
    document.dispatchEvent(new CustomEvent('museum:overlay',{detail:false}));
    $('#notice').hidden = true; document.body.append($('#notice'));
    if(opener?.offsetParent!==null) opener?.focus({preventScroll:true});
  });
  dialog.addEventListener('click',event=> {
    if (event.target === dialog) { const rect=dialog.getBoundingClientRect(); if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) closeDialog(); }
    const button = event.target.closest('[data-room]');
    if(button) visitRoom(button.dataset.room);
  });
  async function visitRoom(id) {
    const room = config.rooms.find(item=>item.id===id);
    if(!room) return;
    if(!roomHandlers.has(id)) { notify(config.texts.roomSoon); return; }
    if(room.requires && !room.requires.every(item=>state.completed.has(item))) { notify(config.texts.lockedRoom); return; }
    closeDialog();
    try {
      const result = await roomHandlers.get(id)({config, returnToLobby});
      if(result?.completed === true && progressStore.completeRoom(id)) progressChanged();
    } catch { notify(config.texts.roomSoon); }
  }
  /* Próximas entregas: registrar una sala que resuelva { completed: true }
     únicamente al finalizar su experiencia. Visitar el mapa nunca da sellos. */
  window.Museum = Object.freeze({
    registerRoom(id, handler) { if(config.rooms.some(room=>room.id===id) && typeof handler==='function') roomHandlers.set(id,handler); },
    openRoom:visitRoom,
    getProgress:progressStore.getProgress,
    showRoom:()=>showScreen('room'),
    showView:name=>showScreen(name),
    playMedia:(element,options)=>sound.play(element,options),
    pauseMedia:element=>sound.pause(element),
    releaseMedia:element=>sound.release(element),
    toggleVideoSound:element=>sound.toggleMediaMuted(element),
    bindAudioButton,
    audioPlaying:src=>{const state=sound.state();return state.kind==='audio'&&state.playing&&state.active?.getAttribute('src')===src;},
    openContent,
    closeOverlay:closeDialog,
    notify,
    discoverPiece:(roomId,pieceId)=>{
      if(!roomHandlers.has(roomId)) return {added:false,newlyCompleted:false};
      const result=progressStore.discoverPiece(roomId,pieceId);
      if(result.added || result.newlyCompleted) progressChanged();
      return result;
    },
    findClue:id=>{const added=progressStore.findClue(id);if(added)progressChanged();return added;},
    returnToLobby,
    playDoors,
    openTutorial:(kind,source)=>openTutorial(source,kind),
    tutorialSeen,
    openMap:source=>openDialog('map',source||$('#open-map')),
    openPassport:source=>openDialog('passport',source||$('#open-passport'))
  });
  let muted=false;try{muted=storage?.getItem('museum-sound-muted')==='1';}catch{}
  const background=new Audio(config.resources.ambientAudio);background.preload='none';background.hidden=true;background.id='museum-background';document.body.append(background);
  const sound=window.MuseumSound.create({background,volume:config.resources.volume,muted,onChange:renderSound});
  function renderSound(state) {
    const button=$('#ambient-toggle');button.setAttribute('aria-pressed',String(state.muted));button.setAttribute('aria-label',state.muted?'Activar todo el sonido':'Silenciar todo el sonido');$('span',button).textContent=state.muted?'Silencio':'Sonido';
    document.querySelectorAll('[data-audio-src]').forEach(control=>{control.textContent=state.kind==='audio'&&state.active?.getAttribute('src')===control.dataset.audioSrc&&state.playing?'Ⅱ Pausar':control.dataset.audioLabel;});
    miniPlayer.hidden=!['lobby','room','moments','little-things','you'].includes(screen)||!state.active||state.kind!=='audio';
    $('#museum-player-title').textContent=state.title;
    $('#museum-player-toggle').textContent=state.playing?'Ⅱ':'▶';$('#museum-player-toggle').setAttribute('aria-label',state.playing?'Pausar canción':'Reproducir canción');
  }
  function bindAudioButton(button,{src,title,label='▶ Escuchar',status=null}) {
    if(!button||!src)return;button.dataset.audioSrc=src;button.dataset.audioLabel=label;renderSound(sound.state());
    button.addEventListener('click',async()=>{
      let current=sound.state(),audio=current.kind==='audio'&&current.active?.getAttribute('src')===src?current.active:null;
      if(audio&&current.playing){sound.pause(audio);return;}
      if(!audio){audio=new Audio(src);audio.preload='none';audio.hidden=true;audio.className='museum-audio-source';document.body.append(audio);}
      const started=await sound.play(audio,{title,kind:'audio',onStop:()=>{audio.pause();audio.removeAttribute('src');audio.load();audio.remove();}});
      if(started===false&&sound.state().active===audio){if(status?.isConnected)status.textContent='No se pudo reproducir el audio.';sound.stop();}
    });
  }
  function toggleSound(){sound.setMuted(!sound.state().muted);try{storage?.setItem('museum-sound-muted',sound.state().muted?'1':'0');}catch{}sound.unlock();}
  $('#museum-player-toggle').addEventListener('click',()=>{const current=sound.state();if(current.playing)sound.pause();else if(current.active)sound.play(current.active);});
  $('#museum-player-stop').addEventListener('click',()=>sound.stop());
  $('#museum-back').addEventListener('click',returnToLobby);
  renderSound(sound.state());
  document.querySelectorAll('[data-config]').forEach(node=>node.textContent=config[node.dataset.config]);
  $('#letter-title').textContent=config.texts.invitationTitle;
  $('#letter-body').textContent=config.texts.invitationBody;
  $('.scene-label').textContent=`VESTÍBULO · ${config.initials}`;
  updatePassportCount();
  $('#ticket-mount').innerHTML=ticketMarkup();
  $('#envelope').addEventListener('click',openInvitation);
  $('#discover-ticket').addEventListener('click',()=>showScreen('ticket'));
  $('#enter-museum').addEventListener('click',enterMuseum);
  $('#back-invitation').addEventListener('click',()=>resetInvitation(false));
  $('#continue-visit').addEventListener('click',enterMuseum);
  $('#replay-invitation').addEventListener('click',()=>resetInvitation(false));
  $('.brand').addEventListener('click',event=>{event.preventDefault();if(!transitioning)resetInvitation();});
  $('#open-map').addEventListener('click',event=>openDialog('map',event.currentTarget));
  $('#open-passport').addEventListener('click',event=>openDialog('passport',event.currentTarget));
  $('#consult-ticket').addEventListener('click',event=>openDialog('ticket',event.currentTarget));
  $('#open-note').addEventListener('click',event=>openContent({className:'dialog-note',source:event.currentTarget,html:noteMarkup()}));
  $('#replay-tutorial').addEventListener('click',event=>{const help={room:'room-help',moments:'moments-help','little-things':'little-help',you:'you-help'}[screen];if(help)$('#'+help).click();else openTutorial(event.currentTarget);});
  // Deslizar hacia arriba desde el menú inferior abre el mapa.
  {
    const dock=$('#lobby-dock');let start=null,swallow=0;
    dock.addEventListener('touchstart',event=>{const touch=event.touches[0];start=event.touches.length===1?{x:touch.clientX,y:touch.clientY,time:performance.now()}:null;},{passive:true});
    dock.addEventListener('touchend',event=>{
      if(!start)return;const touch=event.changedTouches[0],dx=touch.clientX-start.x,dy=touch.clientY-start.y,quick=performance.now()-start.time<600;start=null;
      if(quick&&dy<-45&&Math.abs(dy)>Math.abs(dx)*1.3){swallow=performance.now()+500;openDialog('map',$('#open-map'));}
    },{passive:true});
    dock.addEventListener('click',event=>{if(performance.now()<swallow){event.stopPropagation();event.preventDefault();}},true);
  }
  $('#close-dialog').addEventListener('click',closeDialog);
  $('#ambient-toggle').addEventListener('click',toggleSound);
  $('#dismiss-notice').addEventListener('click',()=>{$('#notice').hidden=true;});
  resetInvitation(true);
})();
