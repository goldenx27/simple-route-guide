import { loadGtfsStops, type TransitConfig } from './gtfs';

type GoogleRoutesEnv = { ASSETS: Fetcher; GOOGLE_ROUTES_API_KEY?: string; GOOGLE_ROUTES_TEST_TOKEN?: string };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function checkGoogleRoutes(request: Request, env: GoogleRoutesEnv, config: TransitConfig): Promise<Response> {
  if (!env.GOOGLE_ROUTES_API_KEY || !env.GOOGLE_ROUTES_TEST_TOKEN) {
    return json({ status: 'NOT_CONFIGURED', message: 'Google Routes adapter מוכן לבדיקה אך הסודות טרם הוגדרו.' }, 503);
  }
  if (request.headers.get('X-Google-Routes-Test-Token') !== env.GOOGLE_ROUTES_TEST_TOKEN) {
    return json({ status: 'UNAUTHORIZED' }, 401);
  }
  try {
    const stops = await loadGtfsStops(request, env.ASSETS);
    const origin = stops[config.stopId];
    const destination = stops[config.exitStopId];
    if (!origin || !destination) throw new Error('Route stops are missing from the GTFS extract');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': env.GOOGLE_ROUTES_API_KEY,
        'X-Goog-FieldMask': 'routes.legs.steps.transitDetails',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lon } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lon } } },
        travelMode: 'TRANSIT', computeAlternativeRoutes: true, languageCode: 'he', regionCode: 'il',
        departureTime: new Date().toISOString(),
        transitPreferences: { allowedTravelModes: ['BUS'], routingPreference: 'LESS_WALKING' },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    if (!response.ok) return json({ status: 'GOOGLE_ERROR', http_status: response.status, detail: await response.text() }, 502);
    const payload = await response.json<any>();
    const matches = (payload.routes || []).flatMap((route: any) => route.legs || [])
      .flatMap((leg: any) => leg.steps || []).map((step: any) => step.transitDetails).filter(Boolean)
      .filter((details: any) => String(details.transitLine?.nameShort || '') === config.line)
      .map((details: any) => ({
        line: details.transitLine?.nameShort, departure_time: details.stopDetails?.departureTime,
        arrival_time: details.stopDetails?.arrivalTime, departure_stop: details.stopDetails?.departureStop?.name,
        arrival_stop: details.stopDetails?.arrivalStop?.name, headsign: details.headsign,
      }));
    return json({
      status: matches.length ? 'LINE_FOUND' : 'LINE_NOT_FOUND', line: config.line, matches,
      source: 'google-routes-experiment',
      warning: 'יש להשוות את התוצאה ל-Google Maps ול-GTFS כדי לקבוע אם השעה חיה או מתוכננת.',
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    return json({ status: 'GOOGLE_UNAVAILABLE', error: error instanceof Error ? error.message : 'unknown error' }, 502);
  }
}

