const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/charter - Project Charter, Milestones, Team, and Status
router.get('/', (req, res) => {
  try {
    const charter = db.prepare('SELECT * FROM project_charter WHERE id = 1').get();
    const milestones = db.prepare('SELECT * FROM milestones ORDER BY target_week ASC').all();
    const team = db.prepare('SELECT * FROM team_members ORDER BY id ASC').all();

    res.json({
      success: true,
      charter,
      milestones,
      team
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/charter - Update Project Charter
router.put('/', (req, res) => {
  try {
    const {
      project_name,
      objectives,
      stakeholders,
      scope_inclusions,
      scope_exclusions,
      current_week,
      status
    } = req.body;

    if (!project_name || !objectives) {
      return res.status(400).json({ success: false, error: 'Project name and objectives are required.' });
    }

    const updateStmt = db.prepare(`
      UPDATE project_charter
      SET project_name = ?,
          objectives = ?,
          stakeholders = ?,
          scope_inclusions = ?,
          scope_exclusions = ?,
          current_week = COALESCE(?, current_week),
          status = COALESCE(?, status)
      WHERE id = 1
    `);

    updateStmt.run(
      project_name,
      objectives,
      stakeholders || '',
      scope_inclusions || '',
      scope_exclusions || '',
      current_week,
      status
    );

    const updated = db.prepare('SELECT * FROM project_charter WHERE id = 1').get();
    res.json({ success: true, charter: updated, message: 'Project charter updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/charter/milestones - Add new milestone
router.post('/milestones', (req, res) => {
  try {
    const { name, target_week, deliverable, status } = req.body;
    if (!name || !target_week || !deliverable) {
      return res.status(400).json({ success: false, error: 'Name, target week, and deliverable are required.' });
    }

    const info = db.prepare(`
      INSERT INTO milestones (name, target_week, deliverable, status)
      VALUES (?, ?, ?, ?)
    `).run(name, Number(target_week), deliverable, status || 'Pending');

    res.status(201).json({ success: true, milestoneId: info.lastInsertRowid, message: 'Milestone created.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/charter/milestones/:id - Update milestone status
router.put('/milestones/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status, name, target_week, deliverable } = req.body;

    const existing = db.prepare('SELECT * FROM milestones WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Milestone not found.' });
    }

    db.prepare(`
      UPDATE milestones
      SET status = COALESCE(?, status),
          name = COALESCE(?, name),
          target_week = COALESCE(?, target_week),
          deliverable = COALESCE(?, deliverable)
      WHERE id = ?
    `).run(status, name, target_week ? Number(target_week) : null, deliverable, id);

    res.json({ success: true, message: 'Milestone updated.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/charter/closure - Project Closure Record
router.post('/closure', (req, res) => {
  try {
    const { closure_notes, status } = req.body;
    if (!closure_notes) {
      return res.status(400).json({ success: false, error: 'Closure notes / lessons learned are required.' });
    }

    db.prepare(`
      UPDATE project_charter
      SET closure_status = 'Closed',
          status = COALESCE(?, 'Completed'),
          closure_notes = ?
      WHERE id = 1
    `).run(status || 'Completed', closure_notes);

    res.json({ success: true, message: 'Project closure recorded successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
