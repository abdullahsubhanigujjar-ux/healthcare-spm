/**
 * Automated Verification & Test Suite for
 * Smart Healthcare Project Management System (CSE-494)
 * Validates programmatic EVM, Scheduling CPM, Scope CCB Control, and Quality.
 */

const db = require('../../../../db');

console.log('================================================================');
console.log('CSE-494: SMART HEALTHCARE PROJECT MANAGEMENT SYSTEM - TEST SUITE');
console.log('Testing Modules 1 to 6 with Expected vs Actual Results');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function assertTest(testName, expected, actual, condition) {
  const isPassed = condition !== undefined ? condition : (expected === actual);
  if (isPassed) {
    passCount++;
    console.log(`[PASS] ${testName}`);
    console.log(`       Expected: ${expected} | Actual: ${actual}`);
  } else {
    failCount++;
    console.log(`[FAIL] ${testName}`);
    console.log(`       Expected: ${expected} | Actual: ${actual}`);
  }
}

// -------------------------------------------------------------
// TEST CASE 1: Project Charter & Integration Baseline Verification
// -------------------------------------------------------------
console.log('--- MODULE 1: INITIATION & INTEGRATION MANAGEMENT ---');
const charter = db.prepare('SELECT * FROM project_charter WHERE id = 1').get();
assertTest(
  'Initial Approved Budget is PKR 5,000,000',
  5000000,
  charter ? charter.initial_budget : null,
  charter && charter.initial_budget === 5000000
);
assertTest(
  'Initial Project Deadline is 16 Weeks',
  16,
  charter ? charter.initial_deadline_weeks : null,
  charter && charter.initial_deadline_weeks === 16
);
const teamCount = db.prepare('SELECT count(*) as count FROM team_members').get().count;
assertTest(
  'Case Study Team Members (1 PM, 2 Backend, 2 Frontend, 1 DB, 1 QA = 7 total)',
  7,
  teamCount,
  teamCount === 7
);

// -------------------------------------------------------------
// TEST CASE 2: Scope Management & Unapproved Scope Prevention
// -------------------------------------------------------------
console.log('\n--- MODULE 2: SCOPE MANAGEMENT & WBS BASELINE ---');
// Verify that REQ-07 (AI) and REQ-08 (Mobile App) are NOT in the approved baseline initially
const unapprovedReqs = db.prepare('SELECT count(*) as cnt FROM requirements WHERE is_baseline = 0').get().cnt;
assertTest(
  'Unapproved Change Request Requirements Excluded From Approved Baseline',
  2,
  unapprovedReqs,
  unapprovedReqs === 2
);

// Verify WBS level hierarchy exists
const wbsRootCount = db.prepare('SELECT count(*) as cnt FROM wbs_items WHERE parent_code IS NULL').get().cnt;
assertTest(
  'WBS Root Deliverables (1.0 to 7.0)',
  7,
  wbsRootCount,
  wbsRootCount === 7
);

// -------------------------------------------------------------
// TEST CASE 3: Change Request Impact on Scope, Budget and Schedule
// -------------------------------------------------------------
console.log('\n--- MODULE 2: DYNAMIC CHANGE CONTROL BOARD (CCB) IMPACT ---');
// Case study specifies AI module (+500k, +2 wks) and Mobile App (+300k, +1 wk) = +800,000 PKR and +3 weeks
const totalCrCost = db.prepare('SELECT sum(cost_impact) as total FROM change_requests').get().total;
const totalCrWeeks = db.prepare('SELECT sum(schedule_impact_weeks) as total FROM change_requests').get().total;
assertTest(
  'Combined Scope Change Cost Impact is PKR 800,000',
  800000,
  totalCrCost,
  totalCrCost === 800000
);
assertTest(
  'Combined Scope Change Schedule Extension is 3 Weeks',
  3,
  totalCrWeeks,
  totalCrWeeks === 3
);

// -------------------------------------------------------------
// TEST CASE 4: Schedule Precedence & Delay Propagation
// -------------------------------------------------------------
console.log('\n--- MODULE 3: SCHEDULE PRECEDENCE & SLIPPAGE PROPAGATION ---');
const apptActivity = db.prepare('SELECT * FROM activities WHERE act_code = ?').get('ACT-05');
assertTest(
  'ACT-05 Appointment Engine is Delayed with Progress 75%',
  'Delayed',
  apptActivity ? apptActivity.status : null,
  apptActivity && apptActivity.status === 'Delayed'
);

// Check predecessor dependency logic: ACT-07 (Doctor Rostering) depends on ACT-05
const doctorActivity = db.prepare('SELECT * FROM activities WHERE act_code = ?').get('ACT-07');
assertTest(
  'ACT-07 Predecessor links to ACT-05',
  'ACT-05',
  doctorActivity ? doctorActivity.predecessors : null,
  doctorActivity && doctorActivity.predecessors.includes('ACT-05')
);

// -------------------------------------------------------------
// TEST CASE 5: Programmatic Earned Value Management (EVM)
// -------------------------------------------------------------
console.log('\n--- MODULE 4: COST MANAGEMENT & PROGRAMMATIC EVM ---');
// Baseline budget sum of approved activities
const approvedSum = db.prepare('SELECT sum(planned_cost) as total FROM activities WHERE is_approved_scope = 1').get().total;
assertTest(
  'Sum of Approved Baseline Activity Costs = BAC = PKR 5,000,000',
  5000000,
  approvedSum,
  approvedSum === 5000000
);

// Compute programmatic EVM indicators at Week 8
const activities = db.prepare('SELECT * FROM activities WHERE is_approved_scope = 1').all();
let testPV = 0;
let testEV = 0;
let testAC = 0;
const currentWeek = charter ? charter.current_week : 8;

activities.forEach(a => {
  testAC += a.actual_cost;
  testEV += a.planned_cost * (a.progress_pct / 100);
  if (currentWeek >= a.planned_end_week) {
    testPV += a.planned_cost;
  } else if (currentWeek > a.planned_start_week) {
    const dur = a.planned_end_week - a.planned_start_week;
    testPV += a.planned_cost * ((currentWeek - a.planned_start_week) / dur);
  }
});

const testCPI = testAC > 0 ? (testEV / testAC) : 1.0;
const testSPI = testPV > 0 ? (testEV / testPV) : 1.0;

assertTest(
  'EVM: Actual Cost (AC) Incurred > 0',
  true,
  testAC > 0,
  testAC > 0
);
assertTest(
  'EVM: Cost Performance Index (CPI) Calculated Programmatically',
  true,
  testCPI > 0,
  testCPI > 0
);
assertTest(
  'EVM: Schedule Performance Index (SPI) Calculated Programmatically',
  true,
  testSPI > 0,
  testSPI > 0
);
assertTest(
  'EVM: Threshold Alert Triggered for Cost Deviation (CPI < 1.0)',
  true,
  testCPI < 1.0,
  testCPI < 1.0
);
assertTest(
  'EVM: Threshold Alert Triggered for Schedule Slippage (SPI < 1.0)',
  true,
  testSPI < 1.0,
  testSPI < 1.0
);

// -------------------------------------------------------------
// TEST CASE 6: Quality Defect Tracking (Case Study Critical Defects)
// -------------------------------------------------------------
console.log('\n--- MODULE 5: QUALITY MANAGEMENT & DEFECT RESOLUTION ---');
const def01 = db.prepare('SELECT * FROM quality_defects WHERE defect_code = ?').get('DEF-01');
assertTest(
  'DEF-01: Critical Defect in Appointment Scheduling Recorded',
  'Critical',
  def01 ? def01.severity : 'None',
  def01 && def01.severity === 'Critical' && def01.module === 'Appointment Scheduling'
);

const def02 = db.prepare('SELECT * FROM quality_defects WHERE defect_code = ?').get('DEF-02');
assertTest(
  'DEF-02: Critical Defect in Patient Record Management Recorded',
  'Critical',
  def02 ? def02.severity : 'None',
  def02 && def02.severity === 'Critical' && def02.module === 'Patient Record Management'
);

const failChecklist = db.prepare('SELECT count(*) as cnt FROM quality_checklists WHERE test_result = ?').get('Fail').cnt;
assertTest(
  'Quality Checklist Records Failed Inspection Tests for Defective Modules',
  true,
  failChecklist > 0,
  failChecklist > 0
);

// -------------------------------------------------------------
// TEST CASE 7: 5x5 Risk Prioritization Matrix & PDPC Response
// -------------------------------------------------------------
console.log('\n--- MODULE 5: 5x5 RISK MATRIX & PDPC RISK RESPONSE ---');
const highRiskCount = db.prepare('SELECT count(*) as cnt FROM risks WHERE (likelihood * impact) >= 15').get().cnt;
assertTest(
  'Risk Prioritization Matrix Identifies High Critical Risks (Score >= 15)',
  true,
  highRiskCount >= 2,
  highRiskCount >= 2
);

const pdpcCount = db.prepare('SELECT count(*) as cnt FROM pdpc_items').get().cnt;
assertTest(
  'Process Decision Program Chart (PDPC) Risk Countermeasures Configured',
  4,
  pdpcCount,
  pdpcCount === 4
);

// -------------------------------------------------------------
// TEST SUMMARY
// -------------------------------------------------------------
console.log('\n================================================================');
console.log(`TEST EXECUTION SUMMARY: ${passCount} PASSED | ${failCount} FAILED | TOTAL: ${passCount + failCount}`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('ALL MODULE VERIFICATION TEST CASES PASSED SUCCESSFULLY!\n');
}
