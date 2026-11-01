const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/scope/requirements - List requirements
router.get('/requirements', (req, res) => {
  try {
    const { status, is_baseline } = req.query;
    let query = 'SELECT r.*, cr.cr_number FROM requirements r LEFT JOIN change_requests cr ON r.change_request_id = cr.id';
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }
    if (is_baseline !== undefined) {
      conditions.push('r.is_baseline = ?');
      params.push(Number(is_baseline));
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY r.id ASC';

    const requirements = db.prepare(query).all(...params);
    res.json({ success: true, requirements });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/scope/requirements - Add new requirement
router.post('/requirements', (req, res) => {
  try {
    const { req_code, title, module, description, priority, status } = req.body;

    if (!req_code || !title || !module) {
      return res.status(400).json({ success: false, error: 'Requirement code, title, and module are required.' });
    }

    // By default, new requirements from team/stakeholders must be reviewed unless explicitly approved
    const reqStatus = status || 'Pending Approval';
    const isBaseline = reqStatus === 'Approved' ? 1 : 0;

    const stmt = db.prepare(`
      INSERT INTO requirements (req_code, title, module, description, priority, status, is_baseline)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(req_code, title, module, description || '', priority || 'Medium', reqStatus, isBaseline);

    res.status(201).json({ success: true, message: 'Requirement registered successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/scope/requirements/:id - Update requirement status & priority
router.put('/requirements/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, status } = req.body;

    const existing = db.prepare('SELECT * FROM requirements WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Requirement not found.' });
    }

    // Determine baseline status based on approval
    const newStatus = status !== undefined ? status : existing.status;
    const isBaseline = newStatus === 'Approved' ? 1 : 0;

    db.prepare(`
      UPDATE requirements
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          priority = COALESCE(?, priority),
          status = ?,
          is_baseline = ?
      WHERE id = ?
    `).run(title, description, priority, newStatus, isBaseline, id);

    res.json({
      success: true,
      message: `Requirement ${newStatus === 'Approved' ? 'approved and added to Scope Baseline' : 'updated'}.`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/scope/wbs - Work Breakdown Structure hierarchy
router.get('/wbs', (req, res) => {
  try {
    const allWbs = db.prepare('SELECT * FROM wbs_items ORDER BY wbs_code ASC').all();
    
    // Group into hierarchical tree
    const rootItems = allWbs.filter(item => !item.parent_code);
    const tree = rootItems.map(parent => {
      return {
        ...parent,
        children: allWbs.filter(child => child.parent_code === parent.wbs_code)
      };
    });

    res.json({ success: true, tree, flat: allWbs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/scope/wbs - Add WBS item
router.post('/wbs', (req, res) => {
  try {
    const { wbs_code, title, parent_code, deliverable, level } = req.body;
    if (!wbs_code || !title || !deliverable) {
      return res.status(400).json({ success: false, error: 'WBS code, title, and deliverable are required.' });
    }

    db.prepare(`
      INSERT INTO wbs_items (wbs_code, title, parent_code, deliverable, level)
      VALUES (?, ?, ?, ?, ?)
    `).run(wbs_code, title, parent_code || null, deliverable, level || (parent_code ? 2 : 1));

    res.status(201).json({ success: true, message: 'WBS work package created.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/scope/changes - Change Requests
router.get('/changes', (req, res) => {
  try {
    const changes = db.prepare('SELECT * FROM change_requests ORDER BY id ASC').all();
    res.json({ success: true, changes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/scope/changes - Propose new Change Request
router.post('/changes', (req, res) => {
  try {
    const { cr_number, title, requested_by, justification, cost_impact, schedule_impact_weeks } = req.body;

    if (!cr_number || !title || !requested_by || !justification) {
      return res.status(400).json({ success: false, error: 'CR Number, title, requester, and justification required.' });
    }

    const cost = Number(cost_impact) || 0;
    const scheduleWeeks = Number(schedule_impact_weeks) || 0;

    const info = db.prepare(`
      INSERT INTO change_requests (
        cr_number, title, requested_by, justification, cost_impact, schedule_impact_weeks,
        status, submitted_date
      ) VALUES (?, ?, ?, ?, ?, ?, 'Pending', date('now'))
    `).run(cr_number, title, requested_by, justification, cost, scheduleWeeks);

    res.status(201).json({
      success: true,
      changeRequestId: info.lastInsertRowid,
      message: 'Change Request submitted for CCB review.'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/scope/changes/:id/review - CCB Approval or Rejection
// Demonstrates how an approved change request dynamically affects scope, schedule, and budget!
router.put('/changes/:id/review', (req, res) => {
  try {
    const { id } = req.params;
    const { decision, rationale } = req.body; // 'Approved' or 'Rejected'

    if (!decision || !['Approved', 'Rejected'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'Decision must be "Approved" or "Rejected".' });
    }

    const cr = db.prepare('SELECT * FROM change_requests WHERE id = ?').get(id);
    if (!cr) {
      return res.status(404).json({ success: false, error: 'Change request not found.' });
    }

    if (cr.status === decision) {
      return res.status(400).json({ success: false, error: `Change request is already ${decision}.` });
    }

    const transaction = db.transaction(() => {
      // 1. Update Change Request record
      db.prepare(`
        UPDATE change_requests
        SET status = ?,
            decision_date = date('now'),
            decision_rationale = ?
        WHERE id = ?
      `).run(decision, rationale || `Formally evaluated and ${decision} by Change Control Board (CCB)`, id);

      if (decision === 'Approved') {
        // 2. Dynamically expand Project Budget and Schedule Deadline
        db.prepare(`
          UPDATE project_charter
          SET approved_budget = approved_budget + ?,
              current_deadline_weeks = current_deadline_weeks + ?
          WHERE id = 1
        `).run(cr.cost_impact, cr.schedule_impact_weeks);

        // 3. Formally approve linked requirements into the approved scope baseline
        db.prepare(`
          UPDATE requirements
          SET status = 'Approved',
              is_baseline = 1
          WHERE change_request_id = ?
        `).run(id);

        // 4. Formally authorize linked activities to become active scope
        db.prepare(`
          UPDATE activities
          SET is_approved_scope = 1
          WHERE change_request_id = ?
        `).run(id);
      } else if (decision === 'Rejected') {
        // If transitioning from Approved to Rejected (reversal), subtract impacts
        if (cr.status === 'Approved') {
          db.prepare(`
            UPDATE project_charter
            SET approved_budget = approved_budget - ?,
                current_deadline_weeks = current_deadline_weeks - ?
            WHERE id = 1
          `).run(cr.cost_impact, cr.schedule_impact_weeks);
        }

        // Prevent unapproved requirements from being included in the approved project scope
        db.prepare(`
          UPDATE requirements
          SET status = 'Rejected',
              is_baseline = 0
          WHERE change_request_id = ?
        `).run(id);

        // De-authorize linked activities
        db.prepare(`
          UPDATE activities
          SET is_approved_scope = 0
          WHERE change_request_id = ?
        `).run(id);
      }
    });

    transaction();

    const updatedCharter = db.prepare('SELECT approved_budget, current_deadline_weeks FROM project_charter WHERE id = 1').get();

    res.json({
      success: true,
      decision,
      updatedCharter,
      message: decision === 'Approved'
        ? `Change Request approved! Budget increased by PKR ${cr.cost_impact.toLocaleString()} and deadline extended by ${cr.schedule_impact_weeks} weeks.`
        : `Change Request rejected. Unapproved scope excluded from baseline.`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
