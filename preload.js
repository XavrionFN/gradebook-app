const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gradebook', {
  getAll: () => ipcRenderer.invoke('data:getAll'),
  addStudent: (payload) => ipcRenderer.invoke('student:add', payload),
  updateStudent: (payload) => ipcRenderer.invoke('student:update', payload),
  removeStudent: (studentId) => ipcRenderer.invoke('student:remove', studentId),
  addWeek: (week) => ipcRenderer.invoke('week:add', week),
  removeWeek: (weekId) => ipcRenderer.invoke('week:remove', weekId),
  setGrade: (payload) => ipcRenderer.invoke('grade:set', payload),
  addClass: (name) => ipcRenderer.invoke('class:add', name),
  removeClass: (classId) => ipcRenderer.invoke('class:remove', classId)
});
