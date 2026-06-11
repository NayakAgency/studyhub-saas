-- ============================================================
-- Maintenance Functions Migration
-- DB utility functions for the maintenance cron job
-- ============================================================

-- Get list of user tables
CREATE OR REPLACE FUNCTION get_table_list()
RETURNS TABLE(table_name TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT t.table_name::TEXT
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE';
END;
$$ LANGUAGE plpgsql;

-- Analyze a single table
CREATE OR REPLACE FUNCTION analyze_table(table_name TEXT)
RETURNS void AS $$
BEGIN
    EXECUTE 'ANALYZE ' || quote_ident(table_name);
END;
$$ LANGUAGE plpgsql;

-- Vacuum analyze all public tables (ANALYZE only — VACUUM needs superuser)
CREATE OR REPLACE FUNCTION vacuum_analyze_tables()
RETURNS void AS $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT schemaname, tablename
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
    LOOP
        BEGIN
            EXECUTE 'ANALYZE ' || quote_ident(rec.schemaname) || '.' || quote_ident(rec.tablename);
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO system_logs (log_type, message, error_details, created_at)
            VALUES ('maintenance_warning', 'Failed to analyze: ' || rec.tablename, SQLERRM, NOW());
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Database health metrics
CREATE OR REPLACE FUNCTION get_database_health_metrics()
RETURNS TABLE (
    total_connections   INTEGER,
    active_connections  INTEGER,
    database_size       TEXT,
    cache_hit_ratio     NUMERIC,
    deadlocks           BIGINT,
    temp_files          BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT count(*)::INTEGER FROM pg_stat_activity),
        (SELECT count(*)::INTEGER FROM pg_stat_activity WHERE state = 'active'),
        (SELECT pg_size_pretty(pg_database_size(current_database())))::TEXT,
        (SELECT ROUND(100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0), 2)
         FROM pg_stat_database WHERE datname = current_database()),
        (SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()),
        (SELECT temp_files  FROM pg_stat_database WHERE datname = current_database());
END;
$$ LANGUAGE plpgsql;

-- Table sizes overview
CREATE OR REPLACE FUNCTION get_table_sizes()
RETURNS TABLE (
    table_name  TEXT,
    total_size  TEXT,
    table_size  TEXT,
    index_size  TEXT,
    row_count   BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.table_name::TEXT,
        pg_size_pretty(pg_total_relation_size(c.oid))::TEXT,
        pg_size_pretty(pg_relation_size(c.oid))::TEXT,
        pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid))::TEXT,
        COALESCE(s.n_live_tup, 0)::BIGINT
    FROM information_schema.tables t
    JOIN pg_class c ON c.relname = t.table_name
    LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    ORDER BY pg_total_relation_size(c.oid) DESC;
END;
$$ LANGUAGE plpgsql;
