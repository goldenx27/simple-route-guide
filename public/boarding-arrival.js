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
    return pts[pts.length-1];
  }

  function shouldTrack(){
    return Boolean(
      tripId&&current?.step?.type==='walk'&&
      Number(current?.trip?.current_step)===PRE_BUS_STEP[selectedRoute]
    );
  }

  async function onPosition(pos){
    if(!shouldTrack()||locked)return;
    const accuracy=Number(pos.coords.accuracy||999);
    if(accuracy>90){confirmCount=0;return}
    const target=finalPointForBoarding();if(!target)return;
    const here={lat:pos.coords.latitude,lon:pos.coords.longitude};
    const d=distanceMeters(here,target);
    const threshold=Math.max(35,Math.min(75,accuracy+22));
    if(d>threshold){confirmCount=0;return}
    confirmCount++;
    if(confirmCount<2)return;
    const key=`${tripId}:${selectedRoute}:${current.trip.current_step}`;
    if(key===lastKey)return;
    lastKey=key;locked=true;
    try{
      const data=await api(`/api/trips/${tripId}/simulate-next`,{method:'POST'});
      render(data);
      navigator.vibrate?.([180,90,180]);
      speak?.('הגענו לתחנה. עכשיו מחכים לאוטובוס.');
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
