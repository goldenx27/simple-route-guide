(() => {
  function removeManualBoarding() {
    document.getElementById('busButton')?.remove();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', removeManualBoarding);
  else removeManualBoarding();
  [100, 500, 1500].forEach(ms => setTimeout(removeManualBoarding, ms));
})();
