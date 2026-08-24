let state = { students: [], weeks: [], grades: [] };

const el = (id) => document.getElementById(id);
const bodyRows = el('bodyRows');
const headRow = el('headRow');
const emptyState = el('emptyState');
const tableWrap = el('tableWrap');

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

function render() {
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
  state.students.forEach((s) => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.className = 'student-col';
    nameTd.innerHTML = `
      <div class="row-head">
        <span>${escapeHtml(s.name)}</span>
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

function openModal(title, bodyHtml, confirmLabel, handler) {
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHtml;
  modalConfirm.textContent = confirmLabel;
  onConfirm = handler;
  modalBackdrop.hidden = false;
  const firstInput = modalBody.querySelector('input, textarea');
  if (firstInput) firstInput.focus();
}

function closeModal() {
  modalBackdrop.hidden = true;
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

el('addStudentBtn').addEventListener('click', () => {
  openModal(
    'Add Student',
    `<div class="field">
       <label for="studentName">Student name</label>
       <input type="text" id="studentName" placeholder="e.g. Jordan Lee" />
     </div>`,
    'Add',
    async () => {
      const input = el('studentName');
      const name = input.value.trim();
      if (!name) return input.focus();
      await window.gradebook.addStudent(name);
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

  const removeStudentId = e.target.dataset.removeStudent;
  if (removeStudentId) {
    if (confirm('Remove this student and all their grades?')) {
      window.gradebook.removeStudent(removeStudentId).then(refresh);
    }
  }
});

headRow.addEventListener('click', (e) => {
  const removeWeekId = e.target.dataset.removeWeek;
  if (removeWeekId) {
    if (confirm('Remove this week and all grades entered for it?')) {
      window.gradebook.removeWeek(removeWeekId).then(refresh);
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
}

refresh();
