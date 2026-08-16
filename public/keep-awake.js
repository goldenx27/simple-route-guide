(()=>{
  let retryTimer=null;

  function tripIsActive(){
    const trip=document.getElementById('trip');
    return Boolean(tripId)&&trip&&!trip.classList.contains('hidden')&&current?.step?.type!=='arrival';
  }

  async function ensureWakeLock(){
    if(!tripIsActive()||document.visibilityState!=='visible')return;
    if(!('wakeLock' in navigator))return;
    try{
      if(!wakeLock||wakeLock.released){
        wakeLock=await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release',()=>{
          if(retryTimer)clearTimeout(retryTimer);
          retryTimer=setTimeout(()=>ensureWakeLock(),350);
        },{once:true});
      }
    }catch(e){
      if(retryTimer)clearTimeout(retryTimer);
      retryTimer=setTimeout(()=>ensureWakeLock(),1800);
    }
  }

  const oldRequest=window.requestWakeLock;
  if(typeof oldRequest==='function'){
    window.requestWakeLock=async function(...args){
      try{await oldRequest.apply(this,args)}catch(e){}
      await ensureWakeLock();
      return wakeLock;
    };
  }

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')setTimeout(ensureWakeLock,100);
  });
  window.addEventListener('focus',()=>setTimeout(ensureWakeLock,100));
  document.addEventListener('pointerdown',()=>{if(tripIsActive())ensureWakeLock()},{passive:true});

  setInterval(()=>{
    if(tripIsActive())ensureWakeLock();
    else if(wakeLock&&!wakeLock.released){try{wakeLock.release()}catch(e){}}
  },3000);
})();
