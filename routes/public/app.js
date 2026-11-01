/**
 * Smart Healthcare Project Management & Monitoring System (CSE-494)
 * Comprehensive Frontend Application Engine
 * Supports Modules 1 to 6: Charter, Scope/WBS, Schedule/Gantt, Cost/EVM, Quality/Risks/PDPC, Reports
 */

// Global Application State Cache
const state = {
  currentTab: 'dashboard',
  summary: null,
  team: [],
  activities: [],
  requirements: [],
  changes: [],
  milestones: [],
  defects: [],
  checklists: [],
  risks: [],
  pdpc: [],
  wbs: []
};

// ==========================================
// 1. API HELPER & TOAST NOTIFICATION ENGINE
// ==========================================
async function api(url, method = 'GET', body = null) {
  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}: Request failed`);
    }
    return data;
  } catch (err) {
    console.error(`[API Error ${method} ${url}]:`, err);
    throw err;
  }
}

function notify(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'fa-circle-check',
    danger: 'fa-circle-xmark',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };

  const toast = document.createElement('div');
  toast.className = `toast-msg ${type}`;
  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <i class="fa-solid ${icons[type] || 'fa-circle-info'}"></i>
      <span>${message}</span>
    </div>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:inherit;font-size:1.1rem;">&times;</button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 4000);
}

// Format numbers as PKR currency
function formatPKR(val) {
  if (val === null || val === undefined) return '--';
  return 'PKR ' + Number(val).toLocaleString();
}

// ==========================================
// 2. TAB NAVIGATION & VIEW SWITCHING
// ==========================================
function switchTab(tabId) {
  state.currentTab = tabId;

  // Update navigation buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const onclickStr = btn.getAttribute('onclick') || '';
    if (onclickStr.includes(`'${tabId}'`)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Switch visible section
  document.querySelectorAll('.module-section').forEach(sec => {
    sec.classList.remove('active');
  });

  const targetSec = document.getElementById(`section-${tabId}`);
  if (targetSec) targetSec.classList.add('active');

  // Update top page title
  const titles = {
    dashboard: 'Executive Project Dashboard',
    charter: '1. Initiation & Project Charter',
    scope: '2. Scope Management & Work Breakdown Structure (WBS)',
    schedule: '3. Schedule Precedence & Gantt Timeline',
    cost: '4. Cost Management & Programmatic EVM Analysis',
    quality: '5. Quality Assurance, Defects & 5x5 Risk Matrix',
    reports: '6. System Integration, Validation & Formal Audit Report'
  };
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = titles[tabId] || 'Smart Healthcare PM';

  // Load section-specific data
  loadTabData(tabId);
}

async function loadTabData(tabId) {
  try {
    switch (tabId) {
      case 'dashboard':
        await loadDashboard();
        break;
      case 'charter':
        await loadCharter();
        break;
      case 'scope':
        await loadScope();
        break;
      case 'schedule':
        await loadSchedule();
        break;
      case 'cost':
        await loadCost();
        break;
      case 'quality':
        await loadQuality();
        break;
      case 'reports':
        await loadReports();
        break;
    }
  } catch (err) {
    notify(err.message, 'danger');
  }
}

// Main Refresh Button
async function fetchSummary() {
  try {
    await updateHeaderAndBadges();
    await loadTabData(state.currentTab);
    notify('Dashboard and module metrics refreshed.');
  } catch (err) {
    notify('Failed to refresh data: ' + err.message, 'danger');
  }
}

// ==========================================
// 3. TOP HEADER & SIDEBAR BADGES ENGINE
// ==========================================
async function updateHeaderAndBadges() {
  const data = await api('/api/dashboard/summary');
  if (!data || !data.summary) return;

  state.summary = data.summary;
  const s = data.summary;

  // Header stats
  const curWeekEl = document.getElementById('headerCurrentWeek');
  if (curWeekEl) curWeekEl.textContent = `Week ${s.current_week}`;

  const deadlineEl = document.getElementById('headerDeadline');
  if (deadlineEl) deadlineEl.textContent = `${s.deadline_weeks} Weeks`;

  const budgetEl = document.getElementById('headerApprovedBudget');
  if (budgetEl) budgetEl.textContent = formatPKR(s.budget.approved_budget);

  const healthEl = document.getElementById('headerProjectHealth');
  if (healthEl) {
    healthEl.textContent = s.project_health;
    if (s.project_health.startsWith('RED')) {
      healthEl.style.color = '#ef4444';
    } else if (s.project_health.startsWith('AMBER')) {
      healthEl.style.color = '#f59e0b';
    } else {
      healthEl.style.color = '#10b981';
    }
  }

  // Sidebar badges
  const crBadge = document.getElementById('pendingCrBadge');
  if (crBadge) crBadge.textContent = `${s.pending_changes_count} CR`;

  const delayBadge = document.getElementById('delayedTaskBadge');
  if (delayBadge) delayBadge.textContent = `${s.delayed_activities_count} Del`;

  const defectBadge = document.getElementById('criticalDefectBadge');
  if (defectBadge) defectBadge.textContent = `${s.unresolved_critical_defects_count} Crit`;
}

// ==========================================
// 4. MODULE 6 / EXECUTIVE DASHBOARD
// ==========================================
async function loadDashboard() {
  const data = await api('/api/dashboard/summary');
  if (!data || !data.summary) return;

  state.summary = data.summary;
  const s = data.summary;

  // Live Alert Banner
  const alertContainer = document.getElementById('dashboardAlertContainer');
  if (alertContainer) {
    let alertHtml = '';
    if (s.health_reasons && s.health_reasons.length > 0) {
      alertHtml += `
        <div class="danger-box">
          <i class="fa-solid fa-triangle-exclamation fa-lg"></i>
          <div>
            <strong>Executive Attention Required (${s.project_health}):</strong>
            <ul style="margin-top: 6px; padding-left: 18px;">
              ${s.health_reasons.map(r => `<li>${r}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    }
    alertContainer.innerHTML = alertHtml;
  }

  // 4 Key KPI Tiles
  const progVal = document.getElementById('dashProgressVal');
  if (progVal) progVal.textContent = `${s.overall_progress_pct}%`;

  const progFill = document.getElementById('dashProgressFill');
  if (progFill) progFill.style.width = `${Math.min(100, s.overall_progress_pct)}%`;

  const cpiVal = document.getElementById('dashCpiVal');
  if (cpiVal) {
    cpiVal.textContent = s.budget.cpi.toFixed(2);
    cpiVal.style.color = s.budget.cpi < 1.0 ? '#ef4444' : '#10b981';
  }

  const spiVal = document.getElementById('dashSpiVal');
  if (spiVal) {
    spiVal.textContent = s.budget.spi.toFixed(2);
    spiVal.style.color = s.budget.spi < 1.0 ? '#ef4444' : '#10b981';
  }

  const critDefVal = document.getElementById('dashCriticalDefectsVal');
  if (critDefVal) critDefVal.textContent = s.unresolved_critical_defects_count;

  // Budget & Cost Tracking
  const bBadge = document.getElementById('dashBudgetApprovedBadge');
  if (bBadge) bBadge.textContent = formatPKR(s.budget.approved_budget);

  const dashBAC = document.getElementById('dashBAC');
  if (dashBAC) dashBAC.textContent = formatPKR(s.budget.bac);

  const dashAC = document.getElementById('dashAC');
  if (dashAC) dashAC.textContent = formatPKR(s.budget.ac);

  const dashEV = document.getElementById('dashEV');
  if (dashEV) dashEV.textContent = formatPKR(s.budget.ev);

  const dashPV = document.getElementById('dashPV');
  if (dashPV) dashPV.textContent = formatPKR(s.budget.pv);

  const dashEAC = document.getElementById('dashEAC');
  if (dashEAC) dashEAC.textContent = formatPKR(s.budget.eac);

  // Active Pending Changes Box
  const pendingBox = document.getElementById('dashPendingChangesBox');
  if (pendingBox) {
    if (data.pending_changes && data.pending_changes.length > 0) {
      pendingBox.innerHTML = `
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
          <div style="font-weight: 700; color: #b45309; display: flex; align-items: center; justify-content: space-between;">
            <span><i class="fa-solid fa-code-pull-request"></i> Unapproved Change Requests (${data.pending_changes.length})</span>
            <button class="btn btn-outline btn-sm" onclick="switchTab('scope')">Review in Scope</button>
          </div>
          <div style="margin-top: 8px; font-size: 0.85rem;">
            ${data.pending_changes.map(c => `
              <div style="padding: 4px 0; border-top: 1px solid #fef3c7; display: flex; justify-content: space-between;">
                <span><strong>${c.cr_number}:</strong> ${c.title}</span>
                <span style="color: #b45309; font-weight: 600;">+${formatPKR(c.cost_impact)} | +${c.schedule_impact_weeks} wks</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      pendingBox.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); padding: 6px 0;"><i class="fa-solid fa-check text-success"></i> No pending scope change requests.</div>`;
    }
  }

  // Active Delayed Activities Box
  const delayedBox = document.getElementById('dashDelayedActivitiesBox');
  if (delayedBox) {
    if (data.delayed_activities && data.delayed_activities.length > 0) {
      delayedBox.innerHTML = `
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px;">
          <div style="font-weight: 700; color: #dc2626; display: flex; align-items: center; justify-content: space-between;">
            <span><i class="fa-solid fa-calendar-xmark"></i> Delayed Project Activities (${data.delayed_activities.length})</span>
            <button class="btn btn-outline btn-sm" onclick="switchTab('schedule')">Gantt Details</button>
          </div>
          <div style="margin-top: 8px; font-size: 0.85rem;">
            ${data.delayed_activities.map(a => `
              <div style="padding: 6px 0; border-top: 1px solid #fee2e2; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <strong>${a.act_code}:</strong> ${a.name} (${a.assignee || 'Unassigned'})
                </div>
                <div style="text-align: right;">
                  <span class="badge badge-delayed">${a.progress_pct}% Progress</span>
                  <div style="font-size: 0.75rem; color: #991b1b;">Spent: ${formatPKR(a.cost_spent)} / ${formatPKR(a.planned_cost)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      delayedBox.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); padding: 6px 0;"><i class="fa-solid fa-check text-success"></i> All scheduled tasks currently on target.</div>`;
    }
  }

  // Milestones Roadmap Table
  const msTbody = document.getElementById('dashMilestonesTableBody');
  if (msTbody && data.milestones) {
    state.milestones = data.milestones;
    msTbody.innerHTML = data.milestones.map(m => {
      let badgeClass = 'badge-pending';
      if (m.status === 'Completed') badgeClass = 'badge-resolved';
      if (m.status === 'In Progress') badgeClass = 'badge-progress';
      if (m.status === 'Delayed') badgeClass = 'badge-delayed';

      return `
        <tr>
          <td><strong>${m.name}</strong></td>
          <td>Week ${m.target_week}</td>
          <td>${m.deliverable}</td>
          <td><span class="badge ${badgeClass}">${m.status}</span></td>
          <td>
            <select class="form-control" style="padding: 3px 6px; font-size: 0.75rem; width: auto;" onchange="updateMilestoneStatus(${m.id}, this.value)">
              <option value="Pending" ${m.status === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="In Progress" ${m.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
              <option value="Completed" ${m.status === 'Completed' ? 'selected' : ''}>Completed</option>
              <option value="Delayed" ${m.status === 'Delayed' ? 'selected' : ''}>Delayed</option>
            </select>
          </td>
        </tr>
      `;
    }).join('');
  }
}

// Milestone update action
async function updateMilestoneStatus(milestoneId, newStatus) {
  try {
    await api(`/api/charter/milestones/${milestoneId}`, 'PUT', { status: newStatus });
    notify(`Milestone updated to ${newStatus}.`);
    await updateHeaderAndBadges();
    await loadDashboard();
  } catch (err) {
    notify('Failed to update milestone: ' + err.message, 'danger');
  }
}

// ==========================================
// 5. MODULE 1: CHARTER & INTEGRATION
// ==========================================
async function loadCharter() {
  const data = await api('/api/charter');
  if (!data) return;

  const c = data.charter;
  state.cachedCharter = c;

  // Populate charter form fields
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  };

  setVal('charterProjectName', c.project_name);
  setVal('charterObjectives', c.objectives);
  setVal('charterStakeholders', c.stakeholders);
  setVal('charterInclusions', c.scope_inclusions);
  setVal('charterExclusions', c.scope_exclusions);
  setVal('charterCurrentWeek', c.current_week);
  setVal('charterStatus', c.status);

  // Baselines snapshot
  const pmpDeadline = document.getElementById('pmpDeadlineWeeks');
  if (pmpDeadline) pmpDeadline.textContent = c.current_deadline_weeks;

  const pmpBudget = document.getElementById('pmpApprovedBudget');
  if (pmpBudget) pmpBudget.textContent = formatPKR(c.approved_budget);

  // Populate Team Members table (7 Case Study Members)
  const teamTbody = document.getElementById('teamTableBody');
  if (teamTbody && data.team) {
    state.team = data.team;
    teamTbody.innerHTML = data.team.map(m => `
      <tr>
        <td><strong>${m.name}</strong></td>
        <td>${m.role} <span style="font-size: 0.75rem; color: var(--text-muted);">(${m.specialization || ''})</span></td>
        <td><span class="badge badge-approved">${m.allocation_pct}% Allocation</span></td>
      </tr>
    `).join('');

    // Populate team options in modals
    populateTeamDropdowns();
  }
}

function populateTeamDropdowns() {
  const populate = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = state.team.map(m => `<option value="${m.id}">${m.name} (${m.role})</option>`).join('');
  };
  populate('defectAssignee');
  populate('newActAssignedTo');
}

async function saveCharterChanges() {
  try {
    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value : '';
    };

    const body = {
      project_name: getVal('charterProjectName'),
      objectives: getVal('charterObjectives'),
      stakeholders: getVal('charterStakeholders'),
      scope_inclusions: getVal('charterInclusions'),
      scope_exclusions: getVal('charterExclusions'),
      current_week: Number(getVal('charterCurrentWeek')),
      status: getVal('charterStatus')
    };

    const res = await api('/api/charter', 'PUT', body);
    notify(res.message || 'Project charter updated successfully.');
    await updateHeaderAndBadges();
    await loadCharter();
  } catch (err) {
    notify('Error saving charter: ' + err.message, 'danger');
  }
}

// ==========================================
// 6. MODULE 2: SCOPE MANAGEMENT & WBS
// ==========================================
async function loadScope() {
  const [crData, reqData, wbsData] = await Promise.all([
    api('/api/scope/changes'),
    api('/api/scope/requirements'),
    api('/api/scope/wbs')
  ]);

  state.changes = crData.changes || [];
  state.requirements = reqData.requirements || [];
  state.wbs = wbsData.flat || [];

  // 1. Change Requests CCB Evaluation Table
  const crTbody = document.getElementById('changeRequestsTableBody');
  if (crTbody) {
    crTbody.innerHTML = state.changes.map(cr => {
      let badgeClass = 'badge-pending';
      if (cr.status === 'Approved') badgeClass = 'badge-approved';
      if (cr.status === 'Rejected') badgeClass = 'badge-rejected';

      let actionBtns = '';
      if (cr.status === 'Pending') {
        actionBtns = `
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-success btn-sm" onclick="handleCrDecision(${cr.id}, 'Approved')">
              <i class="fa-solid fa-check"></i> Approve (CCB)
            </button>
            <button class="btn btn-danger btn-sm" onclick="handleCrDecision(${cr.id}, 'Rejected')">
              <i class="fa-solid fa-xmark"></i> Reject
            </button>
          </div>
        `;
      } else {
        actionBtns = `
          <div style="font-size: 0.8rem; color: var(--text-muted);">
            Evaluated: ${cr.decision_date || 'Closed'}
          </div>
        `;
      }

      return `
        <tr>
          <td><strong>${cr.cr_number}</strong></td>
          <td>
            <strong>${cr.title}</strong>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${cr.justification}</div>
          </td>
          <td>${cr.requested_by}</td>
          <td style="color: #2563eb; font-weight: 600;">+${formatPKR(cr.cost_impact)}</td>
          <td><strong>+${cr.schedule_impact_weeks} Weeks</strong></td>
          <td><span class="badge ${badgeClass}">${cr.status}</span></td>
          <td>${actionBtns}</td>
        </tr>
      `;
    }).join('');
  }

  // 2. Requirements Table
  const reqTbody = document.getElementById('requirementsTableBody');
  if (reqTbody) {
    reqTbody.innerHTML = state.requirements.map(r => {
      let scopeBadge = r.is_baseline ? 'badge-approved' : 'badge-pending';
      let scopeLabel = r.is_baseline ? 'Approved Baseline' : 'Unapproved (CR)';

      return `
        <tr>
          <td><strong>${r.req_code}</strong></td>
          <td>
            <strong>${r.title}</strong>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${r.description || ''}</div>
          </td>
          <td><span class="badge badge-low">${r.module}</span></td>
          <td><strong>${r.priority}</strong></td>
          <td>
            <select class="form-control" style="padding: 3px 6px; font-size: 0.78rem; width: auto;" onchange="updateRequirementStatus(${r.id}, this.value)">
              <option value="Approved" ${r.status === 'Approved' ? 'selected' : ''}>Approved</option>
              <option value="Pending Approval" ${r.status === 'Pending Approval' ? 'selected' : ''}>Pending Approval</option>
              <option value="Rejected" ${r.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
            </select>
          </td>
          <td><span class="badge ${scopeBadge}">${scopeLabel}</span></td>
          <td>
            ${r.status !== 'Approved' ? `
              <button class="btn btn-outline btn-sm" onclick="updateRequirementStatus(${r.id}, 'Approved')">
                <i class="fa-solid fa-check text-success"></i> Baseline
              </button>
            ` : `<i class="fa-solid fa-shield-halved text-success" title="In Baseline"></i>`}
          </td>
        </tr>
      `;
    }).join('');
  }

  // 3. Hierarchical WBS Tree
  const wbsContainer = document.getElementById('wbsContainer');
  if (wbsContainer && wbsData.tree) {
    wbsContainer.innerHTML = `
      <div class="wbs-tree">
        ${wbsData.tree.map(root => `
          <div class="wbs-card wbs-root">
            <div class="wbs-header">
              <div>
                <span class="wbs-code">${root.wbs_code}</span>
                <span class="wbs-title">${root.title}</span>
              </div>
              <span class="badge badge-low">Level 1 Deliverable</span>
            </div>
            <div class="wbs-deliverable"><strong>Deliverable:</strong> ${root.deliverable}</div>

            ${root.children && root.children.length > 0 ? `
              <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px;">
                ${root.children.map(ch => `
                  <div class="wbs-card wbs-child">
                    <div class="wbs-header">
                      <div>
                        <span class="wbs-code" style="background: rgba(8, 145, 178, 0.1); color: var(--secondary);">${ch.wbs_code}</span>
                        <span class="wbs-title">${ch.title}</span>
                      </div>
                      <span class="badge" style="background:#f1f5f9; color:#475569;">Level 2 Work Package</span>
                    </div>
                    <div class="wbs-deliverable"><strong>Deliverable:</strong> ${ch.deliverable}</div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }
}

// CCB Decision Trigger
async function handleCrDecision(crId, decision) {
  try {
    const rationale = prompt(`Enter CCB Decision Rationale for ${decision}:`, `Formally evaluated and ${decision} by Change Control Board`);
    if (rationale === null) return; // User cancelled

    const res = await api(`/api/scope/changes/${crId}/review`, 'PUT', {
      decision,
      rationale
    });

    notify(res.message);
    await updateHeaderAndBadges();
    await loadScope();
  } catch (err) {
    notify('Failed to record CCB decision: ' + err.message, 'danger');
  }
}

async function updateRequirementStatus(reqId, newStatus) {
  try {
    const res = await api(`/api/scope/requirements/${reqId}`, 'PUT', { status: newStatus });
    notify(res.message);
    await updateHeaderAndBadges();
    await loadScope();
  } catch (err) {
    notify('Failed to update requirement: ' + err.message, 'danger');
  }
}

// ==========================================
// 7. MODULE 3: SCHEDULE PRECEDENCE & GANTT
// ==========================================
async function loadSchedule() {
  const data = await api('/api/schedule/analysis');
  if (!data) return;

  state.activities = data.activities || [];
  const currentWeek = data.current_week || 8;
  const deadlineWeeks = data.target_deadline_weeks || 16;

  // 1. Precedence Slippage Warning Box
  const delayBox = document.getElementById('scheduleDelayImpactBox');
  if (delayBox) {
    if (data.dependency_impacts && data.dependency_impacts.length > 0) {
      delayBox.innerHTML = `
        <div class="danger-box">
          <i class="fa-solid fa-triangle-exclamation fa-lg"></i>
          <div>
            <strong>Schedule Dependency Cascade & Delay Propagation Detected:</strong>
            <div style="font-size: 0.85rem; margin-top: 4px;">
              ${data.dependency_impacts.map(imp => `
                <div><i class="fa-solid fa-arrow-right text-danger"></i> <strong>${imp.source_activity} (${imp.source_name})</strong> delay of ${imp.delay_transferred_weeks} week(s) cascades to successor <strong>${imp.impacted_activity} (${imp.impacted_name})</strong>, pushing estimated start to Week ${imp.new_estimated_start}.</div>
              `).join('')}
            </div>
            <div style="margin-top: 6px; font-weight: 700; color: #b91c1c;">
              Projected Finish: Week ${data.projected_finish_week} | Total Baseline Slippage: +${data.total_project_slippage_weeks} Weeks
            </div>
          </div>
        </div>
      `;
    } else {
      delayBox.innerHTML = `
        <div class="info-box">
          <i class="fa-solid fa-circle-check fa-lg text-success"></i>
          <div>All activity precedence sequences and predecessors are in compliance with the schedule baseline.</div>
        </div>
      `;
    }
  }

  // 2. Gantt Timeline Chart
  const ganttContainer = document.getElementById('ganttTimelineContainer');
  if (ganttContainer) {
    const totalWeeks = Math.max(16, data.projected_finish_week || 16);
    let headerCols = '<div class="gantt-header"><div style="text-align: left; padding-left: 8px;">Activity / Task</div>';
    for (let w = 1; w <= totalWeeks; w++) {
      headerCols += `<div ${w === currentWeek ? 'style="color: var(--primary); font-weight:800;"' : ''}>W${w}</div>`;
    }
    headerCols += '</div>';

    let rowsHtml = state.activities.map(act => {
      let barClass = 'gantt-bar';
      if (act.status === 'Completed') barClass += ' completed';
      else if (act.status === 'Delayed' || act.is_delayed) barClass += ' delayed';

      const startCol = Math.max(1, Math.round(act.planned_start_week));
      const endCol = Math.max(startCol + 1, Math.round(act.expected_end_week || act.planned_end_week));
      const dur = Math.max(1, endCol - startCol);

      // Grid position: column 1 is task name, so week w is column (w + 1)
      const colStart = startCol + 1;
      const colSpan = dur;

      return `
        <div class="gantt-row" style="grid-template-columns: 240px repeat(${totalWeeks}, minmax(45px, 1fr));">
          <div class="gantt-task-name" title="${act.name}">
            <span style="font-weight: 700; color: var(--primary);">${act.act_code}</span>: ${act.name}
          </div>
          <div class="gantt-bar-cell" style="grid-column: ${colStart} / span ${colSpan};">
            <div class="${barClass}" style="width: 100%;">
              ${act.progress_pct}% (${act.status})
            </div>
          </div>
        </div>
      `;
    }).join('');

    ganttContainer.innerHTML = headerCols + rowsHtml;
  }

  // 3. Activities Table
  const actTbody = document.getElementById('activitiesTableBody');
  if (actTbody) {
    actTbody.innerHTML = state.activities.map(act => {
      let badgeClass = 'badge-pending';
      if (act.status === 'Completed') badgeClass = 'badge-resolved';
      if (act.status === 'In Progress') badgeClass = 'badge-progress';
      if (act.status === 'Delayed') badgeClass = 'badge-delayed';

      return `
        <tr>
          <td><strong>${act.act_code}</strong></td>
          <td><strong>${act.name}</strong></td>
          <td>${act.assignee_name || '<span style="color:var(--text-light)">Unassigned</span>'}</td>
          <td>${act.planned_duration_weeks} wks</td>
          <td>W${act.planned_start_week} - W${act.planned_end_week}</td>
          <td>${act.predecessors ? `<span class="badge" style="background:#f1f5f9;">${act.predecessors}</span>` : '--'}</td>
          <td>${formatPKR(act.planned_cost)}</td>
          <td style="color: ${act.actual_cost > act.planned_cost ? '#ef4444' : 'inherit'}; font-weight: 600;">
            ${formatPKR(act.actual_cost)}
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div class="progress-bar-bg" style="width: 60px;">
                <div class="progress-bar-fill ${act.progress_pct === 100 ? 'success' : ''}" style="width: ${act.progress_pct}%;"></div>
              </div>
              <span style="font-size: 0.75rem; font-weight: 700;">${act.progress_pct}%</span>
            </div>
          </td>
          <td><span class="badge ${badgeClass}">${act.status}</span></td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="openActivityUpdateModal(${act.id})">
              <i class="fa-solid fa-pen-to-square"></i> Update
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
}

// Open modal to update activity progress and actual costs
function openActivityUpdateModal(actId) {
  const act = state.activities.find(a => a.id === actId);
  if (!act) return;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  setVal('updateActId', act.id);
  setVal('updateActName', `[${act.act_code}] ${act.name}`);
  setVal('updateActProgress', act.progress_pct);
  setVal('updateActActualCost', act.actual_cost);
  setVal('updateActStatus', act.status);

  openModal('modalActivityUpdate');
}

async function handleActivityUpdateSubmit(ev) {
  ev.preventDefault();
  const getVal = id => document.getElementById(id).value;

  const actId = getVal('updateActId');
  const body = {
    progress_pct: Number(getVal('updateActProgress')),
    actual_cost: Number(getVal('updateActActualCost')),
    status: getVal('updateActStatus')
  };

  try {
    const res = await api(`/api/schedule/activities/${actId}`, 'PUT', body);
    notify(res.message);
    closeModal('modalActivityUpdate');
    await updateHeaderAndBadges();
    await loadSchedule();
  } catch (err) {
    notify('Failed to update activity: ' + err.message, 'danger');
  }
}

// ==========================================
// 8. MODULE 4: COST MANAGEMENT & EVM ANALYSIS
// ==========================================
async function loadCost() {
  const data = await api('/api/cost/evm');
  if (!data || !data.evm) return;

  const evm = data.evm;

  // KPI Tiles
  const setEl = (id, text, color = null) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = text;
      if (color) el.style.color = color;
    }
  };

  setEl('evmPV', formatPKR(evm.pv));
  setEl('evmEV', formatPKR(evm.ev));
  setEl('evmAC', formatPKR(evm.ac), '#ef4444');
  setEl('evmBAC', formatPKR(evm.bac));

  setEl('evmCPI', evm.cpi.toFixed(2), evm.cpi < 1.0 ? '#ef4444' : '#10b981');
  setEl('evmSPI', evm.spi.toFixed(2), evm.spi < 1.0 ? '#ef4444' : '#10b981');
  setEl('evmCV', formatPKR(evm.cv), evm.cv < 0 ? '#ef4444' : '#10b981');
  setEl('evmEAC', formatPKR(evm.eac), '#dc2626');

  // EVM Automated Threshold Warnings
  const warnContainer = document.getElementById('evmWarningsContainer');
  if (warnContainer) {
    if (evm.warnings && evm.warnings.length > 0) {
      warnContainer.innerHTML = evm.warnings.map(w => `
        <div class="${w.severity === 'Critical' ? 'danger-box' : 'warning-box'}">
          <i class="fa-solid fa-triangle-exclamation fa-lg"></i>
          <div>
            <strong>${w.type} (${w.metric} = ${w.value}):</strong> ${w.message}
          </div>
        </div>
      `).join('');
    } else {
      warnContainer.innerHTML = `
        <div class="info-box">
          <i class="fa-solid fa-circle-check fa-lg text-success"></i>
          <div>All Earned Value Management metrics are currently within normal baseline operational thresholds.</div>
        </div>
      `;
    }
  }

  // Activity-Level Breakdown Table
  const costTbody = document.getElementById('evmActivityTableBody');
  if (costTbody && evm.activity_breakdown) {
    costTbody.innerHTML = evm.activity_breakdown.map(b => `
      <tr>
        <td><strong>${b.act_code}</strong></td>
        <td><strong>${b.name}</strong></td>
        <td>${formatPKR(b.planned_cost)}</td>
        <td style="color: ${b.actual_cost > b.planned_cost ? '#ef4444' : 'inherit'}; font-weight:600;">
          ${formatPKR(b.actual_cost)}
        </td>
        <td><strong>${b.progress_pct}%</strong></td>
        <td>${formatPKR(b.pv)}</td>
        <td>${formatPKR(b.ev)}</td>
        <td style="color: ${b.cv < 0 ? '#ef4444' : '#10b981'}; font-weight:600;">
          ${formatPKR(b.cv)}
        </td>
        <td>
          <span class="badge ${b.cpi >= 1.0 ? 'badge-approved' : 'badge-rejected'}">
            ${b.cpi.toFixed(2)}
          </span>
        </td>
        <td>
          <span class="badge ${b.spi >= 1.0 ? 'badge-approved' : 'badge-rejected'}">
            ${b.spi.toFixed(2)}
          </span>
        </td>
      </tr>
    `).join('');
  }
}

// ==========================================
// 9. MODULE 5: QUALITY & RISK MANAGEMENT (PDPC)
// ==========================================
async function loadQuality() {
  const [defData, chkData, riskData, pdpcData] = await Promise.all([
    api('/api/quality/defects'),
    api('/api/quality/checklists'),
    api('/api/quality/risks'),
    api('/api/quality/pdpc')
  ]);

  state.defects = defData.defects || [];
  state.checklists = chkData.checklists || [];
  state.risks = riskData.risks || [];
  state.pdpc = pdpcData.pdpc || [];

  // 1. Defect Tracking Table
  const defTbody = document.getElementById('defectsTableBody');
  if (defTbody) {
    defTbody.innerHTML = state.defects.map(d => {
      let sevBadge = 'badge-low';
      if (d.severity === 'Critical') sevBadge = 'badge-critical';
      if (d.severity === 'High') sevBadge = 'badge-high';
      if (d.severity === 'Medium') sevBadge = 'badge-medium';

      return `
        <tr>
          <td><strong>${d.defect_code}</strong></td>
          <td>
            <strong>${d.title}</strong>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${d.description}</div>
            ${d.resolution_notes ? `<div style="font-size: 0.75rem; color: #0284c7; margin-top: 3px;"><i class="fa-solid fa-wrench"></i> ${d.resolution_notes}</div>` : ''}
          </td>
          <td><span class="badge badge-low">${d.module}</span></td>
          <td><span class="badge ${sevBadge}">${d.severity}</span></td>
          <td>${d.assignee_name || 'Unassigned'}</td>
          <td>
            <select class="form-control" style="padding: 3px 6px; font-size: 0.78rem; width: auto;" onchange="updateDefectStatus(${d.id}, this.value)">
              <option value="Open" ${d.status === 'Open' ? 'selected' : ''}>Open</option>
              <option value="In Progress" ${d.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
              <option value="Resolved" ${d.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
              <option value="Closed" ${d.status === 'Closed' ? 'selected' : ''}>Closed</option>
            </select>
          </td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="promptDefectResolution(${d.id})">
              <i class="fa-solid fa-notes-medical"></i> Notes
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 2. Quality Checklists Table
  const chkTbody = document.getElementById('checklistsTableBody');
  if (chkTbody) {
    chkTbody.innerHTML = state.checklists.map(c => {
      let resBadge = 'badge-pending';
      if (c.test_result === 'Pass') resBadge = 'badge-approved';
      if (c.test_result === 'Fail') resBadge = 'badge-rejected';

      return `
        <tr>
          <td><strong>${c.deliverable}</strong></td>
          <td>${c.item_name}</td>
          <td><span style="font-size: 0.8rem; color: var(--text-muted);">${c.standard}</span></td>
          <td><span class="badge ${resBadge}">${c.test_result}</span></td>
          <td>${c.inspected_by || 'Pending QA'}</td>
          <td>
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-success btn-sm" onclick="updateChecklistResult(${c.id}, 'Pass')">Pass</button>
              <button class="btn btn-danger btn-sm" onclick="updateChecklistResult(${c.id}, 'Fail')">Fail</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 3. 5x5 Risk Prioritization Matrix Grid & Table
  const matrixGrid = document.getElementById('riskMatrixGrid');
  if (matrixGrid) {
    // 5x5 Header: Impact (Rows 5 to 1) vs Likelihood (Cols 1 to 5)
    let gridHtml = '<div></div>';
    for (let l = 1; l <= 5; l++) {
      gridHtml += `<div style="font-weight: 700; font-size: 0.75rem; color: var(--text-muted);">L-${l}</div>`;
    }

    for (let imp = 5; imp >= 1; imp--) {
      gridHtml += `<div style="font-weight: 700; font-size: 0.75rem; color: var(--text-muted); display:flex; align-items:center; justify-content:center;">I-${imp}</div>`;
      for (let lh = 1; lh <= 5; lh++) {
        const score = imp * lh;
        let cellClass = 'matrix-green';
        if (score >= 15) cellClass = 'matrix-red';
        else if (score >= 8) cellClass = 'matrix-yellow';

        // Count risks falling in this cell
        const matchingRisks = state.risks.filter(r => r.likelihood === lh && r.impact === imp);
        const count = matchingRisks.length;

        gridHtml += `
          <div class="matrix-cell ${cellClass}" title="${matchingRisks.map(r => r.risk_code).join(', ')}">
            <div>Score: ${score}</div>
            ${count > 0 ? `<div style="font-size: 0.9rem; font-weight: 800; background: rgba(0,0,0,0.1); border-radius: 999px; padding: 1px 6px;">${count} Risk${count > 1 ? 's' : ''}</div>` : ''}
          </div>
        `;
      }
    }
    matrixGrid.innerHTML = gridHtml;
  }

  const riskTbody = document.getElementById('riskTableBody');
  if (riskTbody) {
    riskTbody.innerHTML = state.risks.map(r => `
      <tr>
        <td><strong>${r.risk_code}</strong></td>
        <td>
          <strong>${r.title}</strong>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${r.category}</div>
        </td>
        <td>
          <span class="badge ${r.risk_score >= 15 ? 'badge-critical' : (r.risk_score >= 8 ? 'badge-high' : 'badge-low')}">
            Score ${r.risk_score} (L${r.likelihood}×I${r.impact})
          </span>
        </td>
        <td><strong>${r.response_strategy}</strong></td>
        <td style="font-size: 0.82rem;">${r.mitigation_plan}</td>
      </tr>
    `).join('');
  }

  // 4. Process Decision Program Chart (PDPC) Tree
  const pdpcTree = document.getElementById('pdpcTreeContainer');
  if (pdpcTree) {
    pdpcTree.innerHTML = state.pdpc.map(p => `
      <div class="pdpc-node">
        <div>
          <div class="pdpc-step"><i class="fa-solid fa-code-fork"></i> ${p.process_step}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 3px;">Gate: ${p.decision_node}</div>
        </div>
        <div>
          <div style="font-weight: 600; color: #dc2626;"><i class="fa-solid fa-circle-exclamation"></i> Potential Failure:</div>
          <div style="font-size: 0.82rem; margin-top: 2px;">${p.potential_problem}</div>
        </div>
        <div>
          <div style="font-weight: 600; color: #16a34a;"><i class="fa-solid fa-shield"></i> Preventive: ${p.preventive_action}</div>
          <div style="font-weight: 600; color: #2563eb; margin-top: 4px;"><i class="fa-solid fa-life-ring"></i> Contingency: ${p.contingency_plan}</div>
        </div>
        <div>
          <span class="badge badge-approved">${p.feasibility}</span>
        </div>
      </div>
    `).join('');
  }
}

async function updateDefectStatus(defectId, newStatus) {
  try {
    await api(`/api/quality/defects/${defectId}`, 'PUT', { status: newStatus });
    notify(`Defect status updated to ${newStatus}.`);
    await updateHeaderAndBadges();
    await loadQuality();
  } catch (err) {
    notify('Failed to update defect status: ' + err.message, 'danger');
  }
}

async function promptDefectResolution(defectId) {
  const notes = prompt('Enter Engineering Resolution Notes / Fix Description:');
  if (notes === null) return;
  try {
    await api(`/api/quality/defects/${defectId}`, 'PUT', { resolution_notes: notes });
    notify('Resolution notes appended.');
    await loadQuality();
  } catch (err) {
    notify('Failed to save resolution notes: ' + err.message, 'danger');
  }
}

async function updateChecklistResult(itemId, result) {
  try {
    await api(`/api/quality/checklists/${itemId}`, 'PUT', { test_result: result, inspected_by: 'Engr. Bilal Shabbir (PM)' });
    notify(`Inspection recorded as ${result}.`);
    await loadQuality();
  } catch (err) {
    notify('Failed to update checklist item: ' + err.message, 'danger');
  }
}

// ==========================================
// 10. MODULE 6: FORMAL AUDIT REPORT
// ==========================================
async function loadReports() {
  const [summaryData, charterData, evmData, scheduleData, qualityData] = await Promise.all([
    api('/api/dashboard/summary'),
    api('/api/charter'),
    api('/api/cost/evm'),
    api('/api/schedule/analysis'),
    api('/api/quality/defects')
  ]);

  const reportContainer = document.getElementById('fullReportContent');
  if (!reportContainer) return;

  const s = summaryData.summary;
  const c = charterData.charter;
  const evm = evmData.evm;

  reportContainer.innerHTML = `
    <div style="background: #ffffff; border: 1px solid var(--border); border-radius: 8px; padding: 24px; font-family: inherit;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--primary); padding-bottom: 14px; margin-bottom: 20px;">
        <div>
          <h2 style="color: var(--primary); font-size: 1.4rem;">${c.project_name}</h2>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">Comprehensive Project Management Audit & System Verification (Mid-Term Week 8)</p>
        </div>
        <div style="text-align: right;">
          <span class="badge ${s.project_health.startsWith('RED') ? 'badge-critical' : 'badge-approved'}" style="font-size: 0.9rem; padding: 6px 12px;">
            Status: ${s.project_health}
          </span>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Audited On: ${new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <div class="report-section">
        <h4><i class="fa-solid fa-stamp"></i> 1. Executive Summary & Baselines</h4>
        <div class="grid-4" style="margin-top: 10px;">
          <div><strong>Lifecycle Status:</strong> ${c.status}</div>
          <div><strong>Current Week:</strong> Week ${s.current_week} / ${s.deadline_weeks}</div>
          <div><strong>Approved Budget:</strong> ${formatPKR(s.budget.approved_budget)}</div>
          <div><strong>Overall Progress:</strong> ${s.overall_progress_pct}%</div>
        </div>
      </div>

      <div class="report-section">
        <h4><i class="fa-solid fa-calculator"></i> 2. Programmatic Earned Value Management (EVM) Performance</h4>
        <div class="table-responsive" style="margin-top: 10px;">
          <table class="data-table">
            <thead>
              <tr><th>Metric</th><th>Symbol</th><th>Value</th><th>Baseline Assessment</th></tr>
            </thead>
            <tbody>
              <tr><td>Budget at Completion</td><td>BAC</td><td>${formatPKR(evm.bac)}</td><td>Total Approved Planned Cost Baseline</td></tr>
              <tr><td>Planned Value</td><td>PV</td><td>${formatPKR(evm.pv)}</td><td>Expected expenditure at Week ${s.current_week}</td></tr>
              <tr><td>Earned Value</td><td>EV</td><td>${formatPKR(evm.ev)}</td><td>Value of work completed to date</td></tr>
              <tr><td>Actual Cost Incurred</td><td>AC</td><td class="text-danger">${formatPKR(evm.ac)}</td><td>Actual financial expenditure</td></tr>
              <tr><td>Cost Performance Index</td><td>CPI</td><td><strong style="color: ${evm.cpi < 1 ? '#ef4444' : '#10b981'}">${evm.cpi.toFixed(2)}</strong></td><td>${evm.cpi < 1 ? 'Cost Overrun: earning PKR ' + (evm.cpi * 100).toFixed(0) + ' for every PKR 100 spent' : 'Within Budget'}</td></tr>
              <tr><td>Schedule Performance Index</td><td>SPI</td><td><strong style="color: ${evm.spi < 1 ? '#ef4444' : '#10b981'}">${evm.spi.toFixed(2)}</strong></td><td>${evm.spi < 1 ? 'Schedule Slippage: progress lags baseline schedule' : 'On Schedule'}</td></tr>
              <tr><td>Estimate at Completion</td><td>EAC</td><td style="color:#dc2626; font-weight:700;">${formatPKR(evm.eac)}</td><td>Projected total cost if current CPI continues</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="report-section">
        <h4><i class="fa-solid fa-bug"></i> 3. Quality Assurance & Defect Audit</h4>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">
          Case study compliance: Zero critical defects allowed before 5-hospital network pilot rollout.
        </p>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Defect</th><th>Module</th><th>Severity</th><th>Assignee</th><th>Status</th></tr></thead>
            <tbody>
              ${(qualityData.defects || []).map(d => `
                <tr>
                  <td><strong>${d.defect_code}:</strong> ${d.title}</td>
                  <td>${d.module}</td>
                  <td><span class="badge ${d.severity === 'Critical' ? 'badge-critical' : 'badge-low'}">${d.severity}</span></td>
                  <td>${d.assignee_name || 'Unassigned'}</td>
                  <td><span class="badge ${d.status === 'Resolved' ? 'badge-approved' : 'badge-pending'}">${d.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="report-section">
        <h4><i class="fa-solid fa-flag-checkered"></i> 4. Project Closure & Lessons Learned</h4>
        <div style="background: #f8fafc; border-left: 4px solid var(--primary); padding: 12px 16px; border-radius: 4px; font-size: 0.88rem;">
          <div><strong>Closure Status:</strong> ${c.closure_status || 'Active'}</div>
          <div style="margin-top: 4px;"><strong>Recorded Notes & Lessons Learned:</strong> ${c.closure_notes || 'Project is currently executing Week 8 milestones. Formal closure pending final hospital pilot sign-off.'}</div>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 11. MODAL CONTROLLERS & FORM SUBMIT HANDLERS
// ==========================================
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

// Open Specific Modals
function openCrModal() { openModal('modalCr'); }
function openReqModal() { openModal('modalReq'); }
function openWbsModal() { openModal('modalWbs'); }
function openActivityModal() {
  populateTeamDropdowns();
  openModal('modalActivity');
}
function openDefectModal() {
  populateTeamDropdowns();
  openModal('modalDefect');
}
function openRiskModal() { openModal('modalRisk'); }
function openPdpcModal() { openModal('modalPdpc'); }
function openClosureModal() { openModal('modalClosure'); }

// Close modals when clicking overlay backdrop
window.addEventListener('click', (ev) => {
  if (ev.target.classList.contains('modal-overlay')) {
    ev.target.classList.remove('active');
  }
});

// Form Submissions
async function handleCrSubmit(ev) {
  ev.preventDefault();
  const getVal = id => document.getElementById(id).value;

  const body = {
    cr_number: getVal('crNumber'),
    title: getVal('crTitle'),
    requested_by: getVal('crRequester'),
    justification: getVal('crJustification'),
    cost_impact: Number(getVal('crCostImpact')),
    schedule_impact_weeks: Number(getVal('crScheduleImpact'))
  };

  try {
    const res = await api('/api/scope/changes', 'POST', body);
    notify(res.message);
    document.getElementById('formCr').reset();
    closeModal('modalCr');
    await updateHeaderAndBadges();
    await loadScope();
  } catch (err) {
    notify('Failed to submit change request: ' + err.message, 'danger');
  }
}

async function handleReqSubmit(ev) {
  ev.preventDefault();
  const getVal = id => document.getElementById(id).value;

  const body = {
    req_code: getVal('reqCode'),
    title: getVal('reqTitle'),
    module: getVal('reqModule'),
    priority: getVal('reqPriority'),
    status: getVal('reqStatus'),
    description: getVal('reqDesc')
  };

  try {
    const res = await api('/api/scope/requirements', 'POST', body);
    notify(res.message);
    document.getElementById('formReq').reset();
    closeModal('modalReq');
    await updateHeaderAndBadges();
    await loadScope();
  } catch (err) {
    notify('Failed to add requirement: ' + err.message, 'danger');
  }
}

async function handleWbsSubmit(ev) {
  ev.preventDefault();
  const getVal = id => document.getElementById(id).value;

  const body = {
    wbs_code: getVal('wbsCode'),
    parent_code: getVal('wbsParentCode') || null,
    title: getVal('wbsTitle'),
    deliverable: getVal('wbsDeliverable')
  };

  try {
    const res = await api('/api/scope/wbs', 'POST', body);
    notify(res.message);
    document.getElementById('formWbs').reset();
    closeModal('modalWbs');
    await loadScope();
  } catch (err) {
    notify('Failed to create WBS package: ' + err.message, 'danger');
  }
}

async function handleActivitySubmit(ev) {
  ev.preventDefault();
  const getVal = id => document.getElementById(id).value;

  const body = {
    act_code: getVal('newActCode'),
    wbs_code: getVal('newActWbsCode'),
    name: getVal('newActName'),
    assigned_to: Number(getVal('newActAssignedTo')),
    predecessors: getVal('newActPredecessors'),
    planned_duration_weeks: Number(getVal('newActDuration')),
    planned_start_week: Number(getVal('newActStartWeek')),
    planned_cost: Number(getVal('newActPlannedCost'))
  };

  try {
    const res = await api('/api/schedule/activities', 'POST', body);
    notify(res.message);
    document.getElementById('formActivity').reset();
    closeModal('modalActivity');
    await updateHeaderAndBadges();
    await loadSchedule();
  } catch (err) {
    notify('Failed to schedule activity: ' + err.message, 'danger');
  }
}

async function handleDefectSubmit(ev) {
  ev.preventDefault();
  const getVal = id => document.getElementById(id).value;

  const body = {
    defect_code: getVal('defectCode'),
    title: getVal('defectTitle'),
    module: getVal('defectModule'),
    severity: getVal('defectSeverity'),
    assigned_to: Number(getVal('defectAssignee')),
    description: getVal('defectDesc')
  };

  try {
    const res = await api('/api/quality/defects', 'POST', body);
    notify(res.message);
    document.getElementById('formDefect').reset();
    closeModal('modalDefect');
    await updateHeaderAndBadges();
    await loadQuality();
  } catch (err) {
    notify('Failed to log defect: ' + err.message, 'danger');
  }
}

async function handleRiskSubmit(ev) {
  ev.preventDefault();
  const getVal = id => document.getElementById(id).value;

  const body = {
    risk_code: getVal('riskCode'),
    category: getVal('riskCategory'),
    title: getVal('riskTitle'),
    likelihood: Number(getVal('riskLikelihood')),
    impact: Number(getVal('riskImpact')),
    response_strategy: getVal('riskStrategy'),
    mitigation_plan: getVal('riskMitigationPlan')
  };

  try {
    const res = await api('/api/quality/risks', 'POST', body);
    notify(res.message);
    document.getElementById('formRisk').reset();
    closeModal('modalRisk');
    await loadQuality();
  } catch (err) {
    notify('Failed to register risk: ' + err.message, 'danger');
  }
}

async function handlePdpcSubmit(ev) {
  ev.preventDefault();
  const getVal = id => document.getElementById(id).value;

  const body = {
    process_step: getVal('pdpcStep'),
    potential_problem: getVal('pdpcProblem'),
    preventive_action: getVal('pdpcPreventive'),
    contingency_plan: getVal('pdpcContingency'),
    decision_node: getVal('pdpcDecisionNode'),
    feasibility: getVal('pdpcFeasibility')
  };

  try {
    const res = await api('/api/quality/pdpc', 'POST', body);
    notify(res.message);
    document.getElementById('formPdpc').reset();
    closeModal('modalPdpc');
    await loadQuality();
  } catch (err) {
    notify('Failed to add PDPC item: ' + err.message, 'danger');
  }
}

async function handleClosureSubmit(ev) {
  ev.preventDefault();
  const getVal = id => document.getElementById(id).value;

  const body = {
    status: getVal('closureStatus'),
    closure_notes: getVal('closureNotes')
  };

  try {
    const res = await api('/api/charter/closure', 'POST', body);
    notify(res.message);
    closeModal('modalClosure');
    await updateHeaderAndBadges();
    await loadDashboard();
  } catch (err) {
    notify('Failed to record project closure: ' + err.message, 'danger');
  }
}

// ==========================================
// 12. INITIALIZATION ON BOOT
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await updateHeaderAndBadges();
    await loadDashboard();
  } catch (err) {
    console.error('Initialization error:', err);
  }
});