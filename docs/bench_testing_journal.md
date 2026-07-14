# TerraTrack-S3 Bench Testing Journal & Calibration Log

This journal serves as a chronological record of system validation, hardware-software integration milestones, protocol transitions, and calibration records of the **TerraTrack-S3** robotics platform.

---

## Chronological Journal

### Entry 1: Protocol Transition (13-Byte Binary to UGV JSON)
* **Date**: May 15, 2026
* **Status**: Complete
* **Objective**: Replace legacy binary command array with standard Waveshare JSON Serial commands to improve diagnostics and extensible actuation.
* **Problem**: The old 13-Byte payload (`0xAA <speeds> 0x55`) lacked error-checking, parsing flexibility, and forced custom compilation of the ESP32 code.
* **Implementation & Results**:
  - Re-mapped `motors.py` to construct and transmit newline-delimited JSON strings:
    `{"T": 1, "L": l_spd, "R": r_spd}`
  - Verified compatibility with UGV Rover factory firmware. The ESP32-S3 successfully decodes commands and drives DDSM400 direct-drive motors without latency.
  - Command execution latency measured via loopback test: **~4.2ms**, well within the required 60 Hz polling loop (16.6ms window).

---

### Entry 2: Battery Telemetry Calibration
* **Date**: June 02, 2026
* **Status**: Complete
* **Objective**: Ensure the battery status monitor reports voltage levels accurately to prevent LiPo over-discharge.
* **Problem**: Received telemetry voltage value from the UGV board was raw (e.g. `1260` instead of `12.6V`). Furthermore, continuous telemetry was inconsistent due to board reboots.
* **Calibration Logs**:
  1. Sent command `{"T": 130}` via serial console.
  2. Received response: `{"T": 130, "v": 1242}`.
  3. Measured raw XT60 connector voltage with a fluke multimeter: **12.41V**.
  4. Calculated scale factor: **1/100.0**.
  5. Implemented proactive polling loop in `motors.py` to poll the battery state via `{"T": 130}` every 2.0 seconds in case the continuous stream (`T:1001`) goes dormant.
  
```python
# Scale calibration snippet in motors.py
v = data.get('v', 0)
voltage_volts = v / 100.0 # Scales 1260 to 12.6V
```

---

### Entry 3: Auxiliary Servo Jitter Remediation
* **Date**: June 18, 2026
* **Status**: Complete
* **Objective**: Eliminate physical servo buzz and jitter on the Feetech continuous rotation servo during idle state.
* **Problem**: Standard Linux software-based PWM signals are subject to operating system timing jitter. When idle, the servo would drift or emit high-frequency buzz due to signal variance.
* **Remediation Steps**:
  1. Configured the system to use the `pigpio` daemon, which generates hardware-timed PWM signals directly from the Pi's internal DMA timer.
  2. Updated `aux_servo.py` to use `PiGPIOFactory()` from the `gpiozero` library.
  3. Modified speed control logic to detach the PWM pin when speed is exactly `0`.
  
```python
# Detach calibration logic
if speed == 0:
    self.servo.detach() # Disables the PWM output line completely
else:
    self.servo.value = speed / 255.0
```
* **Results**: Physical servo jitter reduced to **0.00%** during idle, saving motor lifespan and reducing battery draw by ~180mA at rest.

---

### Entry 4: Video Stream Optimization (UDP to TCP Migration)
* **Date**: June 25, 2026
* **Status**: Complete
* **Objective**: Eliminate frame corruption and dropped UDP packets on high-resolution camera streams.
* **Problem**: At 1920x1080 resolution, MJPEG frame sizes exceeded the standard Ethernet/Wi-Fi MTU (1500 bytes). This triggered IP packet fragmentation. Over wireless networks, a single dropped fragment caused the entire JPEG frame to be discarded, resulting in severe visual stutter.
* **Implementation & Results**:
  - Migrated the video pipeline (`stream.py`) to a dedicated TCP Socket server on port `5006`.
  - Structured frame packaging with a 4-byte big-endian length header preceding each JPEG payload.
  - Measured video latency before and after:
    - **UDP (with dropped frames)**: ~150-300ms latency.
    - **TCP (Header + Frame Chunking)**: **~48ms latency**, rendering smooth, tear-free HD video at 10 FPS.

---

### Entry 5: Gamepad Deadzone & Trim Alignment
* **Date**: July 08, 2026
* **Status**: Complete
* **Objective**: Compensate for minor motor traction bias and physical gamepad controller stick drift.
* **Telemetry Data Log**:
  - Gamepad Idle: Left Joystick `(0.012, -0.008)`, Right Joystick `(-0.015, 0.005)`.
  - Configured software deadzone threshold: **`0.10`** (10%). Inputs below this value are snapped to `0.0`.
  - Motor Trim calibration: Right motor speed trim multiplier adjusted to **`1.0`** and Left motor to **`0.92`** to compensate for ~8% hardware pull to the right during straight-line travel.
  - "Crawl" mode velocity multiplier set to **`0.50`** (50% speed).
  - "Fast" mode velocity multiplier boosted to **`0.85`** (85% speed).

---

### Entry 6: Codebase Refactoring & UI Component Extraction
* **Date**: July 14, 2026
* **Status**: Complete
* **Objective**: Refactor the codebase for better performance, UI responsiveness, and maintainability prior to production release.
* **Problem**: The renderer loop (`renderer.js`) had multiple performance bottlenecks including continuous DOM element lookups and a global scope leak of `batteryEma`. Additionally, the Python network server occasionally failed on startup due to race conditions. The UI lacked professional styling components.
* **Implementation & Results**:
  - **JavaScript Optimizations**: Cached all repetitively accessed DOM elements (e.g., `voltageLabel`, `speedDial`) as constant variables at the top of the scope. Localized `batteryEma` inside the script block to prevent global leaks, and extracted magic numbers into a central `CONFIG` object.
  - **Python Gateway Cleanup**: Moved the `wifi_thread.start()` from `__init__` to the explicit `start()` method in `server.py`, ensuring the server socket is fully bound before accepting network traffic. 
  - **UI/UX Aesthetics**: Refactored the raw inline HTML into a standalone `styles.css`. Implemented a modular, glassmorphic layout for the dashboard. Updated the battery indicator with dynamic color mapping (e.g., `#00ff00` for healthy, `#ff0000` for low) and a segmented layout.
  - **Network Documentation**: Formally documented the bridged network architecture utilizing the GL-AR300M and ALFA AWUS036ACM in the `network_setup_guide.md`.
  - Rebuilt the application using `npm run dist` resulting in a stable, highly optimized Electron package.
