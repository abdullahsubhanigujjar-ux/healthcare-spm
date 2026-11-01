const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'healthcare_pm.db');
const db = new Database(dbPath);

// Enable WAL mode and foreign keys for reliability
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
function initSchema() {
  db.exec(`
    -- 1. Project Charter & Integration
    CREATE TABLE IF NOT EXISTS project_charter (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      objectives TEXT NOT NULL,
      stakeholders TEXT NOT NULL,
      scope_inclusions TEXT NOT NULL,
      scope_exclusions TEXT NOT NULL,
      initial_budget REAL NOT NULL DEFAULT 5000000,
      approved_budget REAL NOT NULL DEFAULT 5000000,
      initial_deadline_weeks INTEGER NOT NULL DEFAULT 16,
      current_deadline_weeks INTEGER NOT NULL DEFAULT 16,
      current_week INTEGER NOT NULL DEFAULT 8,
      status TEXT NOT NULL DEFAULT 'In Progress',
      closure_status TEXT NOT NULL DEFAULT 'Active',
      closure_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_week INTEGER NOT NULL,
      deliverable TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending' -- Pending, Completed, Delayed
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      specialization TEXT,
      allocation_pct INTEGER NOT NULL DEFAULT 100
    );

    -- 2. Scope Management & WBS
    CREATE TABLE IF NOT EXISTS requirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      req_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      module TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'Medium', -- Critical, High, Medium, Low
      status TEXT NOT NULL DEFAULT 'Approved', -- Draft, Pending Approval, Approved, Rejected
      is_baseline INTEGER NOT NULL DEFAULT 1,  -- 1 = Initial Scope, 0 = Proposed/Change Request
      change_request_id INTEGER,
      FOREIGN KEY (change_request_id) REFERENCES change_requests(id)
    );

    CREATE TABLE IF NOT EXISTS wbs_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wbs_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      parent_code TEXT,
      deliverable TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS change_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cr_number TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      requested_by TEXT NOT NULL,
      justification TEXT NOT NULL,
      cost_impact REAL NOT NULL DEFAULT 0,
      schedule_impact_weeks INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Pending', -- Pending, Approved, Rejected
      submitted_date TEXT NOT NULL,
      decision_date TEXT,
      decision_rationale TEXT
    );

    -- 3. Schedule and Resource Management & Cost (EVM)
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      act_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      wbs_code TEXT NOT NULL,
      assigned_to INTEGER,
      planned_duration_weeks REAL NOT NULL,
      planned_start_week REAL NOT NULL,
      planned_end_week REAL NOT NULL,
      actual_start_week REAL,
      actual_end_week REAL,
      predecessors TEXT DEFAULT '', -- Comma-separated act_codes (e.g. "ACT-1,ACT-2")
      planned_cost REAL NOT NULL,
      actual_cost REAL NOT NULL DEFAULT 0,
      progress_pct REAL NOT NULL DEFAULT 0, -- 0 to 100
      status TEXT NOT NULL DEFAULT 'Not Started', -- Not Started, In Progress, Completed, Delayed
      is_approved_scope INTEGER NOT NULL DEFAULT 1, -- 0 if belongs to unapproved CR
      change_request_id INTEGER,
      FOREIGN KEY (assigned_to) REFERENCES team_members(id),
      FOREIGN KEY (change_request_id) REFERENCES change_requests(id)
    );

    -- 4. Quality Management & Risk Control
    CREATE TABLE IF NOT EXISTS quality_defects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      defect_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      module TEXT NOT NULL,
      severity TEXT NOT NULL, -- Critical, High, Medium, Low
      status TEXT NOT NULL DEFAULT 'Open', -- Open, In Progress, Resolved, Closed
      reported_week INTEGER NOT NULL,
      assigned_to INTEGER,
      description TEXT NOT NULL,
      resolution_notes TEXT,
      FOREIGN KEY (assigned_to) REFERENCES team_members(id)
    );

    CREATE TABLE IF NOT EXISTS quality_checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deliverable TEXT NOT NULL,
      item_name TEXT NOT NULL,
      standard TEXT NOT NULL,
      test_result TEXT NOT NULL DEFAULT 'Pending', -- Pass, Fail, Pending
      inspected_by TEXT,
      inspection_notes TEXT
    );

    CREATE TABLE IF NOT EXISTS risks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      risk_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      likelihood INTEGER NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
      impact INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 5),
      risk_score INTEGER GENERATED ALWAYS AS (likelihood * impact) VIRTUAL,
      response_strategy TEXT NOT NULL, -- Avoid, Mitigate, Transfer, Accept
      mitigation_plan TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active' -- Active, Monitored, Closed
    );

    CREATE TABLE IF NOT EXISTS pdpc_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      process_step TEXT NOT NULL,
      potential_problem TEXT NOT NULL,
      preventive_action TEXT NOT NULL,
      contingency_plan TEXT NOT NULL,
      decision_node TEXT NOT NULL,
      feasibility TEXT NOT NULL DEFAULT 'Feasible' -- Feasible, In Review, Rejected
    );
  `);
}

initSchema();

module.exports = db;
