const express = require('express');
const router = express.Router();
const db = require('../db');

// --- 1. DEFECT TRACKING ---

// GET /api/quality/defects - List defects
router.get('/defects', (req, res) => {
  try {
    const { severity, status, module } = req.query;
    let query = `
      SELECT d.*, tm.name as assignee_name, tm.role as assignee_role
      FROM quality_defects d
      LEFT JOIN team_members tm ON d.assigned_to = tm.id
    `;
    const conditions = [];
    const params = [];

    if (severity) {
      conditions.push('d.severity = ?');
      params.push(severity);
    }
    if (status) {
      conditions.push('d.status = ?');
      params.push(status);
    }
    if (module) {
      conditions.push('d.module = ?');
      params.push(module);
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += " ORDER BY CASE d.severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, d.id ASC";

    const defects = db.prepare(query).all(...params);

    const metrics = {
      total: defects.length,
      critical_unresolved: defects.filter(d => d.severity === 'Critical' && ['Open', 'In Progress'].includes(d.status)).length,
      open: defects.filter(d => d.status === 'Open').length,
      in_progress: defects.filter(d => d.status === 'In Progress').length,
      resolved: defects.filter(d => ['Resolved', 'Closed'].includes(d.status)).length
    };

    res.json({ success: true, metrics, defects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/quality/defects - Log new defect
router.post('/defects', (req, res) => {
  try {
    const { defect_code, title, module, severity, assigned_to, description } = req.body;
    if (!defect_code || !title || !module || !severity || !description) {
      return res.status(400).json({ success: false, error: 'Defect code, title, module, severity, and description required.' });
    }

    const charter = db.prepare('SELECT current_week FROM project_charter WHERE id = 1').get();
    const currentWeek = charter ? charter.current_week : 8;

    const stmt = db.prepare(`
      INSERT INTO quality_defects (
        defect_code, title, module, severity, status, reported_week, assigned_to, description
      ) VALUES (?, ?, ?, ?, 'Open', ?, ?, ?)
    `);

    stmt.run(defect_code, title, module, severity, currentWeek, assigned_to || null, description);

    res.status(201).json({ success: true, message: 'Defect logged successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/quality/defects/:id - Update defect status and resolution notes
router.put('/defects/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution_notes, assigned_to } = req.body;

    const existing = db.prepare('SELECT * FROM quality_defects WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Defect not found.' });
    }

    db.prepare(`
      UPDATE quality_defects
      SET status = COALESCE(?, status),
          resolution_notes = COALESCE(?, resolution_notes),
          assigned_to = COALESCE(?, assigned_to)
      WHERE id = ?
    `).run(status, resolution_notes, assigned_to, id);

    res.json({ success: true, message: 'Defect updated.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 2. QUALITY CHECKLISTS ---

// GET /api/quality/checklists - Deliverable Inspection Checklist
router.get('/checklists', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM quality_checklists ORDER BY deliverable ASC, id ASC').all();
    const total = items.length;
    const passed = items.filter(i => i.test_result === 'Pass').length;
    const failed = items.filter(i => i.test_result === 'Fail').length;
    const pending = items.filter(i => i.test_result === 'Pending').length;

    res.json({
      success: true,
      summary: { total, passed, failed, pending, pass_rate_pct: total > 0 ? Math.round((passed / total) * 100) : 0 },
      checklists: items
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/quality/checklists/:id - Record Inspection Result
router.put('/checklists/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { test_result, inspected_by, inspection_notes } = req.body;

    if (!['Pass', 'Fail', 'Pending'].includes(test_result)) {
      return res.status(400).json({ success: false, error: 'Test result must be Pass, Fail, or Pending.' });
    }

    db.prepare(`
      UPDATE quality_checklists
      SET test_result = ?,
          inspected_by = COALESCE(?, inspected_by),
          inspection_notes = COALESCE(?, inspection_notes)
      WHERE id = ?
    `).run(test_result, inspected_by, inspection_notes, id);

    res.json({ success: true, message: 'Quality inspection result recorded.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 3. RISK PRIORITIZATION MATRIX ---

// GET /api/quality/risks - 5x5 Prioritization Matrix
router.get('/risks', (req, res) => {
  try {
    const risks = db.prepare(`
      SELECT *, (likelihood * impact) AS risk_score
      FROM risks
      ORDER BY (likelihood * impact) DESC, id ASC
    `).all();

    const enriched = risks.map(r => {
      let level = 'Low';
      let color = 'green';
      if (r.risk_score >= 15) {
        level = 'High';
        color = 'red';
      } else if (r.risk_score >= 8) {
        level = 'Medium';
        color = 'yellow';
      }
      return { ...r, risk_level: level, risk_color: color };
    });

    res.json({ success: true, risks: enriched });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/quality/risks - Add new risk
router.post('/risks', (req, res) => {
  try {
    const { risk_code, title, category, likelihood, impact, response_strategy, mitigation_plan } = req.body;
    if (!risk_code || !title || !category || !likelihood || !impact || !mitigation_plan) {
      return res.status(400).json({ success: false, error: 'All risk fields including likelihood and impact (1-5) required.' });
    }

    const lh = Number(likelihood);
    const imp = Number(impact);
    if (lh < 1 || lh > 5 || imp < 1 || imp > 5) {
      return res.status(400).json({ success: false, error: 'Likelihood and Impact must be between 1 and 5.' });
    }

    db.prepare(`
      INSERT INTO risks (risk_code, title, category, likelihood, impact, response_strategy, mitigation_plan, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
    `).run(risk_code, title, category, lh, imp, response_strategy || 'Mitigate', mitigation_plan);

    res.status(201).json({ success: true, message: 'Risk registered in Prioritization Matrix.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 4. PROCESS DECISION PROGRAM CHART (PDPC) ---

// GET /api/quality/pdpc - Structured PDPC Tree
router.get('/pdpc', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM pdpc_items ORDER BY id ASC').all();
    res.json({ success: true, pdpc: items });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/quality/pdpc - Add PDPC Node
router.post('/pdpc', (req, res) => {
  try {
    const { process_step, potential_problem, preventive_action, contingency_plan, decision_node, feasibility } = req.body;
    if (!process_step || !potential_problem || !preventive_action || !contingency_plan) {
      return res.status(400).json({ success: false, error: 'Process step, potential problem, preventive action, and contingency plan required.' });
    }

    db.prepare(`
      INSERT INTO pdpc_items (process_step, potential_problem, preventive_action, contingency_plan, decision_node, feasibility)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(process_step, potential_problem, preventive_action, contingency_plan, decision_node || 'Decision Point', feasibility || 'Feasible');

    res.status(201).json({ success: true, message: 'PDPC risk response node created.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
