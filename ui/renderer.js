const statusDot = document.getElementById('conn-status');
const statusText = document.getElementById('status-text');
const gamepadStatus = document.getElementById('gamepad-status');
const cameraImg = document.getElementById('camera-img');

// Telemetry DOM
const telemetryBattery = document.getElementById('telemetry-battery');
const batteryFill = document.getElementById('battery-fill');
const telemetryWifi = document.getElementById('telemetry-wifi');
const wifiArcs = [
    document.getElementById('wifi-arc-0'),
    document.getElementById('wifi-arc-1'),
    document.getElementById('wifi-arc-2'),
    document.getElementById('wifi-arc-3')
];

// Sub-components
const motorLeftLabel = document.getElementById('motor-left');
const motorRightLabel = document.getElementById('motor-right');
const motorHookLabel = document.getElementById('motor-hook');

const stickL = document.getElementById('stick-L');
const stickR = document.getElementById('stick-R');
const trigL2 = document.getElementById('trig-l2');
const trigR2 = document.getElementById('trig-r2');

const btnA = document.querySelector('.btn-a');
const btnB = document.querySelector('.btn-b');
const btnX = document.querySelector('.btn-x');
const btnY = document.querySelector('.btn-y');

const dpadUp = document.querySelector('.d-up');
const dpadDown = document.querySelector('.d-down');
const dpadLeft = document.querySelector('.d-left');
const dpadRight = document.querySelector('.d-right');

const crawlerSvg = document.getElementById('crawler-graphic');

// Listen for connection status updates from Main process
let isPiConnected = false;

window.crawlerAPI.onConnectionStatus((status) => {
    isPiConnected = (status === 'connected');
    if (status === 'connected') {
        statusDot.className = 'status-dot status-connected';
        statusText.innerText = 'Connected to Pi (Waiting for stream)';
    } else {
        statusDot.className = 'status-dot';
        statusText.innerText = status === 'error' ? 'Connection Error' : 'Disconnected';
        cameraImg.style.display = 'none';
        document.querySelector('.no-signal').style.display = 'block';
    }
});

// Display incoming UDP JPEG frames
window.crawlerAPI.onVideoFrame((base64Image) => {
    cameraImg.src = `data:image/jpeg;base64,${base64Image}`;
    cameraImg.style.display = 'block';
    document.querySelector('.no-signal').style.display = 'none';
    
    // Update status to reflect streaming
    if (statusText.innerText.includes('Waiting')) {
        statusText.innerText = 'Connected to Pi (Streaming)';
    }
});

// Display incoming TCP telemetry data
window.crawlerAPI.onTelemetry((data) => {
    if (data.battery !== undefined) {
        // Calibration: The Waveshare board has a reverse-polarity protection diode that natively drops ~0.4V to ~0.5V 
        // between the raw battery/power-supply input and what the ESP32's ADC actually measures.
        const VOLTAGE_CALIBRATION_OFFSET = +0.4; 
        
        let rawVoltage = data.battery + VOLTAGE_CALIBRATION_OFFSET;
        
        // Exponential Moving Average (EMA) to smooth out voltage sag when driving motors
        if (window.batteryEma === undefined) {
            window.batteryEma = rawVoltage;
        } else {
            // Alpha of 0.1 provides smooth tracking without jumping instantly
            window.batteryEma = (rawVoltage * 0.1) + (window.batteryEma * 0.9);
        }
        
        let calibratedVoltage = window.batteryEma;
        
        // Highly accurate 3S LiPo non-linear discharge curve under load
        const lipoCurve = [
            { v: 12.6, p: 1.0 },
            { v: 12.2, p: 0.85 },
            { v: 12.0, p: 0.75 },
            { v: 11.8, p: 0.60 },
            { v: 11.6, p: 0.45 },
            { v: 11.4, p: 0.30 },
            { v: 11.2, p: 0.15 },
            { v: 11.0, p: 0.05 },
            { v: 10.8, p: 0.0 }  // Floor at 10.8V to prevent dead-drifting in ducts
        ];

        let pct = 0;
        if (calibratedVoltage >= 12.6) pct = 1.0;
        else if (calibratedVoltage <= 10.8) pct = 0;
        else {
            for (let i = 0; i < lipoCurve.length - 1; i++) {
                if (calibratedVoltage <= lipoCurve[i].v && calibratedVoltage >= lipoCurve[i+1].v) {
                    let v_range = lipoCurve[i].v - lipoCurve[i+1].v;
                    let p_range = lipoCurve[i].p - lipoCurve[i+1].p;
                    let v_ratio = (calibratedVoltage - lipoCurve[i+1].v) / v_range;
                    pct = lipoCurve[i+1].p + (p_range * v_ratio);
                    break;
                }
            }
        }
        
        // Output standard percentage along with precise calibrated voltage
        telemetryBattery.innerText = `${Math.round(pct * 100)}% (${calibratedVoltage.toFixed(2)}V)`;
        
        let maxWidth = 23;
        batteryFill.setAttribute('width', (pct * maxWidth).toFixed(1));
        
        // Color transition logic explicitly updating the fill style
        if (pct <= 0.15) batteryFill.setAttribute('fill', '#ff003c'); // Red critical alert under 11.2V
        else if (pct <= 0.35) batteryFill.setAttribute('fill', '#ffea00'); // Yellow warning under 11.4V
        else batteryFill.setAttribute('fill', '#ff6d00'); // Orange default
    }
    
    if (data.wifi !== undefined) {
        telemetryWifi.innerText = data.wifi + ' dBm';
        // -40 is excellent, -60 is very good, -75 is fair, -85 is poor
        let strength = 0;
        if (data.wifi >= -50) strength = 4;
        else if (data.wifi >= -65) strength = 3;
        else if (data.wifi >= -75) strength = 2;
        else if (data.wifi >= -85) strength = 1;
        else strength = 0; // -90 or less is basically 0 bars
        
        // Apply active arc glows
        wifiArcs.forEach((arc, idx) => {
            if (arc) {
                arc.style.opacity = (idx < strength) ? '1.0' : '0.2';
                // Drop shadow for active arcs
                arc.style.filter = (idx < strength) ? 'drop-shadow(0 0 5px #00e75a)' : 'none';
            }
        });
    }
});

// Gamepad polling loop
let lastLeft = 0;
let lastRight = 0;
window.lastHook = 0;
window.lastAux = 0;
let irModeActive = false;
let ledsActive = false;
let hdrActive = false;
let currentZoom = 1.0;
let currentOptical = 1;
let aiActive = true;
let speedMode = "FAST";

// Track previously pressed state to allow toggle on rise edge
let lastBtnX = false;
let lastBtnY = false;
let lastBtnA = false;
let lastBtnB = false;
let lastBtnRight = false;

let lastSendTime = 0;

// UI Toggles
const btnIr = document.getElementById('btn-ir');
if(btnIr) {
    btnIr.addEventListener('click', () => {
        if (!isPiConnected) return;
        irModeActive = !irModeActive;
        btnIr.classList.toggle('active', irModeActive);
        
        if (irModeActive) {
            cameraImg.style.filter = "grayscale(100%) contrast(150%) brightness(120%)";
        } else {
            cameraImg.style.filter = "none";
        }
        
        window.crawlerAPI.sendCommand({ action: 'toggle_ir', state: irModeActive });
    });
}

const btnLed = document.getElementById('btn-led');
if(btnLed) {
    btnLed.addEventListener('click', () => {
        if (!isPiConnected) return;
        ledsActive = !ledsActive;
        btnLed.classList.toggle('active', ledsActive);
        window.crawlerAPI.sendCommand({
            action: 'drive',
            front_left: lastLeft,
            rear_left: lastLeft,
            front_right: lastRight,
            rear_right: lastRight,
            hook_speed: window.lastHook,
            led_state: ledsActive
        });
    });
}

const btnHdr = document.getElementById('btn-hdr');
if(btnHdr) {
    btnHdr.addEventListener('click', () => {
        if (!isPiConnected) return;
        hdrActive = !hdrActive;
        btnHdr.classList.toggle('active', hdrActive);
        window.crawlerAPI.sendCommand({ action: 'toggle_hdr', state: hdrActive });
    });
}

const btnOptical = document.getElementById('btn-optical');
if(btnOptical) {
    btnOptical.addEventListener('click', () => {
        if (!isPiConnected) return;
        currentOptical *= 2;
        if(currentOptical > 4) currentOptical = 1;
        btnOptical.innerHTML = `OPTICAL ${currentOptical}X<div style="font-size: 10px; color: rgba(255,255,255,0.6); margin-top: 5px; font-weight: normal; letter-spacing: 1px;">[BTN B]</div>`;
        btnOptical.classList.toggle('active', currentOptical > 1);
        window.crawlerAPI.sendCommand({ action: 'set_roi', level: currentOptical });
    });
}

const btnAi = document.getElementById('btn-ai');
if(btnAi) {
    btnAi.addEventListener('click', () => {
        if (!isPiConnected) return;
        aiActive = !aiActive;
        btnAi.classList.toggle('active', aiActive);
        window.crawlerAPI.sendCommand({ action: 'toggle_ai', state: aiActive });
    });
}

const btnZoomIn = document.getElementById('btn-zoom-in');
if(btnZoomIn) {
    btnZoomIn.addEventListener('click', () => { currentZoom = Math.min(currentZoom + 0.5, 4.0); });
}

const btnZoomOut = document.getElementById('btn-zoom-out');
if(btnZoomOut) {
    btnZoomOut.addEventListener('click', () => { currentZoom = Math.max(currentZoom - 0.5, 1.0); });
}

const btnSpeed = document.getElementById('btn-speed');
if(btnSpeed) {
    btnSpeed.addEventListener('click', () => {
        if (!isPiConnected) return;
        if (speedMode === "FAST") {
            speedMode = "CRAWL";
            btnSpeed.innerHTML = `SPEED: CRAWL<div style="font-size: 10px; color: rgba(255,255,255,0.6); margin-top: 5px; font-weight: normal; letter-spacing: 1px;">[BTN D-RIGHT]</div>`;
            btnSpeed.classList.remove('active');
            btnSpeed.style.borderColor = '#00e75a';
            btnSpeed.style.color = '#00e75a';
        } else {
            speedMode = "FAST";
            btnSpeed.innerHTML = `SPEED: FAST<div style="font-size: 10px; color: rgba(255,255,255,0.6); margin-top: 5px; font-weight: normal; letter-spacing: 1px;">[BTN D-RIGHT]</div>`;
            btnSpeed.classList.add('active');
            btnSpeed.style.borderColor = '#ff6d00';
            btnSpeed.style.color = '#ff6d00';
        }
    });
}

function updateGamepad() {
    try {
        const gamepads = navigator.getGamepads();
        const gp = gamepads[0]; // Take first connected gamepad
        
        if (gp) {
            gamepadStatus.innerText = gp.id.substring(0, 15) + '...';
            
            const deadzone = 0.1;
        
        let leftSpeed = 0;
        let rightSpeed = 0;
        
        // Speed Modes: 50% for CRAWL, 85% for FAST
        let speedMultiplier = (speedMode === "CRAWL") ? 0.50 : 0.85;
        
        // Motor Calibration Trim
        // If crawler pulls RIGHT, the LEFT motors are too fast, so we reduce left power.
        const LEFT_TRIM = 0.92; 
        const RIGHT_TRIM = 1.0;
        
        // Helper for cubic acceleration curve
        let applyCurve = (val) => {
            let sign = val < 0 ? -1 : 1;
            let abs = Math.abs(val);
            return sign * (abs * abs * abs) * speedMultiplier;
        };
        
        // gp.axes[1] is Left Stick Y, gp.axes[3] is Right Stick Y
        if (Math.abs(gp.axes[1]) > deadzone) {
            let normalized = -gp.axes[1];
            leftSpeed = Math.round(applyCurve(normalized) * 255 * LEFT_TRIM);
        }
        if (Math.abs(gp.axes[3]) > deadzone) {
            let normalized = -gp.axes[3];
            rightSpeed = Math.round(applyCurve(normalized) * 255 * RIGHT_TRIM);
        }

        // L2 and R2 triggers for the hook servo (now mapped to auxSpeed on Pi GPIO)
        let hookSpeed = 0; // Legacy ESP32 hook speed is now unused, send 0
        let auxSpeed = 0;
        
        let l2 = gp.buttons[6] ? gp.buttons[6].value : 0;
        let r2 = gp.buttons[7] ? gp.buttons[7].value : 0;
        
        if (l2 > 0.1) {
            auxSpeed = -Math.round(l2 * 255);
        } else if (r2 > 0.1) {
            auxSpeed = Math.round(r2 * 255);
        }

        // --- UPDATE UI TEXT ---
        let lPct = Math.abs(Math.round((leftSpeed / 255) * 100));
        let rPct = Math.abs(Math.round((rightSpeed / 255) * 100));
        let lDir = leftSpeed > 0 ? "FWD " : (leftSpeed < 0 ? "REV " : "");
        let rDir = rightSpeed > 0 ? "FWD " : (rightSpeed < 0 ? "REV " : "");
        
        motorLeftLabel.innerText = lDir + lPct + '%';
        motorRightLabel.innerText = rDir + rPct + '%';
        // Hook servo is now on Aux speed
        motorHookLabel.innerText = Math.round((auxSpeed / 255) * 100) + '%';
        
        // --- GAMEPAD VISUALIZATIONS ---
        stickL.style.transform = `translate(${gp.axes[0] * 12}px, ${gp.axes[1] * 12}px)`;
        stickR.style.transform = `translate(${gp.axes[2] * 12}px, ${gp.axes[3] * 12}px)`;
        
        trigL2.style.height = `${l2 * 100}%`;
        trigR2.style.height = `${r2 * 100}%`;
        
        if (l2 > 0) trigL2.classList.add('active'); else trigL2.classList.remove('active');
        if (r2 > 0) trigR2.classList.add('active'); else trigR2.classList.remove('active');

        // D-pad Digital Zoom Vector mapping
        if (gp.buttons[12] && gp.buttons[12].pressed) { // DPAD UP
            dpadUp.style.background = '#00e5ff'; dpadUp.style.boxShadow = '0 0 10px #00e5ff';
            currentZoom = Math.min(currentZoom + 0.05, 4.0);
        } else {
            dpadUp.style.background = ''; dpadUp.style.boxShadow = '';
        }
        if (gp.buttons[13] && gp.buttons[13].pressed) { // DPAD DOWN
            dpadDown.style.background = '#00e5ff'; dpadDown.style.boxShadow = '0 0 10px #00e5ff';
            currentZoom = Math.max(currentZoom - 0.05, 1.0);
        } else {
            dpadDown.style.background = ''; dpadDown.style.boxShadow = '';
        }
        // Apply Hardware CSS transform purely onto the img canvas
        cameraImg.style.transform = `scale(${currentZoom})`;
        
        if (gp.buttons[13] && gp.buttons[13].pressed) {
            dpadDown.style.background = '#00e5ff'; dpadDown.style.boxShadow = '0 0 10px #00e5ff';
        } else {
            dpadDown.style.background = ''; dpadDown.style.boxShadow = '';
        }

        if (gp.buttons[14] && gp.buttons[14].pressed) {
            dpadLeft.style.background = '#00e5ff'; dpadLeft.style.boxShadow = '0 0 10px #00e5ff';
        } else {
            dpadLeft.style.background = ''; dpadLeft.style.boxShadow = '';
        }

        let btnRightPressed = gp.buttons[15] && gp.buttons[15].pressed;
        if (btnRightPressed) {
            dpadRight.style.background = '#00e5ff'; dpadRight.style.boxShadow = '0 0 10px #00e5ff';
        } else {
            dpadRight.style.background = ''; dpadRight.style.boxShadow = '';
        }

        // --- 2D ANIMATIONS ---
        
        if (crawlerSvg) {
            // Calculate animation duration (faster speed = shorter duration)
            // min duration 0.2s, max 2.0s. If speed is 0, freeze animation.
            let calcDur = (speed) => {
                let abs = Math.abs(speed);
                if (abs < 20) return '0s';
                return (2.0 - (abs / 255) * 1.8).toFixed(2) + 's';
            };
            
            let lDur = calcDur(leftSpeed);
            let rDur = calcDur(rightSpeed);
            
            // Map the physical direction visual flip (1 = FWD, -1 = REV)
            // Arrows natively point UP. leftSpeed > 0 is FWD.
            let lFlip = leftSpeed >= 0 ? 1 : -1;
            let rFlip = rightSpeed >= 0 ? 1 : -1;

            crawlerSvg.style.setProperty('--left-speed', lDur);
            crawlerSvg.style.setProperty('--left-flip', lFlip);
            
            crawlerSvg.style.setProperty('--right-speed', rDur);
            crawlerSvg.style.setProperty('--right-flip', rFlip);

            // Hook rotation map: continually sum degrees depending on CW/CCW vector
            if (Math.abs(auxSpeed) > 20) {
                let currentRot = parseFloat(crawlerSvg.style.getPropertyValue('--hook-rotation')) || 0;
                currentRot += auxSpeed * 0.05;
                crawlerSvg.style.setProperty('--hook-rotation', currentRot + 'deg');
            }
        }
        // Action Buttons
        let btnXPressed = gp.buttons[2] && gp.buttons[2].pressed;
        let btnYPressed = gp.buttons[3] && gp.buttons[3].pressed;

        btnY.style.boxShadow = btnYPressed ? '0 0 15px #ff6d00, inset 0 0 10px #ff6d00' : '';
        btnX.style.boxShadow = btnXPressed ? '0 0 15px #00e5ff, inset 0 0 10px #00e5ff' : '';
        btnB.style.boxShadow = (gp.buttons[1] && gp.buttons[1].pressed) ? '0 0 15px #ff4081, inset 0 0 10px #ff4081' : '';
        btnA.style.boxShadow = (gp.buttons[0] && gp.buttons[0].pressed) ? '0 0 15px #00e75a, inset 0 0 10px #00e75a' : '';

        // Handle toggles on button press (not hold)
        if (btnXPressed && !lastBtnX && btnIr) btnIr.click();
        if (btnYPressed && !lastBtnY && btnLed) btnLed.click();
        
        let btnAPressed = gp.buttons[0] && gp.buttons[0].pressed;
        if (btnAPressed && !lastBtnA && btnHdr) btnHdr.click();
        
        let btnBPressed = gp.buttons[1] && gp.buttons[1].pressed;
        if (btnBPressed && !lastBtnB && btnOptical) btnOptical.click();
        
        if (btnRightPressed && !lastBtnRight && btnSpeed) btnSpeed.click();
        
        lastBtnX = btnXPressed;
        lastBtnY = btnYPressed;
        lastBtnA = btnAPressed;
        lastBtnB = btnBPressed;
        lastBtnRight = btnRightPressed;
        
        // --- SEND COMMANDS ---
        let now = performance.now();
        let valueChanged = (leftSpeed !== lastLeft || rightSpeed !== lastRight || hookSpeed !== window.lastHook || auxSpeed !== window.lastAux);
        let shouldSend = valueChanged && (now - lastSendTime > 50);

        // Always send immediately if we are commanding a stop to ensure instant braking
        let isStopCommand = (leftSpeed === 0 && rightSpeed === 0 && hookSpeed === 0 && auxSpeed === 0);
        if (isStopCommand && valueChanged) {
            shouldSend = true;
        }

        if (shouldSend) {
            if (isPiConnected) {
                window.crawlerAPI.sendCommand({
                    action: 'drive',
                    front_left: leftSpeed,
                    rear_left: leftSpeed,
                    front_right: rightSpeed,
                    rear_right: rightSpeed,
                    hook_speed: hookSpeed,
                    aux_speed: auxSpeed,
                    led_state: ledsActive
                });
            }
            lastLeft = leftSpeed;
            lastRight = rightSpeed;
            window.lastHook = hookSpeed;
            window.lastAux = auxSpeed;
            lastSendTime = now;
        }
        
    } else {
        gamepadStatus.innerText = "Not Detected";
        motorLeftLabel.innerText = "0%";
        motorRightLabel.innerText = "0%";
        motorHookLabel.innerText = "0%";
        
        lastBtnX = false;
        lastBtnY = false;
        lastBtnA = false;
        lastBtnB = false;
        lastBtnRight = false;

        stickL.style.transform = `translate(0px, 0px)`;
        stickR.style.transform = `translate(0px, 0px)`;
        trigL2.style.height = `0%`;
        trigR2.style.height = `0%`;
        trigL2.classList.remove('active');
        trigR2.classList.remove('active');
        
        if (lastLeft !== 0 || lastRight !== 0 || window.lastHook !== 0 || window.lastAux !== 0) {
            if (isPiConnected) {
                window.crawlerAPI.sendCommand({
                     action: 'drive', 
                     front_left: 0, 
                     rear_left: 0, 
                     front_right: 0, 
                     rear_right: 0,
                     hook_speed: 0,
                     aux_speed: 0,
                     led_state: ledsActive
                });
            }
            lastLeft = 0;
            lastRight = 0;
            window.lastHook = 0;
            window.lastAux = 0;
        }
    }
    } catch (e) {
        console.error('[Renderer] JS CRASH IN GAMEPAD LOOP:', e);
        let errDiv = document.querySelector('.no-signal');
        if (errDiv) {
            errDiv.style.display = 'block';
            errDiv.style.color = 'red';
            errDiv.style.fontSize = '12px';
            errDiv.innerText = "JS CRASH: " + (e.stack || e);
        }
    }
    
    requestAnimationFrame(updateGamepad);
}

// Keepalive Ping
setInterval(() => {
    if (isPiConnected) {
        window.crawlerAPI.sendCommand({ action: 'ping' });
    }
}, 1000);

// Start loop
updateGamepad();
