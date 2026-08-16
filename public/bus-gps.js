(() => {
  const TOTAL_STOPS = 7;
  // Temporary route-relative stop milestones. These are intentionally isolated here so
  // real GTFS/SIRI stop coordinates can replace them without changing the trip flow.
  const STOP_PROGRESS = [0.13, 0.27, 0.41, 0.55, 0.69, 0.83, 0.96];
  const MAX_ACCURACY = 65;
  const MAX_JUMP_METERS = 220;
  const CONFIRMATIONS_REQUIRED = 2;

  let busWatch = null;
  let passedStops = 0;
  let updating = false;
  let lastProgress = 0;
  let lastAcceptedPoint = null;
  let pendingCandidate = 0;
  let pendingCount = 0;
  let autoBoarded = false;

  function endpointConfig() {
    if (selectedRoute === 'maor-home-school') return { start: routeRecordings['home-to-38283'], end: routeRecordings['38252-to-school'] };
    if (selectedRoute === 'maor-school-home') return { start: routeRecordings['school-to-36743'], end: routeRecordings['33734-to-home'] };
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
    return Math.max(-0.05, Math.min(1.08, (wx * vx + wy * vy) / denom));
  }

  function remainingText(remaining) {
    if (remaining <= 0) return 'הגענו לתחנת הירידה';
    if (remaining === 1) return 'עוד תחנה אחת — התחנה הבאה שלך';
    return `עוד ${remaining} תחנות`;
  }

  function paintBusGpsStatus() {
    if (!current || !['wait_for_bus','bus'].includes(current.step?.type)) return;
    const sub = document.getElementById('sub');
    if (!sub) return;
    if (current.step?.type === 'wait_for_bus') {
      sub.textContent = 'GPS · מחכים לאוטובוס — הזיהוי יקרה אוטומטית';
      return;
    }
    const remaining = Math.max(0, TOTAL_STOPS - passedStops);
    sub.textContent = `GPS · עברנו ${passedStops} מתוך ${TOTAL_STOPS} תחנות · ${remainingText(remaining)}`;
  }

  function announceProgress(remaining) {
    let text;
    if (remaining <= 0) text = 'הגענו לתחנת הירידה. יורדים וממשיכים ברגל.';
    else if (remaining === 1) text = 'עוד תחנה אחת. התחנה הבאה שלך.';
    else text = `עברנו תחנה. נשארו עוד ${remaining} תחנות.`;
    speak?.(text);
  }

  async function autoBoard() {
    if (autoBoarded || updating || !tripId || current?.step?.type !== 'wait_for_bus') return;
    autoBoarded = true;
    updating = true;
    try {
      const d = await api(`/api/trips/${tripId}/board-bus`, { method: 'POST' });
      render(d);
      navigator.vibrate?.([250,100,250]);
      speak?.('עלינו על האוטובוס. אני אספור את התחנות בשבילך.');
      paintBusGpsStatus();
    } catch (e) {
      autoBoarded = false;
      console.warn('automatic bus boarding failed', e);
    } finally { updating = false; }
  }

  async function pushRemaining(remaining) {
    if (!tripId || updating || current?.step?.type !== 'bus') return;
    updating = true;
    try {
      const d = await api(`/api/trips/${tripId}/bus-progress`, { method: 'POST', body: JSON.stringify({ remaining_stops: remaining }) });
      render(d);
      paintBusGpsStatus();
      announceProgress(remaining);
      if (remaining <= 1) navigator.vibrate?.([350,150,350,150,600]);
      if (d.step?.type === 'walk') {
        stopBusGpsTracker();
        navigator.vibrate?.([500,180,500]);
        speak?.(d.message || d.step?.instruction);
      }
    } catch (e) { console.warn('bus GPS progress update failed', e); }
    finally { updating = false; }
  }

  function acceptPoint(here, accuracy) {
    if (accuracy > MAX_ACCURACY) return false;
    if (!lastAcceptedPoint) { lastAcceptedPoint = here; return true; }
    const jump = distanceMeters(lastAcceptedPoint, here);
    if (jump > MAX_JUMP_METERS) return false;
    lastAcceptedPoint = here;
    return true;
  }

  async function evaluateBusPosition(pos) {
    if (!current || !['wait_for_bus','bus'].includes(current.step?.type)) return;
    const accuracy = Number(pos.coords.accuracy || 999);
    const endpoints = busEndpoints(); if (!endpoints) return;
    const here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    if (!acceptPoint(here, accuracy)) return;

    let progress = projectedProgress(here, endpoints.start, endpoints.end);
    // Never allow GPS noise to move the trip backwards.
    progress = Math.max(lastProgress - 0.01, progress);
    if (progress + 0.03 < lastProgress) return;
    lastProgress = Math.max(lastProgress, progress);

    // Once we have genuinely left the boarding stop toward the route, board automatically.
    if (current.step?.type === 'wait_for_bus') {
      const leftBoardingStop = distanceMeters(here, endpoints.start) > Math.max(70, accuracy + 35) && progress >= 0.035;
      if (leftBoardingStop) await autoBoard();
      paintBusGpsStatus();
      return;
    }

    let candidate = passedStops;
    for (let i = passedStops; i < STOP_PROGRESS.length; i++) {
      if (progress >= STOP_PROGRESS[i]) candidate = i + 1; else break;
    }
    const distanceToEnd = distanceMeters(here, endpoints.end);
    if (distanceToEnd <= Math.max(55, accuracy + 25) && progress >= 0.82) candidate = TOTAL_STOPS;

    // Require the same next stop on consecutive GPS readings. Also advance at most one
    // stop per confirmation cycle so a single jump can never skip several stops.
    candidate = Math.min(candidate, passedStops + 1);
    if (candidate <= passedStops) { pendingCandidate = 0; pendingCount = 0; paintBusGpsStatus(); return; }
    if (candidate !== pendingCandidate) { pendingCandidate = candidate; pendingCount = 1; return; }
    pendingCount++;
    if (pendingCount < CONFIRMATIONS_REQUIRED) return;

    passedStops = candidate;
    pendingCandidate = 0; pendingCount = 0;
    await pushRemaining(Math.max(0, TOTAL_STOPS - passedStops));
  }

  function startBusGpsTracker(initialPassed = 0) {
    stopBusGpsTracker();
    passedStops = Math.max(0, Math.min(TOTAL_STOPS, Number(initialPassed) || 0));
    lastProgress = passedStops ? STOP_PROGRESS[Math.max(0, passedStops - 1)] : 0;
    lastAcceptedPoint = null; pendingCandidate = 0; pendingCount = 0;
    autoBoarded = current?.step?.type === 'bus';
    if (!navigator.geolocation || !busEndpoints()) {
      const sub = document.getElementById('sub');
      if (sub && ['wait_for_bus','bus'].includes(current?.step?.type)) sub.textContent = 'GPS · ממתין לנתוני המסלול';
      return;
    }
    paintBusGpsStatus();
    busWatch = navigator.geolocation.watchPosition(evaluateBusPosition, () => {}, { enableHighAccuracy: true, maximumAge: 1500, timeout: 15000 });
  }

  function stopBusGpsTracker() {
    if (busWatch != null) navigator.geolocation.clearWatch(busWatch);
    busWatch = null;
  }

  window.startBusGpsTracker = startBusGpsTracker;
  window.stopBusGpsTracker = stopBusGpsTracker;
  window.busGpsEndpoints = busEndpoints;
  window.busProjectedProgress = projectedProgress;

  // Watch app state and start automatically as soon as the child reaches the wait-for-bus step.
  let lastStepKey = '';
  setInterval(() => {
    try {
      const key = `${tripId || ''}:${current?.step?.type || ''}`;
      if (key === lastStepKey) return;
      lastStepKey = key;
      if (['wait_for_bus','bus'].includes(current?.step?.type)) {
        const alreadyPassed = current?.step?.type === 'bus' ? Math.max(0, TOTAL_STOPS - Number(current?.trip?.remaining_stops ?? TOTAL_STOPS)) : 0;
        startBusGpsTracker(alreadyPassed);
      } else stopBusGpsTracker();
    } catch (e) {}
  }, 500);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ['wait_for_bus','bus'].includes(current?.step?.type) && busWatch == null) startBusGpsTracker();
  });
})();
