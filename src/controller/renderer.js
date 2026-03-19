const statusDot = document.getElementById('conn-status');
const statusText = document.getElementById('status-text');
const gamepadStatus = document.getElementById('gamepad-status');
const cameraImg = document.getElementById('camera-img');

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

// Gamepad polling loop
let lastLeft = 0;
let lastRight = 0;
window.lastHook = 0;
let irModeActive = false;
let ledsActive = false;

// Track previously pressed state to allow toggle on rise edge
let lastBtnX = false;
let lastBtnY = false;

// UI Toggles
const btnIr = document.getElementById('btn-ir');
if(btnIr) {
    btnIr.addEventListener('click', () => {
        if (!isPiConnected) return;
        irModeActive = !irModeActive;
        btnIr.classList.toggle('active', irModeActive);
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

function updateGamepad() {
    try {
        const gamepads = navigator.getGamepads();
        const gp = gamepads[0]; // Take first connected gamepad
        
        if (gp) {
            gamepadStatus.innerText = gp.id.substring(0, 15) + '...';
            
            const deadzone = 0.1;
        
        let leftSpeed = 0;
        let rightSpeed = 0;
        
        // gp.axes[1] is Left Stick Y, gp.axes[3] is Right Stick Y
        if (Math.abs(gp.axes[1]) > deadzone) {
            leftSpeed = Math.floor(-gp.axes[1] * 255);
        }
        if (Math.abs(gp.axes[3]) > deadzone) {
            rightSpeed = Math.floor(-gp.axes[3] * 255);
        }

        // L2 and R2 triggers for the hook servo
        let hookSpeed = 0;
        let l2 = gp.buttons[6] ? gp.buttons[6].value : 0;
        let r2 = gp.buttons[7] ? gp.buttons[7].value : 0;
        
        if (l2 > deadzone) {
            hookSpeed = Math.floor(-l2 * 255); // CCW
        } else if (r2 > deadzone) {
            hookSpeed = Math.floor(r2 * 255);  // CW
        }

        // --- UPDATE UI TEXT ---
        let lPct = Math.abs(Math.round((leftSpeed / 255) * 100));
        let rPct = Math.abs(Math.round((rightSpeed / 255) * 100));
        let lDir = leftSpeed > 0 ? "FWD " : (leftSpeed < 0 ? "REV " : "");
        let rDir = rightSpeed > 0 ? "FWD " : (rightSpeed < 0 ? "REV " : "");
        
        motorLeftLabel.innerText = lDir + lPct + '%';
        motorRightLabel.innerText = rDir + rPct + '%';
        motorHookLabel.innerText = Math.round((hookSpeed / 255) * 100) + '%';
        
        // --- GAMEPAD VISUALIZATIONS ---
        stickL.style.transform = `translate(${gp.axes[0] * 12}px, ${gp.axes[1] * 12}px)`;
        stickR.style.transform = `translate(${gp.axes[2] * 12}px, ${gp.axes[3] * 12}px)`;
        
        trigL2.style.height = `${l2 * 100}%`;
        trigR2.style.height = `${r2 * 100}%`;
        
        if (l2 > 0) trigL2.classList.add('active'); else trigL2.classList.remove('active');
        if (r2 > 0) trigR2.classList.add('active'); else trigR2.classList.remove('active');

        // D-pad
        if (gp.buttons[12] && gp.buttons[12].pressed) {
            dpadUp.style.background = '#00e5ff'; dpadUp.style.boxShadow = '0 0 10px #00e5ff';
        } else {
            dpadUp.style.background = ''; dpadUp.style.boxShadow = '';
        }
        
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

        if (gp.buttons[15] && gp.buttons[15].pressed) {
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
            if (Math.abs(hookSpeed) > 20) {
                let currentRot = parseFloat(crawlerSvg.style.getPropertyValue('--hook-rotation')) || 0;
                currentRot += hookSpeed * 0.05;
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
        
        lastBtnX = btnXPressed;
        lastBtnY = btnYPressed;
        
        // --- SEND COMMANDS ---
        if (leftSpeed !== lastLeft || rightSpeed !== lastRight || hookSpeed !== window.lastHook) {
            if (isPiConnected) {
                window.crawlerAPI.sendCommand({
                    action: 'drive',
                    front_left: leftSpeed,
                    rear_left: leftSpeed,
                    front_right: rightSpeed,
                    rear_right: rightSpeed,
                    hook_speed: hookSpeed,
                    led_state: ledsActive
                });
            }
            lastLeft = leftSpeed;
            lastRight = rightSpeed;
            window.lastHook = hookSpeed;
        }
        
    } else {
        gamepadStatus.innerText = "Not Detected";
        motorLeftLabel.innerText = "0%";
        motorRightLabel.innerText = "0%";
        motorHookLabel.innerText = "0%";
        
        lastBtnX = false;
        lastBtnY = false;

        stickL.style.transform = `translate(0px, 0px)`;
        stickR.style.transform = `translate(0px, 0px)`;
        trigL2.style.height = `0%`;
        trigR2.style.height = `0%`;
        trigL2.classList.remove('active');
        trigR2.classList.remove('active');
        
        if (lastLeft !== 0 || lastRight !== 0 || window.lastHook !== 0) {
            if (isPiConnected) {
                window.crawlerAPI.sendCommand({
                     action: 'drive', 
                     front_left: 0, 
                     rear_left: 0, 
                     front_right: 0, 
                     rear_right: 0,
                     hook_speed: 0,
                     led_state: ledsActive
                });
            }
            lastLeft = 0;
            lastRight = 0;
            window.lastHook = 0;
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
