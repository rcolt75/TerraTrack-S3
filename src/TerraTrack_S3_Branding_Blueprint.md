# TerraTrack-S3 Branding & Project Blueprint

This document serves as the foundational blueprint for the **TerraTrack-S3** project. It outlines the brand identity, design language, repository structure, and the standard onboarding flow. Its purpose is to ensure that any new developer, engineer, or operator can understand the project's vision and successfully set up the system without external help.

---

## 1. Brand Identity & Vision

*   **Name**: TerraTrack-S3
*   **Tagline**: Modular, Low-Profile Tracked Autonomous Robotics Platform
*   **Target Audience**: Industrial inspectors, HVAC professionals, and robotics researchers.
*   **Tone & Voice**: Professional, technical, robust, and modern.
*   **Core Philosophy**: Decoupled architecture. The system must separate high-level perception (Pi 5) from low-level real-time actuation (ESP32-S3) to ensure stability, safety, and modular extensibility.

---

## 2. Visual Design Language (UI/UX)

The control dashboard is designed for high-stress, low-light environments. The interface must be instantly readable and responsive.

*   **Theme**: Dark Mode (Industrial)
*   **Aesthetics**: **Glassmorphism**. UI elements should feature translucent backgrounds (`rgba`), background blurring (`backdrop-filter: blur`), and subtle borders to create depth without obstructing the underlying camera feed.
*   **Color Palette**:
    *   **Backgrounds**: Deep, translucent blacks and dark grays.
    *   **Accents**: Vibrant, high-contrast colors (e.g., Cyan/Blue for active states, Neon Green for healthy telemetry, Crimson Red for critical alerts).
    *   **Telemetry Indicators**: Non-linear color mapping (e.g., Battery changes from Green > Yellow > Orange > Red based on realistic LiPo discharge curves).
*   **Typography**: Clean, sans-serif fonts (e.g., `Segoe UI`, `Roboto`, or system default sans-serif) with monospace fonts for telemetry numbers to prevent layout shifting.
*   **Animations**: Micro-animations (smooth transitions on hover, pulse effects for active connections) to provide immediate tactile feedback to the operator.

---

## 3. Repository Architecture

To maintain a clean and scalable codebase, the repository is strictly divided by operational domains:

```text
terratrack-s3/
├── docs/                      # 📚 The source of truth for all technical documentation
├── firmware/                  # ⚡ Low-level C++ code for the ESP32-S3 Actuator Node
├── gateway/                   # 🧠 Python source for the Raspberry Pi 5 (Networking/AI)
├── hardware/                  # ⚙️ 3D models, CAD files, and mechanical references
├── ui/                        # 💻 Electron-based operator dashboard (HTML/CSS/JS)
└── package.json               # 📦 Root build scripts
```

---

## 4. Onboarding & Setup Flow (For New Developers)

If you are setting up this project from scratch, follow this exact sequence of documentation. Do not skip steps, as the hardware, network, and software layers are deeply intertwined.

### Step 1: Hardware Assembly
**Document**: `docs/bill_of_materials.md`
*   **Action**: Acquire all listed components. Follow the wiring diagrams to establish the shared ground between the LiPo, Buck Converter, Pi 5, and ESP32. Ensure the serial TX/RX lines are crossed correctly.

### Step 2: Network Infrastructure
**Document**: `docs/network_setup_guide.md`
*   **Action**: Configure the **GL.iNet GL-AR300M** router to create the isolated `10.250.2.0/24` subnet. 
*   **Action**: Assign the static IP `10.250.2.247` to the Raspberry Pi 5.
*   **Action**: Install the ALFA AWUS036ACM adapter on the control PC and **disable Windows USB power management** to prevent connection drops.

### Step 3: Understanding the Protocols
**Document**: `docs/heterogeneous_protocol.md`
*   **Action**: Review how the systems talk to each other. Understand the difference between Tier 1 (TCP over WiFi) and Tier 2 (UART Serial). 
*   **Action**: Note the designated ports: `5005` for Commands/Telemetry, and `5006` for the MJPEG Video Stream.

### Step 4: Software Installation & Deployment
**Document**: `README.md`
*   **Action (Robot)**: Run the setup scripts on the Raspberry Pi 5 to install dependencies and enable the `hvac-crawler.service` systemd daemon so it boots automatically.
*   **Action (PC)**: Install Node.js, run `npm install` in the `ui/` folder, and launch the dashboard.

### Step 5: History & Troubleshooting
**Document**: `docs/bench_testing_journal.md`
*   **Action**: Read through past calibration logs. If you encounter jittering servos, TCP lag, or UI crashes, the solution is likely documented here.

---

## 5. Contribution Guidelines
*   **Documentation First**: Any change to network ports, serial payload structures, or hardware components must be updated in the `docs/` folder *before* code is merged.
*   **Testing**: All motor logic and deadzone changes must be bench-tested with the tracks elevated to prevent runaway scenarios.
