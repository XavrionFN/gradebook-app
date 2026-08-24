const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gradebook', {
  getAll: () => ipcRenderer.invoke('data:getAll'),
  addStudent: (name) => ipcRenderer.invoke('student:add', name),
  removeStudent: (studentId) => ipcRenderer.invoke('student:remove', studentId),
  addWeek: (week) => ipcRenderer.invoke('week:add', week),
  removeWeek: (weekId) => ipcRenderer.invoke('week:remove', weekId),
  setGrade: (payload) => ipcRenderer.invoke('grade:set', payload)
});
