const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const net = require('net');
const dgram = require('dgram');

const PI_IP = '10.250.2.247';
const PI_PORT = 5005;

let mainWindow;
let piSocket = null;
let piDataBuffer = "";

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
        piSocket.setNoDelay(true);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('connection-status', 'connected');
        }
    });

    piSocket.on('data', (chunk) => {
        piDataBuffer += chunk.toString('utf-8');
        
        let nlIndex;
        while ((nlIndex = piDataBuffer.indexOf('\n')) !== -1) {
            let line = piDataBuffer.substring(0, nlIndex).trim();
            piDataBuffer = piDataBuffer.substring(nlIndex + 1);
            
            if (line.length > 0) {
                try {
                    let parsed = JSON.parse(line);
                    if (parsed.type === 'telemetry') {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('telemetry', parsed.data);
                        }
                    }
                } catch (e) {
                    // Ignore parse errors from generic print statements mapped to serial
                }
            }
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

function startTcpStreamServer() {
    const tcpServer = net.createServer((socket) => {
        console.log('Video TCP Stream connected from Pi');
        let buffer = Buffer.alloc(0);

        socket.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
            
            while (buffer.length >= 4) {
                const len = buffer.readUInt32BE(0);
                
                // If the stream was interrupted, sync markers can become framing headers.
                // Flush the buffer to resync on the next valid TCP chunk.
                if (len < 100 || len > 5000000) {
                    console.log(`[TCP Decoder] Malformed length header detected: ${len} bytes. Corrupted socket buffer! Flushing buffer to force resync.`);
                    buffer = Buffer.alloc(0);
                    break;
                }
                
                if (buffer.length >= 4 + len) {
                    const imgData = buffer.slice(4, 4 + len);
                    buffer = buffer.slice(4 + len);
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        const base64Img = imgData.toString('base64');
                        mainWindow.webContents.send('video-frame', base64Img);
                    }
                } else {
                    break;
                }
            }
        });

        socket.on('error', (err) => {
            console.error('Video Stream TCP Error:', err);
        });
        
        socket.on('close', () => {
            console.log('Video Stream TCP Disconnected');
        });
    });

    global.tcpServer = tcpServer;

    tcpServer.listen(5006, () => {
        console.log('TCP Stream Server listening for high-res video on port 5006');
    });
}

app.whenReady().then(() => {
    createWindow();
    connectToPi();
    startTcpStreamServer();

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
    if (global.tcpServer) {
        try { global.tcpServer.close(); } catch(e) {}
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
