# Simple Route Guide

Child-friendly guided route MVP, initially built for Maor's school journey.

## Cloudflare version
The active implementation is now a Cloudflare Worker written in TypeScript.

- `src/index.ts` - route state machine and API
- `public/index.html` - Hebrew mobile UI
- `wrangler.jsonc` - Worker + Static Assets configuration
- `schema.sql` - D1 schema for persistent trips

The older Python/FastAPI files are kept temporarily as reference and are not used by the Cloudflare deployment.

## MVP flow
1. Start the route to school.
2. Walk through ordered guidance points.
3. Wait for the configured bus.
4. Confirm boarding.
5. Count remaining stops.
6. Trigger a strong alert one stop before getting off.
7. Continue walking to school.
8. Mark the trip completed.

The UI also includes Hebrew speech, vibration, browser GPS and a simulation mode for testing from home.

## Run locally

```bash
npm install
npm run dev
```

Wrangler serves both the Worker API and the files in `public/`.

## Deploy

```bash
npm install
npm run deploy
```

The current configuration can deploy without D1. In that mode trips are stored only in Worker memory and should be treated as demo state.

## Connect D1

Create a D1 database named `simple-route-guide-db`, then add the generated binding to `wrangler.jsonc` using the binding name `DB`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "simple-route-guide-db",
    "database_id": "<DATABASE_ID>"
  }
]
```

Apply the schema:

```bash
npx wrangler d1 execute simple-route-guide-db --remote --file=./schema.sql
```

The Worker automatically starts persisting and reloading trips when the `DB` binding exists.

## Current limitations
- Demo coordinates only; the real approved route still needs to be entered.
- Bus progress is simulated; no GTFS-Realtime integration yet.
- No parent dashboard or push notification yet.
- No authentication yet.
- Help mode currently changes trip state but does not yet send a real parent notification.
- Deviation-from-approved-route detection is not implemented yet.

## Next increment
1. Deploy the Worker and obtain a live URL.
2. Create and bind D1.
3. Replace demo coordinates with Maor's real route.
4. Add route-corridor/deviation detection.
5. Add parent view and notifications.
