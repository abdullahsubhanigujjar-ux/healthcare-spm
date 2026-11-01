const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/dashboard/summary - Consolidated Executive SPM Dashboard
router.get('/summary', (req, res) => {
  try {
    // 1. Charter & Baselines
    const charter = db.prepare('SELECT * FROM project_charter WHERE id = 1').get();
    const currentWeek = charter ? charter.current_week : 8;
    const approvedBudget = charter ? charter.approved_budget : 5000000;
    const deadlineWeeks = charter ? charter.current_deadline_weeks : 16;

    // 2. Approved Activities for EVM & Schedule
    const activities = db.prepare(`
      SELECT a.*, tm.name as assignee_name
      FROM activities a
      LEFT JOIN team_members tm ON a.assigned_to = tm.id
      WHERE a.is_approved_scope = 1
    `).all();

    let totalBAC = 0;
    let totalPV = 0;
    let totalEV = 0;
    let totalAC = 0;
    const delayedActivities = [];

    activities.forEach(act => {
      totalBAC += act.planned_cost;
      totalAC += act.actual_cost;

      // PV
      let pv = 0;
      if (currentWeek >= act.planned_end_week) {
        pv = act.planned_cost;
      } else if (currentWeek <= act.planned_start_week) {
        pv = 0;
      } else {
        const duration = Math.max(1, act.planned_end_week - act.planned_start_week);
        const elapsed = currentWeek - act.planned_start_week;
        pv = act.planned_cost * Math.min(1, Math.max(0, elapsed / duration));
      }
      totalPV += pv;

      // EV
      const ev = act.planned_cost * (act.progress_pct / 100);
      totalEV += ev;

      // Delayed check
      if (act.status === 'Delayed' || (currentWeek > act.planned_end_week && act.progress_pct < 100)) {
        delayedActivities.push({
          act_code: act.act_code,
          name: act.name,
          assignee: act.assignee_name,
          planned_end: act.planned_end_week,
          progress_pct: act.progress_pct,
          cost_spent: act.actual_cost,
          planned_cost: act.planned_cost
        });
      }
    });

    // EVM metrics
    const cpi = totalAC > 0 ? (totalEV / totalAC) : 1.0;
    const spi = totalPV > 0 ? (totalEV / totalPV) : 1.0;
    const cv = totalEV - totalAC;
    const sv = totalEV - totalPV;
    const eac = cpi > 0 ? (totalBAC / cpi) : totalBAC;
    const overallProgress = totalBAC > 0 ? (totalEV / totalBAC) * 100 : 0;

    // 3. Pending Change Requests
    const pendingChanges = db.prepare(`
      SELECT * FROM change_requests WHERE status = 'Pending' ORDER BY id ASC
    `).all();

    // 4. Critical Defects (Open or In Progress)
    const criticalDefects = db.prepare(`
      SELECT d.*, tm.name as assignee_name
      FROM quality_defects d
      LEFT JOIN team_members tm ON d.assigned_to = tm.id
      WHERE d.severity = 'Critical' AND d.status IN ('Open', 'In Progress')
      ORDER BY d.id ASC
    `).all();

    const allDefectsCount = db.prepare('SELECT count(*) as count FROM quality_defects').get().count;
    const resolvedDefectsCount = db.prepare("SELECT count(*) as count FROM quality_defects WHERE status IN ('Resolved', 'Closed')").get().count;

    // 5. High Risks
    const highRisks = db.prepare(`
      SELECT * FROM risks WHERE (likelihood * impact) >= 15 AND status = 'Active'
    `).all();

    // 6. Milestones
    const milestones = db.prepare('SELECT * FROM milestones ORDER BY target_week ASC').all();

    // 7. Overall Project Health Status (Red, Amber, Green)
    let projectHealth = 'GREEN';
    let healthReasons = [];

    if (criticalDefects.length > 0) {
      healthReasons.push(`${criticalDefects.length} critical defect(s) unresolved`);
    }
    if (cpi < 0.9) {
      healthReasons.push(`CPI (${cpi.toFixed(2)}) is below 0.90 (cost overrun)`);
    }
    if (spi < 0.9) {
      healthReasons.push(`SPI (${spi.toFixed(2)}) is below 0.90 (schedule delay)`);
    }

    if (criticalDefects.length > 0 || cpi < 0.85 || spi < 0.85) {
      projectHealth = 'RED (Needs Intervention)';
    } else if (cpi < 1.0 || spi < 1.0 || pendingChanges.length > 0) {
      projectHealth = 'AMBER (Under Watch)';
    } else {
      projectHealth = 'GREEN (On Target)';
    }

    res.json({
      success: true,
      summary: {
        project_name: charter ? charter.project_name : 'Healthcare PM',
        current_week: currentWeek,
        deadline_weeks: deadlineWeeks,
        project_health: projectHealth,
        health_reasons: healthReasons,
        overall_progress_pct: Number(overallProgress.toFixed(1)),
        budget: {
          approved_budget: approvedBudget,
          bac: totalBAC,
          pv: Math.round(totalPV),
          ev: Math.round(totalEV),
          ac: Math.round(totalAC),
          cv: Math.round(cv),
          sv: Math.round(sv),
          cpi: Number(cpi.toFixed(2)),
          spi: Number(spi.toFixed(2)),
          eac: Math.round(eac)
        },
        pending_changes_count: pendingChanges.length,
        delayed_activities_count: delayedActivities.length,
        unresolved_critical_defects_count: criticalDefects.length,
        total_defects: allDefectsCount,
        resolved_defects: resolvedDefectsCount,
        high_risks_count: highRisks.length
      },
      pending_changes: pendingChanges,
      delayed_activities: delayedActivities,
      critical_defects: criticalDefects,
      milestones,
      high_risks: highRisks
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
