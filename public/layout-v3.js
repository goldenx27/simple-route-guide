(() => {
  let debugLastPosition=null,debugLastPositionAt=null,debugLastError=null,debugRefreshTimer=null;

  function addStyles() {
    if (document.getElementById('layoutV3Styles')) return;
    const style = document.createElement('style');
    style.id = 'layoutV3Styles';
    style.textContent = `
      .app{padding:12px 14px}.screen{gap:8px}
      .top-panel{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;min-height:50px;height:50px}
      .top-panel h1{margin:0;font-size:1.85rem;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .top-controls{display:flex;align-items:center;gap:8px;direction:ltr}
      .top-icon-button{position:static!important;width:46px!important;height:46px!important;min-width:46px;padding:0!important;border-radius:50%!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:1.45rem!important;line-height:1!important;background:#eef3f7!important;color:#17202a!important;box-shadow:0 3px 10px rgba(0,0,0,.08)!important}
      .route-action-row,#home .route-buttons{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:2px;height:74px}
      .route-action-row button,#home .route-buttons button{height:74px;min-height:74px;font-size:1.18rem;border-radius:20px}
      #home .top,#trip .top{display:block;position:relative}
      #home #routePreview{display:none!important}
      #home .bus-strip,#tripTransit{margin-top:10px;height:104px;min-height:104px;border-radius:20px;padding:16px;flex-shrink:0}
      #home .bus-strip.route-not-selected{display:none!important}
      #home .content{display:none!important}
      #home .actions{margin-top:auto}
      #home .actions>.danger,#home .actions>.ghost{display:none!important}
      #home #startButton{min-height:58px;font-size:1.15rem}
      #trip .content{justify-content:flex-end;gap:10px;padding-top:4px}
      #trip .card{padding:15px 18px;border-radius:22px;flex-shrink:0}
      #trip .icon{font-size:2.5rem}#trip h2{font-size:1.22rem;margin:2px 0 7px}
      #trip .message{font-size:1.3rem;line-height:1.32}#trip .sub{font-size:.82rem;margin-top:5px}
      #trip .landmark-feedback{position:relative!important;left:auto!important;top:auto!important;width:100%!important;max-width:none!important;padding:8px!important;border-radius:22px!important;box-shadow:0 5px 18px rgba(0,0,0,.10)!important;flex:1;min-height:0;display:flex;flex-direction:column;justify-content:flex-start}
      #trip .landmark-feedback.hidden{display:none!important}
      #trip .landmark-feedback img{width:100%!important;height:auto!important;max-height:38vh!important;min-height:210px;object-fit:cover!important;border-radius:16px!important}
      #trip .landmark-feedback .ok{font-size:1rem!important;margin-top:7px!important}.landmark-feedback .where{font-size:.78rem!important;margin-top:2px!important}
      #trip .actions{display:none!important}
      #trip #busButton.trip-inline-bus{display:block!important;margin-top:10px;min-height:50px}
      #trip #busButton.trip-inline-bus.hidden{display:none!important}
      #wakeStatus{display:none!important}
      #routeName{display:none!important}
      #gpsDebugPanel{position:fixed;z-index:9999;left:8px;right:8px;bottom:8px;max-height:46vh;overflow:auto;background:rgba(18,24,31,.96);color:#fff;border-radius:16px;padding:12px;direction:ltr;text-align:left;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;line-height:1.45;box-shadow:0 10px 30px rgba(0,0,0,.3)}
      #gpsDebugPanel.hidden{display:none!important}#gpsDebugPanel .debug-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;font-family:system-ui,sans-serif;font-weight:800;direction:rtl}
      #gpsDebugPanel .debug-close{width:auto;padding:6px 10px;border-radius:10px;background:#34404c;color:#fff;font-size:12px}#gpsDebugPanel .debug-ok{color:#9ee6af}#gpsDebugPanel .debug-warn{color:#ffd27a}#gpsDebugPanel .debug-error{color:#ff9d9d}
      @media(max-height:760px){.top-panel{height:46px;min-height:46px}#home .route-buttons,.route-action-row{height:64px}#home .route-buttons button,.route-action-row button{height:64px;min-height:64px}#home .bus-strip,#tripTransit{height:96px;min-height:96px;padding:12px}#trip .landmark-feedback img{max-height:29vh!important;min-height:160px}#trip .message{font-size:1.16rem}#trip .card{padding:11px 15px}}
      @media(max-width:380px){.top-panel h1{font-size:1.65rem}.top-icon-button{width:42px!important;height:42px!important;min-width:42px;font-size:1.32rem!important}#trip .landmark-feedback img{min-height:165px}}
    `;
    document.head.appendChild(style);
  }

  function makeParentButton(id){const b=document.createElement('button');b.id=id;b.type='button';b.className='top-icon-button';b.textContent='⚙️';b.setAttribute('aria-label','מצב הורה');b.title='מצב הורה';b.onclick=()=>openRecorder();return b}
  function makeDebugButton(id){const b=document.createElement('button');b.id=id;b.type='button';b.className='top-icon-button';b.textContent='🐞';b.setAttribute('aria-label','מצב דיבאג GPS');b.title='מצב דיבאג GPS';b.onclick=toggleGpsDebug;return b}
  function normalizeSoundButton(button){if(!button)return;button.classList.add('top-icon-button');button.dataset.soundControl='1'}

  function makeHeader(screenId,soundId,parentId){
    const top=document.querySelector(`#${screenId} .top`);if(!top)return;
    if(document.getElementById(`${screenId}TopPanel`))return;
    const existingHeadings=[...top.querySelectorAll('h1')];
    const h=existingHeadings.shift()||document.createElement('h1');
    h.textContent='היי מאור 👋';
    existingHeadings.forEach(x=>x.remove());
    const panel=document.createElement('div');panel.id=`${screenId}TopPanel`;panel.className='top-panel';
    const controls=document.createElement('div');controls.className='top-controls';controls.appendChild(makeParentButton(parentId));controls.appendChild(makeDebugButton(`${screenId}DebugButton`));
    const sound=document.getElementById(soundId);if(sound){normalizeSoundButton(sound);controls.appendChild(sound)}
    panel.appendChild(h);panel.appendChild(controls);top.insertBefore(panel,top.firstChild);
  }

  function createDebugPanel(){if(document.getElementById('gpsDebugPanel'))return;const panel=document.createElement('div');panel.id='gpsDebugPanel';panel.className='hidden';panel.innerHTML='<div class="debug-head"><span>🐞 GPS Debug</span><button type="button" class="debug-close" id="gpsDebugClose">סגור</button></div><div id="gpsDebugBody">ממתין לנתוני GPS…</div>';document.body.appendChild(panel);document.getElementById('gpsDebugClose').onclick=()=>toggleGpsDebug(false)}
  function toggleGpsDebug(force){createDebugPanel();const p=document.getElementById('gpsDebugPanel'),show=typeof force==='boolean'?force:p.classList.contains('hidden');p.classList.toggle('hidden',!show);localStorage.setItem('simpleRouteGpsDebug',show?'on':'off');if(show){refreshGpsDebug();if(!debugRefreshTimer)debugRefreshTimer=setInterval(refreshGpsDebug,1000)}else if(debugRefreshTimer){clearInterval(debugRefreshTimer);debugRefreshTimer=null}}
  window.toggleGpsDebug=toggleGpsDebug;
  function safeValue(name,fallback='—'){try{return typeof window[name]!=='undefined'?window[name]:eval(name)}catch(e){return fallback}}
  function fmt(v,d=6){return Number.isFinite(Number(v))?Number(v).toFixed(d):'—'}
  function distanceMeters(a,b){if(!a||!b)return null;const lat1=Number(a.latitude??a.lat),lon1=Number(a.longitude??a.lon??a.lng),lat2=Number(b.latitude??b.lat),lon2=Number(b.longitude??b.lon??b.lng);if(![lat1,lon1,lat2,lon2].every(Number.isFinite))return null;const r=6371000,p1=lat1*Math.PI/180,p2=lat2*Math.PI/180,dp=(lat2-lat1)*Math.PI/180,dl=(lon2-lon1)*Math.PI/180,h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*r*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))}
  function nearestLandmark(position){try{const recordings=safeValue('routeRecordings',{}),landmarks=[];Object.entries(recordings||{}).forEach(([segment,r])=>(r?.landmarks||[]).forEach((l,i)=>landmarks.push({...l,_segment:segment,_index:i})));let best=null;for(const l of landmarks){const d=distanceMeters(position?.coords,l);if(d==null)continue;if(!best||d<best.distance)best={landmark:l,distance:d}}return best}catch(e){return null}}
  function refreshGpsDebug(){const body=document.getElementById('gpsDebugBody');if(!body)return;const p=debugLastPosition,age=debugLastPositionAt?Math.max(0,Math.round((Date.now()-debugLastPositionAt)/1000)):null,nearest=nearestLandmark(p),selected=safeValue('selectedRoute'),cur=safeValue('current'),tid=safeValue('tripId'),watch=safeValue('gpsWatch'),lock=safeValue('gpsAdvanceLock'),lastKey=safeValue('lastAutoAdvanceKey'),rec=safeValue('routeRecordings',{});let decision='ממתין ל-GPS';if(debugLastError)decision=`GPS error ${debugLastError.code}: ${debugLastError.message}`;else if(p){const acc=Number(p.coords?.accuracy);decision=acc>80?'דיוק GPS נמוך — ייתכן שהמיקום לא מספיק אמין':age>15?'נתון GPS ישן — ממתין לעדכון חדש':'GPS מתקבל ונראה עדכני'}const lines=[`status: ${debugLastError?'<span class="debug-error">ERROR</span>':p?'<span class="debug-ok">GPS RECEIVED</span>':'<span class="debug-warn">WAITING</span>'}`,`lat: ${fmt(p?.coords?.latitude)}  lon: ${fmt(p?.coords?.longitude)}`,`accuracy: ${p?.coords?.accuracy!=null?Math.round(p.coords.accuracy)+' m':'—'}  age: ${age!=null?age+' s':'—'}`,`speed: ${p?.coords?.speed!=null?fmt(p.coords.speed,1)+' m/s':'—'}  heading: ${p?.coords?.heading!=null?fmt(p.coords.heading,0)+'°':'—'}`,`selectedRoute: ${selected||'—'}  tripId: ${tid||'—'}`,`gpsWatch: ${watch??'—'}  advanceLock: ${String(lock??'—')}`,`current step: ${cur?.type||cur?.step||cur?.title||'—'}`,`lastAutoAdvanceKey: ${lastKey||'—'}`,`route recordings: ${Object.keys(rec||{}).length}/4`,`nearest landmark: ${nearest?`${nearest.landmark._segment} #${nearest.landmark._index+1} · ${Math.round(nearest.distance)} m`:'—'}`,`decision: ${decision}`];body.innerHTML=lines.join('<br>')}
  function installGeolocationTap(){if(!navigator.geolocation||navigator.geolocation.__simpleRouteDebugWrapped)return;const geo=navigator.geolocation,origWatch=geo.watchPosition.bind(geo),origGet=geo.getCurrentPosition.bind(geo);try{geo.watchPosition=function(success,error,options){return origWatch(pos=>{debugLastPosition=pos;debugLastPositionAt=Date.now();debugLastError=null;refreshGpsDebug();success?.(pos)},err=>{debugLastError=err;refreshGpsDebug();error?.(err)},options)};geo.getCurrentPosition=function(success,error,options){return origGet(pos=>{debugLastPosition=pos;debugLastPositionAt=Date.now();debugLastError=null;refreshGpsDebug();success?.(pos)},err=>{debugLastError=err;refreshGpsDebug();error?.(err)},options)};geo.__simpleRouteDebugWrapped=true}catch(e){debugLastError={code:'wrap',message:String(e?.message||e)}}}

  function placeHomeBusPanel(){const top=document.querySelector('#home .top'),routes=document.querySelector('#home .route-buttons'),strip=document.querySelector('#home .bus-strip');if(top&&routes&&strip&&strip.parentElement!==top)routes.insertAdjacentElement('afterend',strip)}

  function buildTripActionRow(){
    const top=document.querySelector('#trip .top');if(!top||document.getElementById('tripActionRow'))return;
    const row=document.createElement('div');row.id='tripActionRow';row.className='route-action-row';
    const back=document.createElement('button');back.className='secondary';back.textContent='🏠 חזרה לתפריט הראשי';back.onclick=()=>window.goHomeMenu?.();
    const help=document.createElement('button');help.className='danger';help.textContent='🆘 צריך עזרה';help.onclick=()=>sendHelp();
    row.appendChild(back);row.appendChild(help);
    const panel=document.getElementById('tripTopPanel');if(panel)panel.insertAdjacentElement('afterend',row);else top.insertBefore(row,top.firstChild);
  }

  function placeTripBusPanel(){const top=document.querySelector('#trip .top'),row=document.getElementById('tripActionRow'),strip=document.getElementById('tripTransit');if(top&&row&&strip&&strip.parentElement!==top)row.insertAdjacentElement('afterend',strip)}
  function moveBusButtonIntoCard(){const b=document.getElementById('busButton'),card=document.querySelector('#trip .card');if(!b||!card)return;b.classList.add('trip-inline-bus');if(b.parentElement!==card)card.appendChild(b)}
  function cleanLegacyButtons(){document.querySelector('#home .actions .danger')?.remove();document.querySelector('#home .actions .ghost')?.remove();document.getElementById('backToHomeButton')?.remove();document.querySelector('#trip .actions>.danger')?.remove()}
  function syncEtaVisibility(){const strip=document.querySelector('#home .bus-strip');if(strip)strip.classList.toggle('route-not-selected',!selectedRoute)}
  function startHomeEtaPolling(){if(!selectedRoute)return;refreshEta();if(etaTimer)clearInterval(etaTimer);etaTimer=setInterval(()=>{if(!tripId&&selectedRoute)refreshEta()},20000)}

  function install(){
    addStyles();installGeolocationTap();createDebugPanel();makeHeader('home','homeSoundIconButton','homeParentIconButton');makeHeader('trip','tripSoundIconButton','tripParentIconButton');
    placeHomeBusPanel();buildTripActionRow();placeTripBusPanel();moveBusButtonIntoCard();cleanLegacyButtons();syncEtaVisibility();
    const routeChosen=()=>setTimeout(()=>{syncEtaVisibility();startHomeEtaPolling();refreshGpsDebug()},0);
    document.getElementById('schoolRouteButton')?.addEventListener('click',routeChosen);document.getElementById('homeRouteButton')?.addEventListener('click',routeChosen);
    if(localStorage.getItem('simpleRouteGpsDebug')==='on')toggleGpsDebug(true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));else setTimeout(install,0);
})();
