# TerraTrack-S3 Network Setup Guide

This guide documents the wireless communication infrastructure used to bridge the **TerraTrack-S3 Crawler** (Raspberry Pi 5) and the **Control Station** (operator laptop) through a dedicated wireless network using the **GL.iNet GL-AR300M** travel router and **ALFA AWUS036ACM** WiFi adapter.

---

## 1. Network Topology Overview

```
┌──────────────────────────────┐          ┌──────────────────────────────┐
│   CONTROL STATION (Laptop)   │          │  TERRATRACK-S3 CRAWLER       │
│                              │          │                              │
│   ALFA AWUS036ACM            │          │   Raspberry Pi 5             │
│   USB WiFi Adapter           │          │   Onboard WiFi               │
│   IP: 10.250.2.100           │          │   IP: 10.250.2.247 (Static)  │
│   (DHCP or Static)           │          │                              │
└────────────┬─────────────────┘          └────────────┬─────────────────┘
             │                                         │
             │  ┌──────────────────────────────┐       │
             └──┤  GL.iNet GL-AR300M Router    ├───────┘
                │  (Travel Router / Bridge)     │
                │  SSID: TerraTrack-Net         │
                │  Subnet: 10.250.2.0/24        │
                │  Gateway: 10.250.2.1          │
                └──────────────────────────────┘
```

### Purpose
The GL-AR300M acts as a **dedicated, isolated wireless bridge** between the operator's laptop and the crawler. This keeps the robot's control traffic completely separated from any external networks, reducing latency and eliminating interference from other traffic on shared networks.

---

## 2. Hardware Components

### 2.1 ALFA AWUS036ACM USB WiFi Adapter (Control Station)

| Property | Value |
|---|---|
| **Model** | ALFA AWUS036ACM |
| **Chipset** | MediaTek MT7612U |
| **Bands** | 2.4 GHz (802.11b/g/n) + 5 GHz (802.11ac) |
| **Interface** | USB 3.0 Type-A |
| **Max Speed** | 867 Mbps (5 GHz), 300 Mbps (2.4 GHz) |
| **Antenna** | Dual-band omnidirectional (detachable RP-SMA) |
| **Driver** | Native Windows 10/11 (in-box), Linux `mt76` kernel module |

**Why this adapter?** The AWUS036ACM provides high-gain 5 GHz support and USB 3.0 throughput, critical for the low-latency MJPEG video stream. Its external antenna also helps maintain connection quality when operating the crawler at distance through structures.

### 2.2 GL.iNet GL-AR300M Travel Router

| Property | Value |
|---|---|
| **Model** | GL-AR300M (Mango) |
| **Chipset** | Qualcomm QCA9531 |
| **Band** | 2.4 GHz (802.11b/g/n) |
| **Interface** | 1x WAN, 1x LAN, USB 2.0, microUSB power |
| **Default Admin** | `192.168.8.1` (Factory) |
| **Firmware** | OpenWrt-based (GL.iNet custom) |

> **Note**: The GL-AR300M is 2.4 GHz only. The ALFA adapter connects on 2.4 GHz for this link. If upgrading to 5 GHz-only operation, a GL.iNet Slate AX (GL-AXT1800) or similar dual-band router would be required.

---

## 3. GL-AR300M Router Configuration

### 3.1 Factory Reset (If Needed)
1. Hold the reset button for **10 seconds** while powered on.
2. Wait for the LED to blink rapidly, then release.
3. Connect via Ethernet and navigate to `http://192.168.8.1`.

### 3.2 Initial Setup
1. Set a new admin password.
2. Under **Wireless Settings**:
   - **SSID**: `TerraTrack-Net`
   - **Security**: WPA2-PSK (AES)
   - **Password**: Use a strong, unique passphrase
   - **Channel**: Set a fixed channel (e.g., **6** for 2.4 GHz) to avoid interference from auto-channel scanning
3. Under **LAN Settings** → **LAN IP**:
   - Change the router LAN IP to `10.250.2.1`
   - Subnet Mask: `255.255.255.0`
   
   > ⚠️ After this change, the admin panel will be accessible at `http://10.250.2.1`

### 3.3 DHCP Configuration
1. Navigate to **DHCP Settings** (under LAN or Network):
   - DHCP Range: `10.250.2.50` – `10.250.2.199`
   - Lease Time: 12 hours (default is fine)
2. **Static Lease / IP Reservation**:
   - Reserve `10.250.2.247` for the Raspberry Pi 5 (use the Pi's WiFi MAC address)
   - Optionally reserve `10.250.2.100` for the control station

### 3.4 Operating Mode
- The router should operate in **standalone router mode** (NOT bridge/repeater mode)
- Ensure the WAN port is **disconnected** or the WAN interface is disabled — this router creates a self-contained network, it should not uplink to the internet during operation
- **Firewall**: Keep default settings (all internal traffic is permitted within the `10.250.2.0/24` subnet)

---

## 4. ALFA WiFi Adapter Setup (Control Station)

### 4.1 Driver Installation (Windows 10/11)
The AWUS036ACM uses the MediaTek MT7612U chipset which is supported **natively** by Windows 10/11 in-box drivers:
1. Plug in the adapter via USB 3.0.
2. Windows should auto-install drivers. Verify under **Device Manager → Network adapters** → `MediaTek Wi-Fi 6 MT7921 Wireless LAN Card` or `802.11ac USB NIC`.
3. If drivers are not detected, download the latest from [ALFA Network Support](https://www.alfa.com.tw/downloads).

### 4.2 Connecting to TerraTrack-Net
1. Open **Settings → Network & Internet → Wi-Fi**.
2. Select the `TerraTrack-Net` SSID.
3. Enter the WPA2 passphrase.
4. The adapter should receive an IP via DHCP (e.g., `10.250.2.100`).

### 4.3 Power Management (CRITICAL)
Windows often puts USB WiFi adapters to sleep to save power, causing **connection drops**:
1. Open **Device Manager** → **Network adapters** → right-click the ALFA adapter → **Properties**.
2. Go to the **Power Management** tab → **Uncheck** "Allow the computer to turn off this device to save power".
3. Go to **Advanced** tab → Set **Selective Suspend** to **Disabled** (if available).

### 4.4 Preferred Band (Optional)
If other 2.4 GHz networks are nearby:
1. In **Advanced** adapter properties, set **Preferred Band** to **2.4 GHz Only**.
2. This prevents the adapter from scanning 5 GHz bands and reduces reconnect times.

### 4.5 Verify Connectivity
```powershell
# Verify IP assignment
ipconfig | findstr "10.250.2"

# Ping the crawler
ping 10.250.2.247

# Ping the router gateway
ping 10.250.2.1
```

---

## 5. Raspberry Pi 5 WiFi Configuration

The Raspberry Pi 5 running Raspberry Pi OS (Bookworm) uses **NetworkManager** by default.

### 5.1 Connect to TerraTrack-Net
```bash
# List available SSIDs
sudo nmcli device wifi list

# Connect to the network
sudo nmcli device wifi connect "TerraTrack-Net" password "YOUR_WPA2_PASSPHRASE"
```

### 5.2 Static IP Assignment
The Pi must always be reachable at `10.250.2.247`:
```bash
# Assign static IP to the WiFi connection
sudo nmcli connection modify "TerraTrack-Net" \
    ipv4.method manual \
    ipv4.addresses 10.250.2.247/24 \
    ipv4.gateway 10.250.2.1 \
    ipv4.dns 10.250.2.1

# Restart the connection to apply
sudo nmcli connection down "TerraTrack-Net"
sudo nmcli connection up "TerraTrack-Net"
```

### 5.3 Auto-Connect on Boot
```bash
# Ensure auto-connect is enabled
sudo nmcli connection modify "TerraTrack-Net" connection.autoconnect yes

# Set priority (higher = preferred)
sudo nmcli connection modify "TerraTrack-Net" connection.autoconnect-priority 100
```

### 5.4 Verify
```bash
# Check assigned IP
ip addr show wlan0

# Expected output should include:
# inet 10.250.2.247/24
```

---

## 6. Firewall & Port Requirements

The TerraTrack-S3 system uses the following TCP ports:

| Port | Protocol | Direction | Purpose |
|------|----------|-----------|---------|
| `5005` | TCP | Laptop → Pi | Command channel (drive, toggles, telemetry) |
| `5006` | TCP | Pi → Laptop | Video stream (MJPEG over TCP with length headers) |

### 6.1 Windows Firewall Exceptions
If the Electron app is blocked:
1. Open **Windows Defender Firewall** → **Advanced Settings**.
2. Create **Inbound Rules** allowing TCP on ports `5005` and `5006`.
3. Or when Windows prompts on first launch of the TerraTrack-S3 Dashboard, click **Allow Access** for both private and public networks.

### 6.2 Raspberry Pi Firewall
Raspberry Pi OS (Bookworm Lite) does not enable `ufw` or `iptables` rules by default. If a firewall has been configured:
```bash
sudo ufw allow 5005/tcp
sudo ufw allow 5006/tcp
```

---

## 7. Troubleshooting

### 7.1 Connection Drops / Intermittent Disconnects
| Symptom | Likely Cause | Fix |
|---|---|---|
| ALFA disconnects after idle period | Windows USB power management | Disable selective suspend (Section 4.3) |
| Pi drops off network after 10-15 min | WiFi power saving on Pi | `sudo iw wlan0 set power_save off` |
| Frequent reconnects | Channel interference | Change GL-AR300M to a fixed, less congested channel |

### 7.2 Cannot Reach `10.250.2.247`
1. Verify the Pi is connected: `sudo nmcli connection show --active` on the Pi.
2. Verify the laptop is on the correct network: `ipconfig` should show a `10.250.2.x` address on the ALFA adapter.
3. Check the router admin panel at `http://10.250.2.1` → **Connected Clients** to confirm both devices are visible.

### 7.3 Video Stream Lag or Dropouts
- Ensure the ALFA adapter is plugged into a **USB 3.0 port** (blue port).
- Reduce channel congestion by selecting a less-used 2.4 GHz channel on the GL-AR300M.
- Verify no other application on the laptop is consuming bandwidth on the ALFA adapter.

### 7.4 GL-AR300M Router Not Accessible
- If the admin panel is unreachable at `10.250.2.1`, factory reset (Section 3.1) and reconfigure.
- Ensure you are connecting via WiFi or the LAN port (not WAN).

### 7.5 Pi Not Auto-Connecting on Boot
```bash
# Verify auto-connect is set
nmcli connection show "TerraTrack-Net" | grep autoconnect

# If not, enable it
sudo nmcli connection modify "TerraTrack-Net" connection.autoconnect yes
```

---

## 8. Network Performance Benchmarks

For reference, the following are typical performance characteristics on this setup:

| Metric | Value |
|---|---|
| **Ping Latency** (Laptop → Pi) | 2-8 ms |
| **Command Round-Trip** | ~10-15 ms |
| **Video Stream Bandwidth** | ~2-4 Mbps (640×480 MJPEG @ 20fps) |
| **Effective Range** (Indoor) | ~15-25 meters through 1-2 walls |
| **Effective Range** (Line of Sight) | ~30-50 meters |

---

## 9. Quick Reference Card

```
┌──────────────────────────────────────────────┐
│           TERRATRACK-S3 NETWORK              │
├──────────────────────────────────────────────┤
│  SSID:        TerraTrack-Net                 │
│  Subnet:      10.250.2.0/24                  │
│  Router IP:   10.250.2.1                     │
│  Crawler IP:  10.250.2.247                   │
│  Command Port: 5005 (TCP)                    │
│  Video Port:   5006 (TCP)                    │
│  Router Admin: http://10.250.2.1             │
└──────────────────────────────────────────────┘
```
