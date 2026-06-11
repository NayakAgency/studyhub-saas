-- ============================================================
-- Analytics & ML Migration
-- Adds analytics views, functions for predictions & ML features
-- ============================================================

-- ============================================================
-- Analytics Materialized Views
-- ============================================================

-- Daily occupancy statistics view
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_occupancy_stats AS
SELECT 
    s.tenant_id,
    DATE(m.created_at) as date,
    COUNT(s.id) as total_seats,
    COUNT(CASE WHEN s.status = 'occupied' THEN 1 END) as occupied_seats,
    ROUND(
        (COUNT(CASE WHEN s.status = 'occupied' THEN 1 END)::DECIMAL / COUNT(s.id)) * 100, 
        2
    ) as occupancy_rate
FROM seats s
LEFT JOIN memberships m ON s.id = m.seat_id AND m.status = 'active'
WHERE DATE(m.created_at) >= CURRENT_DATE - INTERVAL '365 days' OR m.created_at IS NULL
GROUP BY s.tenant_id, DATE(m.created_at)
HAVING DATE(m.created_at) IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_occupancy_unique 
ON daily_occupancy_stats(tenant_id, date);

-- Monthly revenue statistics view
CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_revenue_stats AS
SELECT 
    tenant_id,
    DATE_TRUNC('month', payment_date)::DATE as month,
    COUNT(*) as payment_count,
    SUM(amount) as total_revenue,
    AVG(amount) as avg_payment,
    COUNT(CASE WHEN status = 'verified' THEN 1 END) as successful_payments,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as failed_payments
FROM payments 
WHERE payment_date >= CURRENT_DATE - INTERVAL '24 months'
GROUP BY tenant_id, DATE_TRUNC('month', payment_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_revenue_unique 
ON monthly_revenue_stats(tenant_id, month);

-- ============================================================
-- Analytics Functions for ML & Predictions
-- ============================================================

-- Student churn risk analysis function
CREATE OR REPLACE FUNCTION analyze_student_churn_risk(p_tenant_id UUID)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    membership_months INTEGER,
    late_payments INTEGER,
    days_since_last_login INTEGER,
    unresolved_complaints INTEGER,
    last_payment_date DATE,
    membership_end_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id as student_id,
        s.full_name as student_name,
        EXTRACT(MONTH FROM AGE(COALESCE(m.end_date, CURRENT_DATE), m.start_date))::INTEGER as membership_months,
        COUNT(p.id) FILTER (WHERE p.payment_date > p.created_at::DATE + INTERVAL '5 days')::INTEGER as late_payments,
        EXTRACT(DAY FROM NOW() - s.last_login_at)::INTEGER as days_since_last_login,
        COUNT(c.id) FILTER (WHERE c.status IN ('open', 'in_progress'))::INTEGER as unresolved_complaints,
        MAX(p.payment_date) as last_payment_date,
        m.end_date as membership_end_date
    FROM students s
    LEFT JOIN memberships m ON s.id = m.student_id AND m.status = 'active'
    LEFT JOIN payments p ON s.id = p.student_id
    LEFT JOIN complaints c ON s.id = c.student_id
    WHERE s.tenant_id = p_tenant_id 
        AND s.status = 'active'
    GROUP BY s.id, s.full_name, m.start_date, m.end_date, s.last_login_at
    ORDER BY membership_months ASC, late_payments DESC;
END;
$$ LANGUAGE plpgsql;

-- Churn factor analysis function
CREATE OR REPLACE FUNCTION get_churn_factor_analysis(p_tenant_id UUID)
RETURNS TABLE (
    payment_churn_rate DECIMAL,
    complaint_churn_rate DECIMAL,
    low_engagement_churn_rate DECIMAL,
    price_sensitive_churn_rate DECIMAL,
    seasonal_churn_pattern JSONB
) AS $$
DECLARE
    total_churned INTEGER;
    payment_related_churn INTEGER;
    complaint_related_churn INTEGER;
    engagement_related_churn INTEGER;
    seasonal_pattern JSONB;
BEGIN
    -- Count total churned students (expired memberships in last 6 months)
    SELECT COUNT(*) INTO total_churned
    FROM memberships m
    WHERE m.tenant_id = p_tenant_id 
        AND m.status = 'expired'
        AND m.end_date >= CURRENT_DATE - INTERVAL '6 months';
    
    IF total_churned = 0 THEN
        total_churned := 1; -- Avoid division by zero
    END IF;
    
    -- Payment-related churn (students with 3+ late payments before churning)
    SELECT COUNT(*) INTO payment_related_churn
    FROM memberships m
    JOIN students s ON m.student_id = s.id
    WHERE m.tenant_id = p_tenant_id 
        AND m.status = 'expired'
        AND m.end_date >= CURRENT_DATE - INTERVAL '6 months'
        AND (
            SELECT COUNT(*)
            FROM payments p 
            WHERE p.student_id = s.id 
                AND p.payment_date > p.created_at::DATE + INTERVAL '5 days'
        ) >= 3;
    
    -- Complaint-related churn
    SELECT COUNT(*) INTO complaint_related_churn
    FROM memberships m
    JOIN students s ON m.student_id = s.id
    WHERE m.tenant_id = p_tenant_id 
        AND m.status = 'expired'
        AND m.end_date >= CURRENT_DATE - INTERVAL '6 months'
        AND (
            SELECT COUNT(*)
            FROM complaints c 
            WHERE c.student_id = s.id 
                AND c.created_at >= m.start_date
        ) > 0;
    
    -- Low engagement churn (students who hadn't logged in 30+ days before expiry)
    SELECT COUNT(*) INTO engagement_related_churn
    FROM memberships m
    JOIN students s ON m.student_id = s.id
    WHERE m.tenant_id = p_tenant_id 
        AND m.status = 'expired'
        AND m.end_date >= CURRENT_DATE - INTERVAL '6 months'
        AND s.last_login_at < m.end_date - INTERVAL '30 days';
    
    -- Seasonal churn pattern by month
    SELECT jsonb_object_agg(
        EXTRACT(MONTH FROM end_date)::TEXT,
        month_count
    ) INTO seasonal_pattern
    FROM (
        SELECT 
            EXTRACT(MONTH FROM end_date) as month,
            COUNT(*) as month_count
        FROM memberships
        WHERE tenant_id = p_tenant_id 
            AND status = 'expired'
            AND end_date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY EXTRACT(MONTH FROM end_date)
    ) month_data;
    
    RETURN QUERY SELECT
        (payment_related_churn::DECIMAL / total_churned) as payment_churn_rate,
        (complaint_related_churn::DECIMAL / total_churned) as complaint_churn_rate,
        (engagement_related_churn::DECIMAL / total_churned) as low_engagement_churn_rate,
        0.0::DECIMAL as price_sensitive_churn_rate, -- Placeholder for future implementation
        COALESCE(seasonal_pattern, '{}'::JSONB) as seasonal_churn_pattern;
END;
$$ LANGUAGE plpgsql;

-- Student behavior profile function
CREATE OR REPLACE FUNCTION get_student_behavior_profile(
    p_tenant_id UUID, 
    p_student_id UUID
)
RETURNS TABLE (
    avg_logins_per_week DECIMAL,
    avg_session_minutes DECIMAL,
    feature_usage_pattern JSONB,
    payment_punctuality_score DECIMAL,
    preferred_payment_method TEXT,
    avg_payment_delay_days DECIMAL,
    complaints_per_month DECIMAL,
    satisfaction_trend TEXT,
    resource_usage_rate DECIMAL,
    predicted_renewal_probability DECIMAL,
    churn_risk_score DECIMAL,
    predicted_ltv DECIMAL
) AS $$
DECLARE
    student_start_date DATE;
    months_active INTEGER;
    total_payments INTEGER;
    late_payments INTEGER;
    total_complaints INTEGER;
BEGIN
    -- Get student's membership start date
    SELECT MIN(start_date) INTO student_start_date
    FROM memberships
    WHERE student_id = p_student_id AND tenant_id = p_tenant_id;
    
    -- Calculate months active
    months_active := GREATEST(1, EXTRACT(MONTH FROM AGE(CURRENT_DATE, student_start_date))::INTEGER);
    
    -- Get payment behavior
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE payment_date > created_at::DATE + INTERVAL '5 days')
    INTO total_payments, late_payments
    FROM payments
    WHERE student_id = p_student_id AND tenant_id = p_tenant_id;
    
    -- Get complaint count
    SELECT COUNT(*) INTO total_complaints
    FROM complaints
    WHERE student_id = p_student_id AND tenant_id = p_tenant_id;
    
    RETURN QUERY SELECT
        -- Login frequency (simplified - would need user_activity_logs table for real implementation)
        2.5::DECIMAL as avg_logins_per_week,
        45.0::DECIMAL as avg_session_minutes,
        '{}'::JSONB as feature_usage_pattern,
        
        -- Payment behavior
        CASE 
            WHEN total_payments = 0 THEN 1.0
            ELSE GREATEST(0.0, 1.0 - (late_payments::DECIMAL / total_payments))
        END as payment_punctuality_score,
        
        COALESCE((
            SELECT payment_method 
            FROM payments 
            WHERE student_id = p_student_id 
            GROUP BY payment_method 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        ), 'unknown') as preferred_payment_method,
        
        COALESCE((
            SELECT AVG(EXTRACT(DAY FROM payment_date - created_at::DATE))
            FROM payments 
            WHERE student_id = p_student_id 
                AND payment_date > created_at::DATE
        ), 0.0) as avg_payment_delay_days,
        
        -- Service usage
        (total_complaints::DECIMAL / months_active) as complaints_per_month,
        
        CASE 
            WHEN late_payments::DECIMAL / GREATEST(1, total_payments) < 0.2 THEN 'improving'
            WHEN late_payments::DECIMAL / GREATEST(1, total_payments) > 0.5 THEN 'declining'
            ELSE 'stable'
        END as satisfaction_trend,
        
        0.75::DECIMAL as resource_usage_rate, -- Placeholder
        
        -- Predictions (simplified models)
        CASE 
            WHEN late_payments::DECIMAL / GREATEST(1, total_payments) < 0.2 THEN 0.85
            WHEN late_payments::DECIMAL / GREATEST(1, total_payments) < 0.5 THEN 0.65
            ELSE 0.35
        END as predicted_renewal_probability,
        
        CASE 
            WHEN late_payments::DECIMAL / GREATEST(1, total_payments) > 0.5 THEN 75.0
            WHEN total_complaints > 2 THEN 50.0
            ELSE 25.0
        END as churn_risk_score,
        
        (months_active * 5000.0 * (1.0 - (late_payments::DECIMAL / GREATEST(1, total_payments)))) as predicted_ltv;
END;
$$ LANGUAGE plpgsql;
-- Cohort behavior analysis function
CREATE OR REPLACE FUNCTION get_cohort_behavior_analysis(p_tenant_id UUID)
RETURNS TABLE (
    engagement_segments JSONB,
    payment_segments JSONB,
    usage_trends JSONB,
    lifecycle_distribution JSONB
) AS $$
DECLARE
    engagement_data JSONB;
    payment_data JSONB;
    usage_data JSONB;
    lifecycle_data JSONB;
BEGIN
    -- Engagement segments
    SELECT jsonb_build_object(
        'high_engagement', COUNT(*) FILTER (WHERE days_since_login <= 7),
        'medium_engagement', COUNT(*) FILTER (WHERE days_since_login > 7 AND days_since_login <= 30),
        'low_engagement', COUNT(*) FILTER (WHERE days_since_login > 30),
        'total_active', COUNT(*)
    ) INTO engagement_data
    FROM (
        SELECT 
            COALESCE(EXTRACT(DAY FROM NOW() - last_login_at), 999)::INTEGER as days_since_login
        FROM students 
        WHERE tenant_id = p_tenant_id AND status = 'active'
    ) engagement_calc;
    
    -- Payment behavior segments
    SELECT jsonb_build_object(
        'always_on_time', COUNT(*) FILTER (WHERE late_payment_ratio <= 0.1),
        'occasionally_late', COUNT(*) FILTER (WHERE late_payment_ratio > 0.1 AND late_payment_ratio <= 0.3),
        'frequently_late', COUNT(*) FILTER (WHERE late_payment_ratio > 0.3),
        'no_payments', COUNT(*) FILTER (WHERE total_payments = 0)
    ) INTO payment_data
    FROM (
        SELECT 
            s.id,
            COUNT(p.id) as total_payments,
            COALESCE(
                COUNT(p.id) FILTER (WHERE p.payment_date > p.created_at::DATE + INTERVAL '5 days')::DECIMAL 
                / NULLIF(COUNT(p.id), 0), 
                0
            ) as late_payment_ratio
        FROM students s
        LEFT JOIN payments p ON s.id = p.student_id
        WHERE s.tenant_id = p_tenant_id AND s.status = 'active'
        GROUP BY s.id
    ) payment_calc;
    
    -- Usage trends (simplified)
    SELECT jsonb_build_object(
        'monthly_active_users', COUNT(*) FILTER (WHERE last_activity >= CURRENT_DATE - INTERVAL '30 days'),
        'weekly_active_users', COUNT(*) FILTER (WHERE last_activity >= CURRENT_DATE - INTERVAL '7 days'),
        'retention_rate', ROUND(
            COUNT(*) FILTER (WHERE membership_months >= 3)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 
            2
        )
    ) INTO usage_data
    FROM (
        SELECT 
            s.id,
            COALESCE(s.last_login_at::DATE, s.created_at::DATE) as last_activity,
            COALESCE(EXTRACT(MONTH FROM AGE(CURRENT_DATE, m.start_date)), 0)::INTEGER as membership_months
        FROM students s
        LEFT JOIN memberships m ON s.id = m.student_id AND m.status = 'active'
        WHERE s.tenant_id = p_tenant_id AND s.status = 'active'
    ) usage_calc;
    
    -- Lifecycle distribution
    SELECT jsonb_build_object(
        'new_students', COUNT(*) FILTER (WHERE membership_months <= 1),
        'growing_students', COUNT(*) FILTER (WHERE membership_months > 1 AND membership_months <= 6),
        'mature_students', COUNT(*) FILTER (WHERE membership_months > 6 AND membership_months <= 12),
        'loyal_students', COUNT(*) FILTER (WHERE membership_months > 12)
    ) INTO lifecycle_data
    FROM (
        SELECT 
            COALESCE(EXTRACT(MONTH FROM AGE(CURRENT_DATE, m.start_date)), 0)::INTEGER as membership_months
        FROM students s
        LEFT JOIN memberships m ON s.id = m.student_id AND m.status = 'active'
        WHERE s.tenant_id = p_tenant_id AND s.status = 'active'
    ) lifecycle_calc;
    
    RETURN QUERY SELECT
        COALESCE(engagement_data, '{}'::JSONB) as engagement_segments,
        COALESCE(payment_data, '{}'::JSONB) as payment_segments,
        COALESCE(usage_data, '{}'::JSONB) as usage_trends,
        COALESCE(lifecycle_data, '{}'::JSONB) as lifecycle_distribution;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Additional Analytics Support Tables
-- ============================================================

-- Student activity logs table (for detailed behavior tracking)
CREATE TABLE IF NOT EXISTS student_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- 'login', 'payment', 'complaint', 'resource_access'
    activity_data JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for activity logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_student_date ON student_activity_logs(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_type ON student_activity_logs(tenant_id, activity_type, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type_date ON student_activity_logs(activity_type, created_at);

-- Prediction model cache table
CREATE TABLE IF NOT EXISTS ml_predictions_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NULL,
    prediction_type TEXT NOT NULL, -- 'churn_risk', 'ltv', 'renewal_probability'
    prediction_value DECIMAL NOT NULL,
    confidence_score DECIMAL DEFAULT 0.5,
    model_version TEXT DEFAULT '1.0',
    features JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for prediction cache
CREATE INDEX IF NOT EXISTS idx_predictions_tenant_type ON ml_predictions_cache(tenant_id, prediction_type, expires_at);
CREATE INDEX IF NOT EXISTS idx_predictions_student_type ON ml_predictions_cache(student_id, prediction_type, expires_at);
CREATE INDEX IF NOT EXISTS idx_predictions_expires ON ml_predictions_cache(expires_at);

-- Business intelligence metrics table
CREATE TABLE IF NOT EXISTS bi_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    metric_type TEXT NOT NULL, -- 'occupancy', 'revenue', 'churn', 'satisfaction'
    metric_value DECIMAL NOT NULL,
    metric_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, metric_date, metric_type)
);

-- Index for BI metrics
CREATE INDEX IF NOT EXISTS idx_bi_metrics_tenant_date ON bi_metrics(tenant_id, metric_date, metric_type);

-- ============================================================
-- Automated Analytics Data Population Triggers
-- ============================================================

-- Function to update daily occupancy stats
CREATE OR REPLACE FUNCTION update_daily_occupancy_stats()
RETURNS void AS $$
BEGIN
    -- Refresh the materialized view
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_occupancy_stats;
    
    -- Update BI metrics table with latest occupancy data
    INSERT INTO bi_metrics (tenant_id, metric_date, metric_type, metric_value, metric_metadata)
    SELECT 
        tenant_id,
        date,
        'occupancy',
        occupancy_rate,
        jsonb_build_object(
            'total_seats', total_seats,
            'occupied_seats', occupied_seats
        )
    FROM daily_occupancy_stats
    WHERE date = CURRENT_DATE
    ON CONFLICT (tenant_id, metric_date, metric_type) 
    DO UPDATE SET 
        metric_value = EXCLUDED.metric_value,
        metric_metadata = EXCLUDED.metric_metadata;
END;
$$ LANGUAGE plpgsql;

-- Function to update monthly revenue stats
CREATE OR REPLACE FUNCTION update_monthly_revenue_stats()
RETURNS void AS $$
BEGIN
    -- Refresh the materialized view
    REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_revenue_stats;
    
    -- Update BI metrics for current month
    INSERT INTO bi_metrics (tenant_id, metric_date, metric_type, metric_value, metric_metadata)
    SELECT 
        tenant_id,
        month,
        'revenue',
        total_revenue,
        jsonb_build_object(
            'payment_count', payment_count,
            'avg_payment', avg_payment,
            'success_rate', ROUND(successful_payments::DECIMAL / payment_count * 100, 2)
        )
    FROM monthly_revenue_stats
    WHERE month = DATE_TRUNC('month', CURRENT_DATE)::DATE
    ON CONFLICT (tenant_id, metric_date, metric_type) 
    DO UPDATE SET 
        metric_value = EXCLUDED.metric_value,
        metric_metadata = EXCLUDED.metric_metadata;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Analytics Maintenance Functions
-- ============================================================

-- Clean up old analytics data
CREATE OR REPLACE FUNCTION cleanup_analytics_data()
RETURNS void AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Clean up old activity logs (older than 1 year)
    DELETE FROM student_activity_logs 
    WHERE created_at < NOW() - INTERVAL '1 year';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    INSERT INTO system_logs (log_type, message, created_at)
    VALUES ('analytics_cleanup', 'Deleted ' || deleted_count || ' old activity logs', NOW());
    
    -- Clean up expired prediction cache
    DELETE FROM ml_predictions_cache 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    INSERT INTO system_logs (log_type, message, created_at)
    VALUES ('analytics_cleanup', 'Deleted ' || deleted_count || ' expired predictions', NOW());
    
    -- Clean up old BI metrics (keep 2 years)
    DELETE FROM bi_metrics 
    WHERE metric_date < CURRENT_DATE - INTERVAL '2 years';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    INSERT INTO system_logs (log_type, message, created_at)
    VALUES ('analytics_cleanup', 'Deleted ' || deleted_count || ' old BI metrics', NOW());
END;
$$ LANGUAGE plpgsql;

-- Function to recalculate analytics views
CREATE OR REPLACE FUNCTION recalculate_analytics_views()
RETURNS void AS $$
BEGIN
    -- Update daily occupancy
    PERFORM update_daily_occupancy_stats();
    
    -- Update monthly revenue
    PERFORM update_monthly_revenue_stats();
    
    INSERT INTO system_logs (log_type, message, created_at)
    VALUES ('analytics_maintenance', 'Analytics views recalculated', NOW());
    
EXCEPTION WHEN OTHERS THEN
    INSERT INTO system_logs (log_type, message, error_details, created_at)
    VALUES ('analytics_error', 'Failed to recalculate analytics views', SQLERRM, NOW());
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Performance Optimization for Analytics
-- ============================================================

-- Additional indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_memberships_analytics ON memberships(tenant_id, status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_payments_analytics ON payments(tenant_id, student_id, payment_date, status, amount);
CREATE INDEX IF NOT EXISTS idx_students_analytics ON students(tenant_id, status, created_at, last_login_at);
CREATE INDEX IF NOT EXISTS idx_complaints_analytics ON complaints(tenant_id, student_id, status, created_at);

-- Partial indexes for active records only
CREATE INDEX IF NOT EXISTS idx_active_memberships_dates ON memberships(tenant_id, start_date, end_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_completed_payments_date ON payments(tenant_id, payment_date, amount) WHERE status = 'completed';

-- Update table statistics for better query planning
ANALYZE students;
ANALYZE memberships;
ANALYZE payments;
ANALYZE complaints;
ANALYZE daily_occupancy_stats;
ANALYZE monthly_revenue_stats;