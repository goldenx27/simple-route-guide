(() => {
  function ensure() {
    if (document.getElementById('exportButton')) return true;
    const recorder = document.getElementById('recorder');
    if (!recorder || recorder.dataset.genericWizard !== '1') return false;

    // The legacy recorder uses exportButton.disabled as its internal
    // "recording has finished" flag. The cloud wizard no longer shows a
    // download action, but keeping this hidden sentinel preserves that state.
    const b = document.createElement('button');
    b.id = 'exportButton';
    b.type = 'button';
    b.disabled = true;
    b.className = 'hidden';
    b.tabIndex = -1;
    b.setAttribute('aria-hidden', 'true');
    recorder.appendChild(b);
    return true;
  }

  if (!ensure()) {
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if (ensure() || tries > 50) clearInterval(timer);
    }, 100);
  }
})();
