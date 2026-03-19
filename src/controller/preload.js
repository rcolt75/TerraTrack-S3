const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('crawlerAPI', {
    sendCommand: (command) => ipcRenderer.send('send-command', command),
    onConnectionStatus: (callback) => ipcRenderer.on('connection-status', (event, status) => callback(status)),
    onVideoFrame: (callback) => ipcRenderer.on('video-frame', (event, base64) => callback(base64))
});
