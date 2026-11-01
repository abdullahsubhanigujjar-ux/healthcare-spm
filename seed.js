const db = require('./db');

function seedDatabase() {
  console.log('--- Seeding Smart Healthcare Project Management System Database ---');

  // Disable foreign keys temporarily during table reset & bulk seed
  db.pragma('foreign_keys = OFF');

  // Clear existing data safely
  db.exec(`
    DELETE FROM pdpc_items;
    DELETE FROM risks;
    DELETE FROM quality_checklists;
    DELETE FROM quality_defects;
    DELETE FROM activities;
    DELETE FROM requirements;
    DELETE FROM change_requests;
    DELETE FROM wbs_items;
    DELETE FROM team_members;
    DELETE FROM milestones;
    DELETE FROM project_charter;
  `);

  // 1. Project Charter
  const insertCharter = db.prepare(`
    INSERT INTO project_charter (
      id, project_name, objectives, stakeholders, scope_inclusions, scope_exclusions,
      initial_budget, approved_budget, initial_deadline_weeks, current_deadline_weeks,
      current_week, status, closure_status, closure_notes
    ) VALUES (
      1,
      'Smart Healthcare Project Management and Monitoring System',
      'Deploy a centralized, high-availability healthcare management system for a 5-hospital network to manage appointments, lab reports, doctor schedules, online consultations, and billing.',
      'Hospital Executive Board, Medical Directors (5 Hospitals), Chief Medical Officers, Software Project Manager, Development Team, Patients & Lab Techs',
      'Patient appointment scheduling, Electronic laboratory reports, Doctor shift rosters, Online tele-consultations, Centralized hospital billing & co-pay insurance.',
      'Hardware hospital procurement, On-site surgical equipment integration, Third-party pharmacy retail ERP integration.',
      5000000,
      5000000,
      16,
      16,
      8,
      'In Progress',
      'Active',
      'Project is currently at Mid-Term Milestone (Week 8 of 16). Scope change requests pending approval.'
    )
  `);
  insertCharter.run();

  // Milestones
  const insertMilestone = db.prepare(`
    INSERT INTO milestones (name, target_week, deliverable, status) VALUES (?, ?, ?, ?)
  `);
  insertMilestone.run('M1: Project Charter & Baseline Plan Sign-off', 2, 'Approved Project Charter & WBS Dictionary', 'Completed');
  insertMilestone.run('M2: Architecture & Multi-Tenant DB Schema', 4, '5-Hospital Database Schema & Security Spec', 'Completed');
  insertMilestone.run('M3: Mid-Term Core Modules MVP (Appt, Lab, Billing)', 8, 'Working Core Modules & EVM Assessment', 'In Progress');
  insertMilestone.run('M4: Telehealth & Online Consultation Engine', 12, 'WebRTC Video Consultation Module', 'Pending');
  insertMilestone.run('M5: Pilot Testing & Hospital Network Deployment', 16, 'Full Network Rollout Across 5 Hospitals', 'Pending');

  // Team Members (Exact 7 team roles specified in the case study)
  const insertTeam = db.prepare(`
    INSERT INTO team_members (id, name, role, specialization, allocation_pct) VALUES (?, ?, ?, ?, ?)
  `);
  insertTeam.run(1, 'Engr. Bilal Shabbir (PM)', 'Project Manager', 'Agile & PMP Certified / Governance', 100);
  insertTeam.run(2, 'Ahmed Raza', 'Backend Developer 1', 'Node.js, Express & Microservices', 100);
  insertTeam.run(3, 'Farhan Ali', 'Backend Developer 2', 'API Gateways & WebRTC Consultation', 100);
  insertTeam.run(4, 'Sana Fatima', 'Frontend Developer 1', 'React, Dashboards & Appointment UI', 100);
  insertTeam.run(5, 'Zainab Noor', 'Frontend Developer 2', 'Telehealth & Lab Portal UI', 100);
  insertTeam.run(6, 'Muhammad Usman', 'Database Developer', 'PostgreSQL/SQLite, HIPAA Encryption, Multi-Tenant', 100);
  insertTeam.run(7, 'Tariq Mehmood', 'Quality Assurance Engineer', 'Automation, Defect Tracking & EVM Audits', 100);

  // 2. Change Requests (Directly from case study: +PKR 800,000, +3 weeks)
  // Inserted BEFORE requirements & activities so FK relationships resolve
  const insertCR = db.prepare(`
    INSERT INTO change_requests (
      id, cr_number, title, requested_by, justification, cost_impact, schedule_impact_weeks,
      status, submitted_date, decision_date, decision_rationale
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertCR.run(
    1,
    'CR-01',
    'AI-Based Preliminary Diagnosis Module',
    'Hospital Medical Advisory Council (Dr. Tariq & Dr. Samina)',
    'Provides automated preliminary symptom assessment to triage acute patients prior to clinical consultation, reducing ER bottleneck across the 5 hospitals.',
    500000,
    2,
    'Pending',
    '2026-10-15',
    null,
    'Under review by Project Manager and Hospital Steering Committee. Evaluates ML server overhead and medical accuracy liability.'
  );
  insertCR.run(
    2,
    'CR-02',
    'Cross-Platform Mobile Application (iOS/Android)',
    'Executive Patient Experience Board',
    'Hospital management requires a dedicated mobile app to increase patient self-service booking and real-time lab notification delivery.',
    300000,
    1,
    'Pending',
    '2026-10-18',
    null,
    'Pending formal review. Evaluates mobile API gateway readiness and store compliance.'
  );

  // 3. Scope Management: Requirements
  const insertReq = db.prepare(`
    INSERT INTO requirements (req_code, title, module, description, priority, status, is_baseline, change_request_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertReq.run('REQ-01', 'Multi-Hospital Appointment Scheduling', 'Appointments', 'Patients and desk staff can book, reschedule, and cancel slots across 5 hospitals.', 'Critical', 'Approved', 1, null);
  insertReq.run('REQ-02', 'Automated Laboratory Diagnostics & Reports', 'Laboratory', 'Direct digital delivery of lab findings with doctor verification signature.', 'High', 'Approved', 1, null);
  insertReq.run('REQ-03', 'Doctor Duty Rosters & Real-Time Availability', 'Doctor Schedules', 'Real-time synchronization of shift timetables across clinical departments.', 'High', 'Approved', 1, null);
  insertReq.run('REQ-04', 'Secure Video Online Consultations', 'Telehealth', 'End-to-end encrypted WebRTC video conference between doctors and remote patients.', 'Medium', 'Approved', 1, null);
  insertReq.run('REQ-05', 'Unified Hospital Billing & Insurance Claims', 'Billing', 'Split billing calculation for consultation, tests, and insurance coverage co-pay.', 'Critical', 'Approved', 1, null);
  insertReq.run('REQ-06', 'Centralized Patient Records (EHR) & RBAC', 'Patient Records', 'Role-based access control protecting patient histories across all 5 hospitals.', 'Critical', 'Approved', 1, null);
  // Unapproved Scope / Change Request Items (Case Study additions)
  insertReq.run('REQ-07', 'AI-Based Preliminary Diagnosis & Triage', 'AI Diagnosis', 'Machine learning algorithm for initial patient symptom check and risk scoring.', 'High', 'Pending Approval', 0, 1);
  insertReq.run('REQ-08', 'Cross-Platform Patient & Doctor Mobile App', 'Mobile App', 'Native iOS/Android companion app for live notifications and booking.', 'High', 'Pending Approval', 0, 2);

  // 4. WBS Items (Hierarchical Work Breakdown Structure)
  const insertWBS = db.prepare(`
    INSERT INTO wbs_items (wbs_code, title, parent_code, deliverable, level)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertWBS.run('1.0', 'Project Initiation & Integration', null, 'Charter & Management Plans', 1);
  insertWBS.run('1.1', 'Project Charter & Governance Setup', '1.0', 'Signed Charter Document', 2);
  insertWBS.run('1.2', 'Project Management Plan & Baselines', '1.0', 'PMP Baseline Schedule & Budget', 2);

  insertWBS.run('2.0', 'Core Architecture & Multi-Hospital Database', null, '5-Hospital Database Infrastructure', 1);
  insertWBS.run('2.1', 'Multi-Tenant Relational Schema Design', '2.0', 'Verified Entity Relationship Model', 2);
  insertWBS.run('2.2', 'HIPAA Compliant Patient Data Security & RBAC', '2.0', 'Security & Access Protocols', 2);

  insertWBS.run('3.0', 'Clinical Appointment & Records Engine', null, 'Appointment & Patient Records Modules', 1);
  insertWBS.run('3.1', 'Appointment Booking & Slot Allocation', '3.0', 'Automated Booking Engine', 2);
  insertWBS.run('3.2', 'Electronic Health Record (EHR) Sync', '3.0', 'Centralized Patient Health Ledger', 2);

  insertWBS.run('4.0', 'Telehealth & Doctor Rostering', null, 'Online Consultation & Doctor Schedules', 1);
  insertWBS.run('4.1', 'Doctor Availability & Shift Rostering', '4.0', 'Dynamic Shift Manager', 2);
  insertWBS.run('4.2', 'WebRTC Video Online Consultation Gateway', '4.0', 'Real-time Tele-consultation Web App', 2);

  insertWBS.run('5.0', 'Laboratory & Financial Systems', null, 'Lab Reporting & Billing Modules', 1);
  insertWBS.run('5.1', 'Lab Diagnostic Test Workflow & PDF Reports', '5.0', 'Lab Orders & Reporting Engine', 2);
  insertWBS.run('5.2', 'Consolidated Hospital Billing & Co-Pay', '5.0', 'Multi-Hospital Payment Gateway', 2);

  insertWBS.run('6.0', 'Integration, Quality Assurance & Pilot', null, 'System Validation & Rollout', 1);
  insertWBS.run('6.1', 'End-to-End System Testing & Defect Resolution', '6.0', 'Audit & Verification Reports', 2);
  insertWBS.run('6.2', 'Hospital Pilot Deployment (5 Network Hospitals)', '6.0', 'Live Network Go-Live Certificate', 2);

  insertWBS.run('7.0', 'Hospital Scope Expansion (Change Requests)', null, 'AI & Mobile Extensions', 1);
  insertWBS.run('7.1', 'AI Preliminary Diagnosis Engine (CR-01)', '7.0', 'AI Symptom Classifier Module', 2);
  insertWBS.run('7.2', 'Mobile Application for Patients & Doctors (CR-02)', '7.0', 'iOS & Android Hybrid App Package', 2);

  // 5. Activities: Baseline planned total = PKR 5,000,000 across 16 weeks
  // Week 8 Status: Demonstrates realistic in-flight project with defects causing slippage & cost deviation
  const insertActivity = db.prepare(`
    INSERT INTO activities (
      act_code, name, wbs_code, assigned_to, planned_duration_weeks, planned_start_week,
      planned_end_week, actual_start_week, actual_end_week, predecessors,
      planned_cost, actual_cost, progress_pct, status, is_approved_scope, change_request_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Baseline activities (Sum of planned_cost = 5,000,000 PKR)
  insertActivity.run('ACT-01', 'Project Charter & Stakeholder Alignment', '1.1', 1, 2, 1, 2, 1, 2, '', 250000, 240000, 100, 'Completed', 1, null);
  insertActivity.run('ACT-02', 'Project Management Plan & Baseline Setup', '1.2', 1, 2, 2, 4, 2, 4, 'ACT-01', 250000, 260000, 100, 'Completed', 1, null);
  insertActivity.run('ACT-03', 'Multi-Tenant 5-Hospital Database Architecture', '2.1', 6, 3, 2, 5, 2, 5, 'ACT-01', 600000, 620000, 100, 'Completed', 1, null);
  insertActivity.run('ACT-04', 'HIPAA & Role-Based Access Control (RBAC)', '2.2', 6, 3, 4, 7, 4, 7, 'ACT-03', 400000, 430000, 100, 'Completed', 1, null);
  insertActivity.run('ACT-05', 'Patient Appointment Scheduling Engine', '3.1', 2, 4, 4, 8, 4, null, 'ACT-03', 550000, 680000, 75, 'Delayed', 1, null);
  insertActivity.run('ACT-06', 'Patient Health Record (EHR) Storage & Sync', '3.2', 3, 4, 5, 9, 5, null, 'ACT-04', 500000, 570000, 65, 'Delayed', 1, null);
  insertActivity.run('ACT-07', 'Doctor Duty Rostering & Schedule Synchronization', '4.1', 4, 3, 7, 10, 7, null, 'ACT-05', 400000, 250000, 25, 'In Progress', 1, null);
  insertActivity.run('ACT-08', 'WebRTC Video Online Consultation Gateway', '4.2', 3, 4, 8, 12, null, null, 'ACT-07', 500000, 0, 0, 'Not Started', 1, null);
  insertActivity.run('ACT-09', 'Laboratory Diagnostics & PDF Report Engine', '5.1', 5, 4, 6, 10, 6, null, 'ACT-03', 450000, 310000, 40, 'In Progress', 1, null);
  insertActivity.run('ACT-10', 'Unified Hospital Billing & Co-Pay Calculation', '5.2', 2, 4, 9, 13, null, null, 'ACT-05,ACT-09', 500000, 0, 0, 'Not Started', 1, null);
  insertActivity.run('ACT-11', 'System Integration & Defect Verification', '6.1', 7, 3, 12, 15, null, null, 'ACT-06,ACT-08,ACT-10', 350000, 0, 0, 'Not Started', 1, null);
  insertActivity.run('ACT-12', '5-Hospital Network Rollout & Project Closure', '6.2', 1, 2, 15, 16, null, null, 'ACT-11', 250000, 0, 0, 'Not Started', 1, null);

  // Unapproved Scope Activities (Linked to Change Requests: 500,000 + 300,000 = 800,000 PKR; 2 wks + 1 wk)
  insertActivity.run('ACT-13', 'AI Preliminary Diagnosis Model & Triage Engine', '7.1', 2, 3, 11, 14, null, null, 'ACT-06', 500000, 0, 0, 'Not Started', 0, 1);
  insertActivity.run('ACT-14', 'Hybrid Mobile App Development (iOS/Android)', '7.2', 4, 3, 12, 15, null, null, 'ACT-05,ACT-07', 300000, 0, 0, 'Not Started', 0, 2);

  // 6. Quality Defects (Directly matching case study: critical defects in appointment scheduling and patient records)
  const insertDefect = db.prepare(`
    INSERT INTO quality_defects (
      defect_code, title, module, severity, status, reported_week, assigned_to, description, resolution_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertDefect.run(
    'DEF-01',
    'Appointment Slot Double-Booking Under High Concurrency',
    'Appointment Scheduling',
    'Critical',
    'Open',
    7,
    2,
    'Testing revealed that when multiple patients simultaneously book the same doctor slot across two different hospital terminals, both requests succeed, causing critical doctor double-booking.',
    'Under investigation: requires atomic database row locks and redis distributed lock implementation.'
  );
  insertDefect.run(
    'DEF-02',
    'Cross-Hospital Patient EHR Record Mismatch & Integrity Leak',
    'Patient Record Management',
    'Critical',
    'In Progress',
    8,
    6,
    'During multi-hospital synchronization tests, patient records from Hospital A were duplicated under a conflicting National ID key from Hospital B, leading to corrupted medical history.',
    'Schema unique constraint patch created; database migration script in staging test.'
  );
  insertDefect.run(
    'DEF-03',
    'Laboratory Diagnostic PDF Report Generation Buffer Overflow',
    'Laboratory Reports',
    'High',
    'In Progress',
    8,
    5,
    'High-resolution ultrasound and pathology image attachments cause the PDF generator service to crash with an out-of-memory exception.',
    'Image compression pipeline added before PDF rendering.'
  );
  insertDefect.run(
    'DEF-04',
    'Hospital Billing Co-Pay Rounding Error on Tax Exemption',
    'Hospital Billing',
    'Medium',
    'Resolved',
    6,
    2,
    'Tax exemption percentage formula calculated PKR 2.50 discrepancy per transaction for private insurer co-pays.',
    'Corrected fixed-point currency math algorithm; unit test verified.'
  );

  // 7. Quality Checklists
  const insertChecklist = db.prepare(`
    INSERT INTO quality_checklists (deliverable, item_name, standard, test_result, inspected_by, inspection_notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertChecklist.run('Appointment Module', 'Concurrent Booking Stress Test (500 users/sec)', 'Zero double-bookings permitted', 'Fail', 'Tariq Mehmood', 'Failed on multi-hospital race condition test (DEF-01 logged).');
  insertChecklist.run('Patient Records (EHR)', 'Data Encryption at Rest & In-Transit (AES-256)', 'HIPAA / ISO 27001 Security Standard', 'Pass', 'Tariq Mehmood', 'All patient identifiable data verified encrypted.');
  insertChecklist.run('Patient Records (EHR)', 'Multi-Hospital Record Sync & Foreign Key Integrity', '100% Data Consistency Across 5 Nodes', 'Fail', 'Tariq Mehmood', 'Sync failure observed on identical patient IDs (DEF-02 logged).');
  insertChecklist.run('Doctor Schedule Roster', 'Timezone & Shift Overlap Boundary Validation', 'Prevent overlapping shifts for same doctor', 'Pass', 'Tariq Mehmood', 'Automated validation passed all 30 shift boundary test cases.');
  insertChecklist.run('Laboratory Module', 'Diagnostic Report Signature Verification', 'Digital SHA-256 checksum for lab sign-off', 'Pass', 'Tariq Mehmood', 'Verified report cryptographic signature functionality.');
  insertChecklist.run('Hospital Billing', 'Insurance Co-Pay & Split Billing Precision', '0% rounding discrepancy across invoices', 'Pass', 'Tariq Mehmood', 'Passed post-defect resolution verification.');

  // 8. Risk Prioritization Matrix (5x5: Likelihood x Impact = Risk Score)
  const insertRisk = db.prepare(`
    INSERT INTO risks (risk_code, title, category, likelihood, impact, response_strategy, mitigation_plan, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertRisk.run('RSK-01', 'Scope Creep from Hospital Executives (AI & Mobile Requests)', 'Scope', 5, 4, 'Mitigate', 'Implement strict Change Control Board (CCB) approval process. Enforce +PKR 800k and +3 weeks budget/schedule adjustments before inclusion.', 'Active');
  insertRisk.run('RSK-02', 'Data Synchronization Glitches in Multi-Hospital EHR Database', 'Technical', 4, 5, 'Mitigate', 'Implement distributed database transaction isolation, atomic distributed locking, and rigorous data migration tests.', 'Active');
  insertRisk.run('RSK-03', 'Schedule Slippage Due to Defect Remediation in Week 8', 'Schedule', 4, 4, 'Mitigate', 'Reassign QA resources, prioritize critical defect fixes, and perform fast-tracking on non-critical path activities.', 'Active');
  insertRisk.run('RSK-04', 'Doctor Adoption Resistance Across Hospital Network', 'Operational', 3, 3, 'Avoid', 'Conduct interactive training sessions with hospital medical directors and design simplified one-click schedule interfaces.', 'Monitored');
  insertRisk.run('RSK-05', 'High Server Bandwidth Costs for HD Video Consultations', 'Cost', 2, 3, 'Transfer', 'Utilize peer-to-peer WebRTC mesh routing for local hospital intranet calls to minimize external cloud egress costs.', 'Monitored');

  // 9. Process Decision Program Chart (PDPC) Items
  const insertPDPC = db.prepare(`
    INSERT INTO pdpc_items (process_step, potential_problem, preventive_action, contingency_plan, decision_node, feasibility)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertPDPC.run(
    'Phase 1: Multi-Hospital Patient Scheduling',
    'Simultaneous slot booking collision across 2 hospital branches for same specialist.',
    'Apply pessimistic database row locks during transaction checkout window (3-minute lock).',
    'Immediately rollback slot reservation, release slot, and offer next available alternative slot via modal prompt.',
    'Node A: High Booking Concurrency',
    'Feasible'
  );
  insertPDPC.run(
    'Phase 2: Patient Medical Records Sync',
    'Network disconnection between remote hospital branch and central EHR cluster.',
    'Implement local offline SQLite cache on hospital gateway server with cryptographic write-ahead log.',
    'Trigger automated exponential backoff sync as soon as central network heartbeat resumes.',
    'Node B: Hospital Network Outage',
    'Feasible'
  );
  insertPDPC.run(
    'Phase 3: Scope Change Authorization',
    'Hospital management demands AI module without approving required PKR 800,000 budget & 3-week extension.',
    'Prevent unapproved requirements from being included in the baseline scope or assigned to sprint sprints.',
    'Present formal CCB impact assessment report; halt non-charter development until amendment contract is signed.',
    'Node C: Scope Creep Escalation',
    'Feasible'
  );
  insertPDPC.run(
    'Phase 4: Telehealth Video Quality Degradation',
    'Low patient internet bandwidth causes packet loss and video freeze during consultation.',
    'Implement adaptive bitrate streaming and automatic fallback to audio-only VoIP when bandwidth drops < 256 kbps.',
    'Initiate automated cellular telephone bridge if data connection drops completely.',
    'Node D: Telehealth Reliability',
    'Feasible'
  );

  // Re-enable foreign key constraints
  db.pragma('foreign_keys = ON');

  console.log('Database seeded successfully with all case study data!');
}

seedDatabase();
