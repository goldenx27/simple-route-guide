# Simple Route Guide

Child-friendly guided route MVP, initially built for Maor's school journey.

## MVP features
- Route state machine
- Walking steps and ordered instruction points
- GPS distance checks
- Bus waiting / boarding / remaining-stops flow
- Strong alert one stop before getting off
- Arrival and help states
- Hebrew mobile UI
- Hebrew text-to-speech when supported by the browser
- Vibration for important alerts
- Simulation mode for testing from home
- Real browser GPS mode

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000`.

## Current limitations
- Demo coordinates only
- In-memory trip storage
- Bus progress is simulated; no GTFS-Realtime integration yet
- No parent dashboard/push notifications yet
- No authentication yet
- No deviation-from-approved-route algorithm yet

## Next increment
1. Replace demo coordinates with the real route.
2. Persist routes/trips in a D1-compatible schema.
3. Add route corridor + deviation detection.
4. Add parent screen and push notifications.
5. Add real transit data.
