# HVAC Crawler

A comprehensive hardware/software control system for an HVAC inspection crawler robot. 

This project bridges a **Raspberry Pi 5** backend (which handles camera streaming and hardware communication) with a **desktop Electron App** frontend (which provides a sci-fi inspired dashboard, gamepad mapping, and live video telemetry).

![Crawler Dashboard](src/controller/banana_crawler.png)

## System Architecture

The crawler ecosystem consists of three main components:

1. **Frontend (Electron App)**: Written in Node.js, HTML, and CSS. It connects to the local OS Gamepad API, maps joystick and trigger inputs, and renders a translucent, glassmorphic 2D visualization of the robot's real-time state.
2. **Backend (Raspberry Pi 5)**: Written in Python. It manages a TCP socket server to receive UDP stream configurations and motor/servo coordinates from the frontend. It interfaces directly with an Arducam Mini over SPI (using `libcamera`/`rpicam-vid`).
3. **Hardware Controllers (ESP32)**: The Pi relays UART byte packets to an ESP32, which physically commands 4 individual wheel motors (via motor drivers), a continuous rotation boom hook servo, and an LED headlight array.

## Features
- **Independent 4-Wheel Drive**: Tank-drive telemetry is calculated locally and transmitted flawlessly.
- **Hook Servo Integration**: L2 and R2 analog gamepad triggers map to a proportional PWM crawler boom hook.
- **Low-Latency UDP Video**: Directly pipes the `rpicam-vid` raw MJPEG bitstream over UDP to the Electron `<canvas>`, effectively averting HTTP buffering delays.
- **Greyscale / IR Toggle**: The "X" button gracefully halts the camera pipeline and re-instantiates it with `--saturation 0.0` and `--awb grey` tuning for NoIR nocturnal navigation.
- **Animated 2D Telemetry**: Tread arrows and a hook dial physically animate on the dashboard cascading proportionally based on the joystick speed array.

## Repository Layout
- `/src/pi/`: Contains the Raspberry Pi Python socket server (`server.py`), UART bridge (`motors.py`), and camera subprocess driver (`stream.py`).
- `/src/controller/`: Contains the Electron framework.
  - `main.js`: Bootstraps the Node environment and TCP connection block.
  - `renderer.js`: Executes the Gamepad API polling loop and manipulates the UI Document Object Model (DOM) at 60 FPS.
  - `index.html`: Deep-abyss dark theme markup UI.
- `ESP32_Configuration_Guide.md`: Details the 13-byte UART payload schema required for the ESP32.

## Installation & Usage

### 1. Raspberry Pi Backend
1. Clone this repository to your Pi 5.
2. Enable UART, I2C, and SPI interfaces via `sudo raspi-config`.
3. Set up the Python systemd service (see `/scripts/hvac-crawler.service`).
4. Start the service: `sudo systemctl start hvac-crawler`

### 2. Desktop Frontend (Windows/macOS/Linux)
1. Ensure Node.js and NPM are installed.
2. Open a terminal and navigate to the controller directory: `cd src/controller`
3. Install electron dependencies: `npm install`
4. Launch the dashboard: `npm start`
5. *Note: Ensure your PC is on the same local network subnet as the Raspberry Pi (default IP: 10.250.2.247).*

### 3. ESP32 Payload Configuration
Refer to the `ESP32_Configuration_Guide.md` located in the project root for instructions on compiling your ESP32 Arduino C++ firmware to ingest the Raspberry Pi's `0xAA` start-byte communication protocol.

## License
MIT License
