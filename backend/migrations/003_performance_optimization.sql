-- ============================================================
-- Performance Optimization Migration
-- Adds database indexes and optimizes queries
-- ============================================================

-- ============================================================
-- Critical Performance Indexes
-- ============================================================

-- Students table optimization
CREATE INDEX IF NOT EXISTS idx_students_tenant_status ON students(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_students_tenant_code ON students(tenant_id, student_code);
CREATE INDEX IF NOT EXISTS idx_students_email_tenant ON students(email, tenant_id) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_phone_tenant ON students(phone, tenant_id);

-- Memberships table optimization (most frequently queried)
CREATE INDEX IF NOT EXISTS idx_memberships_student_status ON memberships(student_id, status);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_status ON memberships(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_memberships_expiry_active ON memberships(end_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_expiry ON memberships(tenant_id, end_date, status);

-- Payments table optimization
CREATE INDEX IF NOT EXISTS idx_payments_tenant_date ON payments(tenant_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_student_date ON payments(student_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_status_date ON payments(status, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_method_date ON payments(payment_method, payment_date);

-- Seats table optimization
CREATE INDEX IF NOT EXISTS idx_seats_tenant_status ON seats(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_seats_section_status ON seats(section_id, status);
CREATE INDEX IF NOT EXISTS idx_seats_tenant_number ON seats(tenant_id, seat_number);

-- Notifications table optimization
CREATE INDEX IF NOT EXISTS idx_notifications_student_unread ON notifications(student_id, is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_type ON notifications(tenant_id, type, created_at);

-- Announcements table optimization
CREATE INDEX IF NOT EXISTS idx_announcements_tenant_active ON announcements(tenant_id, expires_at) WHERE expires_at IS NULL OR expires_at > NOW();
CREATE INDEX IF NOT EXISTS idx_announcements_tenant_pinned ON announcements(tenant_id, is_pinned, created_at);

-- Complaints table optimization
CREATE INDEX IF NOT EXISTS idx_complaints_tenant_status ON complaints(tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_complaints_student_status ON complaints(student_id, status, created_at);

-- Booking requests optimization
CREATE INDEX IF NOT EXISTS idx_booking_requests_tenant_status ON seat_booking_requests(tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_booking_requests_student_status ON seat_booking_requests(student_id, status);

-- ============================================================
-- Composite Indexes for Complex Queries
-- ============================================================

-- Dashboard queries optimization
CREATE INDEX IF NOT EXISTS idx_students_tenant_status_created ON students(tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_status_amount ON payments(tenant_id, status, amount, payment_date);

-- Analytics queries optimization
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_dates ON memberships(tenant_id, start_date, end_date, status);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_method_status ON payments(tenant_id, payment_method, status, payment_date);

-- Search optimization
CREATE INDEX IF NOT EXISTS idx_students_name_search ON students USING gin(to_tsvector('english', full_name));
CREATE INDEX IF NOT EXISTS idx_complaints_text_search ON complaints USING gin(to_tsvector('english', subject || ' ' || description));

-- ============================================================
-- Materialized Views for Heavy Analytics
-- ============================================================

-- Daily payment statistics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_payment_stats AS
SELECT 
    tenant_id,
    payment_date,
    COUNT(*) as payment_count,
    SUM(amount) as total_amount,
    COUNT(CASE WHEN status = 'verified' THEN 1 END) as successful_count,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as failed_count,
    AVG(amount) FILTER (WHERE status = 'verified') as avg_amount
FROM payments 
WHERE payment_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY tenant_id, payment_date;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_payment_stats_unique 
ON daily_payment_stats(tenant_id, payment_date);

-- Monthly membership statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_membership_stats AS
SELECT 
    tenant_id,
    DATE_TRUNC('month', start_date) as month,
    COUNT(*) as new_memberships,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_memberships,
    COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_memberships,
    COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_memberships
FROM memberships 
WHERE start_date >= CURRENT_DATE - INTERVAL '24 months'
GROUP BY tenant_id, DATE_TRUNC('month', start_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_membership_stats_unique 
ON monthly_membership_stats(tenant_id, month);

-- ============================================================
-- Optimized Functions for Common Queries
-- ============================================================

-- Fast dashboard statistics function
CREATE OR REPLACE FUNCTION get_tenant_dashboard_stats(p_tenant_id UUID)
RETURNS TABLE (
    total_students BIGINT,
    active_students BIGINT,
    total_seats BIGINT,
    occupied_seats BIGINT,
    monthly_revenue NUMERIC,
    pending_applications BIGINT,
    unread_complaints BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM students WHERE tenant_id = p_tenant_id)::BIGINT,
        (SELECT COUNT(*) FROM students WHERE tenant_id = p_tenant_id AND status = 'active')::BIGINT,
        (SELECT COUNT(*) FROM seats WHERE tenant_id = p_tenant_id)::BIGINT,
        (SELECT COUNT(*) FROM seats WHERE tenant_id = p_tenant_id AND status = 'occupied')::BIGINT,
        (SELECT COALESCE(SUM(amount), 0) FROM payments 
         WHERE tenant_id = p_tenant_id 
           AND status = 'verified' 
           AND payment_date >= DATE_TRUNC('month', CURRENT_DATE))::NUMERIC,
        (SELECT COUNT(*) FROM seat_booking_requests 
         WHERE tenant_id = p_tenant_id AND status = 'pending')::BIGINT,
        (SELECT COUNT(*) FROM complaints 
         WHERE tenant_id = p_tenant_id AND status IN ('open', 'in_progress'))::BIGINT;
END;
$$ LANGUAGE plpgsql;

-- Optimized student search function
CREATE OR REPLACE FUNCTION search_students(
    p_tenant_id UUID,
    p_search_term TEXT,
    p_status TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    student_code TEXT,
    phone TEXT,
    email TEXT,
    status TEXT,
    assigned_seat_number TEXT,
    membership_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.full_name,
        s.student_code,
        s.phone,
        s.email,
        s.status,
        seats.seat_number,
        COALESCE(m.status, 'none') as membership_status
    FROM students s
    LEFT JOIN seats ON s.assigned_seat_id = seats.id
    LEFT JOIN memberships m ON s.id = m.student_id AND m.status = 'active'
    WHERE s.tenant_id = p_tenant_id
        AND (p_status IS NULL OR s.status = p_status)
        AND (
            p_search_term IS NULL OR
            s.full_name ILIKE '%' || p_search_term || '%' OR
            s.student_code ILIKE '%' || p_search_term || '%' OR
            s.phone ILIKE '%' || p_search_term || '%' OR
            s.email ILIKE '%' || p_search_term || '%'
        )
    ORDER BY s.full_name
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Automated Maintenance Procedures
-- ============================================================

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_payment_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_membership_stats;
    
    -- Log the refresh
    INSERT INTO system_logs (log_type, message, created_at)
    VALUES ('maintenance', 'Analytics views refreshed', NOW());
    
EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail
    INSERT INTO system_logs (log_type, message, error_details, created_at)
    VALUES ('error', 'Failed to refresh analytics views', SQLERRM, NOW());
END;
$$ LANGUAGE plpgsql;

-- Create system logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_type TEXT NOT NULL,
    message TEXT NOT NULL,
    error_details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Cleanup Old Data Function
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Clean up old notifications (older than 6 months)
    DELETE FROM notifications 
    WHERE created_at < NOW() - INTERVAL '6 months'
    AND is_read = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    INSERT INTO system_logs (log_type, message, created_at)
    VALUES ('cleanup', 'Deleted ' || deleted_count || ' old notifications', NOW());
    
    -- Archive old audit logs to separate table (if exists)
    -- This would be implemented based on your audit requirements
    
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Triggers for Automatic Statistics Updates
-- ============================================================

-- Function to update materialized views when payments change
CREATE OR REPLACE FUNCTION update_payment_stats_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Only refresh if it's a recent payment (within last 90 days)
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') 
       AND NEW.payment_date >= CURRENT_DATE - INTERVAL '90 days' THEN
        -- Schedule a refresh (in a real app, you'd use a job queue)
        -- For now, we'll refresh immediately for recent data
        REFRESH MATERIALIZED VIEW CONCURRENTLY daily_payment_stats;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment statistics updates
DROP TRIGGER IF EXISTS payment_stats_update_trigger ON payments;
CREATE TRIGGER payment_stats_update_trigger
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_payment_stats_trigger();

-- ============================================================
-- Performance Monitoring Views
-- ============================================================

-- View to monitor slow queries and table usage
CREATE OR REPLACE VIEW performance_monitoring AS
SELECT 
    schemaname,
    tablename,
    seq_scan as sequential_scans,
    seq_tup_read as sequential_reads,
    idx_scan as index_scans,
    idx_tup_fetch as index_reads,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC;

-- Create indexes on system tables for better performance monitoring
CREATE INDEX IF NOT EXISTS idx_system_logs_type_date ON system_logs(log_type, created_at);

-- ============================================================
-- Index Usage Statistics Function
-- ============================================================

CREATE OR REPLACE FUNCTION get_index_usage_stats()
RETURNS TABLE (
    table_name TEXT,
    index_name TEXT,
    index_scans BIGINT,
    index_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.relname::TEXT as table_name,
        i.relname::TEXT as index_name,
        s.idx_scan as index_scans,
        pg_size_pretty(pg_relation_size(i.oid)) as index_size
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    LEFT JOIN pg_stat_user_indexes s ON i.oid = s.indexrelid
    WHERE t.relkind = 'r'
        AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ORDER BY s.idx_scan DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Schedule regular maintenance (this would typically be done via cron or a job scheduler)
-- For now, we'll just create the functions that can be called manually or via cron jobs

COMMENT ON FUNCTION refresh_analytics_views() IS 'Refresh materialized views for analytics. Should be run daily.';
COMMENT ON FUNCTION cleanup_old_data() IS 'Clean up old data to maintain performance. Should be run weekly.';
COMMENT ON FUNCTION get_index_usage_stats() IS 'Monitor index usage to identify unused indexes.';

-- Final optimization: Update table statistics
ANALYZE;