(()=>{
  function clean(){
    const recorder=document.getElementById('recorder');
    if(!recorder)return false;

    const input=document.getElementById('routeFilesInput');
    const tools=recorder.querySelector('.route-data-tools');
    if(tools){
      [...tools.querySelectorAll('button')].forEach(btn=>{
        const text=(btn.textContent||'').trim();
        if(/טען.*קבצי.*הקלטה|טען את .*הקלטות/i.test(text))btn.remove();
      });
      if(!tools.querySelector('button'))tools.remove();
    }
    input?.remove();
    return true;
  }

  if(!clean()){
    let tries=0;
    const t=setInterval(()=>{tries++;if(clean()||tries>50)clearInterval(t);},100);
  }
})();
