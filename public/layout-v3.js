(() => {
  function addStyles() {
    if (document.getElementById('layoutV3Styles')) return;
    const style = document.createElement('style');
    style.id = 'layoutV3Styles';
    style.textContent = `
      .app{padding:12px 14px}
      .screen{gap:8px}
      .top-panel{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
      .top-panel h1{margin:0;font-size:1.85rem;line-height:1.1;white-space:nowrap}
      .top-controls{display:flex;align-items:center;gap:8px;direction:ltr}
      .top-icon-button{position:static!important;width:46px!important;height:46px!important;min-width:46px;padding:0!important;border-radius:50%!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:1.45rem!important;line-height:1!important;background:#eef3f7!important;color:#17202a!important;box-shadow:0 3px 10px rgba(0,0,0,.08)!important}
      #home .top{display:block}
      #home .route-buttons{margin-top:2px}
      #home .route-buttons button{min-height:74px;font-size:1.18rem;border-radius:20px}
      #home #routePreview{display:none!important}
      #home .content{justify-content:flex-start;padding-top:6px}
      #home .bus-strip{margin-top:4px;min-height:104px;border-radius:20px;padding:16px}
      #home .bus-strip.route-not-selected{display:none!important}
      #home .actions{margin-top:auto}
      #home #startButton{min-height:56px}
      #home .actions>.danger{min-height:58px;font-size:1.15rem}
      #home .actions>.ghost{display:none!important}
      #trip .top{display:block;position:relative}
      #trip .trip-top-panel{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}
      #trip .trip-title{font-size:.88rem;opacity:.7;text-align:right;line-height:1.2;flex:1}
      #trip .top-controls{flex-shrink:0}
      #trip .content{justify-content:flex-end;gap:10px;padding-top:4px}
      #trip .card{padding:15px 18px;border-radius:22px;flex-shrink:0}
      #trip .icon{font-size:2.5rem}
      #trip h2{font-size:1.22rem;margin:2px 0 7px}
      #trip .message{font-size:1.3rem;line-height:1.32}
      #trip .sub{font-size:.82rem;margin-top:5px}
      #trip .landmark-feedback{position:relative!important;left:auto!important;top:auto!important;width:100%!important;max-width:none!important;padding:8px!important;border-radius:22px!important;box-shadow:0 5px 18px rgba(0,0,0,.10)!important;flex:1;min-height:0;display:flex;flex-direction:column;justify-content:flex-start}
      #trip .landmark-feedback.hidden{display:none!important}
      #trip .landmark-feedback img{width:100%!important;height:auto!important;max-height:38vh!important;min-height:210px;object-fit:cover!important;border-radius:16px!important}
      #trip .landmark-feedback .ok{font-size:1rem!important;margin-top:7px!important}
      #trip .landmark-feedback .where{font-size:.78rem!important;margin-top:2px!important}
      #trip .landmark-dots{margin-top:4px!important}
      #trip .actions{gap:8px}
      #trip .actions>.danger{min-height:58px;font-size:1.15rem}
      #trip #backToHomeButton{min-height:54px}
      #trip #busButton{min-height:54px}
      #tripTransit{border-radius:18px;padding:10px 13px}
      #wakeStatus{font-size:.7rem}
      @media(max-height:760px){
        #trip .landmark-feedback img{max-height:32vh!important;min-height:170px}
        #trip .message{font-size:1.18rem}
        #trip .card{padding:12px 16px}
        #home .route-buttons button{min-height:64px}
      }
      @media(max-width:380px){
        .top-panel h1{font-size:1.65rem}
        .top-icon-button{width:42px!important;height:42px!important;min-width:42px;font-size:1.32rem!important}
        #trip .landmark-feedback img{min-height:180px}
      }
    `;
    document.head.appendChild(style);
  }

  function makeParentButton(id) {
    const b = document.createElement('button');
    b.id = id;
    b.type = 'button';
    b.className = 'top-icon-button';
    b.textContent = '⚙️';
    b.setAttribute('aria-label', 'מצב הורה');
    b.title = 'מצב הורה';
    b.onclick = () => openRecorder();
    return b;
  }

  function normalizeSoundButton(button) {
    if (!button) return;
    button.classList.add('top-icon-button');
    button.classList.remove('sound-icon-button');
  }

  function buildHomeHeader() {
    const top = document.querySelector('#home .top');
    if (!top || document.getElementById('homeTopPanel')) return;
    const h1 = top.querySelector('h1');
    const sound = document.getElementById('homeSoundIconButton');
    const panel = document.createElement('div');
    panel.id = 'homeTopPanel';
    panel.className = 'top-panel';
    const controls = document.createElement('div');
    controls.className = 'top-controls';
    controls.appendChild(makeParentButton('homeParentIconButton'));
    if (sound) { normalizeSoundButton(sound); controls.appendChild(sound); }
    if (h1) panel.appendChild(h1);
    panel.appendChild(controls);
    top.insertBefore(panel, top.firstChild);
  }

  function buildTripHeader() {
    const top = document.querySelector('#trip .top');
    if (!top || document.getElementById('tripTopPanel')) return;
    const routeName = document.getElementById('routeName');
    const sound = document.getElementById('tripSoundIconButton');
    const panel = document.createElement('div');
    panel.id = 'tripTopPanel';
    panel.className = 'trip-top-panel';
    if (routeName) { routeName.classList.add('trip-title'); panel.appendChild(routeName); }
    const controls = document.createElement('div');
    controls.className = 'top-controls';
    controls.appendChild(makeParentButton('tripParentIconButton'));
    if (sound) { normalizeSoundButton(sound); controls.appendChild(sound); }
    panel.appendChild(controls);
    top.insertBefore(panel, top.firstChild);
  }

  function hideLegacyParentButton() {
    document.querySelector('#home .actions .ghost')?.remove();
  }

  function syncEtaVisibility() {
    const strip = document.querySelector('#home .bus-strip');
    if (!strip) return;
    strip.classList.toggle('route-not-selected', !window.selectedRoute);
  }

  function install() {
    addStyles();
    buildHomeHeader();
    buildTripHeader();
    hideLegacyParentButton();
    syncEtaVisibility();

    const school = document.getElementById('schoolRouteButton');
    const home = document.getElementById('homeRouteButton');
    school?.addEventListener('click', () => setTimeout(syncEtaVisibility, 0));
    home?.addEventListener('click', () => setTimeout(syncEtaVisibility, 0));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install, 0));
  else setTimeout(install, 0);
})();
