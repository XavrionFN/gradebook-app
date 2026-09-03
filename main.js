const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
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
    classes: [],
    checkinLocations: [],
    checkinLogs: [],
    checkinActive: {},
    checkinSettings: { activeCheckinClassId: null }
  }
});

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isSameDay(tsA, tsB) {
  const a = new Date(tsA);
  const b = new Date(tsB);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

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

app.whenReady().then(() => {
  // Only the camera is ever needed (for scan-to-check-in); deny everything else by default.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media');
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');
  createWindow();
}).catch((err) => logFatal('whenReady', err));

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
  classes: store.get('classes'),
  checkinLocations: store.get('checkinLocations'),
  checkinLogs: store.get('checkinLogs'),
  checkinActive: store.get('checkinActive'),
  checkinSettings: store.get('checkinSettings')
}));

ipcMain.handle('student:add', (_e, { name, classId, code }) => {
  const students = store.get('students');
  const trimmedCode = (code || '').trim();
  if (trimmedCode && students.some((s) => (s.code || '').toLowerCase() === trimmedCode.toLowerCase())) {
    throw new Error('That check-in code is already assigned to another student.');
  }
  const student = {
    id: genId('s'),
    name: name.trim(),
    classId: classId || null,
    code: trimmedCode
  };
  students.push(student);
  store.set('students', students);
  return student;
});

ipcMain.handle('student:update', (_e, { studentId, name, classId, code }) => {
  const students = store.get('students');
  const trimmedCode = (code || '').trim();
  if (
    trimmedCode &&
    students.some((s) => s.id !== studentId && (s.code || '').toLowerCase() === trimmedCode.toLowerCase())
  ) {
    throw new Error('That check-in code is already assigned to another student.');
  }
  const student = students.find((s) => s.id === studentId);
  if (student) {
    student.name = name.trim();
    student.classId = classId || null;
    student.code = trimmedCode;
    store.set('students', students);
  }
  return student || null;
});

ipcMain.handle('student:remove', (_e, studentId) => {
  store.set('students', store.get('students').filter((s) => s.id !== studentId));
  store.set('grades', store.get('grades').filter((g) => g.studentId !== studentId));
  const active = store.get('checkinActive');
  delete active[studentId];
  store.set('checkinActive', active);
  return true;
});

ipcMain.handle('class:add', (_e, { name, checkinMode }) => {
  const classes = store.get('classes');
  const cls = { id: genId('c'), name: name.trim(), checkinMode: checkinMode || 'off' };
  classes.push(cls);
  store.set('classes', classes);
  return cls;
});

ipcMain.handle('class:update', (_e, { classId, name, checkinMode }) => {
  const classes = store.get('classes');
  const cls = classes.find((c) => c.id === classId);
  if (cls) {
    cls.name = name.trim();
    cls.checkinMode = checkinMode || 'off';
    store.set('classes', classes);
  }
  return cls || null;
});

ipcMain.handle('class:remove', (_e, classId) => {
  store.set('classes', store.get('classes').filter((c) => c.id !== classId));
  const students = store.get('students');
  students.forEach((s) => {
    if (s.classId === classId) s.classId = null;
  });
  store.set('students', students);
  const settings = store.get('checkinSettings');
  if (settings.activeCheckinClassId === classId) {
    store.set('checkinSettings', { ...settings, activeCheckinClassId: null });
  }
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

// --- Check-in / hallway pass & classroom attendance ---

ipcMain.handle('location:add', (_e, { name, capacity }) => {
  const locations = store.get('checkinLocations');
  const location = { id: genId('loc'), name: name.trim(), capacity: capacity != null ? capacity : null };
  locations.push(location);
  store.set('checkinLocations', locations);
  return location;
});

ipcMain.handle('location:update', (_e, { locationId, name, capacity }) => {
  const locations = store.get('checkinLocations');
  const location = locations.find((l) => l.id === locationId);
  if (location) {
    location.name = name.trim();
    location.capacity = capacity != null ? capacity : null;
    store.set('checkinLocations', locations);
  }
  return location || null;
});

ipcMain.handle('location:remove', (_e, locationId) => {
  store.set('checkinLocations', store.get('checkinLocations').filter((l) => l.id !== locationId));
  const active = store.get('checkinActive');
  Object.keys(active).forEach((sid) => {
    if (active[sid].locationId === locationId) delete active[sid];
  });
  store.set('checkinActive', active);
  return true;
});

ipcMain.handle('checkin:setActiveClass', (_e, classId) => {
  const settings = { activeCheckinClassId: classId || null };
  store.set('checkinSettings', settings);
  return settings;
});

ipcMain.handle('checkin:sendOut', (_e, { studentId, locationId }) => {
  const locations = store.get('checkinLocations');
  const location = locations.find((l) => l.id === locationId);
  if (!location) return { ok: false, reason: 'no_location' };

  const active = store.get('checkinActive');
  if (location.capacity != null) {
    const count = Object.values(active).filter((a) => a.locationId === locationId).length;
    if (count >= location.capacity) return { ok: false, reason: 'full' };
  }

  const students = store.get('students');
  const student = students.find((s) => s.id === studentId);
  if (!student) return { ok: false, reason: 'no_student' };

  active[studentId] = { locationId, outTime: Date.now() };
  store.set('checkinActive', active);

  const logs = store.get('checkinLogs');
  logs.push({ id: genId('log'), studentId, kind: 'out', locationId, timestamp: Date.now(), durationMs: null });
  store.set('checkinLogs', logs);

  return { ok: true, studentName: student.name, locationName: location.name };
});

ipcMain.handle('checkin:scan', (_e, rawCode) => {
  const code = (rawCode || '').trim();
  if (!code) return { type: 'not_found', code };

  const students = store.get('students');
  const student = students.find((s) => (s.code || '').toLowerCase() === code.toLowerCase());
  if (!student) return { type: 'not_found', code };

  const settings = store.get('checkinSettings');
  const activeClassId = settings.activeCheckinClassId;

  if (activeClassId) {
    const classes = store.get('classes');
    const cls = classes.find((c) => c.id === activeClassId);
    if (!cls) {
      store.set('checkinSettings', { activeCheckinClassId: null });
      return { type: 'not_found', code };
    }

    const logs = store.get('checkinLogs');
    const now = Date.now();
    const alreadyToday = logs.some(
      (l) => l.kind === 'classroom' && l.studentId === student.id && l.classId === activeClassId && isSameDay(l.timestamp, now)
    );
    logs.push({ id: genId('log'), studentId: student.id, kind: 'classroom', classId: activeClassId, mode: cls.checkinMode, timestamp: now });
    store.set('checkinLogs', logs);

    let rosterChanged = false;
    if (cls.checkinMode === 'roster' && student.classId !== activeClassId) {
      student.classId = activeClassId;
      store.set('students', students);
      rosterChanged = true;
    }

    return {
      type: 'classroom',
      studentId: student.id,
      studentName: student.name,
      classId: activeClassId,
      className: cls.name,
      mode: cls.checkinMode,
      rosterChanged,
      alreadyToday
    };
  }

  // No active classroom set for this station: fall back to hallway pass tracking.
  const active = store.get('checkinActive');
  const currentlyOut = active[student.id];
  if (currentlyOut) {
    const locations = store.get('checkinLocations');
    const location = locations.find((l) => l.id === currentlyOut.locationId);
    const durationMs = Date.now() - currentlyOut.outTime;

    const logs = store.get('checkinLogs');
    logs.push({ id: genId('log'), studentId: student.id, kind: 'in', locationId: currentlyOut.locationId, timestamp: Date.now(), durationMs });
    store.set('checkinLogs', logs);

    delete active[student.id];
    store.set('checkinActive', active);

    return {
      type: 'returned',
      studentId: student.id,
      studentName: student.name,
      locationName: location ? location.name : 'a location',
      durationMs
    };
  }

  return { type: 'need_destination', studentId: student.id, studentName: student.name };
});
