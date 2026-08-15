(()=>{
  let running=false;

  function setUploadReady(ready){
    const exportBtn=document.getElementById('exportButton');
    if(exportBtn) exportBtn.disabled=!ready;
  }

  function setUi(state){
    try{ setRecordingControls(state); }catch(e){}
    const record=document.getElementById('recordButton');
    if(record) record.textContent=state==='recording'?'■ סיים הקלטה':'● התחל הקלטה';
  }

  function stopSafe(){
    if(!running && recWatch==null) return;
    running=false;
    try{ if(recWatch!=null) navigator.geolocation.clearWatch(recWatch); }catch(e){}
    recWatch=null;
    try{ if(recTimer) clearInterval(recTimer); }catch(e){}
    recTimer=null;
    setUi('finished');

    // parent-wizard uses the hidden legacy export button as its finished-state flag.
    // Make that state explicit so the cloud upload button becomes available immediately.
    setUploadReady(Array.isArray(recPoints) && recPoints.length>0);

    const status=document.getElementById('recStatus');
    if(status) status.textContent=`ההקלטה הסתיימה · ${recPoints.length} נקודות · ${recLandmarks.length} נקודות ציון`;

    // Force the wizard's MutationObserver to repaint after the readiness flag is set.
    const record=document.getElementById('recordButton');
    if(record) record.setAttribute('data-recording-finished',String(Date.now()));
  }

  function startSafe(){
    if(running) return;
    if(!navigator.geolocation){ alert('GPS אינו זמין'); return; }

    running=true;
    setUploadReady(false);
    recPoints=[];
    recLandmarks=[];
    pendingLandmark=null;
    recStarted=Date.now();

    const points=document.getElementById('recPoints'); if(points) points.textContent='0';
    const accuracy=document.getElementById('recAccuracy'); if(accuracy) accuracy.textContent='—';
    const time=document.getElementById('recTime'); if(time) time.textContent='00:00';
    const status=document.getElementById('recStatus'); if(status) status.textContent='מחפש GPS…';
    setUi('recording');

    // Timer starts independently of GPS, so the UI can never look frozen while GPS is searching.
    recTimer=setInterval(()=>{
      const sec=Math.floor((Date.now()-recStarted)/1000);
      const node=document.getElementById('recTime');
      if(node) node.textContent=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
    },1000);

    try{
      // watchPosition returns its watch id immediately; keep it immediately so Stop always works.
      recWatch=navigator.geolocation.watchPosition(pos=>{
        if(!running) return;
        const p={lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:Math.round(pos.coords.accuracy),time:new Date().toISOString()};
        const a=document.getElementById('recAccuracy'); if(a) a.textContent=`±${p.accuracy}מ׳`;
        const s=document.getElementById('recStatus');
        if(s) s.textContent=p.accuracy<=10?'קליטה מצוינת':p.accuracy<=20?'קליטה טובה':'קליטה חלשה — ממשיכים לדגום';
        const last=recPoints[recPoints.length-1];
        if(!last||distanceMeters(last,p)>=3){
          recPoints.push(p);
          const c=document.getElementById('recPoints'); if(c) c.textContent=String(recPoints.length);
        }
      },err=>{
        if(!running) return;
        const s=document.getElementById('recStatus'); if(s) s.textContent='שגיאת GPS: '+err.message;
      },{enableHighAccuracy:true,maximumAge:0,timeout:15000});
    }catch(err){
      running=false;
      if(recTimer) clearInterval(recTimer);
      recTimer=null;
      recWatch=null;
      setUploadReady(false);
      setUi('idle');
      const s=document.getElementById('recStatus'); if(s) s.textContent='לא ניתן להפעיל GPS';
      return;
    }

    // Never block recording on Wake Lock.
    try{ requestWakeLock(); }catch(e){}
  }

  function install(){
    const button=document.getElementById('recordButton');
    if(!button) return false;
    if(button.dataset.safeRecorder==='1') return true;
    button.dataset.safeRecorder='1';
    button.removeAttribute('onclick');
    button.addEventListener('click',()=> running ? stopSafe() : startSafe());
    window.__safeRecorder={start:startSafe,stop:stopSafe,isRunning:()=>running};
    return true;
  }

  if(!install()){
    let tries=0;
    const t=setInterval(()=>{tries++;if(install()||tries>50)clearInterval(t);},100);
  }
})();
