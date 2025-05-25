// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    login: (credentials) => ipcRenderer.invoke('login', credentials),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    selectEnvFile: () => ipcRenderer.invoke('select-env-file'),
    startRecognition: (params) => ipcRenderer.send('start-recognition', params),
    navigate: (page) => ipcRenderer.send('navigate', page),
    onPythonError: (callback) => ipcRenderer.on('python-error', (_event, value) => callback(value)),
    onRecognitionFinished: (callback) => ipcRenderer.on('recognition-finished', (_event, value) => callback(value)),
    // Remove listener functions if you add many .on listeners
    removeAllPythonErrorListeners: () => ipcRenderer.removeAllListeners('python-error'),
    removeAllRecognitionFinishedListeners: () => ipcRenderer.removeAllListeners('recognition-finished'),
}); 