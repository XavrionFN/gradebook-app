const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function logFatal(label, err) {
  const message = `${label}: ${err && err.stack ? err.stack : err}`;
  try {
    fs.appendFileSync(
      path.join(app.getPath('userData'), 'main-error.log'),
      `[${new Date().toISOString()}] ${message}\n`
    );
  } catch {
    // best-effort logging only
  }
  dialog.showErrorBox('Weekly Gradebook failed to start', message);
}

process.on('uncaughtException', (err) => logFatal('uncaughtException', err));

// Some Windows machines (older GPU drivers, remote desktop, VMs) crash the
// GPU process and never render a window at all with no visible error.
// Rendering in software avoids that at the cost of GPU acceleration, which
// this app doesn't need.
app.disableHardwareAcceleration();

const Store = require('electron-store');

const store = new Store({
  name: 'gradebook-data',
  defaults: {
    students: [],
    weeks: [],
    grades: [],
    classes: []
  }
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 860,
    minHeight: 560,
    backgroundColor: '#12141a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, description) => {
    logFatal('did-fail-load', new Error(`${description} (${code})`));
  });

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    logFatal('render-process-gone', new Error(details.reason));
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow).catch((err) => logFatal('whenReady', err));

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// --- Data access (all persisted locally via electron-store) ---

ipcMain.handle('data:getAll', () => ({
  students: store.get('students'),
  weeks: store.get('weeks'),
  grades: store.get('grades'),
  classes: store.get('classes')
}));

ipcMain.handle('student:add', (_e, { name, classId }) => {
  const students = store.get('students');
  const student = {
    id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    classId: classId || null
  };
  students.push(student);
  store.set('students', students);
  return student;
});

ipcMain.handle('student:update', (_e, { studentId, name, classId }) => {
  const students = store.get('students');
  const student = students.find((s) => s.id === studentId);
  if (student) {
    student.name = name.trim();
    student.classId = classId || null;
    store.set('students', students);
  }
  return student || null;
});

ipcMain.handle('student:remove', (_e, studentId) => {
  store.set('students', store.get('students').filter((s) => s.id !== studentId));
  store.set('grades', store.get('grades').filter((g) => g.studentId !== studentId));
  return true;
});

ipcMain.handle('class:add', (_e, name) => {
  const classes = store.get('classes');
  const cls = { id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: name.trim() };
  classes.push(cls);
  store.set('classes', classes);
  return cls;
});

ipcMain.handle('class:remove', (_e, classId) => {
  store.set('classes', store.get('classes').filter((c) => c.id !== classId));
  const students = store.get('students');
  students.forEach((s) => {
    if (s.classId === classId) s.classId = null;
  });
  store.set('students', students);
  return true;
});

ipcMain.handle('week:add', (_e, { label, date }) => {
  const weeks = store.get('weeks');
  const week = { id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, label: label.trim(), date };
  weeks.push(week);
  weeks.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  store.set('weeks', weeks);
  return week;
});

ipcMain.handle('week:remove', (_e, weekId) => {
  store.set('weeks', store.get('weeks').filter((w) => w.id !== weekId));
  store.set('grades', store.get('grades').filter((g) => g.weekId !== weekId));
  return true;
});

ipcMain.handle('grade:set', (_e, { studentId, weekId, scores }) => {
  const grades = store.get('grades');
  const existing = grades.find((g) => g.studentId === studentId && g.weekId === weekId);
  if (existing) {
    existing.scores = scores;
  } else {
    grades.push({ studentId, weekId, scores });
  }
  store.set('grades', grades.filter((g) => g.scores.length > 0));
  return true;
});
