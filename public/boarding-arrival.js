(()=>{
  const PRE_BUS_STEP={
    'maor-home-school':2,
    'maor-school-home':1,
  };
  const FIRST_WALK_SEGMENT={
    'maor-home-school':'home-to-38283',
    'maor-school-home':'school-to-36743',
  };
  let watchId=null,confirmCount=0,locked=false,lastKey='';

  function finalPointForBoarding(){
    const seg=FIRST_WALK_SEGMENT[selectedRoute];
    const pts=seg&&routeRecordings?.[seg]?.points;
    if(!Array.isArray(pts)||!pts.length)return null;
    // Use the center of the last few recorded points instead of one exact sample.
    // This is more tolerant of a noisy final GPS point in the original recording.
    const tail=pts.slice(-5);
    return{
      lat:tail.reduce((s,p)=>s+Number(p.lat||0),0)/tail.length,
      lon:tail.reduce((s,p)=>s+Number(p.lon||0),0)/tail.length,
    };
  }

  function shouldTrack(){
    const step=Number(current?.trip?.current_step);
    const pre=PRE_BUS_STEP[selectedRoute];
    return Boolean(
      tripId&&current?.step?.type==='walk'&&
      Number.isFinite(step)&&Number.isFinite(pre)&&step<=pre
    );
  }

  async function forceWaitingForBus(){
    let data=current;
    // The walking UI and GPS map can be several walking steps behind the physical
    // position. Once the child is physically at the boarding stop, advance through
    // any remaining walking steps until the server state is actually wait_for_bus.
    for(let i=0;i<4&&data?.step?.type==='walk';i++){
      data=await api(`/api/trips/${tripId}/simulate-next`,{method:'POST'});
    }
    if(data)render(data);
    if(data?.step?.type!=='wait_for_bus')throw new Error(`expected wait_for_bus, got ${data?.step?.type||'unknown'}`);
    return data;
  }

  async function onPosition(pos){
    if(!shouldTrack()||locked)return;
    const accuracy=Number(pos.coords.accuracy||999);
    if(accuracy>100){confirmCount=0;return}
    const target=finalPointForBoarding();if(!target)return;
    const here={lat:pos.coords.latitude,lon:pos.coords.longitude};
    const d=distanceMeters(here,target);
    const threshold=Math.max(45,Math.min(90,accuracy+28));
    if(d>threshold){confirmCount=0;return}
    confirmCount++;
    if(confirmCount<2)return;
    const key=`${tripId}:${selectedRoute}:boarding`;
    if(key===lastKey)return;
    lastKey=key;locked=true;
    try{
      await forceWaitingForBus();
      navigator.vibrate?.([180,90,180]);
      speak?.('הגענו לתחנה. עכשיו מחכים לאוטובוס.');
      window.startBusGpsTracker?.(0);
    }catch(e){lastKey='';console.warn('boarding stop auto transition failed',e)}
    finally{confirmCount=0;setTimeout(()=>locked=false,1800)}
  }

  function start(){
    if(watchId!=null||!navigator.geolocation)return;
    watchId=navigator.geolocation.watchPosition(onPosition,()=>{}, {enableHighAccuracy:true,maximumAge:1000,timeout:15000});
  }
  function stop(){if(watchId!=null)navigator.geolocation.clearWatch(watchId);watchId=null;confirmCount=0}

  setInterval(()=>{
    if(shouldTrack())start();else stop();
  },500);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&shouldTrack())start()});
})();
