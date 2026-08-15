(()=>{
  function install(){
    if(typeof window.startRecording!=='function'||typeof window.stopRecording!=='function'||typeof window.setRecordingControls!=='function')return false;
    if(window.__recordingStartFixInstalled)return true;
    window.__recordingStartFixInstalled=true;

    window.startRecording=function(){
      if(!navigator.geolocation){alert('GPS אינו זמין');return;}
      recPoints=[];recLandmarks=[];pendingLandmark=null;recStarted=Date.now();
      const points=document.getElementById('recPoints');if(points)points.textContent='0';
      const accuracy=document.getElementById('recAccuracy');if(accuracy)accuracy.textContent='—';
      const time=document.getElementById('recTime');if(time)time.textContent='00:00';
      const status=document.getElementById('recStatus');if(status)status.textContent='מחפש GPS…';
      const record=document.getElementById('recordButton');if(record)record.textContent='■ סיים הקלטה';
      setRecordingControls('recording');

      // Start GPS and timer immediately. Wake Lock is useful, but must never block recording startup.
      try{
        recWatch=navigator.geolocation.watchPosition(pos=>{
          const p={lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:Math.round(pos.coords.accuracy),time:new Date().toISOString()};
          const a=document.getElementById('recAccuracy');if(a)a.textContent=`±${p.accuracy}מ׳`;
          const s=document.getElementById('recStatus');if(s)s.textContent=p.accuracy<=10?'קליטה מצוינת':p.accuracy<=20?'קליטה טובה':'קליטה חלשה — ממשיכים לדגום';
          const last=recPoints[recPoints.length-1];
          if(!last||distanceMeters(last,p)>=3){recPoints.push(p);const c=document.getElementById('recPoints');if(c)c.textContent=String(recPoints.length);}
        },err=>{
          const s=document.getElementById('recStatus');if(s)s.textContent='שגיאת GPS: '+err.message;
        },{enableHighAccuracy:true,maximumAge:0,timeout:15000});
      }catch(err){
        const s=document.getElementById('recStatus');if(s)s.textContent='לא ניתן להפעיל GPS';
        recWatch=null;
        if(record)record.textContent='● התחל הקלטה';
        setRecordingControls('idle');
        return;
      }

      recTimer=setInterval(()=>{
        const sec=Math.floor((Date.now()-recStarted)/1000);
        const node=document.getElementById('recTime');
        if(node)node.textContent=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
      },1000);

      // Fire-and-forget: never await this before GPS starts.
      Promise.resolve().then(()=>requestWakeLock?.()).catch(()=>{});
    };

    window.toggleRecording=function(){
      recWatch!=null?window.stopRecording():window.startRecording();
    };
    return true;
  }

  if(!install()){
    let tries=0;
    const t=setInterval(()=>{tries++;if(install()||tries>50)clearInterval(t);},100);
  }
})();
