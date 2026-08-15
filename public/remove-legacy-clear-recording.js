(()=>{
  function removeLegacyClear(){
    const recorder=document.getElementById('recorder');
    if(!recorder)return false;
    const clear=document.getElementById('clearRecordingButton');
    if(clear){
      const zone=clear.closest('.parent-danger-zone');
      if(zone)zone.remove();
      else clear.remove();
    }
    [...recorder.querySelectorAll('*')].forEach(el=>{
      const text=(el.textContent||'').trim();
      if(text==='איפוס ומחיקה' || text==='🗑️ נקה הקלטה והתחל מחדש'){
        const zone=el.closest('.parent-danger-zone');
        if(zone)zone.remove();
        else if(el.tagName==='BUTTON')el.remove();
      }
    });
    return true;
  }
  function boot(){
    removeLegacyClear();
    let n=0;
    const t=setInterval(()=>{removeLegacyClear();if(++n>30)clearInterval(t)},100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
