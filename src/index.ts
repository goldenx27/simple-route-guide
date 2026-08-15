type Env = {
  ASSETS: Fetcher;
  DB?: D1Database;
};

type StepType = 'walk' | 'wait_for_bus' | 'bus' | 'arrival';

type Step = {
  type: StepType;
  title: string;
  instruction: string;
  bus_line?: string;
  destination?: { location: { lat: number; lon: number } };
  instruction_points?: Array<{ location: { lat: number; lon: number } }>;
};

type Trip = {
  id: string;
  route_id: string;
  child_id: string;
  status: string;
  current_step: number;
  current_instruction_index: number;
  remaining_stops?: number;
};

const ROUTE_NAME = 'הדרך של מאור לבית הספר';
const ROUTE_ID = 'maor-home-school';
const trips = new Map<string, Trip>();

const steps: Step[] = [
  {
    type: 'walk',
    title: 'הולכים לתחנה',
    instruction: 'לך לכיוון תחנת האוטובוס',
    instruction_points: [
      { location: { lat: 32.0904, lon: 34.8806 } },
      { location: { lat: 32.0908, lon: 34.8812 } }
    ],
    destination: { location: { lat: 32.0912, lon: 34.8820 } }
  },
  {
    type: 'wait_for_bus',
    title: 'מחכים לאוטובוס',
    instruction: 'חכה לקו 17',
    bus_line: '17',
    destination: { location: { lat: 32.0912, lon: 34.8820 } }
  },
  {
    type: 'bus',
    title: 'נוסעים לבית הספר',
    instruction: 'נוסעים עד התחנה של בית הספר',
    bus_line: '17',
    destination: { location: { lat: 32.1000, lon: 34.8900 } }
  },
  {
    type: 'walk',
    title: 'ממשיכים לבית הספר',
    instruction: 'לך מתחנת האוטובוס לבית הספר',
    destination: { location: { lat: 32.1020, lon: 34.8920 } }
  },
  {
    type: 'arrival',
    title: 'הגעת!',
    instruction: 'הגעת לבית הספר 🎉',
    destination: { location: { lat: 32.1020, lon: 34.8920 } }
  }
];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function view(trip: Trip, alert?: string) {
  const step = steps[Math.min(trip.current_step, steps.length - 1)];
  let message = step.instruction;
  if (step.type === 'bus' && typeof trip.remaining_stops === 'number') {
    message = `עוד ${trip.remaining_stops} תחנות`;
  }
  return { route_name: ROUTE_NAME, trip, step, message, alert };
}

async function persist(env: Env, trip: Trip) {
  if (!env.DB) return;
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO trips (id, route_id, child_id, status, current_step, current_instruction_index, remaining_stops, started_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status=excluded.status,
      current_step=excluded.current_step,
      current_instruction_index=excluded.current_instruction_index,
      remaining_stops=excluded.remaining_stops,
      updated_at=excluded.updated_at
  `).bind(
    trip.id, trip.route_id, trip.child_id, trip.status,
    trip.current_step, trip.current_instruction_index,
    trip.remaining_stops ?? null, now, now
  ).run();
}

async function loadTrip(env: Env, id: string): Promise<Trip | null> {
  const local = trips.get(id);
  if (local) return local;
  if (!env.DB) return null;
  const row = await env.DB.prepare(
    'SELECT id, route_id, child_id, status, current_step, current_instruction_index, remaining_stops FROM trips WHERE id = ?'
  ).bind(id).first<any>();
  if (!row) return null;
  const trip: Trip = {
    id: row.id,
    route_id: row.route_id,
    child_id: row.child_id,
    status: row.status,
    current_step: row.current_step,
    current_instruction_index: row.current_instruction_index,
    remaining_stops: row.remaining_stops ?? undefined
  };
  trips.set(id, trip);
  return trip;
}

function advanceWalk(trip: Trip) {
  const step = steps[trip.current_step];
  const points = step.instruction_points ?? [];
  if (trip.current_instruction_index < points.length) {
    trip.current_instruction_index += 1;
    return;
  }
  trip.current_step += 1;
  trip.current_instruction_index = 0;
}

async function handleApi(request: Request, env: Env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/health') {
    return json({ ok: true, runtime: 'cloudflare-worker', d1_connected: Boolean(env.DB) });
  }

  if (request.method === 'POST' && path === `/api/trips/start/${ROUTE_ID}`) {
    const trip: Trip = {
      id: crypto.randomUUID(),
      route_id: ROUTE_ID,
      child_id: 'maor',
      status: 'active',
      current_step: 0,
      current_instruction_index: 0
    };
    trips.set(trip.id, trip);
    await persist(env, trip);
    return json(view(trip));
  }

  const match = path.match(/^\/api\/trips\/([^/]+)\/(location|board-bus|bus-progress|help)$/);
  if (!match || request.method !== 'POST') return json({ detail: 'Not found' }, 404);

  const [, id, action] = match;
  const trip = await loadTrip(env, id);
  if (!trip) return json({ detail: 'Trip not found' }, 404);

  if (action === 'help') {
    trip.status = 'help_required';
    await persist(env, trip);
    return json(view(trip, 'צריך עזרה — מיקום נשלח להורה (בגרסה הבאה)'));
  }

  if (action === 'location') {
    const step = steps[trip.current_step];
    if (step.type === 'walk') advanceWalk(trip);
    if (trip.current_step >= steps.length - 1) trip.status = 'completed';
    await persist(env, trip);
    return json(view(trip));
  }

  if (action === 'board-bus') {
    const body = await request.json<any>();
    trip.current_step = 2;
    trip.remaining_stops = Number(body.remaining_stops ?? 6);
    await persist(env, trip);
    return json(view(trip));
  }

  if (action === 'bus-progress') {
    const body = await request.json<any>();
    trip.remaining_stops = Math.max(0, Number(body.remaining_stops ?? 0));
    let alert: string | undefined;
    if (trip.remaining_stops === 1) alert = 'מאור, תלחץ עכשיו על הכפתור — יורדים בתחנה הבאה';
    if (trip.remaining_stops === 0) {
      trip.current_step = 3;
      trip.current_instruction_index = 0;
    }
    await persist(env, trip);
    return json(view(trip, alert));
  }

  return json({ detail: 'Not found' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  }
};
