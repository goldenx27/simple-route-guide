#!/usr/bin/env python3
"""Build a tiny, browser-safe line 238 schedule from the official Israeli GTFS."""

from __future__ import annotations

import argparse
import csv
import io
import json
import tempfile
import urllib.request
import zipfile
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

SOURCE_URL = "https://gtfs.mot.gov.il/gtfsfiles/Gtfs_10_days.zip"
LINE = "238"
BOARDING_STOPS = {"38283", "36743"}
ROUTE_STOPS = BOARDING_STOPS | {"38252", "33734"}
ISRAEL = ZoneInfo("Asia/Jerusalem")
WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def rows(archive: zipfile.ZipFile, name: str):
    with archive.open(name) as raw:
        yield from csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline=""))


def gtfs_date(value: str) -> date:
    return datetime.strptime(value, "%Y%m%d").date()


def service_dates(calendar_row: dict[str, str], start: date, days: int) -> list[date]:
    first, last = gtfs_date(calendar_row["start_date"]), gtfs_date(calendar_row["end_date"])
    result = []
    for offset in range(days):
        candidate = start + timedelta(days=offset)
        if first <= candidate <= last and calendar_row.get(WEEKDAYS[candidate.weekday()]) == "1":
            result.append(candidate)
    return result


def arrival_timestamp(service_date: date, gtfs_time: str) -> datetime:
    hour, minute, second = (int(part) for part in gtfs_time.split(":"))
    return datetime.combine(service_date, datetime.min.time(), ISRAEL) + timedelta(
        hours=hour, minutes=minute, seconds=second
    )


def build(archive_path: Path, output_path: Path, start: date, days: int) -> None:
    with zipfile.ZipFile(archive_path) as archive:
        route_ids = {
            row["route_id"]
            for row in rows(archive, "routes.txt")
            if row.get("route_short_name", "").strip() == LINE
        }
        trips = {
            row["trip_id"]: {
                "service_id": row["service_id"],
                "route_id": row["route_id"],
                "headsign": row.get("trip_headsign", ""),
                "direction_id": row.get("direction_id", ""),
            }
            for row in rows(archive, "trips.txt")
            if row.get("route_id") in route_ids
        }
        if "calendar_dates.txt" in archive.namelist():
            calendar: dict[str, list[date]] = defaultdict(list)
            end = start + timedelta(days=days)
            for row in rows(archive, "calendar_dates.txt"):
                service_date = gtfs_date(row["date"])
                if row.get("exception_type") == "1" and start <= service_date < end:
                    calendar[row["service_id"]].append(service_date)
        else:
            calendar = {
                row["service_id"]: service_dates(row, start, days)
                for row in rows(archive, "calendar.txt")
            }
        stops = {
            row["stop_code"]: {
                "id": row["stop_code"],
                "gtfs_stop_id": row["stop_id"],
                "name": row.get("stop_name", ""),
                "lat": float(row["stop_lat"]),
                "lon": float(row["stop_lon"]),
            }
            for row in rows(archive, "stops.txt")
            if row.get("stop_code") in ROUTE_STOPS
        }
        gtfs_stop_to_code = {value["gtfs_stop_id"]: code for code, value in stops.items()}
        schedule: dict[str, dict[str, list[dict[str, object]]]] = defaultdict(lambda: defaultdict(list))
        for row in rows(archive, "stop_times.txt"):
            trip = trips.get(row.get("trip_id", ""))
            stop_code = gtfs_stop_to_code.get(row.get("stop_id", ""))
            if not trip or stop_code not in BOARDING_STOPS:
                continue
            for service_date in calendar.get(trip["service_id"], []):
                arrival = arrival_timestamp(service_date, row["arrival_time"])
                schedule[stop_code][service_date.isoformat()].append({
                    "timestamp": arrival.isoformat(),
                    "time": arrival.strftime("%H:%M"),
                    "trip_id": row["trip_id"],
                    "headsign": trip["headsign"],
                    "direction_id": trip["direction_id"],
                })

    for dates in schedule.values():
        for arrivals in dates.values():
            arrivals.sort(key=lambda item: item["timestamp"])

    payload = {
        "schema_version": 1,
        "generated_at": datetime.now(ISRAEL).isoformat(),
        "source": "Ministry of Transport GTFS",
        "source_url": SOURCE_URL,
        "timezone": "Asia/Jerusalem",
        "line": LINE,
        "range": {"from": start.isoformat(), "days": days},
        "stops": stops,
        "schedule": schedule,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", type=Path, help="Use an already-downloaded GTFS zip")
    parser.add_argument("--output", type=Path, default=Path("public/data/gtfs-238.json"))
    parser.add_argument("--start-date", type=date.fromisoformat, default=date.today())
    parser.add_argument("--days", type=int, default=10)
    args = parser.parse_args()
    if args.days < 1 or args.days > 31:
        parser.error("--days must be between 1 and 31")

    if args.zip:
        build(args.zip, args.output, args.start_date, args.days)
        return
    with tempfile.TemporaryDirectory() as temp_dir:
        archive_path = Path(temp_dir) / "Gtfs_10_days.zip"
        request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "simple-route-guide-gtfs/1.0"})
        with urllib.request.urlopen(request, timeout=120) as response, archive_path.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
        build(archive_path, args.output, args.start_date, args.days)


if __name__ == "__main__":
    main()

