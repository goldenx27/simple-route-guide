import app from './index';
import { handlePushApi, PushStore, type PushEnv } from './push';
import { getOpenBusArrival } from './openbus';

export { PushStore };

type Env = PushEnv & {
  ASSETS: Fetcher;
  DB?: D1Database;
  SIRI_ENDPOINT?: string;
  SIRI_KEY?: string;
};

const PWA_HEAD = [
  '<link rel="manifest" href="/manifest.json">',
  '<link rel="icon" href="/icons/app-icon.svg" type="image/svg+xml">',
  '<meta name="application-name" content="הדרך של מאור">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="apple-mobile-web-app-title" content="הדרך של מאור">',
].join('');

const TRANSIT_ROUTES: Record<string, { line: string; stopId: string; stopName: string }> = {
  'maor-home-school': { line: '238', stopId: '38283', stopName: 'המכבים/שלונסקי' },
  'maor-school-home': { line: '238', stopId: '36743', stopName: 'אליהו בן חור/אלוף רחבעם זאבי' },
};

function transitJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function textValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    for (const key of ['value', 'Value', '#text']) {
      if (object[key] != null) return String(object[key]);
    }
  }
  return '';
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function findStopMonitoringDeliveries(payload: any): any[] {
  const serviceDelivery = payload?.Siri?.ServiceDelivery ?? payload?.ServiceDelivery ?? payload;
  return asArray(serviceDelivery?.StopMonitoringDelivery ?? serviceDelivery?.stopMonitoringDelivery);
}

function guidanceForEta(minutes: number) {
  if (minutes <= 3) {
    return { status: 'WAIT_FOR_NEXT', message: 'האוטובוס קרוב מאוד — עדיף לחכות לאוטובוס הבא.' };
  }
  if (minutes <= 10) {
    return { status: 'LEAVE_NOW', message: 'אפשר לצאת עכשיו — קו 238 בדרך לתחנה.' };
  }
  return { status: 'WAIT', message: `עדיין לא צריך לצאת — קו 238 צפוי בעוד ${minutes} דקות.` };
}

async function handleTransitArrival(request: Request, env: Env): Promise<Response | null> {
  const requestUrl = new URL(request.url);
  if (requestUrl.pathname !== '/api/transit/arrival' || request.method !== 'GET') return null;

  const routeId = requestUrl.searchParams.get('route_id') || 'maor-home-school';
  const config = TRANSIT_ROUTES[routeId] || TRANSIT_ROUTES['maor-home-school'];

  // Prefer the Ministry's ExpectedArrivalTime when credentials are available.
  // Until then, use Open Bus SIRI vehicle positions as a clearly-labelled fallback.
  if (!env.SIRI_ENDPOINT || !env.SIRI_KEY) return getOpenBusArrival(config);

  const siriUrl = new URL(env.SIRI_ENDPOINT);
  siriUrl.searchParams.set('Key', env.SIRI_KEY);
  siriUrl.searchParams.set('MonitoringRef', config.stopId);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(siriUrl.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) return getOpenBusArrival(config);

    const payload: any = await response.json();
    const now = Date.now();
    const arrivals: Array<{ minutes: number; expected_arrival_time: string }> = [];

    for (const delivery of findStopMonitoringDeliveries(payload)) {
      for (const visit of asArray(delivery?.MonitoredStopVisit ?? delivery?.monitoredStopVisit)) {
        const journey = visit?.MonitoredVehicleJourney ?? visit?.monitoredVehicleJourney ?? {};
        const publishedLine = textValue(journey?.PublishedLineName ?? journey?.publishedLineName);
        if (publishedLine && publishedLine !== config.line) continue;

        const call = journey?.MonitoredCall ?? journey?.monitoredCall ?? {};
        const expected = textValue(call?.ExpectedArrivalTime ?? call?.expectedArrivalTime);
        if (!expected) continue;
        const expectedMs = Date.parse(expected);
        if (!Number.isFinite(expectedMs)) continue;
        const minutes = Math.max(0, Math.ceil((expectedMs - now) / 60000));
        arrivals.push({ minutes, expected_arrival_time: expected });
      }
    }

    arrivals.sort((a, b) => a.minutes - b.minutes);
    const next = arrivals[0];
    if (!next) return getOpenBusArrival(config);

    const guidance = guidanceForEta(next.minutes);
    return transitJson({
      line: config.line,
      stop_id: config.stopId,
      stop_name: config.stopName,
      realtime_connected: true,
      eta_minutes: next.minutes,
      arrivals: arrivals.slice(0, 3),
      status: guidance.status,
      message: guidance.message,
      source: 'mot-siri',
      confidence: 'official',
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    return getOpenBusArrival(config);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/push/') || url.pathname.startsWith('/api/route-recordings')) return handlePushApi(request, env);
    const transitResponse = await handleTransitArrival(request, env);
    if (transitResponse) return transitResponse;
    const response = await app.fetch(request, env);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;
    const html = await response.text(); let injected = html;
    if (!injected.includes('rel="manifest"')) injected = injected.replace('</head>', `${PWA_HEAD}</head>`);
    const scripts = [
      '/push-client.js','/boarding-arrival.js','/bus-gps.js','/bus-auto-ui.js','/exit-app.js','/arrival-gps.js','/map-follow.js','/walk-map.js','/map-heading-fix.js','/keep-awake.js','/recovery-sync.js','/sound-ui.js','/route-cloud-sync.js','/layout-v3.js','/parent-ui-priority.js','/parent-wizard.js','/parent-test-mode.js','/recorder-state-sentinel.js','/recording-start-fix.js','/recorder-runtime-fix.js','/remove-legacy-route-loader.js','/remove-legacy-clear-recording.js'
    ];
    for (const src of scripts) if (!injected.includes(src)) injected = injected.replace('</body>', `<script src="${src}"></script></body>`);
    const headers = new Headers(response.headers); headers.delete('content-length'); headers.set('cache-control','no-cache');
    return new Response(injected,{status:response.status,statusText:response.statusText,headers});
  },
};
