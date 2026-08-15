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

    [...recorder.querySelectorAll('button')].forEach(btn=>{
      const text=(btn.textContent||'').trim();
      if(text==='🗑️' || text==='🗑' || text==='🗑️ נקה הקלטה והתחל מחדש') btn.remove();
    });

    [...recorder.querySelectorAll('*')].forEach(el=>{
      const text=(el.textContent||'').trim();
      if(text==='איפוס ומחיקה'){
        const zone=el.closest('.parent-danger-zone');
        if(zone)zone.remove();
        else el.remove();
      }
    });

    const maintenance=recorder.querySelector('.wizard-maintenance');
    if(maintenance){
      const body=maintenance.querySelector('.wizard-maintenance-body');
      const meaningful=body && [...body.children].some(el=>{
        if(el.matches('input[type="file"]')) return false;
        if(el.hidden || getComputedStyle(el).display==='none') return false;
        return (el.textContent||'').trim() || el.matches('button,details,section');
      });
      if(!meaningful) maintenance.remove();
    }
    return true;
  }

  function boot(){
    removeLegacyClear();
    let n=0;
    const t=setInterval(()=>{removeLegacyClear();if(++n>50)clearInterval(t)},100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
