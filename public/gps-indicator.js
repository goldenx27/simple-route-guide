(()=>{
  let watchId=null,lastGoodAt=0;
  function addStyles(){if(document.getElementById('gpsIndicatorStyles'))return;const s=document.createElement('style');s.id='gpsIndicatorStyles';s.textContent=`
    #gpsQualityIndicator{position:fixed;top:17px;left:18px;z-index:120;width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.28);pointer-events:none;transition:background .25s ease}
    #gpsQualityIndicator.good{background:#22c55e}#gpsQualityIndicator.medium{background:#f59e0b}#gpsQualityIndicator.bad{background:#ef4444}
  `;document.head.appendChild(s)}
  function ensure(){let d=document.getElementById('gpsQualityIndicator');if(!d){d=document.createElement('div');d.id='gpsQualityIndicator';d.className='bad';d.setAttribute('aria-label','מצב GPS');document.body.appendChild(d)}return d}
  function setQuality(q){const d=ensure();d.className=q}
  function onPosition(pos){const accuracy=Number(pos?.coords?.accuracy)||999;lastGoodAt=Date.now();if(accuracy<=25)setQuality('good');else if(accuracy<=60)setQuality('medium');else setQuality('bad')}
  function onError(){setQuality('bad')}
  function boot(){addStyles();ensure();if(!navigator.geolocation)return;if(watchId==null)watchId=navigator.geolocation.watchPosition(onPosition,onError,{enableHighAccuracy:true,maximumAge:3000,timeout:15000});setInterval(()=>{if(!lastGoodAt||Date.now()-lastGoodAt>20000)setQuality('bad')},5000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
