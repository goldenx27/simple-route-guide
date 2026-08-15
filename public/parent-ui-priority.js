(() => {
  function addStyles() {
    if (document.getElementById('parentPriorityStyles')) return;
    const style = document.createElement('style');
    style.id = 'parentPriorityStyles';
    style.textContent = `
      #recorder .parent-priority-status{display:grid;gap:8px;margin-top:-2px}
      #recorder .parent-priority-status #routeDataState,
      #recorder .parent-priority-status .parent-device-state{margin:0!important;padding:11px 12px!important;border-radius:14px!important;font-size:.86rem!important;font-weight:900!important;text-align:center!important}
      #recorder .parent-priority-status #routeDataState{background:#e8f5ec!important;color:#176b36!important}
      #recorder .parent-priority-status .parent-device-state{background:#eef3f7!important;color:#17202a!important}
    `;
    document.head.appendChild(style);
  }

  function apply() {
    const recorder = document.getElementById('recorder');
    const header = recorder?.querySelector('.parent-header');
    if (!recorder || !header) return false;

    addStyles();

    // This was only a development helper; keep it out of the parent UI entirely.
    document.getElementById('parentSimulateButton')?.remove();

    let priority = recorder.querySelector('.parent-priority-status');
    if (!priority) {
      priority = document.createElement('div');
      priority.className = 'parent-priority-status';
      header.insertAdjacentElement('afterend', priority);
    }

    const routeState = document.getElementById('routeDataState');
    if (routeState && routeState.parentElement !== priority) priority.appendChild(routeState);

    const deviceState = recorder.querySelector('.parent-device-state');
    if (deviceState && deviceState.parentElement !== priority) priority.appendChild(deviceState);

    return true;
  }

  function install() {
    if (apply()) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (apply() || attempts > 30) clearInterval(timer);
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
