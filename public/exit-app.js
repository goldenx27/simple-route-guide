(() => {
  function addStyles() {
    if (document.getElementById('exitAppStyles')) return;
    const s = document.createElement('style');
    s.id = 'exitAppStyles';
    s.textContent = `
      #homeTopPanel,#tripTopPanel{position:relative!important}
      #homeTopPanel>h1,#tripTopPanel>h1{margin-right:52px!important}
      #exitAppButton{position:absolute;top:2px;right:0;z-index:20;width:46px;height:46px;min-width:46px;min-height:46px;margin:0;padding:0;border-radius:16px;background:#f1f3f5;color:#8b96a3;font-size:1.5rem;font-weight:400;display:flex;align-items:center;justify-content:center;box-shadow:none;transition:none}
      #exitAppButton:hover,#exitAppButton:focus,#exitAppButton:active{background:#f1f3f5;color:#8b96a3;box-shadow:none;transform:none;outline:none}
      #exitAppButton.hidden{display:none!important}
      #exitAppDialogBackdrop{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
      #exitAppDialogBackdrop.hidden{display:none!important}
      .exit-app-dialog{width:min(100%,360px);background:#fff;border-radius:22px;padding:20px;box-shadow:0 18px 60px rgba(0,0,0,.25);display:grid;gap:16px;text-align:center}
      .exit-app-dialog h2{margin:0;font-size:1.35rem}.exit-app-dialog p{margin:0;color:#52606d;line-height:1.45}
      .exit-app-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .exit-app-actions button{margin:0;min-height:50px}
      @media(max-width:380px){#homeTopPanel>h1,#tripTopPanel>h1{margin-right:48px!important}#exitAppButton{width:42px;height:42px;min-width:42px;min-height:42px}}
    `;
    document.head.appendChild(s);
  }

  function closeApplication() {
    try { window.close(); } catch (e) {}
    setTimeout(() => {
      try {
        if (history.length > 1) history.back();
        else location.replace('about:blank');
      } catch (e) {}
    }, 120);
  }

  function tripActive(){
    return !document.getElementById('trip')?.classList.contains('hidden') && current?.step?.type !== 'arrival';
  }
  function showDialog() {
    const p=document.getElementById('exitAppDialogText');
    if(p)p.textContent=tripActive()?'המסלול עדיין פעיל. לצאת מהאפליקציה בכל זאת?':'המסלול לא פעיל כרגע. אפשר לצאת בבטחה.';
    document.getElementById('exitAppDialogBackdrop')?.classList.remove('hidden');
  }
  function hideDialog() { document.getElementById('exitAppDialogBackdrop')?.classList.add('hidden'); }

  function installDialog() {
    if (document.getElementById('exitAppDialogBackdrop')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'exitAppDialogBackdrop'; backdrop.className = 'hidden';
    backdrop.innerHTML = `<div class="exit-app-dialog" role="dialog" aria-modal="true" aria-labelledby="exitAppTitle">
      <h2 id="exitAppTitle">לצאת מהאפליקציה?</h2>
      <p id="exitAppDialogText">המסלול לא פעיל כרגע. אפשר לצאת בבטחה.</p>
      <div class="exit-app-actions"><button id="exitAppCancel" class="secondary">ביטול</button><button id="exitAppConfirm" class="danger">יציאה</button></div>
    </div>`;
    document.body.appendChild(backdrop);
    document.getElementById('exitAppCancel').onclick = hideDialog;
    document.getElementById('exitAppConfirm').onclick = closeApplication;
    backdrop.addEventListener('click', e => { if (e.target === backdrop) hideDialog(); });
  }

  function ensureButton() {
    let b = document.getElementById('exitAppButton');
    if (!b) {
      b = document.createElement('button');
      b.id = 'exitAppButton'; b.type = 'button';
      b.textContent = '×';
      b.setAttribute('aria-label', 'סגירת האפליקציה');
      b.title = 'סגירת האפליקציה';
      b.onclick = showDialog;
    }
    return b;
  }

  function syncPlacement() {
    const b=ensureButton();
    const recorderVisible=!document.getElementById('recorder')?.classList.contains('hidden');
    if(recorderVisible){b.classList.add('hidden');return}
    const tripVisible=!document.getElementById('trip')?.classList.contains('hidden');
    const target=document.getElementById(tripVisible?'tripTopPanel':'homeTopPanel');
    if(target&&b.parentElement!==target)target.appendChild(b);
    b.classList.toggle('hidden',!target);
  }

  function boot() {
    addStyles(); installDialog(); ensureButton(); syncPlacement();
    setInterval(syncPlacement, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot,80)); else setTimeout(boot,80);
})();
