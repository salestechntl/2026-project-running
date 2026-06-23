-- Load Running Camp CSV files into Vertica
-- Prerequisite: run create_tables.sql first.
--
-- CSV format from export scripts:
--   UTF-8 with BOM, header row, CRLF, comma-delimited, quoted fields when needed.
--
-- Replace file paths before running.

-- Truncate before full reload (optional)
-- TRUNCATE TABLE running_camp.run_entries;
-- TRUNCATE TABLE running_camp.weight_entries;

-- ---------------------------------------------------------------------------
-- CSV columns (15 run / 13 weight) — web + Python export
-- ---------------------------------------------------------------------------

COPY running_camp.run_entries (
    id,
    employee_id,
    run_date,
    run_type,
    distance_km,
    duration_sec,
    mission_month,
    note,
    status,
    reject_note,
    rejected_by,
    approved_by,
    approved_at,
    created_at,
    updated_at
)
FROM '/path/to/run_entries_2026-06-22.csv'
PARSER FCSVParser(
    header = 'true',
    delimiter = ',',
    quote = '"',
    escape = '"',
    reject_on_materialized_type_error = 'false',
    empty_field_as = 'null'
)
ENCODING 'UTF8'
DIRECT;

COPY running_camp.weight_entries (
    id,
    employee_id,
    month,
    period,
    weight_kg,
    status,
    reject_note,
    rejected_by,
    approved_by,
    approved_at,
    created_at,
    updated_at
)
FROM '/path/to/weight_entries_2026-06-22.csv'
PARSER FCSVParser(
    header = 'true',
    delimiter = ',',
    quote = '"',
    escape = '"',
    reject_on_materialized_type_error = 'false',
    empty_field_as = 'null'
)
ENCODING 'UTF8'
DIRECT;

-- ---------------------------------------------------------------------------
-- Quick checks after load
-- ---------------------------------------------------------------------------
-- SELECT COUNT(*) FROM running_camp.run_entries;
-- SELECT COUNT(*) FROM running_camp.weight_entries;
-- SELECT status, COUNT(*) FROM running_camp.run_entries GROUP BY 1;
-- SELECT status, COUNT(*) FROM running_camp.weight_entries GROUP BY 1;
