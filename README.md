# Simple Route Guide

Child-friendly guided route MVP, initially built for Maor's school journey.

## Cloudflare version
The active implementation is now a Cloudflare Worker written in TypeScript.

- `src/index.ts` - route state machine and API
- `src/main.ts` - Worker entrypoint, push routing and live SIRI integration
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

## Live bus arrival (SIRI)
The UI already polls `/api/transit/arrival` every 20 seconds. The Worker can now connect directly to the Ministry of Transport SIRI-Lite service for line 238.

Configured boarding stops:

- School direction: stop `38283` (המכבים/שלונסקי), line `238`
- Home direction: stop `36743` (אליהו בן חור/אלוף רחבעם זאבי), line `238`

Set the SIRI endpoint as a Worker variable and the key as a secret:

```bash
npx wrangler secret put SIRI_KEY
```

Set `SIRI_ENDPOINT` in the Cloudflare Worker environment once the Ministry provides the current SIRI-Lite HTTP GET endpoint.

The Worker sends `Key` and `MonitoringRef`, requests JSON, filters line 238 and returns the next three expected arrivals. Until both `SIRI_ENDPOINT` and `SIRI_KEY` exist, the application deliberately keeps the existing "awaiting SIRI connection" state instead of displaying an estimated or invented ETA.

Guidance based on the next real-time arrival:

- 0–3 minutes: `WAIT_FOR_NEXT`
- 4–10 minutes: `LEAVE_NOW`
- More than 10 minutes: `WAIT`

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
- The real approved walking route still needs final GPS verification.
- Live bus ETA requires the Ministry of Transport SIRI endpoint and key to be configured in Cloudflare.
- Bus progress after boarding is still simulated / GPS-assisted rather than sourced from SIRI trip progress.
- No parent dashboard yet.
- No authentication yet.
- Deviation-from-approved-route detection is not implemented yet.

## Next increment
1. Configure `SIRI_ENDPOINT` and `SIRI_KEY` after Ministry approval.
2. Verify live ETA for stop 38283 / line 238.
3. Connect bus progress after boarding to real-time SIRI data.
4. Finish route-corridor/deviation detection.
5. Add parent view and notifications.
