#!/usr/bin/env python3
"""
Export run_entries and weight_entries via the Running Camp web API (Super Admin).

Edit the constants below, then run:
  python scripts/export_csv_web.py
"""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

# --- config (edit here) ---
BASE_URL = "https://2026-project-running.vercel.app"
EMPLOYEE_ID = "10001"
OUTPUT_DIR = Path.home() / "Downloads" / "running-camp-export"
# --------------------------


def api_json(method: str, url: str, *, token: str | None = None, body: dict | None = None) -> tuple[int, dict | str]:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            raw = res.read().decode("utf-8")
            if not raw:
                return res.status, {}
            return res.status, json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw


def api_download(url: str, token: str) -> tuple[int, bytes, dict[str, str]]:
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}", "Accept": "text/csv"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            return res.status, res.read(), dict(res.headers.items())
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            err = json.loads(raw.decode("utf-8"))
            msg = err.get("error", raw.decode("utf-8", errors="replace"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            msg = raw.decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {msg}") from e


def login(base_url: str, employee_id: str) -> str:
    url = f"{base_url.rstrip('/')}/api/auth/login"
    status, data = api_json("POST", url, body={"employee_id": employee_id})
    if status != 200 or not isinstance(data, dict):
        msg = data.get("error", data) if isinstance(data, dict) else data
        print(f"error: login failed ({status}): {msg}", file=sys.stderr)
        sys.exit(1)
    token = str(data.get("token", "")).strip()
    if not token:
        print("error: login response missing token", file=sys.stderr)
        sys.exit(1)
    if not data.get("isSuperAdmin"):
        print(
            "error: employee is not Super Admin — export API requires super_admin role",
            file=sys.stderr,
        )
        sys.exit(1)
    return token


def filename_from_disposition(header: str | None, fallback: str) -> str:
    if not header:
        return fallback
    match = re.search(r'filename="?([^";\n]+)"?', header, re.IGNORECASE)
    return match.group(1) if match else fallback


def fallback_filename(kind: str) -> str:
    prefix = "run_entries" if kind == "runs" else "weight_entries"
    return f"{prefix}_{date.today().isoformat()}.csv"


def save_export(base_url: str, token: str, kind: str, output_dir: Path) -> Path:
    url = f"{base_url.rstrip('/')}/api/export/{kind}"
    _, content, headers = api_download(url, token)
    name = filename_from_disposition(
        headers.get("Content-Disposition"),
        fallback_filename(kind),
    )
    out_path = output_dir / name
    out_path.write_bytes(content)
    return out_path


def count_csv_rows(path: Path) -> int:
    text = path.read_text(encoding="utf-8-sig")
    lines = [ln for ln in text.splitlines() if ln.strip()]
    return max(0, len(lines) - 1)


def main() -> None:
    output_dir = OUTPUT_DIR.expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    base_url = BASE_URL.rstrip("/")
    print(f"Logging in as {EMPLOYEE_ID} @ {base_url} ...")
    token = login(base_url, EMPLOYEE_ID)

    runs_path = save_export(base_url, token, "runs", output_dir)
    weights_path = save_export(base_url, token, "weights", output_dir)

    print(f"Exported {count_csv_rows(runs_path)} run row(s)    -> {runs_path}")
    print(f"Exported {count_csv_rows(weights_path)} weight row(s) -> {weights_path}")


if __name__ == "__main__":
    main()
