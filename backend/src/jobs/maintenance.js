// ============================================================
// Cron Job: Database Maintenance
// Runs daily at 03:00 AM
// Refreshes materialized views and cleans up old data
// ============================================================

import cron from 'node-cron';
import { supabaseAdmin } from '../config/supabase.js';

export const startMaintenanceJob = () => {
  cron.schedule('0 3 * * *', async () => {
    console.log('[CRON] Running database maintenance job...');

    try {
      const startTime = Date.now();
      
      // Refresh materialized views
      await refreshMaterializedViews();
      
      // Clean up old data
      await cleanupOldData();
      
      // Update table statistics
      await updateTableStatistics();
      
      // Vacuum analyze tables
      if (shouldRunVacuum()) {
        await runVacuumAnalyze();
      }
      
      const duration = Date.now() - startTime;
      console.log(`[CRON] Database maintenance completed in ${duration}ms`);
      
      // Log maintenance completion
      await logMaintenanceEvent('success', `Maintenance completed in ${duration}ms`);
      
    } catch (error) {
      console.error('[CRON] Database maintenance error:', error.message);
      await logMaintenanceEvent('error', error.message);
    }
  });
};

// ============================================================
// Refresh Materialized Views
// ============================================================
async function refreshMaterializedViews() {
  try {
    console.log('[MAINTENANCE] Refreshing materialized views...');
    
    const { error } = await supabaseAdmin.rpc('refresh_analytics_views');
    
    if (error) {
      throw new Error(`Failed to refresh views: ${error.message}`);
    }
    
    console.log('[MAINTENANCE] Materialized views refreshed');
  } catch (error) {
    console.error('[MAINTENANCE] View refresh error:', error.message);
    throw error;
  }
}

// ============================================================
// Clean Up Old Data
// ============================================================
async function cleanupOldData() {
  try {
    console.log('[MAINTENANCE] Cleaning up old data...');
    
    const { error } = await supabaseAdmin.rpc('cleanup_old_data');
    
    if (error) {
      throw new Error(`Failed to cleanup data: ${error.message}`);
    }
    
    console.log('[MAINTENANCE] Old data cleaned up');
  } catch (error) {
    console.error('[MAINTENANCE] Cleanup error:', error.message);
    throw error;
  }
}

// ============================================================
// Update Table Statistics
// ============================================================
async function updateTableStatistics() {
  try {
    console.log('[MAINTENANCE] Updating table statistics...');
    
    // Get list of user tables
    const { data: tables, error: tablesError } = await supabaseAdmin
      .rpc('get_table_list');
    
    if (tablesError) {
      throw new Error(`Failed to get table list: ${tablesError.message}`);
    }
    
    // Run ANALYZE on each table
    const analyzePromises = tables.map(async (table) => {
      try {
        await supabaseAdmin.rpc('analyze_table', { table_name: table.table_name });
      } catch (error) {
        console.warn(`[MAINTENANCE] Failed to analyze table ${table.table_name}:`, error.message);
      }
    });
    
    await Promise.all(analyzePromises);
    console.log('[MAINTENANCE] Table statistics updated');
  } catch (error) {
    console.error('[MAINTENANCE] Statistics update error:', error.message);
    throw error;
  }
}

// ============================================================
// Vacuum Analyze (Weekly)
// ============================================================
function shouldRunVacuum() {
  const today = new Date();
  // Run vacuum on Sundays (day 0)
  return today.getDay() === 0;
}

async function runVacuumAnalyze() {
  try {
    console.log('[MAINTENANCE] Running VACUUM ANALYZE...');
    
    // Note: VACUUM cannot be run inside a transaction in PostgreSQL
    // This is a simplified version - in production you might want to
    // run this as a separate database maintenance script
    
    const { error } = await supabaseAdmin.rpc('vacuum_analyze_tables');
    
    if (error) {
      console.warn('[MAINTENANCE] VACUUM ANALYZE warning:', error.message);
    } else {
      console.log('[MAINTENANCE] VACUUM ANALYZE completed');
    }
  } catch (error) {
    console.error('[MAINTENANCE] VACUUM error:', error.message);
    // Don't throw - this is not critical
  }
}

// ============================================================
// Maintenance Event Logging
// ============================================================
async function logMaintenanceEvent(type, message) {
  try {
    await supabaseAdmin
      .from('system_logs')
      .insert({
        log_type: `maintenance_${type}`,
        message,
        created_at: new Date().toISOString(),
      });
  } catch (error) {
    console.error('[MAINTENANCE] Failed to log event:', error.message);
  }
}

// ============================================================
// Database Health Check Functions
// ============================================================

// Function to get database performance metrics
export const getDatabaseHealthMetrics = async () => {
  try {
    const { data: metrics, error } = await supabaseAdmin
      .rpc('get_database_health_metrics');
    
    if (error) throw error;
    
    return metrics?.[0] || null;
  } catch (error) {
    console.error('[MAINTENANCE] Health metrics error:', error.message);
    return null;
  }
};

// Function to get index usage statistics  
export const getIndexUsageStats = async () => {
  try {
    const { data: stats, error } = await supabaseAdmin
      .rpc('get_index_usage_stats');
    
    if (error) throw error;
    
    return stats || [];
  } catch (error) {
    console.error('[MAINTENANCE] Index stats error:', error.message);
    return [];
  }
};

// Function to get table sizes
export const getTableSizes = async () => {
  try {
    const { data: sizes, error } = await supabaseAdmin
      .rpc('get_table_sizes');
    
    if (error) throw error;
    
    return sizes || [];
  } catch (error) {
    console.error('[MAINTENANCE] Table sizes error:', error.message);
    return [];
  }
};

// ============================================================
// Additional Database Functions (to be added to migration)
// ============================================================

// These functions would need to be added to the database:

const additionalDbFunctions = `
-- Get table list function
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

-- Analyze table function
CREATE OR REPLACE FUNCTION analyze_table(table_name TEXT)
RETURNS void AS $$
BEGIN
    EXECUTE 'ANALYZE ' || quote_ident(table_name);
END;
$$ LANGUAGE plpgsql;

-- Vacuum analyze function (simplified)
CREATE OR REPLACE FUNCTION vacuum_analyze_tables()
RETURNS void AS $$
DECLARE
    rec RECORD;
BEGIN
    -- Note: This is simplified. In production, you might want
    -- to run VACUUM as a separate maintenance script
    FOR rec IN 
        SELECT schemaname, tablename 
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
    LOOP
        BEGIN
            EXECUTE 'ANALYZE ' || quote_ident(rec.schemaname) || '.' || quote_ident(rec.tablename);
        EXCEPTION WHEN OTHERS THEN
            -- Log the error but continue
            INSERT INTO system_logs (log_type, message, error_details, created_at)
            VALUES ('maintenance_warning', 'Failed to analyze table: ' || rec.tablename, SQLERRM, NOW());
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Database health metrics function
CREATE OR REPLACE FUNCTION get_database_health_metrics()
RETURNS TABLE (
    total_connections INTEGER,
    active_connections INTEGER,
    database_size TEXT,
    cache_hit_ratio NUMERIC,
    deadlocks BIGINT,
    temp_files BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT count(*) FROM pg_stat_activity)::INTEGER as total_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active')::INTEGER as active_connections,
        (SELECT pg_size_pretty(pg_database_size(current_database())))::TEXT as database_size,
        (SELECT ROUND(100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2) 
         FROM pg_stat_database WHERE datname = current_database())::NUMERIC as cache_hit_ratio,
        (SELECT deadlocks FROM pg_stat_database WHERE datname = current_database())::BIGINT as deadlocks,
        (SELECT temp_files FROM pg_stat_database WHERE datname = current_database())::BIGINT as temp_files;
END;
$$ LANGUAGE plpgsql;

-- Table sizes function
CREATE OR REPLACE FUNCTION get_table_sizes()
RETURNS TABLE (
    table_name TEXT,
    total_size TEXT,
    table_size TEXT,
    index_size TEXT,
    row_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.table_name::TEXT,
        pg_size_pretty(pg_total_relation_size(c.oid))::TEXT as total_size,
        pg_size_pretty(pg_relation_size(c.oid))::TEXT as table_size,
        pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid))::TEXT as index_size,
        COALESCE(s.n_live_tup, 0)::BIGINT as row_count
    FROM information_schema.tables t
    JOIN pg_class c ON c.relname = t.table_name
    LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
    WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
    ORDER BY pg_total_relation_size(c.oid) DESC;
END;
$$ LANGUAGE plpgsql;
`;

console.log('[MAINTENANCE] Additional database functions needed:');
console.log('Run the following SQL to enable advanced maintenance features:');
console.log(additionalDbFunctions);