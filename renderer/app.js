let state = { students: [], weeks: [], grades: [], classes: [] };
let currentClassFilter = 'all';

const el = (id) => document.getElementById(id);
const bodyRows = el('bodyRows');
const headRow = el('headRow');
const emptyState = el('emptyState');
const tableWrap = el('tableWrap');
const classTabs = el('classTabs');

const modalBackdrop = el('modalBackdrop');
const modalTitle = el('modalTitle');
const modalBody = el('modalBody');
const modalConfirm = el('modalConfirm');
const modalCancel = el('modalCancel');

function average(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function fmtGrade(n) {
  if (n === null) return '';
  return (Math.round(n * 100) / 100).toString();
}

function gradeClass(n) {
  if (n === null) return '';
  if (n >= 90) return 'grade-good';
  if (n >= 75) return 'grade-mid';
  return 'grade-low';
}

function findGrade(studentId, weekId) {
  return state.grades.find((g) => g.studentId === studentId && g.weekId === weekId);
}

function weeklyAverage(studentId, weekId) {
  const g = findGrade(studentId, weekId);
  if (!g || !g.scores.length) return null;
  return average(g.scores);
}

function overallAverage(studentId) {
  const weekAverages = state.weeks
    .map((w) => weeklyAverage(studentId, w.id))
    .filter((v) => v !== null);
  return average(weekAverages);
}

function classNameFor(classId) {
  const cls = state.classes.find((c) => c.id === classId);
  return cls ? cls.name : null;
}

function renderClassTabs() {
  classTabs.hidden = state.classes.length === 0;
  if (state.classes.length === 0) {
    classTabs.innerHTML = '';
    return;
  }

  const countFor = (classId) =>
    state.students.filter((s) => (classId === null ? true : s.classId === classId)).length;

  const tabs = [{ id: 'all', name: 'All Students', removable: false }].concat(
    state.classes.map((c) => ({ id: c.id, name: c.name, removable: true }))
  );

  classTabs.innerHTML = tabs
    .map((t) => {
      const count = t.id === 'all' ? state.students.length : countFor(t.id);
      const active = currentClassFilter === t.id ? ' active' : '';
      const editBtn = t.removable
        ? `<button class="remove-x" data-edit-class="${t.id}" title="Edit class">✎</button>`
        : '';
      const removeBtn = t.removable
        ? `<button class="remove-x" data-remove-class="${t.id}" title="Remove class">✕</button>`
        : '';
      return `
        <span class="class-tab${active}">
          <button class="class-tab-label" data-select-class="${t.id}">${escapeHtml(t.name)} (${count})</button>
          ${editBtn}
          ${removeBtn}
        </span>`;
    })
    .join('');
}

function render() {
  renderClassTabs();

  const visibleStudents = state.students.filter(
    (s) => currentClassFilter === 'all' || s.classId === currentClassFilter
  );

  const hasData = state.students.length > 0 && state.weeks.length > 0;
  emptyState.hidden = hasData;
  tableWrap.hidden = !hasData;

  // Header row
  headRow.innerHTML = '<th class="student-col">Student</th>';
  state.weeks.forEach((w) => {
    const th = document.createElement('th');
    th.innerHTML = `
      <div class="col-head">
        <span>${escapeHtml(w.label)}${w.date ? `<span class="week-date">${escapeHtml(w.date)}</span>` : ''}</span>
        <button class="remove-x" data-remove-week="${w.id}" title="Remove week">✕</button>
      </div>`;
    headRow.appendChild(th);
  });
  const avgTh = document.createElement('th');
  avgTh.className = 'avg-col';
  avgTh.textContent = 'Overall Avg';
  headRow.appendChild(avgTh);

  // Body rows
  bodyRows.innerHTML = '';
  visibleStudents.forEach((s) => {
    const tr = document.createElement('tr');

    const showChip = currentClassFilter === 'all' && classNameFor(s.classId);
    const nameTd = document.createElement('td');
    nameTd.className = 'student-col';
    nameTd.innerHTML = `
      <div class="row-head">
        <span>
          <button class="student-name-btn" data-edit-student="${s.id}">${escapeHtml(s.name)}</button>
          ${showChip ? `<span class="class-chip">${escapeHtml(classNameFor(s.classId))}</span>` : ''}
        </span>
        <button class="remove-x" data-remove-student="${s.id}" title="Remove student">✕</button>
      </div>`;
    tr.appendChild(nameTd);

    state.weeks.forEach((w) => {
      const td = document.createElement('td');
      const g = findGrade(s.id, w.id);
      const avg = weeklyAverage(s.id, w.id);
      const btn = document.createElement('button');
      btn.className = 'cell-btn' + (g && g.scores.length ? ' has-value' : '');
      btn.dataset.studentId = s.id;
      btn.dataset.weekId = w.id;
      if (avg !== null) {
        btn.innerHTML = `<span class="${gradeClass(avg)}">${fmtGrade(avg)}</span><span class="scores-sub">${g.scores.join(', ')}</span>`;
      } else {
        btn.textContent = '+ Add';
      }
      td.appendChild(btn);
      tr.appendChild(td);
    });

    const avgTd = document.createElement('td');
    avgTd.className = 'avg-col';
    const overall = overallAverage(s.id);
    avgTd.innerHTML = overall !== null
      ? `<span class="overall-avg ${gradeClass(overall)}">${fmtGrade(overall)}</span>`
      : '<span style="color:var(--text-dim)">—</span>';
    tr.appendChild(avgTd);

    bodyRows.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Modal helpers ---

let onConfirm = null;

function openModal(title, bodyHtml, confirmLabel, handler, opts = {}) {
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHtml;
  modalConfirm.textContent = confirmLabel;
  modalConfirm.hidden = !!opts.hideConfirm;
  onConfirm = handler;
  modalBackdrop.hidden = false;
  const firstInput = modalBody.querySelector('input, textarea');
  if (firstInput) firstInput.focus();
}

function closeModal() {
  modalBackdrop.hidden = true;
  modalConfirm.hidden = false;
  onConfirm = null;
}

modalCancel.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal();
});
modalConfirm.addEventListener('click', async () => {
  if (onConfirm) await onConfirm();
});

// --- Actions ---

function classOptionsHtml(selectedId) {
  const options = ['<option value="">No class</option>'].concat(
    state.classes.map(
      (c) => `<option value="${c.id}"${c.id === selectedId ? ' selected' : ''}>${escapeHtml(c.name)}</option>`
    )
  );
  return options.join('');
}

function studentFormFields(name = '', classId = '', code = '') {
  return `<div class="field">
       <label for="studentName">Student name</label>
       <input type="text" id="studentName" placeholder="e.g. Jordan Lee" value="${escapeHtml(name)}" />
     </div>
     <div class="field">
       <label for="studentClass">Class</label>
       <select id="studentClass">${classOptionsHtml(classId)}</select>
     </div>
     <div class="field">
       <label for="studentCode">ID number (optional)</label>
       <input type="text" id="studentCode" placeholder="Scan or type student ID / barcode / QR value" value="${escapeHtml(code)}" />
       <p class="hint">Shown on the Master List and used to scan this student in on the Check-In tab.</p>
     </div>`;
}

function checkinModeOptionsHtml(selected) {
  const modes = [
    ['off', 'Off — not used for check-in'],
    ['roster', 'Auto-add to roster on scan'],
    ['attendance', 'Attendance only (roster unchanged)']
  ];
  return modes
    .map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`)
    .join('');
}

function classFormFields(name = '', checkinMode = 'off') {
  return `<div class="field">
       <label for="className">Class name</label>
       <input type="text" id="className" placeholder="e.g. Period 3 - Algebra" value="${escapeHtml(name)}" />
     </div>
     <div class="field">
       <label for="classCheckinMode">Check-in behavior</label>
       <select id="classCheckinMode">${checkinModeOptionsHtml(checkinMode)}</select>
       <p class="hint">Controls what happens when a student scans in while this class is the active check-in station.</p>
     </div>`;
}

el('addStudentBtn').addEventListener('click', () => {
  const preselect = currentClassFilter !== 'all' ? currentClassFilter : '';
  openModal(
    'Add Student',
    studentFormFields('', preselect),
    'Add',
    async () => {
      const input = el('studentName');
      const name = input.value.trim();
      if (!name) return input.focus();
      const classId = el('studentClass').value || null;
      const code = el('studentCode').value.trim();
      try {
        await window.gradebook.addStudent({ name, classId, code });
      } catch (err) {
        return alert(err.message || String(err));
      }
      await refresh();
      closeModal();
    }
  );
});

el('addClassBtn').addEventListener('click', () => {
  openModal(
    'Add Class',
    classFormFields(),
    'Add',
    async () => {
      const input = el('className');
      const name = input.value.trim();
      if (!name) return input.focus();
      const checkinMode = el('classCheckinMode').value;
      await window.gradebook.addClass({ name, checkinMode });
      await refresh();
      closeModal();
    }
  );
});

el('addWeekBtn').addEventListener('click', () => {
  const nextIndex = state.weeks.length + 1;
  openModal(
    'Add Week',
    `<div class="field">
       <label for="weekLabel">Week label</label>
       <input type="text" id="weekLabel" value="Week ${nextIndex}" />
     </div>
     <div class="field">
       <label for="weekDate">Date</label>
       <input type="date" id="weekDate" value="${new Date().toISOString().slice(0, 10)}" />
     </div>`,
    'Add',
    async () => {
      const label = el('weekLabel').value.trim();
      const date = el('weekDate').value;
      if (!label) return el('weekLabel').focus();
      await window.gradebook.addWeek({ label, date });
      await refresh();
      closeModal();
    }
  );
});

bodyRows.addEventListener('click', (e) => {
  const cellBtn = e.target.closest('.cell-btn');
  if (cellBtn) {
    const { studentId, weekId } = cellBtn.dataset;
    const student = state.students.find((s) => s.id === studentId);
    const week = state.weeks.find((w) => w.id === weekId);
    const existing = findGrade(studentId, weekId);
    openModal(
      `${student.name} — ${week.label}`,
      `<div class="field">
         <label for="scoresInput">Grades for this week</label>
         <input type="text" id="scoresInput" placeholder="e.g. 88, 92, 95" value="${existing ? existing.scores.join(', ') : ''}" />
         <p class="hint">Enter one or more scores separated by commas. They'll be averaged into this week's grade.</p>
       </div>`,
      'Save',
      async () => {
        const raw = el('scoresInput').value;
        const scores = raw
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v.length > 0)
          .map(Number)
          .filter((n) => !Number.isNaN(n));
        await window.gradebook.setGrade({ studentId, weekId, scores });
        await refresh();
        closeModal();
      }
    );
    return;
  }

  const editStudentId = e.target.dataset.editStudent;
  if (editStudentId) {
    openEditStudentModal(editStudentId);
    return;
  }

  const removeStudentId = e.target.dataset.removeStudent;
  if (removeStudentId) {
    removeStudentConfirm(removeStudentId);
  }
});

function openEditStudentModal(studentId) {
  const student = state.students.find((s) => s.id === studentId);
  openModal(
    'Edit Student',
    studentFormFields(student.name, student.classId || '', student.code || ''),
    'Save',
    async () => {
      const input = el('studentName');
      const name = input.value.trim();
      if (!name) return input.focus();
      const classId = el('studentClass').value || null;
      const code = el('studentCode').value.trim();
      try {
        await window.gradebook.updateStudent({ studentId, name, classId, code });
      } catch (err) {
        return alert(err.message || String(err));
      }
      await refresh();
      closeModal();
    }
  );
}

function removeStudentConfirm(studentId) {
  if (confirm('Remove this student and all their grades?')) {
    window.gradebook.removeStudent(studentId).then(refresh);
  }
}

headRow.addEventListener('click', (e) => {
  const removeWeekId = e.target.dataset.removeWeek;
  if (removeWeekId) {
    if (confirm('Remove this week and all grades entered for it?')) {
      window.gradebook.removeWeek(removeWeekId).then(refresh);
    }
  }
});

classTabs.addEventListener('click', (e) => {
  const selectId = e.target.dataset.selectClass;
  if (selectId) {
    currentClassFilter = selectId === 'all' ? 'all' : selectId;
    render();
    return;
  }

  const editClassId = e.target.dataset.editClass;
  if (editClassId) {
    const cls = state.classes.find((c) => c.id === editClassId);
    openModal(
      'Edit Class',
      classFormFields(cls.name, cls.checkinMode || 'off'),
      'Save',
      async () => {
        const input = el('className');
        const name = input.value.trim();
        if (!name) return input.focus();
        const checkinMode = el('classCheckinMode').value;
        await window.gradebook.updateClass({ classId: editClassId, name, checkinMode });
        await refresh();
        closeModal();
      }
    );
    return;
  }

  const removeClassId = e.target.dataset.removeClass;
  if (removeClassId) {
    if (confirm('Remove this class? Students in it will become unassigned (not deleted).')) {
      window.gradebook.removeClass(removeClassId).then(() => {
        if (currentClassFilter === removeClassId) currentClassFilter = 'all';
        refresh();
      });
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modalBackdrop.hidden) closeModal();
  if (e.key === 'Enter' && !modalBackdrop.hidden && document.activeElement.tagName !== 'TEXTAREA') {
    modalConfirm.click();
  }
});

async function refresh() {
  state = await window.gradebook.getAll();
  render();
  renderCheckinView();
  renderRosterTable();
}

refresh();
