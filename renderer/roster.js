// --- Master List view: every student's name + ID number, bulk add, CSV export ---
// Reuses `state`, `el`, `escapeHtml`, `refresh`, `classNameFor`, `openEditStudentModal`,
// `removeStudentConfirm` from app.js (classic scripts on the same page share one global scope).

const rosterView = el('rosterView');
const rosterSearch = el('rosterSearch');
const rosterTable = el('rosterTable');

function renderRosterTable() {
  const q = rosterSearch.value.trim().toLowerCase();
  let list = [...state.students].sort((a, b) => a.name.localeCompare(b.name));
  if (q) {
    list = list.filter((s) => s.name.toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q));
  }
  if (list.length === 0) {
    rosterTable.innerHTML = '<div class="empty">No students found.</div>';
    return;
  }
  let h = '<table class="simple-table"><tr><th>Name</th><th>ID number</th><th>Class</th><th></th></tr>';
  list.forEach((s) => {
    const className = classNameFor(s.classId);
    h +=
      '<tr><td>' + escapeHtml(s.name) + '</td><td>' + (s.code ? escapeHtml(s.code) : '<span class="hint">—</span>') + '</td><td>' +
      (className ? escapeHtml(className) : '<span class="hint">Unassigned</span>') + '</td>' +
      '<td class="actions-row">' +
      '<button class="btn btn-icon" data-roster-edit="' + s.id + '">Edit</button> ' +
      '<button class="btn btn-icon" data-roster-remove="' + s.id + '">Delete</button>' +
      '</td></tr>';
  });
  h += '</table>';
  rosterTable.innerHTML = h;
}

rosterSearch.addEventListener('input', renderRosterTable);

rosterTable.addEventListener('click', (e) => {
  const editId = e.target.dataset.rosterEdit;
  if (editId) return openEditStudentModal(editId);
  const removeId = e.target.dataset.rosterRemove;
  if (removeId) removeStudentConfirm(removeId);
});

el('rosterExportCsvBtn').addEventListener('click', () => {
  const rows = [['Name', 'ID Number', 'Class']];
  [...state.students]
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((s) => rows.push([s.name, s.code || '', classNameFor(s.classId) || '']));
  const csv = rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'master-student-list.csv';
  a.click();
  URL.revokeObjectURL(url);
});

el('bulkAddBtn').addEventListener('click', async () => {
  const raw = el('bulkRosterCsv').value.trim();
  if (!raw) return;

  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  let added = 0;
  let skipped = 0;
  let unmatchedClass = 0;

  for (const line of lines) {
    const parts = line.split(',').map((p) => p.trim());
    const [name, code, className] = parts;
    if (!name || !code) {
      skipped++;
      continue;
    }
    let classId = null;
    if (className) {
      const match = state.classes.find((c) => c.name.toLowerCase() === className.toLowerCase());
      if (match) classId = match.id;
      else unmatchedClass++;
    }
    try {
      await window.gradebook.addStudent({ name, classId, code });
      added++;
    } catch (err) {
      skipped++;
    }
  }

  el('bulkRosterCsv').value = '';
  await refresh();
  alert(
    added + ' student(s) added' +
    (skipped ? ', ' + skipped + ' skipped (missing name/ID or duplicate ID number)' : '') +
    (unmatchedClass ? ', ' + unmatchedClass + " added without a class match (class name didn't match exactly)" : '') +
    '.'
  );
});
