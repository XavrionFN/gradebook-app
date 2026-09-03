const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gradebook', {
  getAll: () => ipcRenderer.invoke('data:getAll'),
  addStudent: (payload) => ipcRenderer.invoke('student:add', payload),
  updateStudent: (payload) => ipcRenderer.invoke('student:update', payload),
  removeStudent: (studentId) => ipcRenderer.invoke('student:remove', studentId),
  addWeek: (week) => ipcRenderer.invoke('week:add', week),
  removeWeek: (weekId) => ipcRenderer.invoke('week:remove', weekId),
  setGrade: (payload) => ipcRenderer.invoke('grade:set', payload),
  addClass: (payload) => ipcRenderer.invoke('class:add', payload),
  updateClass: (payload) => ipcRenderer.invoke('class:update', payload),
  removeClass: (classId) => ipcRenderer.invoke('class:remove', classId),

  addLocation: (payload) => ipcRenderer.invoke('location:add', payload),
  updateLocation: (payload) => ipcRenderer.invoke('location:update', payload),
  removeLocation: (locationId) => ipcRenderer.invoke('location:remove', locationId),
  setActiveCheckinClass: (classId) => ipcRenderer.invoke('checkin:setActiveClass', classId),
  sendOut: (payload) => ipcRenderer.invoke('checkin:sendOut', payload),
  scanCode: (code) => ipcRenderer.invoke('checkin:scan', code)
});
