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
  stop_id?: string;
  address?: string;
  stop_count?: number;
  destination?: { name?: string; location?: { lat: number; lon: number } };
  instruction_points?: Array<{ name?: string; location?: { lat: number; lon: number } }>;
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
const GPS_ROUTE_VERIFIED = false;
const trips = new Map<string, Trip>();

const routeInfo = {
  id: ROUTE_ID,
  child: 'מאור',
  origin: 'הרב מאיר אורבך 13, פתח תקווה',
  boarding_stop: {
    id: '33734',
    name: 'היכל התרבות/המכבים',
    address: 'המכבים 7, פתח תקווה'
  },
  bus: {
    line: '238',
    stops: 7
  },
  exit_stop: {
    id: '36743',
    name: 'אליהו בן חור/אלוף רחבעם זאבי',
    address: 'אליהו בן חור 11, פתח תקווה'
  },
  destination: {
    name: 'בית ספר רמון',
    address: 'שרגא רפאלי 4, פתח תקווה'
  },
  final_walk: {
    note: 'לעבור דרך שדרת העצים והקיצור הקבוע',
    gps_verified: false
  }
};

const steps: Step[] = [
  {
    type: 'walk',
    title: 'הולכים לתחנת קו 238',
    instruction: 'צא מהבית ברחוב הרב מאיר אורבך 13 ולך לתחנת היכל התרבות/המכבים',
    address: 'המכבים 7, פתח תקווה',
    stop_id: '33734',
    destination: { name: 'תחנת היכל התרבות/המכבים' }
  },
  {
    type: 'wait_for_bus',
    title: 'מחכים לקו 238',
    instruction: 'חכה לקו 238 בתחנת היכל התרבות/המכבים, תחנה 33734',
    bus_line: '238',
    stop_id: '33734',
    address: 'המכבים 7, פתח תקווה',
    destination: { name: 'תחנת היכל התרבות/המכבים' }
  },
  {
    type: 'bus',
    title: 'נוסעים 7 תחנות',
    instruction: 'נוסעים בקו 238 עד אליהו בן חור/אלוף רחבעם זאבי',
    bus_line: '238',
    stop_count: 7,
    stop_id: '36743',
    address: 'אליהו בן חור 11, פתח תקווה',
    destination: { name: 'אליהו בן חור/אלוף רחבעם זאבי' }
  },
  {
    type: 'walk',
    title: 'ממשיכים לבית ספר רמון',
    instruction: 'רד בתחנה 36743 והמשך ברגל לבית ספר רמון דרך שדרת העצים והקיצור הקבוע',
    address: 'שרגא רפאלי 4, פתח תקווה',
    destination: { name: 'בית ספר רמון' },
    instruction_points: [
      { name: 'שדרת העצים — מיקום GPS ייקלט מהשטח' },
      { name: 'הקיצור לבית הספר — מיקום GPS ייקלט מהשטח' }
    ]
  },
  {
    type: 'arrival',
    title: 'הגעת לבית הספר!',
    instruction: 'הגעת לבית ספר רמון, שרגא רפאלי 4 🎉',
    address: 'שרגא רפאלי 4, פתח תקווה',
    destination: { name: 'בית ספר רמון' }
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
    message = trip.remaining_stops === 1 ? 'עוד תחנה אחת — מתכוננים לרדת' : `עוד ${trip.remaining_stops} תחנות`;
  }
  return { route_name: ROUTE_NAME, route_info: routeInfo, gps_route_verified: GPS_ROUTE_VERIFIED, trip, step, message, alert };
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
    return json({ ok: true, runtime: 'cloudflare-worker', d1_connected: Boolean(env.DB), gps_route_verified: GPS_ROUTE_VERIFIED });
  }

  if (path === '/api/transit/arrival' && request.method === 'GET') {
    return json({
      line: '238',
      stop_id: '33734',
      stop_name: 'היכל התרבות/המכבים',
      realtime_connected: false,
      eta_minutes: null,
      status: 'awaiting_siri_connection',
      message: 'זמן אמת יופעל לאחר חיבור מקור SIRI של משרד התחבורה',
      updated_at: new Date().toISOString()
    });
  }

  if (path === `/api/routes/${ROUTE_ID}` && request.method === 'GET') {
    return json({ route_name: ROUTE_NAME, route_info: routeInfo, gps_route_verified: GPS_ROUTE_VERIFIED, steps });
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

  const match = path.match(/^\/api\/trips\/([^/]+)\/(location|simulate-next|board-bus|bus-progress|help)$/);
  if (!match || request.method !== 'POST') return json({ detail: 'Not found' }, 404);

  const [, id, action] = match;
  const trip = await loadTrip(env, id);
  if (!trip) return json({ detail: 'Trip not found' }, 404);

  if (action === 'help') {
    trip.status = 'help_required';
    await persist(env, trip);
    return json(view(trip, 'צריך עזרה — בגרסה הבאה המיקום יישלח להורה'));
  }

  if (action === 'location') {
    if (!GPS_ROUTE_VERIFIED) {
      return json({ detail: 'המסלול האמיתי עדיין לא עבר כיול GPS. השתמש כרגע במצב סימולציה.' }, 409);
    }
    const step = steps[trip.current_step];
    if (step.type === 'walk') advanceWalk(trip);
    if (trip.current_step >= steps.length - 1) trip.status = 'completed';
    await persist(env, trip);
    return json(view(trip));
  }

  if (action === 'simulate-next') {
    const step = steps[trip.current_step];
    if (step.type === 'walk') advanceWalk(trip);
    if (step.type === 'wait_for_bus') {
      trip.current_step = 2;
      trip.remaining_stops = 7;
    } else if (step.type === 'bus') {
      trip.remaining_stops = Math.max(0, (trip.remaining_stops ?? 7) - 1);
      let alert: string | undefined;
      if (trip.remaining_stops === 1) alert = 'מאור, תלחץ עכשיו על הכפתור — יורדים בתחנה הבאה';
      if (trip.remaining_stops === 0) {
        trip.current_step = 3;
        trip.current_instruction_index = 0;
      }
      await persist(env, trip);
      return json(view(trip, alert));
    }
    if (trip.current_step >= steps.length - 1) trip.status = 'completed';
    await persist(env, trip);
    return json(view(trip));
  }

  if (action === 'board-bus') {
    trip.current_step = 2;
    trip.remaining_stops = 7;
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
