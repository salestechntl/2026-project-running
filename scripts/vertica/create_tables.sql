-- Running Camp 2026 — Vertica staging tables for CSV export
-- Column names match export CSV headers (run_entries_*.csv, weight_entries_*.csv).
--
-- Matches CSV from web export, Python export, and Vertica load_csv.sql.
--
-- Run as a Vertica admin, e.g.:
--   vsql -f scripts/vertica/create_tables.sql

CREATE SCHEMA IF NOT EXISTS running_camp;

DROP TABLE IF EXISTS running_camp.weight_entries CASCADE;
DROP TABLE IF EXISTS running_camp.run_entries CASCADE;

-- ---------------------------------------------------------------------------
-- run_entries  (matches run_entries_YYYY-MM-DD.csv)
-- ---------------------------------------------------------------------------
CREATE TABLE running_camp.run_entries (
    id              VARCHAR(36)     NOT NULL,
    employee_id     VARCHAR(32)     NOT NULL,
    run_date        DATE            NOT NULL,
    run_type        VARCHAR(20)     NOT NULL,   -- discipline | mission
    distance_km     NUMERIC(8, 2)   NOT NULL,
    duration_sec    INTEGER         NOT NULL,
    mission_month   VARCHAR(7)      NOT NULL,   -- YYYY-MM
    note            VARCHAR(4000),
    status          VARCHAR(20)     NOT NULL,   -- pending | approved | rejected | expired
    reject_note     VARCHAR(4000),
    rejected_by     VARCHAR(32),
    approved_by     VARCHAR(32),
    approved_at     TIMESTAMP,
    created_at      TIMESTAMP       NOT NULL,
    updated_at      TIMESTAMP       NOT NULL
)
ORDER BY employee_id, run_date, created_at
SEGMENTED BY HASH(id) ALL NODES;

COMMENT ON TABLE running_camp.run_entries IS 'Running log entries imported from Running Camp CSV export';

-- ---------------------------------------------------------------------------
-- weight_entries  (matches weight_entries_YYYY-MM-DD.csv)
-- ---------------------------------------------------------------------------
CREATE TABLE running_camp.weight_entries (
    id              VARCHAR(36)     NOT NULL,
    employee_id     VARCHAR(32)     NOT NULL,
    month           VARCHAR(7)      NOT NULL,   -- YYYY-MM
    period          VARCHAR(10)     NOT NULL,   -- start | end
    weight_kg       NUMERIC(5, 1)   NOT NULL,
    status          VARCHAR(20)     NOT NULL,   -- pending | approved | rejected | expired
    reject_note     VARCHAR(4000),
    rejected_by     VARCHAR(32),
    approved_by     VARCHAR(32),
    approved_at     TIMESTAMP,
    created_at      TIMESTAMP       NOT NULL,
    updated_at      TIMESTAMP       NOT NULL
)
ORDER BY employee_id, month, period, created_at
SEGMENTED BY HASH(id) ALL NODES;

COMMENT ON TABLE running_camp.weight_entries IS 'Weight log entries imported from Running Camp CSV export';
