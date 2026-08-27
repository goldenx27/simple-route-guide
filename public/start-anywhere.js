(()=>{
  const SEGMENTS={
    'maor-home-school':['home-to-38283','38252-to-school'],
    'maor-school-home':['school-to-36743','33734-to-home']
  };
  const FINAL_WALK_STEP={'maor-home-school':5,'maor-school-home':4};

  function getPosition(){return new Promise(resolve=>{if(!navigator.geolocation)return resolve(null);navigator.geolocation.getCurrentPosition(p=>resolve(p),()=>resolve(null),{enableHighAccuracy:true,maximumAge:3000,timeout:8000})})}
  function point(p){return p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))?{lat:Number(p.lat),lon:Number(p.lon)}:null}
  function pointsForSegment(k){return(routeRecordings?.[k]?.points||[]).map(point).filter(Boolean)}
  function nearest(here,pts){let best={distance:Infinity,index:-1};for(let i=0;i<pts.length;i++){const d=distanceMeters(here,pts[i]);if(d<best.distance)best={distance:d,index:i}}return best}
  function showNotice(text){let n=document.getElementById('routeStartNotice');if(!n){n=document.createElement('div');n.id='routeStartNotice';n.style.cssText='position:absolute;z-index:80;left:10px;right:10px;bottom:10px;background:#fff;border-radius:16px;padding:12px;box-shadow:0 8px 24px rgba(0,0,0,.18);text-align:center;font-weight:800;direction:rtl';document.getElementById('home')?.appendChild(n)}n.textContent=text;setTimeout(()=>n.remove(),4200)}
  async function advanceToFinalWalk(){if(!tripId)return;try{await api(`/api/trips/${tripId}/board-bus`,{method:'POST'});const d=await api(`/api/trips/${tripId}/bus-progress`,{method:'POST',body:JSON.stringify({remaining_stops:0})});render(d);return d}catch(e){console.warn('start-anywhere final walk recovery failed',e);return null}}
  async function advanceToWaitForBus(){if(!tripId)return;for(let i=0;i<5&&current?.step?.type==='walk';i++){const d=await api(`/api/trips/${tripId}/simulate-next`,{method:'POST'});render(d);if(d.step?.type==='wait_for_bus')return d}return current}

  window.startTrip=async function(){
    if(!selectedRoute)return;
    const pos=await getPosition();
    current=await api('/api/trips/start/'+selectedRoute,{method:'POST'});
    tripId=current.trip.id;
    document.getElementById('home')?.classList.add('hidden');
    document.getElementById('trip')?.classList.remove('hidden');
    render(current);
    speak?.(current.message);
    await requestWakeLock?.();
    startEtaPolling?.();
    startGpsGuidance?.();

    if(!pos)return;
    const here={lat:pos.coords.latitude,lon:pos.coords.longitude};
    const accuracy=Number(pos.coords.accuracy||30);
    const segs=SEGMENTS[selectedRoute]||[];
    const first=pointsForSegment(segs[0]),final=pointsForSegment(segs[1]);
    const dFirst=first.length?nearest(here,first).distance:Infinity;
    const dFinal=final.length?nearest(here,final).distance:Infinity;
    const firstEnd=first.at(-1),finalEnd=final.at(-1);
    const dBoard=firstEnd?distanceMeters(here,firstEnd):Infinity;
    const dDestination=finalEnd?distanceMeters(here,finalEnd):Infinity;
    const destinationLimit=Math.max(75,Math.min(120,accuracy+40));

    if(dDestination<=destinationLimit){
      showNotice(selectedRoute==='maor-school-home'?'אתה כבר בבית 🏠':'אתה כבר בבית הספר 🏫');
      return;
    }

    // If the app is opened during the final walking section, jump directly to that phase.
    if(dFinal<=Math.max(180,accuracy+100)&&dFinal+60<dFirst){
      const d=await advanceToFinalWalk();
      if(d){showNotice('מצאתי אותך בדרך — ממשיכים מהמיקום הנוכחי 📍');speak?.(d.message||d.step?.instruction)}
      return;
    }

    // If opened at/near the boarding stop, do not force the child through earlier walking steps.
    if(dBoard<=Math.max(110,accuracy+55)){
      const d=await advanceToWaitForBus();
      if(d?.step?.type==='wait_for_bus'){showNotice('מצאתי אותך בתחנה — מחכים לאוטובוס 🚌');speak?.('הגענו לתחנה. עכשיו מחכים לאוטובוס.')}
      return;
    }

    // Everywhere else: keep the trip active and let the map/GPS locate the child immediately.
    // This intentionally does not reject starts just because the child is away from home/school.
    showNotice(Number.isFinite(Math.min(dFirst,dFinal))&&Math.min(dFirst,dFinal)<500?'מצאתי אותך באזור המסלול — מתחילים מכאן 📍':'המסלול התחיל מהמיקום הנוכחי 📍');
  };
})();
