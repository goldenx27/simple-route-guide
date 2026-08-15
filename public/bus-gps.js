(() => {
  const TOTAL_STOPS = 7;
  const PASS_THRESHOLDS = [0.13, 0.27, 0.41, 0.55, 0.69, 0.83, 0.96];
  let busWatch = null;
  let passedStops = 0;
  let updating = false;
  let lastProgress = 0;

  function endpointConfig() {
    if (selectedRoute === 'maor-home-school') {
      return { start: routeRecordings['home-to-38283'], end: routeRecordings['38252-to-school'] };
    }
    if (selectedRoute === 'maor-school-home') {
      return { start: routeRecordings['school-to-36743'], end: routeRecordings['33734-to-home'] };
    }
    return null;
  }

  function edgePoint(recording, edge) {
    const pts = recording?.points;
    if (!Array.isArray(pts) || !pts.length) return null;
    return edge === 'start' ? pts[0] : pts[pts.length - 1];
  }

  function busEndpoints() {
    const cfg = endpointConfig();
    if (!cfg) return null;
    const start = edgePoint(cfg.start, 'end');
    const end = edgePoint(cfg.end, 'start');
    if (!start || !end || distanceMeters(start, end) < 250) return null;
    return { start, end };
  }

  function projectedProgress(here, start, end) {
    const lat0 = ((start.lat + end.lat) / 2) * Math.PI / 180;
    const kx = 111320 * Math.cos(lat0), ky = 110540;
    const vx = (end.lon - start.lon) * kx, vy = (end.lat - start.lat) * ky;
    const wx = (here.lon - start.lon) * kx, wy = (here.lat - start.lat) * ky;
    const denom = vx * vx + vy * vy;
    if (!denom) return 0;
    return Math.max(0, Math.min(1.05, (wx * vx + wy * vy) / denom));
  }

  function paintBusGpsStatus() {
    if (!current || current.step?.type !== 'bus') return;
    const sub = document.getElementById('sub');
    if (!sub) return;
    const remaining = Math.max(0, TOTAL_STOPS - passedStops);
    sub.textContent = `GPS · עברנו ${passedStops} מתוך ${TOTAL_STOPS} תחנות · נשארו ${remaining}`;
  }

  async function pushRemaining(remaining) {
    if (!tripId || updating) return;
    updating = true;
    try {
      const d = await api(`/api/trips/${tripId}/bus-progress`, { method: 'POST', body: JSON.stringify({ remaining_stops: remaining }) });
      render(d); paintBusGpsStatus();
      if (d.alert) navigator.vibrate?.([350,150,350,150,600]);
      else if (d.step?.type === 'walk') {
        navigator.vibrate?.([500,180,500]); speak(d.message || d.step?.instruction); stopBusGpsTracker();
      }
    } catch (e) { console.warn('bus GPS progress update failed', e); }
    finally { updating = false; }
  }

  async function evaluateBusPosition(pos) {
    if (!current || current.step?.type !== 'bus' || (pos.coords.accuracy || 999) > 60) return;
    const endpoints = busEndpoints(); if (!endpoints) return;
    const here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    let progress = projectedProgress(here, endpoints.start, endpoints.end);
    const distanceToEnd = distanceMeters(here, endpoints.end);
    progress = Math.max(lastProgress, progress); lastProgress = progress;
    let candidate = passedStops;
    for (let i = passedStops; i < PASS_THRESHOLDS.length; i++) {
      if (progress >= PASS_THRESHOLDS[i]) candidate = i + 1; else break;
    }
    if (distanceToEnd <= Math.max(55, (pos.coords.accuracy || 15) + 25) && progress >= 0.82) candidate = TOTAL_STOPS;
    if (candidate <= passedStops) { paintBusGpsStatus(); return; }
    passedStops = candidate;
    await pushRemaining(Math.max(0, TOTAL_STOPS - passedStops));
  }

  function startBusGpsTracker(initialPassed = 0) {
    stopBusGpsTracker();
    passedStops = Math.max(0, Math.min(TOTAL_STOPS, Number(initialPassed) || 0));
    lastProgress = passedStops ? PASS_THRESHOLDS[Math.max(0, passedStops - 1)] : 0;
    if (!navigator.geolocation || !busEndpoints()) {
      const sub = document.getElementById('sub');
      if (sub && current?.step?.type === 'bus') sub.textContent = 'GPS · ממתין לנתוני ארבע ההקלטות';
      return;
    }
    paintBusGpsStatus();
    busWatch = navigator.geolocation.watchPosition(evaluateBusPosition, () => {}, { enableHighAccuracy: true, maximumAge: 1500, timeout: 15000 });
  }

  function stopBusGpsTracker() { if (busWatch != null) navigator.geolocation.clearWatch(busWatch); busWatch = null; }

  window.startBusGpsTracker = startBusGpsTracker;
  window.stopBusGpsTracker = stopBusGpsTracker;
  window.busGpsEndpoints = busEndpoints;
  window.busProjectedProgress = projectedProgress;

  const originalBoardBus = window.boardBus;
  window.boardBus = async function (...args) {
    const result = await originalBoardBus.apply(this, args);
    startBusGpsTracker();
    return result;
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && current?.step?.type === 'bus' && busWatch == null) startBusGpsTracker();
  });
})();
