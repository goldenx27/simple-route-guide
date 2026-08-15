(() => {
  const MAX_ROUTE_DISTANCE = 90;

  function nearestPoint(recording, here) {
    const pts = recording?.points;
    if (!Array.isArray(pts) || !pts.length) return null;
    let bestIndex = 0, bestDistance = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = distanceMeters(here, pts[i]);
      if (d < bestDistance) { bestDistance = d; bestIndex = i; }
    }
    return { index: bestIndex, distance: bestDistance, ratio: pts.length > 1 ? bestIndex / (pts.length - 1) : 0 };
  }

  function landmarkIndex(recording, term) {
    const lm = (recording?.landmarks || []).find(x => (x.name || '').includes(term));
    if (!lm) return null;
    return nearestPoint(recording, lm)?.index ?? null;
  }

  function inferWalkStep(routeId, recording, nearest, terms, baseStep, waitStep) {
    if (!recording || !nearest || nearest.distance > MAX_ROUTE_DISTANCE) return null;
    const idx = nearest.index;
    for (let i = 0; i < terms.length; i++) {
      const targetIdx = landmarkIndex(recording, terms[i]);
      if (targetIdx != null && idx < targetIdx) return baseStep + i;
    }
    return waitStep;
  }

  function busInference(here) {
    const endpoints = window.busGpsEndpoints?.();
    if (!endpoints) return null;
    const startDistance = distanceMeters(here, endpoints.start);
    const endDistance = distanceMeters(here, endpoints.end);
    const progress = window.busProjectedProgress?.(here, endpoints.start, endpoints.end);
    if (typeof progress !== 'number') return null;
    const corridorLength = distanceMeters(endpoints.start, endpoints.end);
    const expected = Math.max(0, Math.min(1, progress));
    const approxPoint = { lat: endpoints.start.lat + (endpoints.end.lat - endpoints.start.lat) * expected, lon: endpoints.start.lon + (endpoints.end.lon - endpoints.start.lon) * expected };
    const corridorDistance = distanceMeters(here, approxPoint);
    if (corridorDistance > Math.max(180, corridorLength * 0.15) && startDistance > 120 && endDistance > 120) return null;
    const passed = Math.max(0, Math.min(7, Math.floor(expected * 7 + 0.15)));
    return { progress: expected, passed, remaining: Math.max(0, 7 - passed), distanceToEnd: endDistance };
  }

  function inferPosition(here) {
    if (!selectedRoute) return null;
    if (selectedRoute === 'maor-home-school') {
      const first = routeRecordings['home-to-38283'], firstNear = nearestPoint(first, here);
      const firstStep = inferWalkStep(selectedRoute, first, firstNear, ['הגענו למכבים','מעבר חצייה רביעי','הגענו לתחנה'], 0, 3);
      if (firstStep != null) return { step: firstStep, source: 'walk', distance: firstNear.distance };
      const last = routeRecordings['38252-to-school'], lastNear = nearestPoint(last, here);
      if (lastNear && lastNear.distance <= MAX_ROUTE_DISTANCE) return lastNear.ratio > 0.94 ? { step: 6, source: 'walk', distance: lastNear.distance } : { step: 5, source: 'walk', distance: lastNear.distance };
      const bus = busInference(here); if (bus) return { step: 4, source: 'bus', ...bus };
    }
    if (selectedRoute === 'maor-school-home') {
      const first = routeRecordings['school-to-36743'], firstNear = nearestPoint(first, here);
      const firstStep = inferWalkStep(selectedRoute, first, firstNear, ['סיום שדרת העצים','תחנה'], 0, 2);
      if (firstStep != null) return { step: firstStep, source: 'walk', distance: firstNear.distance };
      const last = routeRecordings['33734-to-home'], lastNear = nearestPoint(last, here);
      if (lastNear && lastNear.distance <= MAX_ROUTE_DISTANCE) return lastNear.ratio > 0.94 ? { step: 5, source: 'walk', distance: lastNear.distance } : { step: 4, source: 'walk', distance: lastNear.distance };
      const bus = busInference(here); if (bus) return { step: 3, source: 'bus', ...bus };
    }
    return null;
  }

  function getPosition() {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(p => resolve(p), () => resolve(null), { enableHighAccuracy: true, maximumAge: 5000, timeout: 7000 });
    });
  }

  async function moveTripTo(target) {
    if (!tripId || !current) return;
    let safety = 20;
    while (current.trip.current_step < target.step && safety-- > 0) {
      if (current.step?.type === 'bus') current = await api(`/api/trips/${tripId}/bus-progress`, { method: 'POST', body: JSON.stringify({ remaining_stops: 0 }) });
      else current = await api(`/api/trips/${tripId}/simulate-next`, { method: 'POST' });
      render(current);
    }
    if (current.trip.current_step === target.step && target.source === 'bus') {
      current = await api(`/api/trips/${tripId}/bus-progress`, { method: 'POST', body: JSON.stringify({ remaining_stops: target.remaining }) });
      render(current); window.startBusGpsTracker?.(target.passed);
    }
  }

  async function syncCurrentPosition(showFeedback = true) {
    if (!selectedRoute || !tripId) return false;
    if (showFeedback) { const s = document.getElementById('sub'); if (s) s.textContent = '📍 מסתנכרן לפי המיקום הנוכחי…'; }
    const pos = await getPosition(); if (!pos) return false;
    const inferred = inferPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    if (!inferred) { if (showFeedback) { const s = document.getElementById('sub'); if (s) s.textContent = 'לא זיהיתי את המיקום כחלק מהמסלול המוכר'; } return false; }
    await moveTripTo(inferred);
    if (showFeedback) { navigator.vibrate?.(100); const s = document.getElementById('sub'); if (s && current.step?.type !== 'bus') s.textContent = `✅ הסתנכרן לפי GPS · דיוק ±${Math.round(pos.coords.accuracy || 0)} מ׳`; speak(current.message || current.step?.instruction); }
    return true;
  }

  function goHomeMenu() {
    if (gpsWatch != null) { navigator.geolocation.clearWatch(gpsWatch); gpsWatch = null; }
    window.stopBusGpsTracker?.(); if (etaTimer) { clearInterval(etaTimer); etaTimer = null; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    document.getElementById('trip')?.classList.add('hidden'); document.getElementById('recorder')?.classList.add('hidden'); document.getElementById('home')?.classList.remove('hidden');
    tripId = null; current = null; lastAutoAdvanceKey = ''; gpsAdvanceLock = false;
  }

  function installButtons() {
    const actions = document.querySelector('#trip .actions');
    if (actions && !document.getElementById('backToHomeButton')) {
      const b = document.createElement('button'); b.id = 'backToHomeButton'; b.className = 'secondary'; b.type = 'button'; b.textContent = '🏠 חזרה לתפריט הראשי'; b.onclick = goHomeMenu; actions.appendChild(b);
    }
    document.getElementById('syncLocationButton')?.remove();
  }

  const originalStartTrip = window.startTrip;
  window.startTrip = async function (...args) {
    await originalStartTrip.apply(this, args);
    setTimeout(() => syncCurrentPosition(false).catch(() => {}), 350);
  };

  window.syncCurrentPosition = syncCurrentPosition; window.goHomeMenu = goHomeMenu;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installButtons); else installButtons();
})();
