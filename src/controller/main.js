const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const net = require('net');
const dgram = require('dgram');

const PI_IP = '10.250.2.247';
const PI_PORT = 5005;

let mainWindow;
let piSocket = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            // Using contextBridge in preload for security.
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.webContents.on('console-message', (event, ...args) => {
        console.log(`[Renderer]`, ...args);
    });

    // Handle race condition: Send status immediately when UI finishes loading
    mainWindow.webContents.on('did-finish-load', () => {
        if (piSocket && !piSocket.destroyed) {
            if (piSocket.readyState === 'open') {
                mainWindow.webContents.send('connection-status', 'connected');
            } else {
                mainWindow.webContents.send('connection-status', 'disconnected');
            }
        }
    });
}

function connectToPi() {
    if (piSocket) {
        piSocket.destroy();
    }

    console.log(`Attempting connection to ${PI_IP}:${PI_PORT}...`);
    piSocket = new net.Socket();
    
    piSocket.connect(PI_PORT, PI_IP, () => {
        console.log('Connected to Pi backend');
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('connection-status', 'connected');
        }
    });

    piSocket.on('error', (err) => {
        console.error('Socket error:', err.message);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('connection-status', 'error');
        }
    });

    piSocket.on('close', (hadError) => {
        console.log(`Connection closed. hadError: ${hadError}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('connection-status', 'disconnected');
        }
        // Attempt reconnect after delay
        setTimeout(connectToPi, 5000);
    });
}

function startUdpServer() {
    const udpSocket = dgram.createSocket('udp4');
    global.udpSocket = udpSocket; // Expose globally for cleanup on quit
    
    udpSocket.on('error', (err) => {
        console.error(`UDP server error:\n${err.stack}`);
        udpSocket.close();
    });

    udpSocket.on('message', (msg, rinfo) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            // Convert Buffer to base64 to send over IPC to renderer img src
            const base64Img = Buffer.from(msg).toString('base64');
            mainWindow.webContents.send('video-frame', base64Img);
        }
    });

    udpSocket.on('listening', () => {
        const address = udpSocket.address();
        console.log(`UDP Server listening for video on port ${address.port}`);
    });

    udpSocket.bind(5006);
}

app.whenReady().then(() => {
    createWindow();
    connectToPi();
    startUdpServer();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    // Attempt graceful shutdown of sockets when quitting
    if (piSocket) piSocket.destroy();
    if (global.udpSocket) {
        try { global.udpSocket.close(); } catch(e) {}
    }
});

// IPC handler to send commands from Renderer to Socket
ipcMain.on('send-command', (event, commandObj) => {
    if (piSocket && !piSocket.destroyed) {
        try {
            piSocket.write(JSON.stringify(commandObj) + '\n');
        } catch (e) {
            console.error('Error sending command:', e);
        }
    }
});
