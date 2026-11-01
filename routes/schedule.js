const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper: Run Critical Path and Dependency Schedule Engine
function computeScheduleEngine() {
  const charter = db.prepare('SELECT current_week, current_deadline_weeks FROM project_charter WHERE id = 1').get();
  const currentWeek = charter ? charter.current_week : 8;
  const targetDeadline = charter ? charter.current_deadline_weeks : 16;

  // Retrieve approved activities
  const activities = db.prepare(`
    SELECT a.*, tm.name as assignee_name, tm.role as assignee_role
    FROM activities a
    LEFT JOIN team_members tm ON a.assigned_to = tm.id
    WHERE a.is_approved_scope = 1
    ORDER BY a.planned_start_week ASC, a.id ASC
  `).all();

  const activityMap = new Map();
  activities.forEach(act => activityMap.set(act.act_code, act));

  // Determine early start, early finish, delay slippage, and downstream dependency chain
  const enrichedActivities = activities.map(act => {
    const preds = act.predecessors ? act.predecessors.split(',').map(s => s.trim()).filter(Boolean) : [];
    
    // Calculate expected completion week based on current progress
    let expectedEndWeek = act.planned_end_week;
    let delayWeeks = 0;
    let isDelayed = act.status === 'Delayed';

    if (act.progress_pct < 100 && currentWeek >= act.planned_start_week) {
      // If past planned end week and not completed
      if (currentWeek > act.planned_end_week) {
        delayWeeks = currentWeek - act.planned_end_week;
        expectedEndWeek = currentWeek + Math.max(1, Math.round((100 - act.progress_pct) / 25));
        isDelayed = true;
      } else {
        // Expected progress at current week
        const totalDuration = Math.max(1, act.planned_end_week - act.planned_start_week);
        const elapsedWeeks = currentWeek - act.planned_start_week;
        const expectedPct = Math.min(100, (elapsedWeeks / totalDuration) * 100);
        if (act.progress_pct < expectedPct - 15) {
          isDelayed = true;
          delayWeeks = Math.max(1, Math.round((expectedPct - act.progress_pct) / 25));
          expectedEndWeek = act.planned_end_week + delayWeeks;
        }
      }
    }

    return {
      ...act,
      predecessor_list: preds,
      delay_weeks: delayWeeks,
      is_delayed: isDelayed,
      expected_end_week: expectedEndWeek
    };
  });

  // Calculate dependency cascade (downstream impact)
  const delayedTasks = enrichedActivities.filter(a => a.is_delayed || a.delay_weeks > 0);
  let totalProjectSlippage = 0;
  let maxProjectFinishWeek = targetDeadline;

  // Propagate delays through successors
  const dependencyImpacts = [];
  delayedTasks.forEach(delayedAct => {
    // Find all direct and indirect successors
    const successors = enrichedActivities.filter(a => a.predecessor_list.includes(delayedAct.act_code));
    if (successors.length > 0) {
      successors.forEach(succ => {
        const downstreamImpact = delayedAct.delay_weeks;
        dependencyImpacts.push({
          source_activity: delayedAct.act_code,
          source_name: delayedAct.name,
          impacted_activity: succ.act_code,
          impacted_name: succ.name,
          delay_transferred_weeks: downstreamImpact,
          new_estimated_start: succ.planned_start_week + downstreamImpact
        });
      });
    }
    const projectedEnd = delayedAct.expected_end_week;
    if (projectedEnd > maxProjectFinishWeek) {
      maxProjectFinishWeek = projectedEnd;
    }
  });

  // Check if final activities push deadline
  enrichedActivities.forEach(a => {
    if (a.expected_end_week > maxProjectFinishWeek) {
      maxProjectFinishWeek = a.expected_end_week;
    }
  });

  totalProjectSlippage = Math.max(0, maxProjectFinishWeek - targetDeadline);

  return {
    current_week: currentWeek,
    target_deadline_weeks: targetDeadline,
    projected_finish_week: maxProjectFinishWeek,
    total_project_slippage_weeks: totalProjectSlippage,
    activities: enrichedActivities,
    delayed_activities: delayedTasks,
    dependency_impacts: dependencyImpacts
  };
}

// GET /api/schedule/activities - All activities with resource details
router.get('/activities', (req, res) => {
  try {
    const analysis = computeScheduleEngine();
    res.json({
      success: true,
      current_week: analysis.current_week,
      target_deadline_weeks: analysis.target_deadline_weeks,
      projected_finish_week: analysis.projected_finish_week,
      total_project_slippage_weeks: analysis.total_project_slippage_weeks,
      activities: analysis.activities
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/schedule/analysis - Schedule slippage, dependencies, and Gantt data
router.get('/analysis', (req, res) => {
  try {
    const analysis = computeScheduleEngine();
    const milestones = db.prepare('SELECT * FROM milestones ORDER BY target_week ASC').all();
    const team = db.prepare('SELECT * FROM team_members').all();

    res.json({
      success: true,
      ...analysis,
      milestones,
      team
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/schedule/activities - Define new activity
router.post('/activities', (req, res) => {
  try {
    const {
      act_code,
      name,
      wbs_code,
      assigned_to,
      planned_duration_weeks,
      planned_start_week,
      planned_cost,
      predecessors
    } = req.body;

    if (!act_code || !name || !wbs_code || !planned_duration_weeks || !planned_start_week || !planned_cost) {
      return res.status(400).json({
        success: false,
        error: 'Activity code, name, WBS code, duration, start week, and planned cost are required.'
      });
    }

    const duration = Number(planned_duration_weeks);
    const startWeek = Number(planned_start_week);
    const endWeek = startWeek + duration;
    const cost = Number(planned_cost);

    if (duration <= 0 || startWeek <= 0 || cost < 0) {
      return res.status(400).json({ success: false, error: 'Duration, start week, and cost must be positive values.' });
    }

    const stmt = db.prepare(`
      INSERT INTO activities (
        act_code, name, wbs_code, assigned_to, planned_duration_weeks,
        planned_start_week, planned_end_week, predecessors, planned_cost,
        actual_cost, progress_pct, status, is_approved_scope
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'Not Started', 1)
    `);

    stmt.run(act_code, name, wbs_code, assigned_to || null, duration, startWeek, endWeek, predecessors || '', cost);

    res.status(201).json({ success: true, message: 'Activity successfully scheduled.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/schedule/activities/:id - Update activity progress, actual cost, and status
router.put('/activities/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { progress_pct, actual_cost, status, actual_start_week, actual_end_week } = req.body;

    const existing = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Activity not found.' });
    }

    const newProgress = progress_pct !== undefined ? Math.min(100, Math.max(0, Number(progress_pct))) : existing.progress_pct;
    const newActualCost = actual_cost !== undefined ? Math.max(0, Number(actual_cost)) : existing.actual_cost;
    
    // Auto-update status if progress reaches 100%
    let newStatus = status || existing.status;
    if (newProgress === 100) {
      newStatus = 'Completed';
    } else if (newProgress > 0 && newStatus === 'Not Started') {
      newStatus = 'In Progress';
    }

    db.prepare(`
      UPDATE activities
      SET progress_pct = ?,
          actual_cost = ?,
          status = ?,
          actual_start_week = COALESCE(?, actual_start_week),
          actual_end_week = COALESCE(?, actual_end_week)
      WHERE id = ?
    `).run(newProgress, newActualCost, newStatus, actual_start_week, actual_end_week, id);

    res.json({ success: true, message: 'Activity progress and status updated.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
