(()=>{
  let watchId=null,lastGoodAt=0;
  function addStyles(){if(document.getElementById('gpsIndicatorStyles'))return;const s=document.createElement('style');s.id='gpsIndicatorStyles';s.textContent=`
    #gpsQualityIndicator{position:fixed;top:18px;left:10px;z-index:120;width:48px;height:48px;border-radius:15px;background:#f1f3f5;box-shadow:0 3px 10px rgba(30,41,59,.09);pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:#66717f;font:600 9px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-sizing:border-box}
    #gpsQualityIndicator .gps-label{font-size:9px;letter-spacing:.1px;line-height:1;color:#66717f}
    #gpsQualityIndicator .gps-dot{width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.25);box-sizing:border-box;animation:gpsPulse 1s ease-in-out infinite}
    #gpsQualityIndicator.good .gps-dot{background:#22c55e}#gpsQualityIndicator.medium .gps-dot{background:#f59e0b}#gpsQualityIndicator.bad .gps-dot{background:#ef4444}
    @keyframes gpsPulse{0%,100%{opacity:1}50%{opacity:.35}}
    @media (prefers-reduced-motion:reduce){#gpsQualityIndicator .gps-dot{animation:none}}
  `;document.head.appendChild(s)}
  function ensure(){let d=document.getElementById('gpsQualityIndicator');if(!d){d=document.createElement('div');d.id='gpsQualityIndicator';d.className='bad';d.setAttribute('aria-label','מצב GPS');d.innerHTML='<span class="gps-label">GPS</span><span class="gps-dot"></span>';document.body.appendChild(d)}return d}
  function setQuality(q){const d=ensure();d.className=q}
  function onPosition(pos){const accuracy=Number(pos?.coords?.accuracy)||999;lastGoodAt=Date.now();if(accuracy<=25)setQuality('good');else if(accuracy<=60)setQuality('medium');else setQuality('bad')}
  function onError(){setQuality('bad')}
  function boot(){addStyles();ensure();if(!navigator.geolocation)return;if(watchId==null)watchId=navigator.geolocation.watchPosition(onPosition,onError,{enableHighAccuracy:true,maximumAge:3000,timeout:15000});setInterval(()=>{if(!lastGoodAt||Date.now()-lastGoodAt>20000)setQuality('bad')},5000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
