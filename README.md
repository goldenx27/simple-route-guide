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

## Bus arrival: official schedule plus real time
The UI polls `/api/transit/arrival` every 20 seconds and labels the kind of information it displays. Sources are selected in this order:

1. Ministry of Transport SIRI `ExpectedArrivalTime` when configured.
2. Open Bus live vehicle positions when a fresh, usable position exists.
3. The official Ministry GTFS schedule, clearly labelled as planned rather than live.

Configured boarding stops:

- School direction: stop `38283` (המכבים/שלונסקי), line `238`
- Home direction: stop `36743` (אליהו בן חור/אלוף רחבעם זאבי), line `238`

Set the SIRI endpoint as a Worker variable and the key as a secret:

```bash
npx wrangler secret put SIRI_KEY
```

Set `SIRI_ENDPOINT` in the Cloudflare Worker environment once the Ministry provides the current SIRI-Lite HTTP GET endpoint.

The Worker sends `Key` and `MonitoringRef`, requests JSON, filters line 238 and returns the next three expected arrivals. Missing or unavailable real-time sources fall back to the official planned schedule instead of an empty ETA.

### Nightly official GTFS

`.github/workflows/update-gtfs.yml` downloads the Ministry's date-specific `Gtfs_10_days.zip` nightly and runs `scripts/update_gtfs.py`. The script streams the large CSV files and writes only the next ten days for line 238 at stops 38283 and 36743 to `public/data/gtfs-238.json`.

Run the same update manually with `python scripts/update_gtfs.py --days 10`.

### Google Routes experiment

`/api/transit/google-routes-check?route_id=maor-home-school` calls Google Routes with transit mode, filters `transitLine.nameShort` for 238, and returns matching times for comparison. Configure `GOOGLE_ROUTES_API_KEY` and `GOOGLE_ROUTES_TEST_TOKEN` as Wrangler secrets, then send the test token in the `X-Google-Routes-Test-Token` header. The token prevents a public endpoint from consuming Google billing quota.

Google Routes is not part of the production fallback chain until its returned time is verified as real-time in Israel.

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
- Official SIRI live ETA requires the Ministry endpoint and key; otherwise the app uses Open Bus when live data exists, then official GTFS.
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

