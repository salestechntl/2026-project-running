#!/usr/bin/env python3
"""
Export run_entries and weight_entries from Supabase to CSV files on local disk.

Usage:
  python scripts/export_csv.py --output-dir /path/to/folder --env-file .env.local
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from datetime import date
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

RUN_HEADERS = [
    "id",
    "employee_id",
    "run_date",
    "run_type",
    "distance_km",
    "duration_sec",
    "mission_month",
    "note",
    "status",
    "reject_note",
    "rejected_by",
    "approved_by",
    "approved_at",
    "created_at",
    "updated_at",
]

WEIGHT_HEADERS = [
    "id",
    "employee_id",
    "month",
    "period",
    "weight_kg",
    "status",
    "reject_note",
    "rejected_by",
    "approved_by",
    "approved_at",
    "created_at",
    "updated_at",
]

PAGE_SIZE = 1000


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export Running Camp run/weight entries to CSV (Supabase direct).",
    )
    parser.add_argument(
        "--output-dir",
        required=True,
        help="Local folder to write CSV files (created if missing).",
    )
    parser.add_argument(
        "--env-file",
        default=None,
        help="Optional .env file (e.g. .env.local) with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    )
    return parser.parse_args()


def load_config(env_file: str | None) -> tuple[str, str]:
    if env_file:
        path = Path(env_file)
        if not path.is_file():
            print(f"error: env file not found: {path}", file=sys.stderr)
            sys.exit(1)
        load_dotenv(path)
    else:
        load_dotenv()

    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        print(
            "error: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY "
            "(via --env-file or environment).",
            file=sys.stderr,
        )
        sys.exit(1)
    return url, key


def create_supabase(url: str, key: str) -> Client:
    return create_client(url, key)


def fetch_all(
    client: Client,
    table: str,
    columns: list[str],
    *,
    order: list[tuple[str, bool]],
) -> list[dict[str, Any]]:
    """Paginate through Supabase table (PostgREST max ~1000 per request)."""
    select_cols = ",".join(columns)
    rows: list[dict[str, Any]] = []
    offset = 0

    while True:
        query = client.table(table).select(select_cols)
        for col, desc in order:
            query = query.order(col, desc=desc)
        response = query.range(offset, offset + PAGE_SIZE - 1).execute()
        batch = response.data or []
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    return rows


def row_values(row: dict[str, Any], headers: list[str]) -> list[Any]:
    return [row.get(h) for h in headers]


def write_csv(path: Path, headers: list[str], rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f, lineterminator="\r\n")
        writer.writerow(headers)
        for row in rows:
            writer.writerow(row_values(row, headers))


def csv_filename(prefix: str) -> str:
    return f"{prefix}_{date.today().isoformat()}.csv"


def export_table(
    client: Client,
    table: str,
    prefix: str,
    headers: list[str],
    output_dir: Path,
    order: list[tuple[str, bool]],
) -> Path:
    rows = fetch_all(client, table, headers, order=order)
    out_path = output_dir / csv_filename(prefix)
    write_csv(out_path, headers, rows)
    return out_path


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    url, key = load_config(args.env_file)
    client = create_supabase(url, key)

    runs_path = export_table(
        client,
        "run_entries",
        "run_entries",
        RUN_HEADERS,
        output_dir,
        order=[("run_date", True), ("created_at", True)],
    )
    weights_path = export_table(
        client,
        "weight_entries",
        "weight_entries",
        WEIGHT_HEADERS,
        output_dir,
        order=[("month", True), ("period", False)],
    )

    runs_count = sum(1 for _ in runs_path.open(encoding="utf-8-sig")) - 1
    weights_count = sum(1 for _ in weights_path.open(encoding="utf-8-sig")) - 1

    print(f"Exported {runs_count} run row(s)    -> {runs_path}")
    print(f"Exported {weights_count} weight row(s) -> {weights_path}")


if __name__ == "__main__":
    main()
