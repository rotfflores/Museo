(function(){
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const $=selector=>document.querySelector(selector);
  const data=()=>MuseumSummary.build(MUSEUM_CONFIG,Museum.getProgress(),Museum.getNextChapter());
  const paragraphs=lines=>lines.map(line=>`<p>${esc(line)}</p>`).join('');
  function open(source){
    const summary=data(),config=MUSEUM_CONFIG;let imageUrl=null,blob=null;
    const shareLink=`${location.origin}${location.pathname}?boleto=2`;
    const model=summary.sections;
    Museum.openContent({className:'heart-summary',source,onClose:()=>{if(imageUrl)URL.revokeObjectURL(imageUrl);},html:`
      <header class="heart-heading"><img src="assets/museum-wax-seal.png" width="60" height="60" alt=""><p class="eyebrow">EL CORAZÓN DE NUESTRO MUSEO</p><h2 id="dialog-title">Todo lo que guardamos</h2><p>${esc(summary.couple)} · ${esc(summary.celebration)}</p></header>
      <section class="heart-section"><h3>Nuestro recorrido</h3><div class="heart-rooms">${summary.rooms.map((room,i)=>`<span class="${room.done?'done':''}"><b>${room.done?'✧':String(i+1).padStart(2,'0')}</b><span>${esc(room.title)}<small>${room.done?'Completada':`${room.found} de ${room.total} recuerdos`}</small></span></span>`).join('')}</div><button id="heart-passport" class="text-button" type="button">Ver mi pasaporte</button></section>
      <section class="heart-section heart-choice"><p class="eyebrow">NUESTRO PRÓXIMO CAPÍTULO</p><h3>Me gustaría empezar por este</h3>${paragraphs(model[1].lines)}<button id="heart-plan" class="text-button" type="button">${summary.plan?'Cambiar mi elección':'Elegir nuestro próximo plan'}</button></section>
      <section class="heart-section"><h3>Canciones dedicadas</h3><div class="heart-songs">${summary.songs.map((song,i)=>`<article><h4>${esc(song.title)}</h4><small>${esc(song.artist)}</small><p>${esc(song.dedication)}</p>${song.audio?`<button class="text-button" data-heart-song="${i}" type="button">▶ Escuchar</button>`:song.link&&/^https?:\/\//.test(song.link)?`<a class="text-button" href="${esc(song.link)}" target="_blank" rel="noopener noreferrer">Escuchar <img class="icon-arrow-image" src="assets/icons/arrow-up-right.svg" alt="" aria-hidden="true"></a>`:''}</article>`).join('')||'<p>Aún no hay canciones dedicadas.</p>'}</div></section>
      <section class="heart-section"><h3>La última obra</h3>${model[3].photo?`<img class="heart-art" src="${esc(model[3].photo)}" alt="${esc(config.artworkRoom.centerpiece.alt||'Nuestra última obra')}">`:''}${paragraphs(model[3].lines)}</section>
      <section class="heart-section"><details class="heart-letter"><summary>Mi carta para ti</summary>${paragraphs(model[4].lines)}</details></section>
      <section class="heart-section heart-gift"><p class="eyebrow">${summary.giftUnlocked?'LAS CINCO PISTAS REUNIDAS':'UNA SORPRESA POR DESCUBRIR'}</p><h3>La sorpresa de las cinco pistas</h3>${model[5].photo?`<img class="heart-art" src="${esc(model[5].photo)}" alt="${esc(config.artworkRoom.vitrine.photoAlt||'Tu sorpresa')}">`:''}${paragraphs(model[5].lines)}${!summary.giftUnlocked?'<button id="heart-clues" class="text-button" type="button">Seguir buscando las pistas</button>':''}</section>
      <footer class="heart-sharing"><p class="heart-ending">${esc(summary.phrase)}</p><a id="heart-whatsapp" class="button primary" href="${esc(MuseumSummary.whatsappUrl(summary,shareLink))}" target="_blank" rel="noopener noreferrer">Compartir por WhatsApp</a><button id="heart-generate" class="button secondary" type="button">Generar imagen breve</button><p id="heart-image-status" role="status"></p><div id="heart-image-result" hidden><div class="heart-image-actions"><a id="heart-image-download" class="button primary" download="el-museo-de-nosotros-resumen.png">Descargar imagen</a><button id="heart-image-share" class="button secondary" type="button" hidden>Compartir imagen</button></div><p class="heart-share-note">También puedes adjuntar la imagen descargada en el chat de WhatsApp.</p><details class="heart-image-view"><summary>Vista previa de la imagen</summary><img id="heart-image-preview" alt="Tarjeta breve con los recuerdos principales del museo"></details></div></footer>`});
    $('#heart-passport').onclick=()=>Museum.openPassport(source);
    $('#heart-plan').onclick=()=>Museum.openRoom('future');
    $('#heart-clues')?.addEventListener('click',()=>Museum.openMap(source));
    document.querySelectorAll('[data-heart-song]').forEach(button=>{const song=summary.songs[Number(button.dataset.heartSong)];Museum.bindAudioButton(button,{src:song.audio,title:`${song.title} · ${song.artist}`,label:'▶ Escuchar'});});
    $('#heart-generate').onclick=async event=>{
      const button=event.currentTarget,status=$('#heart-image-status'),result=$('#heart-image-result');button.disabled=true;status.textContent='Preparando tu resumen…';
      try{blob=await render(summary);if(!result.isConnected)return;if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=URL.createObjectURL(blob);$('#heart-image-preview').src=imageUrl;$('#heart-image-download').href=imageUrl;result.hidden=false;button.textContent='Volver a generar imagen';status.textContent='Tu imagen está lista para descargar.';
        const file=new File([blob],'el-museo-de-nosotros-resumen.png',{type:'image/png'});$('#heart-image-share').hidden=!(navigator.canShare?.({files:[file]}));
      }catch{if(status.isConnected)status.textContent='No se pudo crear la imagen. Inténtalo otra vez.';}finally{button.disabled=false;}
    };
    $('#heart-image-share').onclick=async()=>{if(!blob)return;try{await navigator.share({files:[new File([blob],'el-museo-de-nosotros-resumen.png',{type:'image/png'})],title:'El Museo de Nosotros'});}catch(error){if(error.name!=='AbortError')$('#heart-image-status').textContent='Puedes descargar la imagen y adjuntarla en WhatsApp.';}};
  }
  async function loadImage(src){if(!src)return null;try{return await new Promise(resolve=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=src;});}catch{return null;}}
  async function render(summary){
    await document.fonts?.ready;
    const width=1080,height=1080,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const g=canvas.getContext('2d');if(!g)throw new Error('Canvas');g.textBaseline='top';
    const serif='Georgia, serif',sans='Arial, sans-serif',ink='#493f32',gold='#96784d',muted='#766a58';
    const seal=await loadImage('assets/museum-wax-seal.png');
    const type=(value,x,y,size=26,color=ink,{font=sans,align='left',max=900}={})=>{
      g.fillStyle=color;g.font=`${size}px ${font}`;g.textAlign=align;g.fillText(String(value),x,y,max);
    };
    const line=(y,x1=86,x2=994)=>{g.strokeStyle='#d3c2a3';g.lineWidth=1.5;g.beginPath();g.moveTo(x1,y);g.lineTo(x2,y);g.stroke();};
    const wrapped=(value,x,y,maxWidth,size=34,maxLines=2)=>{
      g.font=`${size}px ${serif}`;const words=String(value).split(/\s+/);let lines=[],current='';
      for(const word of words){const next=current?`${current} ${word}`:word;if(current&&g.measureText(next).width>maxWidth){lines.push(current);current=word;}else current=next;}
      if(current)lines.push(current);
      lines.slice(0,maxLines).forEach((part,i)=>type(part,x,y+i*(size+8),size,ink,{font:serif,max:maxWidth}));
    };
    g.fillStyle='#f8f3e8';g.fillRect(0,0,width,height);
    g.strokeStyle='#c6b18e';g.lineWidth=2;g.strokeRect(34,34,width-68,height-68);g.strokeRect(46,46,width-92,height-92);
    if(seal)g.drawImage(seal,87,74,118,118);
    type('EL MUSEO',234,101,22,gold);type('DE NOSOTROS',234,133,22,gold);
    type('UNA HISTORIA PARA GUARDAR',995,112,17,gold,{align:'right'});
    line(223);
    type(summary.couple,540,264,56,ink,{font:serif,align:'center',max:900});
    type(`${summary.celebration} · ${summary.date}`,540,333,25,muted,{align:'center',max:900});
    line(380);
    type('NUESTRO PRÓXIMO CAPÍTULO',87,417,18,gold);
    wrapped(summary.plan?.title||'Todavía por elegir',87,456,900,43,2);
    line(566);
    type('CANCIONES DEDICADAS',87,603,18,gold);
    (summary.songs.length?summary.songs.slice(0,3):[{title:'Aún por descubrir',artist:''}]).forEach((song,i)=>{
      const y=638+i*42;g.fillStyle=gold;g.beginPath();g.arc(94,y+13,3.4,0,Math.PI*2);g.fill();
      type(`${song.title}${song.artist?` · ${song.artist}`:''}`,113,y,25,ink,{max:880});
    });
    line(786);
    type('LA ÚLTIMA OBRA',87,826,17,gold);
    wrapped(summary.artRevealed?(summary.sections[3].lines[0]||'Nuestra historia sigue'):'Por descubrir',87,864,420,29,2);
    g.strokeStyle='#d3c2a3';g.beginPath();g.moveTo(540,820);g.lineTo(540,955);g.stroke();
    type('LA SORPRESA',581,826,17,gold);
    wrapped(summary.giftUnlocked?(summary.sections[5].lines[1]||'Una sorpresa para ti'):'Aún por descubrir',581,864,410,29,2);
    line(970);
    type('Nuestra historia continúa.',540,1000,31,gold,{font:serif,align:'center'});
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG')),'image/png'));
  }
  window.MuseumHeart={open,render};
})();
