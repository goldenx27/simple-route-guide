(() => {
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
      #debugToggleButton,#debugPanel,#gpsDebugPanel,#homeDebugButton,#tripDebugButton{display:none!important}

      #recorder{display:flex!important;flex-direction:column!important;gap:12px!important;overflow:auto!important;padding-bottom:16px}
      #recorder.hidden{display:none!important}
      #recorder .parent-header{display:flex;align-items:center;justify-content:space-between;gap:10px;position:sticky;top:0;background:#fff;z-index:8;padding:2px 0 8px}
      #recorder .parent-header h1{margin:0;font-size:1.65rem}
      #recorder .parent-back{width:auto!important;min-width:48px!important;height:48px!important;padding:0 13px!important;border-radius:16px!important;background:#eef3f7!important;color:#17202a!important;font-size:1rem!important;box-shadow:none!important}
      #recorder .parent-section{background:#f7f8fa;border-radius:20px;padding:14px;display:grid;gap:10px}
      #recorder .parent-section-title{font-size:.82rem;font-weight:900;color:#52606d;margin:0 2px}
      #recorder .parent-route-select{display:grid;gap:7px}
      #recorder .parent-route-select label{font-size:.8rem;font-weight:800;color:#52606d}
      #recorder #segmentSelect{margin:0;background:#fff;border-color:#d7e0e7}
      #recorder .rec-panel{margin:0;background:transparent;padding:0;border-radius:0}
      #recorder .rec-stats{gap:8px}
      #recorder .stat{border:1px solid #edf0f3;box-shadow:0 2px 8px rgba(0,0,0,.03)}
      #recorder #recStatus{margin:0!important;padding:9px 10px;border-radius:12px;background:#fff;text-align:center!important;opacity:.8}
      #recorder #routeDataState{margin:0;background:#eaf1f6;font-weight:800}
      #recorder .rec-log{max-height:260px;min-height:100px;background:#fff;border:1px solid #edf0f3}
      #recorder .parent-record-actions{display:grid;grid-template-columns:1.15fr .85fr;gap:8px}
      #recorder .parent-record-actions button{margin:0;min-height:56px}
      #recorder .parent-data-actions{display:grid;grid-template-columns:1fr;gap:8px}
      #recorder .parent-data-row{display:grid;grid-template-columns:1fr 56px;gap:8px}
      #recorder .parent-data-row button{margin:0}
      #recorder .parent-secondary-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      #recorder .parent-secondary-actions button{margin:0;min-height:50px}
      #recorder .parent-danger-zone{background:#fff3f3;border:1px solid #ffd9d9;border-radius:20px;padding:12px;display:grid;gap:8px}
      #recorder .parent-danger-zone .parent-section-title{color:#9c1c1c}
      #recorder .parent-danger-zone button{margin:0}
      #recorder .parent-bottom-back{display:none!important}
      #recorder .parent-device-state{font-size:.82rem;text-align:center;padding:10px;border-radius:14px;background:#eef3f7;font-weight:800}

      @media(max-height:760px){.top-panel{height:46px;min-height:46px}#home .route-buttons,.route-action-row{height:64px}#home .route-buttons button,.route-action-row button{height:64px;min-height:64px}#home .bus-strip,#tripTransit{height:96px;min-height:96px;padding:12px}#trip .landmark-feedback img{max-height:29vh!important;min-height:160px}#trip .message{font-size:1.16rem}#trip .card{padding:11px 15px}}
      @media(max-width:380px){.top-panel h1{font-size:1.65rem}.top-icon-button{width:42px!important;height:42px!important;min-width:42px;font-size:1.32rem!important}#trip .landmark-feedback img{min-height:165px}#recorder .parent-secondary-actions{grid-template-columns:1fr}#recorder .parent-header h1{font-size:1.45rem}}
    `;
    document.head.appendChild(style);
  }

  function makeParentButton(id){
    const b=document.createElement('button');
    b.id=id;b.type='button';b.className='top-icon-button';b.textContent='⚙️';
    b.setAttribute('aria-label','מצב הורה');b.title='מצב הורה';
    b.addEventListener('click',()=>{if(typeof window.openRecorder==='function')window.openRecorder()});
    return b;
  }
  function normalizeSoundButton(button){if(!button)return;button.classList.add('top-icon-button');button.dataset.soundControl='1'}

  function makeHeader(screenId,soundId,parentId){
    const top=document.querySelector(`#${screenId} .top`);if(!top)return;
    if(document.getElementById(`${screenId}TopPanel`))return;
    const existingHeadings=[...top.querySelectorAll('h1')];
    const h=existingHeadings.shift()||document.createElement('h1');
    h.textContent='היי מאור 👋';
    existingHeadings.forEach(x=>x.remove());
    const panel=document.createElement('div');panel.id=`${screenId}TopPanel`;panel.className='top-panel';
    const controls=document.createElement('div');controls.className='top-controls';
    const sound=document.getElementById(soundId);if(sound){normalizeSoundButton(sound);controls.appendChild(sound)}
    if(parentId)controls.appendChild(makeParentButton(parentId));
    panel.appendChild(h);panel.appendChild(controls);top.insertBefore(panel,top.firstChild);
  }

  function removeDebugUi(){
    ['debugToggleButton','debugPanel','gpsDebugPanel','homeDebugButton','tripDebugButton'].forEach(id=>document.getElementById(id)?.remove());
    localStorage.removeItem('simpleRouteGpsDebug');
  }

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

  function section(title,className='parent-section'){
    const box=document.createElement('section');box.className=className;
    const h=document.createElement('div');h.className='parent-section-title';h.textContent=title;box.appendChild(h);return box;
  }

  function polishRecorder(){
    const r=document.getElementById('recorder');if(!r||r.dataset.polished==='1')return;r.dataset.polished='1';
    const oldTop=r.firstElementChild;
    const heading=oldTop?.querySelector('h1');
    const select=document.getElementById('segmentSelect');
    const panel=r.querySelector('.rec-panel');
    const log=document.getElementById('recLog');
    const actions=r.querySelector('.actions');
    const photoInput=document.getElementById('photoInput');
    const routeFilesInput=document.getElementById('routeFilesInput');
    if(!heading||!select||!panel||!actions)return;

    const header=document.createElement('div');header.className='parent-header';
    heading.textContent='⚙️ הגדרות הורה';
    const back=document.createElement('button');back.type='button';back.className='parent-back';back.textContent='🏠 ראשי';back.onclick=()=>window.closeRecorder?.();
    header.appendChild(heading);header.appendChild(back);

    const routeSec=section('מסלול להקלטה');
    const routeWrap=document.createElement('div');routeWrap.className='parent-route-select';
    const label=document.createElement('label');label.htmlFor='segmentSelect';label.textContent='בחר את המקטע שאותו רוצים להקליט או לערוך';
    routeWrap.appendChild(label);routeWrap.appendChild(select);routeSec.appendChild(routeWrap);

    const statusSec=section('מצב נוכחי');statusSec.appendChild(panel);
    const deviceState=[...actions.querySelectorAll('button')].find(b=>b.textContent.includes('התראות חירום'));
    if(deviceState){const state=document.createElement('div');state.className='parent-device-state';state.textContent=deviceState.textContent;deviceState.remove();statusSec.appendChild(state)}

    const recordSec=section('הקלטת המסלול');
    if(log)recordSec.appendChild(log);
    const recPair=actions.querySelector('.rec-actions');
    if(recPair){recPair.classList.add('parent-record-actions');recordSec.appendChild(recPair)}

    const dataSec=section('נתוני המסלול והתמונות');dataSec.classList.add('parent-data-actions');
    const dataTools=actions.querySelector('.route-data-tools');
    if(dataTools){dataTools.classList.add('parent-data-row');dataSec.appendChild(dataTools)}
    const simulate=document.getElementById('parentSimulateButton');
    const exportBtn=document.getElementById('exportButton');
    const secondary=document.createElement('div');secondary.className='parent-secondary-actions';
    if(simulate)secondary.appendChild(simulate);if(exportBtn)secondary.appendChild(exportBtn);if(secondary.children.length)dataSec.appendChild(secondary);

    const danger=section('איפוס ומחיקה','parent-danger-zone');
    const clearRec=document.getElementById('clearRecordingButton');if(clearRec)danger.appendChild(clearRec);
    const legacyBottom=[...actions.querySelectorAll('button')].find(b=>b.textContent.includes('חזרה למסך מאור'));
    if(legacyBottom){legacyBottom.classList.add('parent-bottom-back');legacyBottom.remove()}

    // Preserve the hidden file inputs before removing their old actions container.
    // Android requires the camera/file input to remain attached to the live DOM when click() is triggered.
    if(photoInput)r.appendChild(photoInput);
    if(routeFilesInput)r.appendChild(routeFilesInput);

    oldTop?.remove();actions.remove();
    r.prepend(header,routeSec,statusSec,recordSec,dataSec,danger);
  }

  function install(){
    addStyles();removeDebugUi();
    makeHeader('home','homeSoundIconButton','homeParentIconButton');
    makeHeader('trip','tripSoundIconButton',null);
    placeHomeBusPanel();buildTripActionRow();placeTripBusPanel();moveBusButtonIntoCard();cleanLegacyButtons();syncEtaVisibility();polishRecorder();
    const routeChosen=()=>setTimeout(()=>{syncEtaVisibility();startHomeEtaPolling()},0);
    document.getElementById('schoolRouteButton')?.addEventListener('click',routeChosen);
    document.getElementById('homeRouteButton')?.addEventListener('click',routeChosen);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));else setTimeout(install,0);
})();
