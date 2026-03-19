# HVAC Crawler - Project Documentation & Web Port Strategy

## 1. Current System Architecture (Electron App)
The current HVAC Crawler ecosystem consists of three highly coupled hardware and software layers designed for low-latency desktop control over a local network:

### A. Hardware Subsystem (ESP32 & Chassis)
The physical crawler chassis is driven by an ESP32 microcontroller acting as a motor driver relay.
- **Actuators**: 4 independent DC motors (Front-Left, Rear-Left, Front-Right, Rear-Right), 1 PWM Feetech Servo (Boom Hook), and an LED Headlight array.
- **Protocol**: The ESP32 communicates with the Raspberry Pi exclusively via USB UART (Serial) at 115200 baud. 
- **Payload Structure**: It continuously expects a strictly formatted 13-byte hexadecimal array constraint: 
  `<0xAA> <FL_Dir> <FL_Spd> <RL_Dir> <RL_Spd> <FR_Dir> <FR_Spd> <RR_Dir> <RR_Spd> <Hook_Dir> <Hook_Spd> <LED_State> <0x55>`

### B. Raspberry Pi 5 Backend (Python Core)
The primary "brain" of the crawler running on a Raspberry Pi 5 under a systemd daemon (`hvac-crawler.service`).
- **`server.py`**: A raw TCP socket server listening on port `5005`. It accepts high-frequency, JSON-formatted steering and setting commands from the remote dashboard.
- **`motors.py`**: A serial driver that parses the JSON commands from the server and instantly packs them into the rigid 13-byte UART payload required by the ESP32.
- **`stream.py`**: Subprocess manager for the Arducam IMX477/NoIR sensor. It spins up the native `rpicam-vid` binary, configured to bypass heavy OS overhead by streaming MJPEG frames directly over a raw UDP pipe to port `5006`. It also intercepts state commands to toggle IR/Grayscale profiles (`--saturation 0.0`) on the fly.

### C. Electron Desktop Dashboard (Frontend UI)
A native desktop application built on Node.js and Chromium.
- **`main.js` & `preload.js`**: The privileged Electron backend. It initializes the raw TCP connection to port `5005` (sending commands) and binds a raw UDP listener on `5006` (awaiting JPEG video frames). It bridges this network traffic into the protected browser window context via safe IPC events.
- **`renderer.js` & `index.html`**: The UI presentation layer. It leverages the browser's native `navigator.getGamepads()` API to poll USB controllers natively. It calculates deadzones and throttle mixes, constructs the JSON drive packets, and drives the realistic HTML/CSS/SVG dashboard animations using speed-proportional CSS properties.

---

## 2. Considerations for a Browser-Based Web Port
Transitioning this crawler from an installed Electron Desktop Application to a pure browser-based web application accessible from any phone, tablet, or PC on the network (e.g., navigating to `http://10.250.2.247/`) is an excellent next step. 

However, it requires an architectural shift to accommodate modern browser security sandboxes.

### The Primary Challenge: Raw Sockets
Electron applications have unfettered access to Node.js hardware and networking libraries (the `net` and `dgram` modules), allowing it to open raw TCP and UDP sockets directly to the Raspberry Pi. Standard web browsers (Chrome, Safari, Firefox), however, **strictly prohibit web pages from opening raw TCP/UDP sockets**. Network communication must be handled through standardized protocols like HTTPS or WebSockets.

### Proposed Web Architecture
To make the dashboard fully browser-native, the Raspberry Pi backend must be expanded to serve as both the hardware controller and the web host:

**1. A Standard HTTP Web Server**
- The Pi must run a lightweight web server (like Python's `Flask`, `FastAPI`, or a basic Node `Express` app) acting as the host. When a device visits the IP address on port 80/8080, the Pi serves the `index.html`, `renderer.js`, and `style.css` files directly to the browser.
- The Electron wrappers (`main.js` and `preload.js`) will simply be deleted.

**2. WebSockets for Telemetry (Replacing TCP)**
- The raw TCP `net`/`socket` setup in `server.py` must be upgraded to a **WebSocket Server** (using Python libraries like `websockets` or `python-socketio`).
- Standard web browsers natively support WebSockets (`new WebSocket('ws://10.250.2.247:5005')`), allowing the JS `renderer.js` to stream the gamepad JSON payload array to the Pi with the same low-latency, bidirectional polling rate we currently achieve with TCP.

**3. Video Stream Delivery (Replacing UDP)**
Because browsers drop raw UDP video packets, the `rpicam-vid` transmission pipeline must be altered:
- **Option A (MJPEG over HTTP)**: The easiest and most universally supported web-video method. Instead of piping to UDP, the Pi uses `mjpg-streamer` or a simple Python stream generator to host the MJPEG stream as a continuous webpage endpoint. The frontend simply uses a native HTML image tag: `<img src="http://10.250.2.247:5006/stream.mjpg">`.
- **Option B (WebRTC)**: Noticeably harder to set up, but provides the absolute lowest latency over varying wireless networks. The Pi would use a library like `aiortc` to negotiate a peer-to-peer WebRTC video tunnel directly into the browser's HTML5 `<video>` element.

**4. The Gamepad API**
- **No changes needed!** The `navigator.getGamepads()` API used in `renderer.js` is an HTML5 standard fully supported in Chrome, Firefox, and Safari on Android/PC. Connecting a Bluetooth or USB controller to a laptop or Android tablet will automatically map the inputs directly into the web app identical to the Electron environment.
