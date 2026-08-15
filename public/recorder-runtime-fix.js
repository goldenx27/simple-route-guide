(()=>{
  try {
    // The legacy recorder awaits requestWakeLock() before assigning recWatch.
    // On some Android/WebView builds the Wake Lock promise can remain pending,
    // leaving the UI showing "stop recording" while GPS/timer never started.
    // Make Wake Lock fire-and-forget so recording can never be blocked by it.
    requestWakeLock = function(){
      try {
        if ('wakeLock' in navigator) {
          Promise.resolve(navigator.wakeLock.request('screen'))
            .then(lock => { wakeLock = lock; })
            .catch(() => {});
      } catch (e) {}
      return Promise.resolve();
    };

    // Also harden toggleRecording against the short startup window before the
    // first GPS callback. Button text is the visible source of truth here.
    toggleRecording = function(){
      const b = document.getElementById('recordButton');
      const stopping = !!b && /סיים/.test(b.textContent || '');
      if (stopping) {
        stopRecording();
      } else {
        startRecording();
      }
    };
  } catch (e) {
    console.error('recorder runtime fix failed', e);
  }
})();
