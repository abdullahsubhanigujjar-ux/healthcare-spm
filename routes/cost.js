const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper: Programmatic Earned Value Management (EVM) Engine
function calculateEVM() {
  const charter = db.prepare('SELECT approved_budget, current_week, current_deadline_weeks FROM project_charter WHERE id = 1').get();
  const currentWeek = charter ? charter.current_week : 8;
  const approvedBudget = charter ? charter.approved_budget : 5000000;

  // Retrieve only approved scope activities
  const activities = db.prepare(`
    SELECT a.*, tm.name as assignee_name
    FROM activities a
    LEFT JOIN team_members tm ON a.assigned_to = tm.id
    WHERE a.is_approved_scope = 1
    ORDER BY a.planned_start_week ASC
  `).all();

  let totalBAC = 0;
  let totalPV = 0;
  let totalEV = 0;
  let totalAC = 0;

  const activityCostDetails = activities.map(act => {
    totalBAC += act.planned_cost;
    totalAC += act.actual_cost;

    // Calculate Planned Value (PV) at currentWeek
    let pv = 0;
    if (currentWeek >= act.planned_end_week) {
      pv = act.planned_cost; // 100% of planned work should have completed
    } else if (currentWeek <= act.planned_start_week) {
      pv = 0; // Not planned to start yet
    } else {
      // Linear planned progress
      const duration = Math.max(1, act.planned_end_week - act.planned_start_week);
      const elapsed = currentWeek - act.planned_start_week;
      const plannedRatio = Math.min(1, Math.max(0, elapsed / duration));
      pv = act.planned_cost * plannedRatio;
    }
    totalPV += pv;

    // Calculate Earned Value (EV) = Planned Cost * (actual progress % / 100)
    const ev = act.planned_cost * (act.progress_pct / 100);
    totalEV += ev;

    // Activity level metrics
    const actCV = ev - act.actual_cost;
    const actSV = ev - pv;
    const actCPI = act.actual_cost > 0 ? (ev / act.actual_cost) : (ev > 0 ? 1.0 : 1.0);
    const actSPI = pv > 0 ? (ev / pv) : (ev > 0 ? 1.0 : 1.0);

    return {
      act_code: act.act_code,
      name: act.name,
      planned_cost: act.planned_cost,
      actual_cost: act.actual_cost,
      progress_pct: act.progress_pct,
      pv: Math.round(pv),
      ev: Math.round(ev),
      cv: Math.round(actCV),
      sv: Math.round(actSV),
      cpi: Number(actCPI.toFixed(2)),
      spi: Number(actSPI.toFixed(2)),
      status: act.status
    };
  });

  // Project Level EVM Metrics
  const cv = totalEV - totalAC; // Cost Variance
  const sv = totalEV - totalPV; // Schedule Variance
  const cpi = totalAC > 0 ? (totalEV / totalAC) : 1.0; // Cost Performance Index
  const spi = totalPV > 0 ? (totalEV / totalPV) : 1.0; // Schedule Performance Index
  const eac = cpi > 0 ? (totalBAC / cpi) : totalBAC;   // Estimate at Completion
  const vac = totalBAC - eac;                         // Variance at Completion
  const tcpi = (totalBAC - totalEV) > 0 && (totalBAC - totalAC) > 0
    ? (totalBAC - totalEV) / (totalBAC - totalAC)
    : 1.0;

  // Threshold Warning System (Automated threshold detection)
  const warnings = [];

  // CPI Thresholds
  if (cpi < 0.85) {
    warnings.push({
      type: 'COST_CRITICAL',
      severity: 'Critical',
      metric: 'CPI',
      value: cpi.toFixed(2),
      threshold: '< 0.85',
      message: `CRITICAL COST OVERRUN: CPI is ${cpi.toFixed(2)}. The project is earning only PKR ${(cpi * 100).toFixed(0)} of value for every PKR 100 spent. Projected overrun is PKR ${Math.abs(Math.round(vac)).toLocaleString()}.`
    });
  } else if (cpi < 1.0) {
    warnings.push({
      type: 'COST_WARNING',
      severity: 'Warning',
      metric: 'CPI',
      value: cpi.toFixed(2),
      threshold: '< 1.00',
      message: `COST OVERRUN DETECTED: CPI is ${cpi.toFixed(2)}. Actual spending (PKR ${totalAC.toLocaleString()}) exceeds earned value (PKR ${Math.round(totalEV).toLocaleString()}).`
    });
  }

  // SPI Thresholds
  if (spi < 0.85) {
    warnings.push({
      type: 'SCHEDULE_CRITICAL',
      severity: 'Critical',
      metric: 'SPI',
      value: spi.toFixed(2),
      threshold: '< 0.85',
      message: `CRITICAL SCHEDULE DELAY: SPI is ${spi.toFixed(2)}. The project is progressing at only ${(spi * 100).toFixed(0)}% of the planned schedule pace. Critical milestones are at risk.`
    });
  } else if (spi < 1.0) {
    warnings.push({
      type: 'SCHEDULE_WARNING',
      severity: 'Warning',
      metric: 'SPI',
      value: spi.toFixed(2),
      threshold: '< 1.00',
      message: `SCHEDULE SLIPPAGE DETECTED: SPI is ${spi.toFixed(2)}. Earned value lags planned value by PKR ${Math.abs(Math.round(sv)).toLocaleString()} equivalent of progress.`
    });
  }

  // Cost Variance Warnings
  if (cv < 0) {
    warnings.push({
      type: 'BUDGET_DEFICIT',
      severity: 'Warning',
      metric: 'CV',
      value: `PKR ${Math.round(cv).toLocaleString()}`,
      threshold: '< 0',
      message: `Negative Cost Variance (CV): Current expenditure has created a deficit of PKR ${Math.abs(Math.round(cv)).toLocaleString()}.`
    });
  }

  return {
    current_week: currentWeek,
    approved_budget: approvedBudget,
    bac: totalBAC,
    pv: Math.round(totalPV),
    ev: Math.round(totalEV),
    ac: Math.round(totalAC),
    cv: Math.round(cv),
    sv: Math.round(sv),
    cpi: Number(cpi.toFixed(2)),
    spi: Number(spi.toFixed(2)),
    eac: Math.round(eac),
    vac: Math.round(vac),
    tcpi: Number(tcpi.toFixed(2)),
    overall_progress_pct: totalBAC > 0 ? Number(((totalEV / totalBAC) * 100).toFixed(1)) : 0,
    budget_burn_pct: totalBAC > 0 ? Number(((totalAC / totalBAC) * 100).toFixed(1)) : 0,
    warnings,
    activity_breakdown: activityCostDetails
  };
}

// GET /api/cost/evm - Complete EVM Indicators & Threshold Warnings
router.get('/evm', (req, res) => {
  try {
    const evmData = calculateEVM();
    res.json({ success: true, evm: evmData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/cost/breakdown - Cost breakdown by activity
router.get('/breakdown', (req, res) => {
  try {
    const evmData = calculateEVM();
    res.json({
      success: true,
      bac: evmData.bac,
      ac: evmData.ac,
      ev: evmData.ev,
      pv: evmData.pv,
      breakdown: evmData.activity_breakdown
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
