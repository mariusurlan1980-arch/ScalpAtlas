#!/usr/bin/env python3
"""Rank chart OBSERVABILITY from a SCALP ATLAS JURNAL ZIP. Not a trading model.

This script requires no broker credentials, screen access or app changes.
It does NOT estimate win rate, price direction, payouts, or profitability.
It compares only the recorded chart-readability and signal-filter context.
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import json
import statistics
import sys
import zipfile
from pathlib import Path

OBS_PREFIX = "OBSERVATII LIVE:"

def read_observations(archive: zipfile.ZipFile) -> list[dict]:
    try:
        report = archive.read("Jurnal-semne.txt").decode("utf-8")
    except (KeyError, UnicodeDecodeError) as exc:
        raise ValueError("ZIP-ul nu contine un Jurnal-semne.txt valid") from exc
    in_observations = False
    observations: list[dict] = []
    for line in report.splitlines():
        if line.startswith(OBS_PREFIX):
            in_observations = True
            continue
        if not in_observations:
            continue
        if not line.strip() or line.startswith("Nu utiliza"):
            break
        cells = [cell.strip() for cell in line.split("|", 9)]
        if len(cells) != 10:
            continue
        timestamp, market, tf, regime, signal, score, quality, candle_count, gate, reason = cells
        if market in {"", "NEIDENTIFICAT"} or tf not in {"M5", "M10", "M15"}:
            continue
        try:
            when = dt.datetime.strptime(timestamp, "%Y-%m-%d %H:%M:%S")
            observations.append({
                "at": when, "market": market, "tf": tf,
                "regime": regime, "signal": signal, "score": int(score),
                "quality": int(quality), "candles": int(candle_count),
                "gate": gate, "reason": reason,
            })
        except ValueError:
            continue
    return observations

def compare(observations: list[dict], min_samples: int = 8) -> dict:
    """Require >2 instruments observed recently; NEVER rank one screenshot."""
    groups: dict[tuple[str, str], list[dict]] = collections.defaultdict(list)
    for item in observations:
        groups[item["market"], item["tf"]].append(item)
    profiles = []
    for (market, tf), items in groups.items():
        items.sort(key=lambda x: x["at"])
        span_s = (items[-1]["at"] - items[0]["at"]).total_seconds()
        # 15-second diagnostic snapshots are heavily autocorrelated. Require
        # 8 distinct observations across >= 2 minutes before comparisons.
        qualified = len(items) >= min_samples and span_s >= 120
        qualities = [row["quality"] for row in items]
        unreadable = sum(row["quality"] < 55 or row["regime"] == "NECITIBIL" for row in items)
        agitated = sum(row["regime"] == "AGITAT" for row in items)
        candidates = sum(row["gate"] == "CANDIDAT_OPTIC" for row in items)
        trends = sum(row["regime"] == "TENDINTA" for row in items)
        # This score is ONLY a practical guide to which recorded chart is
        # suitable for closer manual inspection. Not win probability.
        q = statistics.median(qualities)
        observation_quality = round(
            max(0., min(100., q
                - 35. * unreadable / len(items)
                - 18. * agitated / len(items)
                + 6. * trends / len(items))), 1
        )
        profiles.append({
            "market": market, "timeframe": tf,
            "samples": len(items), "duration_minutes": round(span_s / 60, 1),
            "median_image_quality": q, "optical_candidates": candidates,
            "unreadable": unreadable, "agitated": agitated,
            "trend_observations": trends, "chart_review_score": observation_quality,
            "qualified": qualified, "last_observed": items[-1]["at"].isoformat(),
        })
    qualified = sorted(
        (p for p in profiles if p["qualified"]),
        key=lambda p: (-p["chart_review_score"], -p["median_image_quality"], p["market"]),
    )
    if len(qualified) < 2:
        conclusion = "DATE_INSUFICIENTE"
        note = "Pentru comparatie avem nevoie de cel putin doua perechi, fiecare observata >=2 minute cu >=8 esantioane."
        top = None
    else:
        conclusion = "COMPARATIE_TEHNICA"
        note = (
            "Prima pereche are un grafic mai usor de interpretat din esantionul disponibil, "
            "NU o probabilitate de profit mai mare si NU un semnal BUY/SELL."
        )
        top = {"market": qualified[0]["market"], "timeframe": qualified[0]["timeframe"]}
    return {
        "status": conclusion, "note": note, "inspect_first": top,
        "profiles": sorted(profiles, key=lambda p: (p["market"], p["timeframe"])),
        "notice": "Fara date OHLC si rezultate DEMO verificabile, nu poate fi calculata profitabilitatea."
    }

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("journal_zip", type=Path)
    parser.add_argument("--min-samples", type=int, default=8)
    args = parser.parse_args()
    try:
        with zipfile.ZipFile(args.journal_zip) as archive:
            observations = read_observations(archive)
        report = compare(observations, args.min_samples)
    except (zipfile.BadZipFile, OSError, ValueError) as exc:
        print(f"EROARE: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
