// ============================================================
// Advanced Analytics Service - ML & Predictive Analytics
// Occupancy predictions, revenue forecasting, churn analysis
// ============================================================

import { supabaseAdmin } from '../config/supabase.js';
import { cacheService, cacheOrFetch } from './cache.service.js';

class AnalyticsService {
  constructor() {
    this.models = {
      occupancy: null,
      revenue: null,
      churn: null,
    };
  }

  // ============================================================
  // Occupancy Prediction Model
  // ============================================================

  async predictOccupancy(tenantId, days = 30) {
    const cacheKey = `occupancy_prediction:${tenantId}:${days}`;
    
    return await cacheOrFetch(cacheKey, async () => {
      // Get historical occupancy data
      const historicalData = await this.getHistoricalOccupancy(tenantId, 90);
      
      // Simple linear regression for occupancy trends
      const prediction = this.calculateOccupancyTrend(historicalData, days);
      
      return {
        predictions: prediction.dailyPredictions,
        trends: {
          weeklyGrowth: prediction.weeklyGrowth,
          monthlyGrowth: prediction.monthlyGrowth,
          seasonality: prediction.seasonality,
        },
        confidence: prediction.confidence,
        lastUpdated: new Date().toISOString(),
      };
    }, 3600); // 1-hour cache
  }

  async getHistoricalOccupancy(tenantId, days) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const { data, error } = await supabaseAdmin
      .from('daily_occupancy_stats')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date');
    
    if (error) throw error;
    return data || [];
  }

  calculateOccupancyTrend(data, forecastDays) {
    if (data.length < 7) {
      return {
        dailyPredictions: [],
        weeklyGrowth: 0,
        monthlyGrowth: 0,
        seasonality: {},
        confidence: 0.1,
      };
    }

    // Calculate moving averages and trends
    const occupancyRates = data.map(d => d.occupancy_rate);
    const dates = data.map(d => new Date(d.date));
    
    // Simple linear regression
    const n = data.length;
    const sumX = dates.reduce((sum, date, i) => sum + i, 0);
    const sumY = occupancyRates.reduce((sum, rate) => sum + rate, 0);
    const sumXY = dates.reduce((sum, date, i) => sum + i * occupancyRates[i], 0);
    const sumX2 = dates.reduce((sum, date, i) => sum + i * i, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Generate predictions
    const dailyPredictions = [];
    const today = new Date();
    
    for (let i = 0; i < forecastDays; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + i + 1);
      
      const predictedRate = Math.max(0, Math.min(100, 
        intercept + slope * (n + i)
      ));
      
      dailyPredictions.push({
        date: futureDate.toISOString().split('T')[0],
        predicted_occupancy_rate: Math.round(predictedRate * 100) / 100,
        confidence: this.calculateConfidence(data, i),
      });
    }

    // Calculate growth rates
    const recentAvg = occupancyRates.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const olderAvg = occupancyRates.slice(-14, -7).reduce((a, b) => a + b, 0) / 7;
    const weeklyGrowth = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    const monthlyGrowth = slope * 30; // Approximate monthly change
    
    // Analyze seasonality (day of week patterns)
    const seasonality = this.analyzeDayOfWeekPatterns(data);
    
    return {
      dailyPredictions,
      weeklyGrowth: Math.round(weeklyGrowth * 100) / 100,
      monthlyGrowth: Math.round(monthlyGrowth * 100) / 100,
      seasonality,
      confidence: this.calculateOverallConfidence(data),
    };
  }

  calculateConfidence(data, dayOffset) {
    // Confidence decreases with distance into future
    const baseConfidence = 0.9;
    const decayRate = 0.02;
    const dataQuality = Math.min(1, data.length / 30); // More data = higher confidence
    
    return Math.max(0.1, baseConfidence * dataQuality * Math.exp(-decayRate * dayOffset));
  }

  calculateOverallConfidence(data) {
    if (data.length < 7) return 0.1;
    if (data.length < 30) return 0.5;
    if (data.length < 60) return 0.7;
    return 0.9;
  }

  analyzeDayOfWeekPatterns(data) {
    const dayPatterns = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    
    data.forEach(record => {
      const dayOfWeek = new Date(record.date).getDay();
      dayPatterns[dayOfWeek].push(record.occupancy_rate);
    });
    
    const seasonality = {};
    Object.keys(dayPatterns).forEach(day => {
      const rates = dayPatterns[day];
      if (rates.length > 0) {
        seasonality[day] = {
          average: rates.reduce((a, b) => a + b, 0) / rates.length,
          trend: rates.length > 1 ? this.calculateSimpleTrend(rates) : 0,
        };
      }
    });
    
    return seasonality;
  }

  calculateSimpleTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  // ============================================================
  // Revenue Forecasting Model
  // ============================================================

  async forecastRevenue(tenantId, months = 6) {
    const cacheKey = `revenue_forecast:${tenantId}:${months}`;
    
    return await cacheOrFetch(cacheKey, async () => {
      // Get historical revenue data
      const revenueData = await this.getHistoricalRevenue(tenantId, 12);
      const membershipData = await this.getMembershipTrends(tenantId, 6);
      
      // Calculate revenue forecast
      const forecast = this.calculateRevenueForecast(revenueData, membershipData, months);
      
      return {
        forecast: forecast.monthlyPredictions,
        trends: {
          growth: forecast.growthRate,
          seasonality: forecast.seasonality,
          confidence: forecast.confidence,
        },
        factors: {
          membershipGrowth: forecast.membershipImpact,
          priceOptimization: forecast.priceOptimization,
          churnImpact: forecast.churnImpact,
        },
        lastUpdated: new Date().toISOString(),
      };
    }, 7200); // 2-hour cache
  }

  async getHistoricalRevenue(tenantId, months) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    const { data, error } = await supabaseAdmin
      .from('monthly_revenue_stats')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('month', startDate.toISOString().split('T')[0].substring(0, 7))
      .order('month');
    
    if (error) throw error;
    return data || [];
  }

  async getMembershipTrends(tenantId, months) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    const { data, error } = await supabaseAdmin
      .from('monthly_membership_stats')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('month', startDate.toISOString().split('T')[0].substring(0, 7))
      .order('month');
    
    if (error) throw error;
    return data || [];
  }

  calculateRevenueForecast(revenueData, membershipData, months) {
    if (revenueData.length < 3) {
      return {
        monthlyPredictions: [],
        growthRate: 0,
        seasonality: {},
        confidence: 0.1,
        membershipImpact: 0,
        priceOptimization: {},
        churnImpact: 0,
      };
    }

    // Calculate revenue trend
    const revenues = revenueData.map(d => d.total_revenue);
    const revenueTrend = this.calculateSimpleTrend(revenues);
    
    // Calculate membership growth impact
    const membershipTrend = membershipData.length > 0 
      ? this.calculateSimpleTrend(membershipData.map(d => d.new_memberships))
      : 0;
    
    // Generate monthly predictions
    const monthlyPredictions = [];
    const currentDate = new Date();
    const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    
    for (let i = 0; i < months; i++) {
      const futureDate = new Date(currentDate);
      futureDate.setMonth(currentDate.getMonth() + i + 1);
      
      const baseRevenue = avgRevenue + (revenueTrend * (revenueData.length + i));
      const seasonalMultiplier = this.getSeasonalMultiplier(futureDate.getMonth(), revenueData);
      const membershipGrowthImpact = membershipTrend * i * 0.1; // Estimated impact
      
      const predictedRevenue = Math.max(0, 
        (baseRevenue + membershipGrowthImpact) * seasonalMultiplier
      );
      
      monthlyPredictions.push({
        month: futureDate.toISOString().substring(0, 7),
        predicted_revenue: Math.round(predictedRevenue),
        confidence: this.calculateConfidence(revenueData, i * 30), // Convert months to days
        factors: {
          base: Math.round(baseRevenue),
          seasonal: Math.round((seasonalMultiplier - 1) * baseRevenue),
          growth: Math.round(membershipGrowthImpact),
        },
      });
    }

    // Calculate growth rate
    const recentRevenue = revenues.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const olderRevenue = revenues.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
    const growthRate = ((recentRevenue - olderRevenue) / olderRevenue) * 100;

    return {
      monthlyPredictions,
      growthRate: Math.round(growthRate * 100) / 100,
      seasonality: this.analyzeRevenueSeasonality(revenueData),
      confidence: this.calculateOverallConfidence(revenueData),
      membershipImpact: Math.round(membershipTrend * 100) / 100,
      priceOptimization: this.analyzePriceOptimization(revenueData, membershipData),
      churnImpact: this.estimateChurnImpact(membershipData),
    };
  }

  getSeasonalMultiplier(month, revenueData) {
    // Default seasonal patterns for study halls (academic year cycle)
    const defaultSeasonality = {
      0: 0.9,   // January - lower enrollment
      1: 1.1,   // February - new academic term
      2: 1.2,   // March - peak season
      3: 1.1,   // April - continued high
      4: 0.95,  // May - exam season
      5: 0.8,   // June - summer break
      6: 0.75,  // July - lowest season
      7: 0.9,   // August - preparation season  
      8: 1.15,  // September - new academic year
      9: 1.2,   // October - peak enrollment
      10: 1.1,  // November - sustained high
      11: 0.95, // December - holiday season
    };
    
    // If we have enough data, calculate actual seasonality
    if (revenueData.length >= 12) {
      const monthlyAvgs = {};
      const overallAvg = revenueData.reduce((sum, d) => sum + d.total_revenue, 0) / revenueData.length;
      
      revenueData.forEach(d => {
        const month = new Date(d.month + '-01').getMonth();
        if (!monthlyAvgs[month]) monthlyAvgs[month] = [];
        monthlyAvgs[month].push(d.total_revenue);
      });
      
      Object.keys(monthlyAvgs).forEach(month => {
        const avg = monthlyAvgs[month].reduce((a, b) => a + b, 0) / monthlyAvgs[month].length;
        monthlyAvgs[month] = avg / overallAvg;
      });
      
      return monthlyAvgs[month] || defaultSeasonality[month];
    }
    
    return defaultSeasonality[month] || 1.0;
  }

  analyzeRevenueSeasonality(revenueData) {
    const seasonality = {};
    
    if (revenueData.length < 12) {
      return { insufficient_data: true };
    }
    
    const overallAvg = revenueData.reduce((sum, d) => sum + d.total_revenue, 0) / revenueData.length;
    
    for (let month = 0; month < 12; month++) {
      const monthData = revenueData.filter(d => 
        new Date(d.month + '-01').getMonth() === month
      );
      
      if (monthData.length > 0) {
        const monthAvg = monthData.reduce((sum, d) => sum + d.total_revenue, 0) / monthData.length;
        seasonality[month] = {
          multiplier: monthAvg / overallAvg,
          average: Math.round(monthAvg),
          variance: this.calculateVariance(monthData.map(d => d.total_revenue)),
        };
      }
    }
    
    return seasonality;
  }

  analyzePriceOptimization(revenueData, membershipData) {
    // Analyze relationship between pricing and membership numbers
    if (revenueData.length < 6 || membershipData.length < 6) {
      return { insufficient_data: true };
    }
    
    const analysis = {
      current_arpu: 0, // Average Revenue Per User
      optimal_price_range: {},
      elasticity: 0,
    };
    
    // Calculate current ARPU
    const totalRevenue = revenueData.reduce((sum, d) => sum + d.total_revenue, 0);
    const totalMemberships = membershipData.reduce((sum, d) => sum + d.new_memberships, 0);
    analysis.current_arpu = totalMemberships > 0 ? totalRevenue / totalMemberships : 0;
    
    // Simple price elasticity estimation
    if (revenueData.length >= 6 && membershipData.length >= 6) {
      const recentRevenue = revenueData.slice(-3);
      const recentMemberships = membershipData.slice(-3);
      const olderRevenue = revenueData.slice(-6, -3);
      const olderMemberships = membershipData.slice(-6, -3);
      
      const revenueChange = (recentRevenue.reduce((a, b) => a + b.total_revenue, 0) / 3) -
                           (olderRevenue.reduce((a, b) => a + b.total_revenue, 0) / 3);
      const membershipChange = (recentMemberships.reduce((a, b) => a + b.new_memberships, 0) / 3) -
                              (olderMemberships.reduce((a, b) => a + b.new_memberships, 0) / 3);
      
      if (membershipChange !== 0) {
        analysis.elasticity = revenueChange / membershipChange;
      }
    }
    
    return analysis;
  }

  estimateChurnImpact(membershipData) {
    if (membershipData.length < 6) return 0;
    
    // Simple churn estimation based on membership trends
    const recent = membershipData.slice(-3);
    const older = membershipData.slice(-6, -3);
    
    const recentNew = recent.reduce((sum, d) => sum + d.new_memberships, 0);
    const recentExpired = recent.reduce((sum, d) => sum + (d.expired_memberships || 0), 0);
    const recentActive = recent.reduce((sum, d) => sum + d.active_memberships, 0) / 3;
    
    const churnRate = recentActive > 0 ? (recentExpired / recentActive) : 0;
    
    return Math.round(churnRate * 100 * 100) / 100; // Percentage with 2 decimal places
  }

  calculateVariance(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  // ============================================================
  // Student Churn Analysis & Prediction
  // ============================================================

  async analyzeChurnRisk(tenantId) {
    const cacheKey = `churn_analysis:${tenantId}`;
    
    return await cacheOrFetch(cacheKey, async () => {
      // Get student engagement and payment data
      const studentsAtRisk = await this.identifyChurnRisk(tenantId);
      const churnFactors = await this.analyzeChurnFactors(tenantId);
      const retentionStrategies = this.generateRetentionStrategies(studentsAtRisk, churnFactors);
      
      return {
        at_risk_students: studentsAtRisk,
        churn_factors: churnFactors,
        retention_strategies: retentionStrategies,
        overall_health: this.calculateRetentionHealth(studentsAtRisk, churnFactors),
        lastUpdated: new Date().toISOString(),
      };
    }, 1800); // 30-minute cache
  }

  async identifyChurnRisk(tenantId) {
    // Complex query to identify students at risk of churning
    const { data, error } = await supabaseAdmin
      .rpc('analyze_student_churn_risk', { p_tenant_id: tenantId });
    
    if (error) {
      console.error('Churn analysis error:', error);
      return [];
    }
    
    return (data || []).map(student => ({
      ...student,
      risk_score: this.calculateRiskScore(student),
      recommended_actions: this.generateStudentActions(student),
    }));
  }

  calculateRiskScore(student) {
    let riskScore = 0;
    
    // Payment behavior (40% weight)
    if (student.late_payments > 2) riskScore += 40;
    else if (student.late_payments > 0) riskScore += 20;
    
    // Engagement factors (30% weight)  
    if (student.days_since_last_login > 14) riskScore += 30;
    else if (student.days_since_last_login > 7) riskScore += 15;
    
    // Complaint history (20% weight)
    if (student.unresolved_complaints > 0) riskScore += 20;
    
    // Membership duration (10% weight)
    if (student.membership_months < 3) riskScore += 10;
    
    return Math.min(100, riskScore);
  }

  generateStudentActions(student) {
    const actions = [];
    
    if (student.late_payments > 0) {
      actions.push({
        type: 'payment_follow_up',
        priority: 'high',
        action: 'Personal follow-up call for payment assistance',
      });
    }
    
    if (student.days_since_last_login > 14) {
      actions.push({
        type: 'engagement',
        priority: 'medium',
        action: 'Send personalized re-engagement campaign',
      });
    }
    
    if (student.unresolved_complaints > 0) {
      actions.push({
        type: 'service_recovery',
        priority: 'high',
        action: 'Immediate complaint resolution and follow-up',
      });
    }
    
    return actions;
  }

  async analyzeChurnFactors(tenantId) {
    // Analyze common factors leading to churn
    const { data, error } = await supabaseAdmin
      .rpc('get_churn_factor_analysis', { p_tenant_id: tenantId });
    
    if (error) {
      console.error('Churn factors analysis error:', error);
      return {};
    }
    
    return {
      payment_related: data?.payment_churn_rate || 0,
      service_related: data?.complaint_churn_rate || 0,
      engagement_related: data?.low_engagement_churn_rate || 0,
      pricing_related: data?.price_sensitive_churn_rate || 0,
      seasonal_patterns: data?.seasonal_churn_pattern || {},
    };
  }

  generateRetentionStrategies(studentsAtRisk, churnFactors) {
    const strategies = [];
    
    // High-risk students strategy
    const highRisk = studentsAtRisk.filter(s => s.risk_score >= 70);
    if (highRisk.length > 0) {
      strategies.push({
        type: 'immediate_intervention',
        target_count: highRisk.length,
        actions: [
          'Personal outreach within 24 hours',
          'Offer flexible payment plans',
          'Provide additional support services',
        ],
        expected_retention: 0.6,
      });
    }
    
    // Medium-risk students strategy  
    const mediumRisk = studentsAtRisk.filter(s => s.risk_score >= 40 && s.risk_score < 70);
    if (mediumRisk.length > 0) {
      strategies.push({
        type: 'proactive_engagement',
        target_count: mediumRisk.length,
        actions: [
          'Send personalized retention offers',
          'Improve service quality in problem areas',
          'Regular check-in communications',
        ],
        expected_retention: 0.75,
      });
    }
    
    // Payment-focused strategy
    if (churnFactors.payment_related > 0.3) {
      strategies.push({
        type: 'payment_optimization',
        description: 'Focus on payment experience improvements',
        actions: [
          'Introduce flexible payment options',
          'Automate payment reminders',
          'Offer early payment discounts',
        ],
        potential_impact: churnFactors.payment_related,
      });
    }
    
    return strategies;
  }

  calculateRetentionHealth(studentsAtRisk, churnFactors) {
    const totalAtRisk = studentsAtRisk.length;
    const highRisk = studentsAtRisk.filter(s => s.risk_score >= 70).length;
    
    let healthScore = 100;
    
    // Reduce score based on at-risk students
    if (totalAtRisk > 0) {
      healthScore -= Math.min(50, (totalAtRisk / 10) * 10); // Max 50 point reduction
    }
    
    // Additional reduction for high-risk students
    if (highRisk > 0) {
      healthScore -= Math.min(30, (highRisk / 5) * 10); // Max 30 point reduction  
    }
    
    return {
      score: Math.max(0, Math.round(healthScore)),
      level: healthScore >= 80 ? 'excellent' : 
             healthScore >= 60 ? 'good' : 
             healthScore >= 40 ? 'fair' : 'poor',
      total_at_risk: totalAtRisk,
      high_risk_count: highRisk,
    };
  }

  // ============================================================
  // Student Behavior Analytics
  // ============================================================

  async analyzeStudentBehavior(tenantId, studentId = null) {
    const cacheKey = studentId 
      ? `behavior:${tenantId}:${studentId}`
      : `behavior:${tenantId}:all`;
    
    return await cacheOrFetch(cacheKey, async () => {
      if (studentId) {
        return await this.getIndividualBehaviorAnalysis(tenantId, studentId);
      } else {
        return await this.getCohortBehaviorAnalysis(tenantId);
      }
    }, 1800);
  }

  async getIndividualBehaviorAnalysis(tenantId, studentId) {
    // Individual student behavior patterns
    const { data, error } = await supabaseAdmin
      .rpc('get_student_behavior_profile', { 
        p_tenant_id: tenantId, 
        p_student_id: studentId 
      });
    
    if (error) throw error;
    
    const profile = data?.[0] || {};
    
    return {
      engagement: {
        login_frequency: profile.avg_logins_per_week || 0,
        session_duration: profile.avg_session_minutes || 0,
        feature_usage: profile.feature_usage_pattern || {},
      },
      payment: {
        punctuality_score: profile.payment_punctuality_score || 0,
        preferred_method: profile.preferred_payment_method || 'unknown',
        average_delay: profile.avg_payment_delay_days || 0,
      },
      service_usage: {
        complaint_frequency: profile.complaints_per_month || 0,
        satisfaction_trend: profile.satisfaction_trend || 'stable',
        resource_utilization: profile.resource_usage_rate || 0,
      },
      predictions: {
        renewal_probability: profile.predicted_renewal_probability || 0.5,
        churn_risk: profile.churn_risk_score || 0,
        lifetime_value: profile.predicted_ltv || 0,
      },
    };
  }

  async getCohortBehaviorAnalysis(tenantId) {
    // Aggregate behavior analysis for all students
    const { data, error } = await supabaseAdmin
      .rpc('get_cohort_behavior_analysis', { p_tenant_id: tenantId });
    
    if (error) throw error;
    
    return {
      engagement_patterns: data?.engagement_segments || {},
      payment_behaviors: data?.payment_segments || {},
      usage_trends: data?.usage_trends || {},
      lifecycle_stages: data?.lifecycle_distribution || {},
    };
  }

  // ============================================================
  // Performance Optimization Recommendations
  // ============================================================

  async getOptimizationRecommendations(tenantId) {
    const cacheKey = `optimization:${tenantId}`;
    
    return await cacheOrFetch(cacheKey, async () => {
      // Gather data for optimization analysis
      const [occupancyData, revenueData, churnData, behaviorData] = await Promise.all([
        this.predictOccupancy(tenantId, 7),
        this.forecastRevenue(tenantId, 3),
        this.analyzeChurnRisk(tenantId),
        this.analyzeStudentBehavior(tenantId),
      ]);
      
      return this.generateOptimizationRecommendations(
        occupancyData, revenueData, churnData, behaviorData
      );
    }, 3600);
  }

  generateOptimizationRecommendations(occupancy, revenue, churn, behavior) {
    const recommendations = [];
    
    // Occupancy optimization
    if (occupancy.trends.weeklyGrowth < 0) {
      recommendations.push({
        category: 'occupancy',
        priority: 'high',
        title: 'Address Declining Occupancy',
        description: 'Weekly occupancy is declining. Consider marketing campaigns or pricing adjustments.',
        impact: 'high',
        effort: 'medium',
        actions: [
          'Launch targeted marketing campaign',
          'Review competitor pricing',
          'Improve facility amenities',
        ],
      });
    }
    
    // Revenue optimization
    if (revenue.trends.growth < 5) {
      recommendations.push({
        category: 'revenue',
        priority: 'high',
        title: 'Boost Revenue Growth',
        description: 'Revenue growth is below optimal levels. Focus on pricing and retention.',
        impact: 'high', 
        effort: 'medium',
        actions: [
          'Implement dynamic pricing strategy',
          'Introduce premium service tiers',
          'Focus on high-value student retention',
        ],
      });
    }
    
    // Churn reduction
    if (churn.overall_health.score < 70) {
      recommendations.push({
        category: 'retention',
        priority: 'critical',
        title: 'Improve Student Retention',
        description: 'High churn risk detected. Immediate intervention required.',
        impact: 'critical',
        effort: 'high',
        actions: [
          'Implement proactive retention campaigns',
          'Improve payment flexibility',
          'Enhance customer service quality',
        ],
      });
    }
    
    return {
      recommendations,
      summary: {
        total_recommendations: recommendations.length,
        critical_actions: recommendations.filter(r => r.priority === 'critical').length,
        estimated_impact: this.calculateTotalImpact(recommendations),
      },
    };
  }

  calculateTotalImpact(recommendations) {
    const impactScores = { low: 1, medium: 2, high: 3, critical: 4 };
    const totalImpact = recommendations.reduce((sum, rec) => 
      sum + impactScores[rec.impact], 0
    );
    
    return {
      score: totalImpact,
      level: totalImpact >= 8 ? 'high' : totalImpact >= 4 ? 'medium' : 'low',
    };
  }
}

// Create singleton instance
export const analyticsService = new AnalyticsService();

// Convenience functions
export const predictOccupancy = (tenantId, days) => 
  analyticsService.predictOccupancy(tenantId, days);

export const forecastRevenue = (tenantId, months) => 
  analyticsService.forecastRevenue(tenantId, months);

export const analyzeChurnRisk = (tenantId) => 
  analyticsService.analyzeChurnRisk(tenantId);

export const getOptimizationRecommendations = (tenantId) => 
  analyticsService.getOptimizationRecommendations(tenantId);