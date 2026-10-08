(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MuseumSummary=api;})(typeof window==='object'?window:globalThis,()=>{
  const clean=value=>String(value??'').trim();
  function build(config,progress,choice){
    const text=value=>clean(value).replace(/\{(sender|recipient)\}/g,(_,key)=>config[key]);
    const completed=Array.isArray(progress.completed)?progress.completed:[];
    const rooms=config.rooms.map(room=>({id:room.id,title:room.title.replace(/\.$/,''),done:completed.includes(room.id),found:progress.discoveries?.[room.id]?.length||0,total:room.pieces?.length||0}));
    const plan=config.futureRoom?.plans?.find(item=>item.id===choice)||null;
    const invitation=plan?.invitation;
    const planLines=plan?[text(plan.title),text(plan.description),text(plan.dedication),...[['date','Fecha'],['time','Hora'],['place','Lugar'],['message','']].map(([key,label])=>invitation?.[key]?`${label?label+': ':''}${text(invitation[key])}`:'').filter(Boolean)].filter(Boolean):['Todavía no has elegido un próximo capítulo. Puedes hacerlo en la sala 05.'];
    const songs=(config.youRoom?.songs||[]).filter(song=>song.audio||song.link).map(song=>({...song,dedication:text(song.dedication)}));
    const artwork=config.artworkRoom||{},piece=artwork.centerpiece||{},letter=artwork.letter||{};
    const found=progress.discoveries?.artwork||[],artRevealed=found.includes(piece.id||'obra-final'),letterRead=found.includes(letter.id||'carta');
    const giftUnlocked=!!progress.cluesComplete&&!!progress.finalUnlocked;
    const gift=giftUnlocked?artwork.vitrine:null;
    const missing=(config.clueIds||[]).filter(id=>!progress.clues?.includes(id)).length;
    const sections=[
      {title:'Nuestro recorrido',lines:rooms.map((room,i)=>`${String(i+1).padStart(2,'0')} · ${room.title} — ${room.done?'Completada':`${room.found} de ${room.total} recuerdos`}`)},
      {title:'Me gustaría empezar por este',lines:planLines},
      {title:'Canciones dedicadas',lines:songs.length?songs.flatMap(song=>[`${song.title} · ${song.artist||''}`,song.dedication].filter(Boolean)):['Aún no hay canciones dedicadas.']},
      {title:'La última obra',lines:artRevealed?[text(piece.plaque||artwork.title),text(piece.dedication)].filter(Boolean):['Te espera en la sala 06.'],photo:artRevealed?piece.photo:null},
      {title:'Mi carta para ti',lines:letterRead?[text(letter.greeting),...(letter.body||[]).map(text),text(letter.closing),text(letter.signature)].filter(Boolean):['La carta sigue esperando en la última sala.']},
      {title:'La sorpresa de las cinco pistas',lines:gift?[text(gift.kind),text(gift.title),text(gift.message),...['date','place','instructions'].map(key=>text(gift[key])).filter(Boolean)].filter(Boolean):[missing?`Has encontrado ${progress.clues?.length||0} de ${config.clueIds?.length||0} pistas. Faltan ${missing} para descubrir la sorpresa.`:'Has reunido las pistas. Completa las primeras cinco salas para abrir la última.'],photo:gift?.photo||null},
    ];
    const complete=rooms.length>0&&rooms.every(room=>room.done);
    return {couple:config.couple,date:config.date,celebration:config.celebration,complete,rooms,plan,songs,artRevealed,letterRead,giftUnlocked,sections,phrase:complete?text(artwork.completionMessage||'Nuestra historia continúa.'):'Nuestra historia continúa.'};
  }
  function shareText(summary,url){return ['El Museo de Nosotros',summary.couple,`${summary.celebration} · ${summary.date}`,...summary.sections.flatMap(section=>['',section.title,...section.lines]),'',summary.phrase,'',url].filter(value=>value!==undefined).join('\n');}
  function whatsappUrl(summary,url){return `https://wa.me/526182051723?text=${encodeURIComponent(shareText(summary,url))}`;}
  return {build,shareText,whatsappUrl};
});
