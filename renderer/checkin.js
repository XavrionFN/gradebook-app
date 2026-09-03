// --- Check-In view: classroom-based scan check-in + hallway passes ---
// Reuses `state`, `el`, `escapeHtml`, `openModal`, `closeModal`, `refresh` from app.js
// (classic scripts on the same page share one global scope).

let checkinSubTab = 'scan';
let pendingScanStudentId = null;

const viewSwitch = el('viewSwitch');
const gradebookView = el('gradebookView');
const checkinView = el('checkinView');
const checkinSubTabs = el('checkinSubTabs');
const scanInput = el('scanInput');
const activeClassSelect = el('activeClassSelect');

function ciTodayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function ciFmtDT(ts) {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function ciFmtDur(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return '<1 min';
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  return h + 'h ' + (m % 60) + 'm';
}
function classNameForCheckin(classId) {
  const cls = state.classes.find((c) => c.id === classId);
  return cls ? cls.name : 'Unknown class';
}
function locationNameFor(locationId) {
  const loc = (state.checkinLocations || []).find((l) => l.id === locationId);
  return loc ? loc.name : 'Unknown location';
}

// --- View switching ---

viewSwitch.addEventListener('click', (e) => {
  const view = e.target.dataset.view;
  if (!view) return;
  viewSwitch.querySelectorAll('.view-switch-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  gradebookView.hidden = view !== 'gradebook';
  checkinView.hidden = view !== 'checkin';
  if (view === 'checkin' && checkinSubTab === 'scan') scanInput.focus();
});

checkinSubTabs.addEventListener('click', (e) => {
  const tab = e.target.dataset.checkinTab;
  if (!tab) return;
  checkinSubTab = tab;
  checkinSubTabs.querySelectorAll('.class-tab').forEach((t) => {
    t.classList.toggle('active', t.querySelector('[data-checkin-tab]').dataset.checkinTab === tab);
  });
  document.querySelectorAll('.checkin-panel').forEach((p) => p.classList.remove('active'));
  el('checkin-panel-' + tab).classList.add('active');
  if (tab === 'scan') scanInput.focus();
});

// --- Scan ---

scanInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const code = scanInput.value.trim();
    scanInput.value = '';
    if (code) handleScan(code);
  }
});
window.addEventListener('click', () => {
  if (!checkinView.hidden && checkinSubTab === 'scan' && modalBackdrop.hidden) scanInput.focus();
});

function showScanToast(msg, type) {
  const t = el('scanToast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(showScanToast._timer);
  showScanToast._timer = setTimeout(() => t.classList.remove('show'), 4500);
}

async function handleScan(code) {
  const result = await window.gradebook.scanCode(code);
  if (result.type === 'not_found') {
    showScanToast('No student found for code "' + code + '"', 'err');
    return;
  }
  if (result.type === 'classroom') {
    if (result.mode === 'roster') {
      showScanToast(
        result.studentName + (result.rosterChanged ? ' checked in — added to ' + result.className + '’s roster' : ' checked in to ' + result.className),
        'ok'
      );
    } else {
      showScanToast(result.studentName + ' checked in — attendance logged for ' + result.className, 'ok');
    }
    await refresh();
    return;
  }
  if (result.type === 'returned') {
    showScanToast(result.studentName + ' is back from ' + result.locationName + ' — ' + ciFmtDur(result.durationMs), 'ok');
    await refresh();
    return;
  }
  if (result.type === 'need_destination') {
    openDestModal(result.studentId, result.studentName);
  }
}

function openDestModal(studentId, studentName) {
  pendingScanStudentId = studentId;
  const locations = state.checkinLocations || [];
  let body = '<p class="hint" style="margin-bottom:10px;">' + escapeHtml(studentName) + ' — where are they headed?</p>';
  if (locations.length === 0) {
    body += '<div class="empty">No locations set up yet. Add one in the Check-In &rarr; Locations tab.</div>';
  } else {
    body += '<div id="destOptions">';
    locations.forEach((loc) => {
      const count = Object.values(state.checkinActive || {}).filter((a) => a.locationId === loc.id).length;
      const full = loc.capacity != null && count >= loc.capacity;
      body +=
        '<button class="loc-option" data-dest-location="' + loc.id + '"' + (full ? ' disabled' : '') + '>' +
        '<span>' + escapeHtml(loc.name) + '</span>' +
        '<span class="cap">' + (loc.capacity != null ? count + '/' + loc.capacity + (full ? ' · full' : '') : count + ' out') + '</span>' +
        '</button>';
    });
    body += '</div>';
  }
  openModal('Where is this student going?', body, 'Cancel', null, { hideConfirm: true });
}

modalBody.addEventListener('click', async (e) => {
  const locationId = e.target.closest('[data-dest-location]')?.dataset.destLocation;
  if (!locationId || !pendingScanStudentId) return;
  const result = await window.gradebook.sendOut({ studentId: pendingScanStudentId, locationId });
  if (!result.ok) {
    showScanToast('That location is at capacity right now.', 'err');
    return;
  }
  showScanToast(result.studentName + ' headed to ' + result.locationName, 'info');
  pendingScanStudentId = null;
  closeModal();
  await refresh();
  scanInput.focus();
});

// --- Active check-in classroom selector ---

function populateActiveClassSelect() {
  const cur = state.checkinSettings ? state.checkinSettings.activeCheckinClassId : null;
  const eligible = state.classes.filter((c) => c.checkinMode && c.checkinMode !== 'off');
  const options = ['<option value="">Hallway pass station (bathroom, nurse, office…)</option>'].concat(
    eligible.map(
      (c) =>
        '<option value="' + c.id + '"' + (c.id === cur ? ' selected' : '') + '>' +
        escapeHtml(c.name) + ' — ' + (c.checkinMode === 'roster' ? 'auto-add to roster' : 'attendance only') +
        '</option>'
    )
  );
  activeClassSelect.innerHTML = options.join('');
  activeClassSelect.value = cur || '';

  const hint = el('activeClassHint');
  if (!cur) {
    hint.textContent = 'Scans will offer a destination (bathroom, nurse, etc.) and track time out of class.';
  } else {
    const cls = state.classes.find((c) => c.id === cur);
    hint.textContent =
      cls && cls.checkinMode === 'roster'
        ? 'Every scan here moves the student into ' + cls.name + '’s roster and logs a check-in.'
        : 'Every scan here logs attendance for ' + (cls ? cls.name : '') + ' without changing the student’s roster.';
  }
  el('scanStatusTitle').textContent = cur ? 'Checked in today — ' + (state.classes.find((c) => c.id === cur)?.name || '') : 'Currently out of class';
}

activeClassSelect.addEventListener('change', async () => {
  await window.gradebook.setActiveCheckinClass(activeClassSelect.value || null);
  await refresh();
});

// --- Scan status panel (currently out, or today's classroom check-ins) ---

function renderScanStatus() {
  const el2 = el('scanStatusTable');
  const activeClassId = state.checkinSettings ? state.checkinSettings.activeCheckinClassId : null;

  if (!activeClassId) {
    const entries = Object.entries(state.checkinActive || {});
    if (entries.length === 0) {
      el2.innerHTML = '<div class="empty">Everyone is currently in class.</div>';
      return;
    }
    let h = '<table class="simple-table"><tr><th>Student</th><th>Location</th><th>Out since</th><th>Elapsed</th></tr>';
    entries.forEach(([sid, a]) => {
      const s = state.students.find((x) => x.id === sid);
      h +=
        '<tr><td>' + escapeHtml(s ? s.name : 'Unknown') + '</td><td>' + escapeHtml(locationNameFor(a.locationId)) +
        '</td><td>' + ciFmtDT(a.outTime) + '</td><td>' + ciFmtDur(Date.now() - a.outTime) + '</td></tr>';
    });
    h += '</table>';
    el2.innerHTML = h;
    return;
  }

  const roster = state.students.filter((s) => s.classId === activeClassId);
  const today = ciTodayStr();
  const checkedInIds = new Set(
    (state.checkinLogs || [])
      .filter((l) => l.kind === 'classroom' && l.classId === activeClassId && new Date(l.timestamp).toISOString().slice(0, 10) === today)
      .map((l) => l.studentId)
  );
  if (roster.length === 0) {
    el2.innerHTML = '<div class="empty">No students assigned to this class yet.</div>';
    return;
  }
  let h = '<table class="simple-table"><tr><th>Student</th><th>Status</th></tr>';
  roster.forEach((s) => {
    const present = checkedInIds.has(s.id);
    h +=
      '<tr><td>' + escapeHtml(s.name) + '</td><td>' +
      (present ? '<span class="badge success">Checked in</span>' : '<span class="badge muted">Not yet</span>') +
      '</td></tr>';
  });
  h += '</table>';
  el2.innerHTML = h;
}

// --- Activity tab ---

function renderCheckinStats() {
  const today = ciTodayStr();
  const logs = state.checkinLogs || [];
  const checkinsToday = logs.filter((l) => l.kind === 'classroom' && new Date(l.timestamp).toISOString().slice(0, 10) === today).length;
  el('checkinStatsGrid').innerHTML =
    '<div class="stat"><div class="n">' + Object.keys(state.checkinActive || {}).length + '</div><div class="l">Currently out</div></div>' +
    '<div class="stat"><div class="n">' + checkinsToday + '</div><div class="l">Classroom check-ins today</div></div>' +
    '<div class="stat"><div class="n">' + state.students.length + '</div><div class="l">Students on roster</div></div>' +
    '<div class="stat"><div class="n">' + (state.checkinLocations || []).length + '</div><div class="l">Hallway locations</div></div>';
}

function populateCheckinLogFilter() {
  const sel = el('checkinLogClassFilter');
  const cur = sel.value;
  const classOpts = state.classes
    .filter((c) => c.checkinMode && c.checkinMode !== 'off')
    .map((c) => '<option value="class:' + c.id + '">' + escapeHtml(c.name) + '</option>');
  const locOpts = (state.checkinLocations || []).map((l) => '<option value="loc:' + l.id + '">' + escapeHtml(l.name) + '</option>');
  sel.innerHTML = '<option value="">All classes/locations</option>' + classOpts.join('') + locOpts.join('');
  sel.value = cur;
}

function checkinLogEntryLabel(l) {
  if (l.kind === 'classroom') {
    return (l.mode === 'roster' ? 'Checked in (roster) — ' : 'Checked in (attendance) — ') + classNameForCheckin(l.classId);
  }
  if (l.kind === 'out') return 'Out — ' + locationNameFor(l.locationId);
  return 'Returned — ' + locationNameFor(l.locationId);
}

function checkinLogBadge(l) {
  if (l.kind === 'classroom') return '<span class="badge ' + (l.mode === 'roster' ? 'accent' : 'success') + '">Check-in</span>';
  if (l.kind === 'out') return '<span class="badge warn">Out</span>';
  return '<span class="badge success">Returned</span>';
}

function renderCheckinLog() {
  const el2 = el('checkinLogTable');
  const q = el('checkinLogSearch').value.trim().toLowerCase();
  const filterVal = el('checkinLogClassFilter').value;
  const dateFilter = el('checkinLogDateFilter').value.trim();

  let list = [...(state.checkinLogs || [])].sort((a, b) => b.timestamp - a.timestamp);
  list = list.filter((l) => {
    const s = state.students.find((x) => x.id === l.studentId);
    if (q && !(s && s.name.toLowerCase().includes(q))) return false;
    if (filterVal) {
      const [kind, id] = filterVal.split(':');
      if (kind === 'class' && !(l.kind === 'classroom' && l.classId === id)) return false;
      if (kind === 'loc' && !((l.kind === 'out' || l.kind === 'in') && l.locationId === id)) return false;
    }
    if (dateFilter && new Date(l.timestamp).toISOString().slice(0, 10) !== dateFilter) return false;
    return true;
  }).slice(0, 300);

  if (list.length === 0) {
    el2.innerHTML = '<div class="empty">No matching log entries.</div>';
    return;
  }
  let h = '<table class="simple-table"><tr><th>Student</th><th>Event</th><th>Time</th><th>Duration</th></tr>';
  list.forEach((l) => {
    const s = state.students.find((x) => x.id === l.studentId);
    h +=
      '<tr><td>' + escapeHtml(s ? s.name : 'Unknown') + '</td><td>' + checkinLogBadge(l) + ' ' + escapeHtml(checkinLogEntryLabel(l)) +
      '</td><td>' + ciFmtDT(l.timestamp) + '</td><td>' + (l.durationMs != null ? ciFmtDur(l.durationMs) : '—') + '</td></tr>';
  });
  h += '</table>';
  el2.innerHTML = h;
}

['input'].forEach((evt) => {
  el('checkinLogSearch').addEventListener(evt, renderCheckinLog);
  el('checkinLogDateFilter').addEventListener(evt, renderCheckinLog);
});
el('checkinLogClassFilter').addEventListener('change', renderCheckinLog);

el('checkinExportCsvBtn').addEventListener('click', () => {
  const rows = [['Student', 'Code', 'Event', 'Timestamp', 'Duration (min)']];
  [...(state.checkinLogs || [])].sort((a, b) => a.timestamp - b.timestamp).forEach((l) => {
    const s = state.students.find((x) => x.id === l.studentId);
    rows.push([
      s ? s.name : 'Unknown',
      s ? s.code || '' : '',
      checkinLogEntryLabel(l),
      new Date(l.timestamp).toISOString(),
      l.durationMs != null ? Math.round(l.durationMs / 60000) : ''
    ]);
  });
  const csv = rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'check-in-log.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// --- Locations tab ---

el('addLocationBtn').addEventListener('click', async () => {
  const name = el('locName').value.trim();
  const capRaw = el('locCapacity').value;
  if (!name) return alert('Enter a location name.');
  await window.gradebook.addLocation({ name, capacity: capRaw ? parseInt(capRaw, 10) : null });
  el('locName').value = '';
  el('locCapacity').value = '';
  await refresh();
});

function renderCheckinLocations() {
  const el2 = el('checkinLocationsTable');
  const locations = state.checkinLocations || [];
  if (locations.length === 0) {
    el2.innerHTML = '<div class="empty">No locations yet.</div>';
    return;
  }
  let h = '<table class="simple-table"><tr><th>Name</th><th>Capacity</th><th>Currently there</th><th></th></tr>';
  locations.forEach((loc) => {
    const count = Object.values(state.checkinActive || {}).filter((a) => a.locationId === loc.id).length;
    h +=
      '<tr><td>' + escapeHtml(loc.name) + '</td><td>' + (loc.capacity != null ? loc.capacity : 'Unlimited') + '</td><td>' + count + '</td>' +
      '<td class="actions-row"><button class="btn btn-icon" data-remove-location="' + loc.id + '">Delete</button></td></tr>';
  });
  h += '</table>';
  el2.innerHTML = h;
}

el('checkinLocationsTable').addEventListener('click', async (e) => {
  const locationId = e.target.dataset.removeLocation;
  if (!locationId) return;
  if (!confirm('Delete this location? Students currently marked there will be cleared.')) return;
  await window.gradebook.removeLocation(locationId);
  await refresh();
});

// --- Render all ---

function renderCheckinView() {
  populateActiveClassSelect();
  renderScanStatus();
  renderCheckinStats();
  populateCheckinLogFilter();
  renderCheckinLog();
  renderCheckinLocations();
}

setInterval(() => {
  if (!checkinView.hidden && checkinSubTab === 'scan') renderScanStatus();
}, 10000);
