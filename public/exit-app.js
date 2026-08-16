(() => {
  function addStyles() {
    if (document.getElementById('exitAppStyles')) return;
    const s = document.createElement('style');
    s.id = 'exitAppStyles';
    s.textContent = `
      #exitAppButton{margin-top:2px;background:#f1f3f5;color:#52606d;min-height:48px}
      #exitAppDialogBackdrop{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
      #exitAppDialogBackdrop.hidden{display:none!important}
      .exit-app-dialog{width:min(100%,360px);background:#fff;border-radius:22px;padding:20px;box-shadow:0 18px 60px rgba(0,0,0,.25);display:grid;gap:16px;text-align:center}
      .exit-app-dialog h2{margin:0;font-size:1.35rem}.exit-app-dialog p{margin:0;color:#52606d;line-height:1.45}
      .exit-app-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .exit-app-actions button{margin:0;min-height:50px}
    `;
    document.head.appendChild(s);
  }

  function closeApplication() {
    try { window.close(); } catch (e) {}
    setTimeout(() => {
      // Installed PWAs may reject window.close(). Fall back to leaving the app's page.
      try {
        if (history.length > 1) history.back();
        else location.replace('about:blank');
      } catch (e) {}
    }, 120);
  }

  function showDialog() {
    const backdrop = document.getElementById('exitAppDialogBackdrop');
    backdrop?.classList.remove('hidden');
  }
  function hideDialog() { document.getElementById('exitAppDialogBackdrop')?.classList.add('hidden'); }

  function installDialog() {
    if (document.getElementById('exitAppDialogBackdrop')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'exitAppDialogBackdrop'; backdrop.className = 'hidden';
    backdrop.innerHTML = `<div class="exit-app-dialog" role="dialog" aria-modal="true" aria-labelledby="exitAppTitle">
      <h2 id="exitAppTitle">לצאת מהאפליקציה?</h2>
      <p>המסלול לא פעיל כרגע. אפשר לצאת בבטחה.</p>
      <div class="exit-app-actions"><button id="exitAppCancel" class="secondary">ביטול</button><button id="exitAppConfirm" class="danger">יציאה</button></div>
    </div>`;
    document.body.appendChild(backdrop);
    document.getElementById('exitAppCancel').onclick = hideDialog;
    document.getElementById('exitAppConfirm').onclick = closeApplication;
    backdrop.addEventListener('click', e => { if (e.target === backdrop) hideDialog(); });
  }

  function installButton() {
    const home = document.getElementById('home');
    const actions = home?.querySelector('.actions');
    if (!actions) return false;
    let b = document.getElementById('exitAppButton');
    if (!b) {
      b = document.createElement('button'); b.id = 'exitAppButton'; b.type = 'button';
      b.textContent = '🚪 סגירת האפליקציה'; b.onclick = showDialog;
      actions.appendChild(b);
    }
    return true;
  }

  function syncVisibility() {
    const b = document.getElementById('exitAppButton'); if (!b) return;
    const homeVisible = !document.getElementById('home')?.classList.contains('hidden');
    const tripVisible = !document.getElementById('trip')?.classList.contains('hidden');
    b.classList.toggle('hidden', !homeVisible || tripVisible);
  }

  function boot() {
    addStyles(); installDialog(); installButton(); syncVisibility();
    setInterval(syncVisibility, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
