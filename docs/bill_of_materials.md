# TerraTrack-S3 Bill of Materials (BOM) & Hardware Integration Guide

This document lists the components, hardware specifications, and wiring diagrams necessary to assemble and configure the **TerraTrack-S3** robotics platform.

---

## 1. Core Component Breakdown

### 1.1 Compute & Perception Node
| Component | Description | Qty | Part Number / Source | Purpose |
|---|---|---|---|---|
| **Raspberry Pi 5** | 4GB or 8GB RAM, 64-bit Arm processor | 1 | Raspberry Pi 5 | High-level gateway, TCP socket server, OpenCV processing, and libcamera stream hosting. |
| **Active Cooler** | Pi 5 aluminum heatsink and PWM fan | 1 | Official Pi Active Cooler | Thermals management during heavy video encoding and AI inference. |
| **Arducam IMX477 Sensor** | 12.3MP High Quality Camera (NoIR) | 1 | Arducam / Sony IMX477 | Low-light perception for internal duct and dark environment inspection. |
| **Coral Edge TPU** | USB AI accelerator (Optional) | 1 | Google Coral USB | Accelerates MobileNet object recognition inference. |
| **MicroSD Card** | 32GB/64GB Class 10 U3 microSD | 1 | SanDisk Extreme | Operating system drive (Raspberry Pi OS Lite 64-bit Bookworm). |

### 1.2 Actuation & Control Node
| Component | Description | Qty | Part Number / Source | Purpose |
|---|---|---|---|---|
| **Waveshare UGV Controller Board** | ESP32-S3-WROOM-1 based controller | 1 | Waveshare UGV Board | Low-level real-time actuation, motor speed loops, and digital outputs. |
| **DDSM400 Motors** | Direct Drive Brushless Servo Motors (Hub Motors) | 4 | Waveshare / DDSM400 | Independent traction control for the 4 tracked wheels. |
| **Feetech Continuous Servo** | High torque continuous rotation servo | 1 | Feetech FT5335M-FB | Proportional crane/hook control for payload lifting. |
| **LED Headlight Array** | 12V high-brightness LED bars | 2 | 12V LED payload pods | Illuminates inspection zones; controlled via ESP32 payload switches. |
| **OLED Display** | 0.96 inch 128x64 I2C display | 1 | SSD1306 Display | Local telemetry readout (IP address, MAC, battery voltage). |

### 1.3 Power Infrastructure
| Component | Description | Qty | Part Number / Source | Purpose |
|---|---|---|---|---|
| **LiPo Battery Pack** | 3S LiPo Battery (11.1V Nominal, 12.6V Max) | 1 | 3S 5000mAh XT60 Pack | Main system power supply. |
| **DC-DC Buck Converter** | 12V to 5V 5A USB-C Step-Down | 1 | 5A Buck regulator | Safe, high-amperage power supply for the Raspberry Pi 5. |
| **INA219 WE Sensor** | I2C High-side current/voltage monitor | 1 | Integrated on UGV board | Real-time battery telemetry monitoring. |

---

## 2. Wiring & Pinout Architecture

The connection diagram below illustrates the routing between the Raspberry Pi 5 gateway and the ESP32-S3 microcontroller node:

```
+------------------------------------+          +------------------------------------+
|          Raspberry Pi 5            |          |       ESP32-S3 (UGV Board)         |
|                                    |          |                                    |
|  GPIO 14 (UART TX)  -------------> | -------->|  GPIO 18 (Serial RX)               |
|  GPIO 15 (UART RX)  <------------- | <--------|  GPIO 17 (Serial TX)               |
|  GPIO 18 (HW PWM)   ----[Servo]    |          |                                    |
|  GND                -------------+ |          |  GND                               |
+----------------------------------|-+          +------------------+-----------------+
                                   |                               |
                                   +--------[ COMMON GND ]---------+
                                                   |
                                            [ Battery GND ]
```

### 2.1 Serial Connection Detail
* **Baud Rate**: 115200 (Default)
* **Logic Levels**: The Raspberry Pi 5 uses 3.3V logic levels. Ensure the ESP32-S3 serial ports are matched to 3.3V (Waveshare UGV boards handle this natively).
* **Common Ground**: A common ground between the Raspberry Pi 5, the ESP32-S3 board, and the battery regulator is **mandatory** to prevent serial signal corruption.

### 2.2 Auxiliary Servo Signal Routing
* **VCC**: Connects to the 5V power output rail of the buck converter or UGV board (continuous servos draw high current under load).
* **GND**: Connects to the common ground plane.
* **Signal (PWM)**: Connects directly to **GPIO 18** on the Raspberry Pi 5. GPIO 18 supports hardware-timed PWM, preventing jitter.

---

## 3. Power Distribution Path

```
                      +-------------------+
                      |   3S LiPo Pack    |
                      |  (11.1V - 12.6V)  |
                      +---------+---------+
                                |
        +-----------------------+-----------------------+
        | (12V Raw Bus)                                 | (12V Raw Bus)
        v                                               v
+-------+-----------------------+               +-------+-----------------------+
|  Waveshare UGV Board          |               | DC-DC Buck Converter          |
|  (ESP32-S3 Core, DDSM Motors) |               | (12V to 5V @ 5A Output)       |
+-------------------------------+               +-------+-----------------------+
                                                        |
                                                        | (5V DC USB-C)
                                                        v
                                                +-------+-----------------------+
                                                | Raspberry Pi 5                |
                                                | (Gatekeeper, Camera Stream)   |
                                                +-------------------------------+
```
