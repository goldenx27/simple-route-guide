export type TransitConfig = { line: string; stopId: string; stopName: string; exitStopId: string };

type GtfsArrival = { timestamp: string; time: string; trip_id: string; headsign?: string; direction_id?: string };
type GtfsData = {
  generated_at: string;
  source_url: string;
  range: { from: string; days: number };
  stops: Record<string, { id: string; name: string; lat: number; lon: number }>;
  schedule: Record<string, Record<string, GtfsArrival[]>>;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function israelDate(now: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export async function getScheduledArrival(request: Request, assets: Fetcher, config: TransitConfig): Promise<Response> {
  const now = new Date();
  try {
    const dataUrl = new URL('/data/gtfs-238.json', request.url);
    const response = await assets.fetch(new Request(dataUrl, { headers: { Accept: 'application/json' } }));
    if (!response.ok) throw new Error(`GTFS asset returned ${response.status}`);
    const data = await response.json<GtfsData>();
    const today = israelDate(now);
    const yesterday = israelDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const byDate = data.schedule?.[config.stopId] || {};
    // GTFS permits times above 24:00, so the previous service day can contain arrivals after midnight today.
    const arrivals = [...(byDate[yesterday] || []), ...(byDate[today] || [])]
      .map(item => ({ ...item, minutes: Math.ceil((Date.parse(item.timestamp) - now.getTime()) / 60000) }))
      .filter(item => item.minutes >= 0)
      .sort((a, b) => a.minutes - b.minutes)
      .slice(0, 3);
    const next = arrivals[0];
    if (!next) {
      return json({
        line: config.line, stop_id: config.stopId, stop_name: config.stopName,
        realtime_connected: false, eta_minutes: null, arrivals: [], status: 'NO_MORE_SCHEDULED_TRIPS',
        message: `אין עוד נסיעות מתוכננות היום לקו ${config.line}.`, source: 'mot-gtfs',
        confidence: 'scheduled', schedule_generated_at: data.generated_at, updated_at: now.toISOString(),
      });
    }
    return json({
      line: config.line, stop_id: config.stopId, stop_name: config.stopName,
      realtime_connected: false, eta_minutes: next.minutes, arrivals,
      status: 'SCHEDULED', message: `${config.line} מתוכנן בעוד ${next.minutes} דקות`,
      display_text: `${config.line} מתוכנן בעוד ${next.minutes} דקות`,
      source: 'mot-gtfs', source_note: 'לוח זמנים רשמי ומתוכנן; אינו זמן אמת.', confidence: 'scheduled',
      schedule_generated_at: data.generated_at, updated_at: now.toISOString(),
    });
  } catch (error) {
    return json({
      line: config.line, stop_id: config.stopId, stop_name: config.stopName,
      realtime_connected: false, eta_minutes: null, arrivals: [], status: 'SCHEDULE_UNAVAILABLE',
      message: 'לוח הזמנים אינו זמין כרגע.', source: 'mot-gtfs', updated_at: now.toISOString(),
      error: error instanceof Error ? error.message : 'unknown error',
    }, 503);
  }
}

export async function loadGtfsStops(request: Request, assets: Fetcher) {
  const response = await assets.fetch(new Request(new URL('/data/gtfs-238.json', request.url)));
  if (!response.ok) throw new Error(`GTFS asset returned ${response.status}`);
  return (await response.json<GtfsData>()).stops;
}

