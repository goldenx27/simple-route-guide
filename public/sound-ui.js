(() => {
  function installStyles() {
    if (document.getElementById('soundUiStyles')) return;
    const style = document.createElement('style');
    style.id = 'soundUiStyles';
    style.textContent = `
      .sound-icon-button{position:absolute;top:8px;left:8px;width:48px;height:48px;padding:0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.55rem;line-height:1;background:#eef3f7;color:#17202a;z-index:12;box-shadow:0 3px 12px rgba(0,0,0,.10)}
      #home>.top,#trip>.top{position:relative}
      .landmark-feedback{width:154px!important}
      .landmark-feedback img{width:138px!important;height:122px!important}
      @media(max-width:380px){.landmark-feedback{width:138px!important}.landmark-feedback img{width:122px!important;height:108px!important}}
    `;
    document.head.appendChild(style);
  }

  function iconText() { return window.soundEnabled === false ? '🔇' : '🔊'; }

  function paintIcons() {
    document.querySelectorAll('.sound-icon-button').forEach(b => {
      b.textContent = soundEnabled ? '🔊' : '🔇';
      b.setAttribute('aria-label', soundEnabled ? 'השתק קול' : 'הפעל קול');
      b.title = soundEnabled ? 'השתק קול' : 'הפעל קול';
    });
  }

  function makeButton(id, parent) {
    if (!parent || document.getElementById(id)) return;
    const b = document.createElement('button');
    b.id = id;
    b.type = 'button';
    b.className = 'sound-icon-button';
    b.onclick = () => { toggleSound(); paintIcons(); };
    parent.appendChild(b);
  }

  function install() {
    installStyles();
    document.getElementById('soundToggleButton')?.remove();
    makeButton('homeSoundIconButton', document.querySelector('#home .top'));
    makeButton('tripSoundIconButton', document.querySelector('#trip .top'));
    paintIcons();
  }

  const originalToggle = window.toggleSound;
  if (typeof originalToggle === 'function') {
    window.toggleSound = function (...args) {
      const result = originalToggle.apply(this, args);
      paintIcons();
      return result;
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
