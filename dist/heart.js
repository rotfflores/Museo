(function(){
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const $=selector=>document.querySelector(selector);
  const data=()=>MuseumSummary.build(MUSEUM_CONFIG,Museum.getProgress(),Museum.getNextChapter());
  const paragraphs=lines=>lines.map(line=>`<p>${esc(line)}</p>`).join('');
  function open(source){
    const summary=data(),config=MUSEUM_CONFIG;let imageUrl=null,blob=null;
    const model=summary.sections;
    Museum.openContent({className:'heart-summary',source,onClose:()=>{if(imageUrl)URL.revokeObjectURL(imageUrl);},html:`
      <header class="heart-heading"><img src="assets/museum-wax-seal.png" width="60" height="60" alt=""><p class="eyebrow">EL CORAZÓN DE NUESTRO MUSEO</p><h2 id="dialog-title">Todo lo que guardamos</h2><p>${esc(summary.couple)} · ${esc(summary.celebration)}</p></header>
      <section class="heart-section"><h3>Nuestro recorrido</h3><div class="heart-rooms">${summary.rooms.map((room,i)=>`<span class="${room.done?'done':''}"><b>${room.done?'✧':String(i+1).padStart(2,'0')}</b><span>${esc(room.title)}<small>${room.done?'Completada':`${room.found} de ${room.total} recuerdos`}</small></span></span>`).join('')}</div><button id="heart-passport" class="text-button" type="button">Ver mi pasaporte</button></section>
      <section class="heart-section heart-choice"><p class="eyebrow">NUESTRO PRÓXIMO CAPÍTULO</p><h3>Me gustaría empezar por este</h3>${paragraphs(model[1].lines)}<button id="heart-plan" class="text-button" type="button">${summary.plan?'Cambiar mi elección':'Elegir nuestro próximo plan'}</button></section>
      <section class="heart-section"><h3>Canciones dedicadas</h3><div class="heart-songs">${summary.songs.map((song,i)=>`<article><h4>${esc(song.title)}</h4><small>${esc(song.artist)}</small><p>${esc(song.dedication)}</p>${song.audio?`<button class="text-button" data-heart-song="${i}" type="button">▶ Escuchar</button>`:song.link&&/^https?:\/\//.test(song.link)?`<a class="text-button" href="${esc(song.link)}" target="_blank" rel="noopener noreferrer">Escuchar ↗</a>`:''}</article>`).join('')||'<p>Aún no hay canciones dedicadas.</p>'}</div></section>
      <section class="heart-section"><h3>La última obra</h3>${model[3].photo?`<img class="heart-art" src="${esc(model[3].photo)}" alt="${esc(config.artworkRoom.centerpiece.alt||'Nuestra última obra')}">`:''}${paragraphs(model[3].lines)}</section>
      <section class="heart-section"><details class="heart-letter"><summary>Mi carta para ti</summary>${paragraphs(model[4].lines)}</details></section>
      <section class="heart-section heart-gift"><p class="eyebrow">${summary.giftUnlocked?'LAS CINCO PISTAS REUNIDAS':'UNA SORPRESA POR DESCUBRIR'}</p><h3>La sorpresa de las cinco pistas</h3>${model[5].photo?`<img class="heart-art" src="${esc(model[5].photo)}" alt="${esc(config.artworkRoom.vitrine.photoAlt||'Tu sorpresa')}">`:''}${paragraphs(model[5].lines)}${!summary.giftUnlocked?'<button id="heart-clues" class="text-button" type="button">Seguir buscando las pistas</button>':''}</section>
      <footer class="heart-sharing"><p class="heart-ending">${esc(summary.phrase)}</p><a id="heart-whatsapp" class="button primary" href="${esc(MuseumSummary.whatsappUrl(summary,location.origin+location.pathname))}" target="_blank" rel="noopener noreferrer">Compartir por WhatsApp</a><button id="heart-generate" class="button secondary" type="button">Generar imagen del resumen</button><p id="heart-image-status" role="status"></p><div id="heart-image-result" hidden><div class="heart-image-actions"><a id="heart-image-download" class="button primary" download="el-museo-de-nosotros-resumen.png">Descargar imagen</a><button id="heart-image-share" class="button secondary" type="button" hidden>Compartir imagen</button></div><p class="heart-share-note">También puedes adjuntar la imagen descargada en el chat de WhatsApp.</p><details class="heart-image-view"><summary>Vista previa de la imagen</summary><img id="heart-image-preview" alt="Imagen del resumen completo del museo"></details></div></footer>`});
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
    const width=1080,margin=94,inner=width-margin*2,canvas=document.createElement('canvas'),g=canvas.getContext('2d');if(!g)throw new Error('Canvas');
    canvas.width=width;const serif='Georgia, serif',sans='"Segoe UI", Arial, sans-serif';
    const seal=await loadImage('assets/museum-wax-seal.png'),images=await Promise.all(summary.sections.map(section=>loadImage(section.photo)));
    const ops=[];let y=110;
    const text=(value,size=28,color='#685844',italic=false)=>{
      g.font=`${italic?'italic ':''}${size}px ${italic?serif:sans}`;
      for(const paragraph of String(value).split('\n')){let line='';for(const word of paragraph.split(/\s+/)){const test=line?line+' '+word:word;if(line&&g.measureText(test).width>inner){ops.push({type:'text',value:line,size,color,italic,y});y+=size*1.48;line=word;}else line=test;}if(line){ops.push({type:'text',value:line,size,color,italic,y});y+=size*1.48;}}
    };
    if(seal){ops.push({type:'image',img:seal,y,h:100,w:100,center:true});y+=136;}
    text('EL MUSEO DE NOSOTROS',22,'#947a52');y+=20;text(summary.couple,55,'#493f32',true);text(`${summary.celebration} · ${summary.date}`,25);y+=38;
    summary.sections.forEach((section,index)=>{
      ops.push({type:'line',y});y+=42;text(section.title,36,'#493f32',true);y+=14;
      const img=images[index];if(img){const ratio=Math.min(inner/img.width,520/img.height),w=img.width*ratio,h=img.height*ratio;ops.push({type:'image',img,y,w,h,center:true});y+=h+40;}
      section.lines.forEach(line=>{text(line);y+=15;});y+=35;
    });text(summary.phrase,32,'#947a52',true);y+=100;
    canvas.height=Math.ceil(y);g.fillStyle='#f8f3e8';g.fillRect(0,0,width,canvas.height);g.strokeStyle='#c5b18b';g.lineWidth=2;g.strokeRect(36,36,width-72,canvas.height-72);g.strokeRect(48,48,width-96,canvas.height-96);
    g.textBaseline='top';for(const op of ops){if(op.type==='text'){g.fillStyle=op.color;g.font=`${op.italic?'italic ':''}${op.size}px ${op.italic?serif:sans}`;g.fillText(op.value,margin,op.y);}else if(op.type==='line'){g.strokeStyle='#d7c7ab';g.beginPath();g.moveTo(margin,op.y);g.lineTo(width-margin,op.y);g.stroke();}else g.drawImage(op.img,op.center?(width-op.w)/2:margin,op.y,op.w,op.h);}
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG')),'image/png'));
  }
  window.MuseumHeart={open,render};
})();
