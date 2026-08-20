const OPEN_BUS_BASE = 'https://open-bus-stride-api.hasadna.org.il';

type TransitConfig = { line: string; stopId: string; stopName: string };
type JsonRecord = Record<string, any>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function guidanceForEta(minutes: number) {
  if (minutes <= 3) return { status: 'WAIT_FOR_NEXT', message: 'האוטובוס קרוב מאוד — עדיף לחכות לאוטובוס הבא.' };
  if (minutes <= 10) return { status: 'LEAVE_NOW', message: 'אפשר לצאת עכשיו — קו 238 בדרך לתחנה.' };
  return { status: 'WAIT', message: `עדיין לא צריך לצאת — קו 238 צפוי בעוד ${minutes} דקות.` };
}

function israelDate(now: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

async function openBusGet(path: string, params: Record<string, string | number | undefined>) {
  const url = new URL(path, OPEN_BUS_BASE);
  for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, String(value));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Open Bus ${response.status}: ${path}`);
    return await response.json<any[]>();
  } finally {
    clearTimeout(timeout);
  }
}

function latestByRide(locations: JsonRecord[]) {
  const map = new Map<number, JsonRecord>();
  for (const location of locations) {
    const rideId = Number(location.siri_ride__id);
    if (!Number.isFinite(rideId)) continue;
    const existing = map.get(rideId);
    if (!existing || Date.parse(location.recorded_at_time) > Date.parse(existing.recorded_at_time)) map.set(rideId, location);
  }
  return map;
}

function safeDate(value: unknown) {
  const ms = Date.parse(String(value || ''));
  return Number.isFinite(ms) ? ms : null;
}

export async function getOpenBusArrival(config: TransitConfig): Promise<Response> {
  const now = new Date();
  const nowMs = now.getTime();
  const date = israelDate(now);
  const rideWindowFrom = new Date(nowMs - 2 * 60 * 60 * 1000).toISOString();
  const rideWindowTo = new Date(nowMs + 60 * 60 * 1000).toISOString();
  const liveFrom = new Date(nowMs - 7 * 60 * 1000).toISOString();

  try {
    const [stops, rides] = await Promise.all([
      openBusGet('/siri_stops/list', { codes: config.stopId, limit: 5 }),
      openBusGet('/siri_rides/list', {
        gtfs_route__date_from: date,
        gtfs_route__date_to: date,
        gtfs_route__route_short_name: config.line,
        scheduled_start_time_from: rideWindowFrom,
        scheduled_start_time_to: rideWindowTo,
        limit: 100,
      }),
    ]);

    const siriStopId = Number(stops?.[0]?.id);
    const rideIds = rides.map(r => Number(r.id)).filter(Number.isFinite);
    if (!Number.isFinite(siriStopId) || !rideIds.length) {
      return json({
        line: config.line, stop_id: config.stopId, stop_name: config.stopName,
        realtime_connected: false, eta_minutes: null, arrivals: [],
        status: 'OPEN_BUS_NO_DATA',
        message: 'אין כרגע נתוני זמן אמת זמינים לקו 238.',
        source: 'open-bus', updated_at: now.toISOString(),
      });
    }

    const rideIdsCsv = rideIds.join(',');
    const [targetStops, allRideStops, locations] = await Promise.all([
      openBusGet('/siri_ride_stops/list', {
        siri_stop_ids: siriStopId,
        siri_ride_ids: rideIdsCsv,
        gtfs_date_from: date,
        gtfs_date_to: date,
        limit: 500,
      }),
      openBusGet('/siri_ride_stops/list', {
        siri_ride_ids: rideIdsCsv,
        gtfs_date_from: date,
        gtfs_date_to: date,
        limit: 5000,
      }),
      openBusGet('/siri_vehicle_locations/list', {
        siri_rides__ids: rideIdsCsv,
        recorded_at_time_from: liveFrom,
        order_by: 'recorded_at_time desc',
        limit: 1500,
      }),
    ]);

    const targetByRide = new Map<number, JsonRecord>();
    for (const stop of targetStops) targetByRide.set(Number(stop.siri_ride_id), stop);
    const stopById = new Map<number, JsonRecord>();
    for (const stop of allRideStops) stopById.set(Number(stop.id), stop);
    const liveByRide = latestByRide(locations);

    const arrivals: Array<{
      minutes: number;
      expected_arrival_time: string;
      vehicle_ref?: string;
      freshness_seconds: number;
      confidence: 'medium';
    }> = [];

    for (const [rideId, location] of liveByRide) {
      const target = targetByRide.get(rideId);
      const current = stopById.get(Number(location.siri_ride_stop_id));
      if (!target || !current) continue;

      const targetOrder = Number(target.order);
      const currentOrder = Number(current.order);
      if (!Number.isFinite(targetOrder) || !Number.isFinite(currentOrder) || currentOrder > targetOrder) continue;

      const observedAt = safeDate(location.recorded_at_time);
      const currentPlanned = safeDate(current.gtfs_ride_stop__arrival_time);
      const targetPlanned = safeDate(target.gtfs_ride_stop__arrival_time);
      if (observedAt == null || currentPlanned == null || targetPlanned == null) continue;

      const freshnessMs = nowMs - observedAt;
      if (freshnessMs < -60_000 || freshnessMs > 7 * 60_000) continue;

      let etaMs: number;
      if (currentOrder === targetOrder) {
        const distance = Number(location.distance_from_siri_ride_stop_meters);
        if (Number.isFinite(distance) && distance > 500) continue;
        etaMs = observedAt + 60_000;
      } else {
        const scheduledRemainingMs = targetPlanned - currentPlanned;
        if (scheduledRemainingMs <= 0 || scheduledRemainingMs > 90 * 60_000) continue;
        etaMs = observedAt + scheduledRemainingMs;
      }

      const minutes = Math.max(0, Math.ceil((etaMs - nowMs) / 60_000));
      if (minutes > 90) continue;
      arrivals.push({
        minutes,
        expected_arrival_time: new Date(etaMs).toISOString(),
        vehicle_ref: location.siri_ride__vehicle_ref || undefined,
        freshness_seconds: Math.max(0, Math.round(freshnessMs / 1000)),
        confidence: 'medium',
      });
    }

    arrivals.sort((a, b) => a.minutes - b.minutes);
    const unique = arrivals.filter((item, index, arr) => index === 0 || item.minutes !== arr[index - 1].minutes).slice(0, 3);
    const next = unique[0];
    if (!next) {
      return json({
        line: config.line, stop_id: config.stopId, stop_name: config.stopName,
        realtime_connected: false, eta_minutes: null, arrivals: [],
        status: 'OPEN_BUS_NO_LIVE_VEHICLE',
        message: 'לא נמצא כרגע אוטובוס 238 עם מיקום חי בדרך לתחנה.',
        source: 'open-bus', updated_at: now.toISOString(),
      });
    }

    const guidance = guidanceForEta(next.minutes);
    return json({
      line: config.line,
      stop_id: config.stopId,
      stop_name: config.stopName,
      realtime_connected: true,
      eta_minutes: next.minutes,
      arrivals: unique,
      status: guidance.status,
      message: guidance.message,
      display_text: `${config.line} משוער בעוד ${next.minutes} דקות · מבוסס מיקום חי`,
      source: 'open-bus-calculated',
      source_note: 'ETA מחושב ממיקום SIRI חי של Open Bus ומהזמנים המתוכננים בין התחנות; זה אינו ExpectedArrivalTime הרשמי של משרד התחבורה.',
      confidence: 'medium',
      updated_at: now.toISOString(),
    });
  } catch (error) {
    return json({
      line: config.line, stop_id: config.stopId, stop_name: config.stopName,
      realtime_connected: false, eta_minutes: null, arrivals: [],
      status: 'OPEN_BUS_UNAVAILABLE',
      message: 'מקור Open Bus לא זמין כרגע. המסלול עצמו ממשיך לעבוד כרגיל.',
      source: 'open-bus', updated_at: now.toISOString(),
      error: error instanceof Error ? error.message : 'unknown error',
    });
  }
}

