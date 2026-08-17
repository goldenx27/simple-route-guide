(() => {
  let originalSpeak = typeof window.speak === 'function' ? window.speak : null;
  let speechPrimed = false;

  function installStyles() {
    if (document.getElementById('soundUiStyles')) return;
    const style = document.createElement('style');
    style.id = 'soundUiStyles';
    style.textContent = `
      .sound-icon-button{position:absolute;top:8px;left:8px;width:48px;height:48px;padding:0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.55rem;line-height:1;background:#eef3f7;color:#17202a;z-index:12;box-shadow:0 3px 12px rgba(0,0,0,.10)}
      #home>.top,#trip>.top{position:relative}
    `;
    document.head.appendChild(style);
  }

  function soundButtons() {
    return [document.getElementById('homeSoundIconButton'), document.getElementById('tripSoundIconButton')].filter(Boolean);
  }

  function paintIcons() {
    soundButtons().forEach(b => {
      b.textContent = soundEnabled ? '🔊' : '🔇';
      b.setAttribute('aria-label', soundEnabled ? 'השתק קול' : 'הפעל קול');
      b.title = soundEnabled ? 'השתק קול' : 'הפעל קול';
      b.setAttribute('aria-pressed', soundEnabled ? 'false' : 'true');
    });
  }

  function hebrewVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices?.() || [];
    return voices.find(v => /^he(-|_)/i.test(v.lang || '')) || voices.find(v => /hebrew/i.test(v.name || '')) || null;
  }

  function primeSpeech() {
    if (speechPrimed || !soundEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.resume?.();
      const u = new SpeechSynthesisUtterance(' ');
      u.lang = 'he-IL';
      u.volume = 0.01;
      u.rate = 2;
      const v = hebrewVoice(); if (v) u.voice = v;
      window.speechSynthesis.speak(u);
      speechPrimed = true;
    } catch (e) {}
  }

  function reliableSpeak(text) {
    if (!soundEnabled || !text || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume?.();
      const spoken = String(text).replace(/שטמפפר/g,'Shtampeper');
      const make = () => {
        const u = new SpeechSynthesisUtterance(spoken);
        u.lang = 'he-IL';
        u.rate = 0.95;
        u.pitch = 1;
        u.volume = 1;
        const v = hebrewVoice(); if (v) u.voice = v;
        return u;
      };
      window.speechSynthesis.speak(make());
      setTimeout(() => {
        if (!soundEnabled) return;
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          try { window.speechSynthesis.resume?.(); window.speechSynthesis.speak(make()); } catch (e) {}
        }
      }, 650);
    } catch (e) {
      try { originalSpeak?.(text); } catch (_) {}
    }
  }

  function makeButton(id, parent) {
    if (!parent || document.getElementById(id)) return;
    const b = document.createElement('button');
    b.id = id;
    b.type = 'button';
    b.className = 'sound-icon-button';
    b.dataset.soundControl = '1';
    b.onclick = () => {
      toggleSound();
      requestAnimationFrame(paintIcons);
      if (soundEnabled) {
        speechPrimed = false;
        primeSpeech();
        setTimeout(() => reliableSpeak('הקול פועל'), 80);
      } else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
    parent.appendChild(b);
  }

  function install() {
    installStyles();
    document.getElementById('soundToggleButton')?.remove();
    makeButton('homeSoundIconButton', document.querySelector('#home .top'));
    makeButton('tripSoundIconButton', document.querySelector('#trip .top'));
    paintIcons();
    document.addEventListener('pointerdown', e => {
      if (e.target?.closest?.('#startButton,#schoolRouteButton,#homeRouteButton,[data-sound-control="1"]')) primeSpeech();
    }, { passive: true });
    window.speak = reliableSpeak;
    window.speechSynthesis?.addEventListener?.('voiceschanged', () => {});
  }

  const originalToggle = window.toggleSound;
  if (typeof originalToggle === 'function') {
    window.toggleSound = function (...args) {
      const result = originalToggle.apply(this, args);
      requestAnimationFrame(paintIcons);
      return result;
    };
  }

  window.paintSoundIcons = paintIcons;
  window.primeSpeech = primeSpeech;
  window.reliableSpeak = reliableSpeak;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
