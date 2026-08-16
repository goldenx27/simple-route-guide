(()=>{
  const FINAL_SEGMENT={
    'maor-home-school':'38252-to-school',
    'maor-school-home':'33734-to-home'
  };
  const FINAL_STEP={
    'maor-home-school':5,
    'maor-school-home':4
  };
  let watchId=null,confirmCount=0,lastConfirmAt=0,advancing=false,lastStepKey='';

  function point(p){
    return p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))
      ?{lat:Number(p.lat),lon:Number(p.lon)}:null;
  }
  function finalPoints(){
    const key=FINAL_SEGMENT[selectedRoute];
    return(routeRecordings[key]?.points||[]).map(point).filter(Boolean);
  }
  function isFinalWalk(){
    return current?.step?.type==='walk'&&Number(current?.trip?.current_step)===FINAL_STEP[selectedRoute];
  }
  function endpointDistance(here,pts){
    if(!pts.length)return Infinity;
    // Use the tail of the recording rather than one exact coordinate. This is more robust
    // when the recording stopped a few metres before/after the actual doorway.
    const tail=pts.slice(Math.max(0,pts.length-10));
    let best=Infinity;
    for(const p of tail)best=Math.min(best,distanceMeters(here,p));
    return best;
  }
  async function completeArrival(){
    if(advancing||!tripId||!isFinalWalk())return;
    advancing=true;
    try{
      const d=await simulateNext();
      if(d?.step?.type==='arrival'){
        navigator.vibrate?.([350,120,350]);
        speak?.(d.message||d.step?.instruction||'הגענו ליעד');
      }
    }catch(e){console.warn('automatic arrival failed',e)}
    finally{setTimeout(()=>advancing=false,2500)}
  }
  async function onPosition(pos){
    if(!isFinalWalk()){confirmCount=0;return}
    const accuracy=Number(pos.coords.accuracy||999);
    if(accuracy>100){confirmCount=0;return}
    const pts=finalPoints();
    if(pts.length<2)return;
    const here={lat:pos.coords.latitude,lon:pos.coords.longitude};
    const d=endpointDistance(here,pts);
    const threshold=Math.max(32,Math.min(70,accuracy+22));
    if(d<=threshold){
      const now=Date.now();
      if(now-lastConfirmAt>12000)confirmCount=0;
      lastConfirmAt=now;
      confirmCount++;
      if(confirmCount>=2){confirmCount=0;await completeArrival()}
    }else if(d>threshold+25){confirmCount=0}
  }
  function start(){
    if(watchId!=null||!navigator.geolocation)return;
    watchId=navigator.geolocation.watchPosition(onPosition,()=>{},
      {enableHighAccuracy:true,maximumAge:1000,timeout:15000});
  }
  function stop(){if(watchId!=null)navigator.geolocation.clearWatch(watchId);watchId=null;confirmCount=0}
  setInterval(()=>{
    const key=`${tripId||''}:${selectedRoute||''}:${current?.trip?.current_step??''}:${current?.step?.type||''}`;
    if(key!==lastStepKey){lastStepKey=key;confirmCount=0}
    if(isFinalWalk())start();else stop();
  },700);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&isFinalWalk()&&watchId==null)start();
  });
})();
