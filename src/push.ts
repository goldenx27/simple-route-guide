import webpush from 'web-push';

export type PushEnv = {
  PUSH_STORE: DurableObjectNamespace;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
};

type StoredSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function validSegment(segment: string) {
  return /^[a-zA-Z0-9_-]{1,120}$/.test(segment);
}

function routePrefix(testMode = false) {
  return testMode ? 'route-test:' : 'route:';
}

export class PushStore {
  constructor(private state: DurableObjectState, private env: PushEnv) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/subscribe' && request.method === 'POST') {
      const sub = await request.json<StoredSubscription>();
      if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
        return json({ detail: 'Invalid push subscription' }, 400);
      }
      await this.state.storage.put(`sub:${sub.endpoint}`, sub);
      return json({ ok: true });
    }

    if (url.pathname === '/status' && request.method === 'GET') {
      const subs = await this.state.storage.list<StoredSubscription>({ prefix: 'sub:' });
      return json({ subscriptions: subs.size });
    }

    if ((url.pathname === '/routes' || url.pathname === '/routes-test') && request.method === 'GET') {
      const testMode = url.pathname === '/routes-test';
      const stored = await this.state.storage.list<any>({ prefix: routePrefix(testMode) });
      const recordings = [...stored.values()]
        .filter(x => x && typeof x.segment === 'string' && validSegment(x.segment))
        .sort((a, b) => String(a.segment).localeCompare(String(b.segment)));
      return json({ recordings, count: recordings.length, testMode });
    }

    const routeMatch = url.pathname.match(/^\/(routes|routes-test)\/([^/]+)$/);
    if (routeMatch && request.method === 'POST') {
      const testMode = routeMatch[1] === 'routes-test';
      const segment = decodeURIComponent(routeMatch[2]);
      if (!validSegment(segment)) return json({ detail: 'Invalid route segment' }, 400);

      const body = await request.json<any>();
      if (body?.segment !== segment || !Array.isArray(body?.points) || !Array.isArray(body?.landmarks)) {
        return json({ detail: 'Invalid route recording' }, 400);
      }

      const key = `${routePrefix(testMode)}${segment}`;
      const existed = !!(await this.state.storage.get<any>(key));
      await this.state.storage.put(key, { ...body, updatedAt: new Date().toISOString(), testMode });
      return json({ ok: true, stored: true, overwritten: existed, segment, testMode });
    }

    if (url.pathname === '/routes-test' && request.method === 'DELETE') {
      const stored = await this.state.storage.list<any>({ prefix: routePrefix(true) });
      await Promise.all([...stored.keys()].map(key => this.state.storage.delete(key)));
      return json({ ok: true, deleted: stored.size, testMode: true });
    }

    if (url.pathname === '/send' && request.method === 'POST') {
      const payload = await request.json<any>();
      const subs = await this.state.storage.list<StoredSubscription>({ prefix: 'sub:' });
      if (!subs.size) return json({ ok: false, delivered: 0, detail: 'No parent subscription' }, 409);

      webpush.setVapidDetails(
        this.env.VAPID_SUBJECT,
        this.env.VAPID_PUBLIC_KEY,
        this.env.VAPID_PRIVATE_KEY,
      );

      let delivered = 0;
      const dead: string[] = [];
      await Promise.all([...subs.entries()].map(async ([key, sub]) => {
        try {
          await webpush.sendNotification(sub as any, JSON.stringify(payload), { TTL: 120 });
          delivered++;
        } catch (err: any) {
          const code = Number(err?.statusCode || 0);
          if (code === 404 || code === 410) dead.push(key);
          else console.error('push failed', code, err?.message || err);
        }
      }));

      if (dead.length) await Promise.all(dead.map(key => this.state.storage.delete(key)));
      return json({ ok: delivered > 0, delivered, removed: dead.length });
    }

    return json({ detail: 'Not found' }, 404);
  }
}

function parentStub(env: PushEnv) {
  const id = env.PUSH_STORE.idFromName('parent');
  return env.PUSH_STORE.get(id);
}

export async function handlePushApi(request: Request, env: PushEnv): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === '/api/route-recordings' && request.method === 'GET') {
    return parentStub(env).fetch('https://push.internal/routes');
  }
  if (url.pathname === '/api/route-recordings/test' && request.method === 'GET') {
    return parentStub(env).fetch('https://push.internal/routes-test');
  }
  if (url.pathname === '/api/route-recordings/test' && request.method === 'DELETE') {
    return parentStub(env).fetch('https://push.internal/routes-test', { method: 'DELETE' });
  }

  const testRouteMatch = url.pathname.match(/^\/api\/route-recordings\/test\/([^/]+)$/);
  if (testRouteMatch && request.method === 'POST') {
    const segment = decodeURIComponent(testRouteMatch[1]);
    const body = await request.text();
    return parentStub(env).fetch(`https://push.internal/routes-test/${encodeURIComponent(segment)}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body,
    });
  }

  const routeRecordingMatch = url.pathname.match(/^\/api\/route-recordings\/([^/]+)$/);
  if (routeRecordingMatch && request.method === 'POST') {
    const segment = decodeURIComponent(routeRecordingMatch[1]);
    const body = await request.text();
    return parentStub(env).fetch(`https://push.internal/routes/${encodeURIComponent(segment)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
  }

  if (url.pathname === '/api/push/public-key' && request.method === 'GET') {
    if (!env.VAPID_PUBLIC_KEY) return json({ detail: 'Push is not configured' }, 503);
    return json({ publicKey: env.VAPID_PUBLIC_KEY });
  }

  if (url.pathname === '/api/push/subscribe' && request.method === 'POST') {
    const body = await request.text();
    return parentStub(env).fetch('https://push.internal/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
  }

  if (url.pathname === '/api/push/status' && request.method === 'GET') {
    return parentStub(env).fetch('https://push.internal/status');
  }

  if (url.pathname === '/api/push/emergency' && request.method === 'POST') {
    const body = await request.json<any>();
    const lat = Number(body?.lat);
    const lon = Number(body?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return json({ detail: 'Valid GPS location is required' }, 400);
    }

    const accuracy = Number.isFinite(Number(body?.accuracy)) ? Math.round(Number(body.accuracy)) : null;
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`;
    const step = typeof body?.step === 'string' ? body.step : '';
    const payload = {
      title: '🆘 מאור צריך עזרה',
      body: `${step ? step + ' · ' : ''}📍 לחץ כאן כדי לראות את מאור במפה${accuracy ? ` · דיוק ±${accuracy} מ׳` : ''}`,
      tag: `maor-help-${Date.now()}`,
      data: { url: mapUrl, lat, lon, accuracy, at: new Date().toISOString() },
    };

    return parentStub(env).fetch('https://push.internal/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  return json({ detail: 'Not found' }, 404);
}
