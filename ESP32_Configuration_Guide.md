# ESP32-S3-WROOM-1 Configuration Guide for HVAC Crawler

This guide outlines the steps to configure and program your ESP32-S3-WROOM-1 microcontroller to receive commands from the Raspberry Pi 5 backend.

## 1. IDE Setup (Espressif Extension)
Since you have the Espressif extension installed in your IDE (VS Code):
1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).
2. Search for and select **ESP-IDF: Show Examples Projects** (if using IDF) or create a new Arduino project if you're using the Arduino Core via the extension.
3. Configure the target:
   * **Target Framework**: ESP32-S3
   * **Flash Mode**: Default (usually QIO or DIO depending on the exact WROOM-1 module layout).
   * **COM Port**: Select the USB port your ESP32-S3 is attached to.

## 2. UART Wiring
The ESP32-S3 needs to receive serial data from the Pi 5.
* **Pi 5 TX (GPIO 14)** -> **ESP32-S3 RX** (Choose a dedicated RX pin, e.g., GPIO 18 or 16 depending on your board's pinout).
* **Pi 5 GND** -> **ESP32-S3 GND** (Critical for establishing a shared signal ground).

*Note: The script currently expects a baud rate of `115200`.*

## 3. The 13-Byte UART Payload Protocol
Your Raspberry Pi 5 backend (`motors.py`) transmits a highly structured **13-byte payload** 60 times a second to control the 4 drive motors, the hook servo, and the global LED state.

Your ESP32 code needs to parse the following byte structure:
1. **[0]** `0xAA` (Start Byte)
2. **[1]** `FL_Dir` (Front-Left Direction: 1 = Forward, 0 = Reverse)
3. **[2]** `FL_Spd` (Front-Left Speed: 0-255)
4. **[3]** `RL_Dir` (Rear-Left Direction: 1 = Forward, 0 = Reverse)
5. **[4]** `RL_Spd` (Rear-Left Speed: 0-255)
6. **[5]** `FR_Dir` (Front-Right Direction: 1 = Forward, 0 = Reverse)
7. **[6]** `FR_Spd` (Front-Right Speed: 0-255)
8. **[7]** `RR_Dir` (Rear-Right Direction: 1 = Forward, 0 = Reverse)
9. **[8]** `RR_Spd` (Rear-Right Speed: 0-255)
10. **[9]** `H_Dir` (Hook Direction: 1 = CW, 0 = CCW)
11. **[10]** `H_Spd` (Hook Speed: 0-255)
12. **[11]** `LED_State` (Headlights: 1 = ON, 0 = OFF)
13. **[12]** `0x55` (End Byte)

## 4. Example ESP32 Parsing Code (Arduino C++)

Here is a foundational C++ snippet you can flash to the ESP32 to receive and decode the 13-byte stream:

```cpp
#define RX_PIN 18 // Adjust based on your wiring
#define TX_PIN 17

// Example Motor Pins (Assign to your actual H-Bridge / ESC pins)
#define LED_PIN 2

uint8_t buffer[13];
int bufferIndex = 0;
bool isReceiving = false;

void setup() {
  // Debug Serial over USB
  Serial.begin(115200);
  
  // Hardware Serial connection to Raspberry Pi
  Serial1.begin(115200, SERIAL_8N1, RX_PIN, TX_PIN);
  
  pinMode(LED_PIN, OUTPUT);
  Serial.println("ESP32-S3 Crawler Controller Ready.");
}

void loop() {
  while (Serial1.available() > 0) {
    uint8_t incomingByte = Serial1.read();
    
    // Look for Start Byte
    if (!isReceiving && incomingByte == 0xAA) {
      isReceiving = true;
      bufferIndex = 0;
      buffer[bufferIndex++] = incomingByte;
    } 
    // If receiving, populate the buffer
    else if (isReceiving) {
      buffer[bufferIndex++] = incomingByte;
      
      // If we reach the expected length of 13 bytes
      if (bufferIndex == 13) {
        isReceiving = false; // Reset for next packet
        
        // Check End Byte for validity
        if (buffer[12] == 0x55) {
          processPacket();
        } else {
          Serial.println("Packet Error: Invalid End Byte");
        }
      }
    }
  }
}

void processPacket() {
  // Extract Data
  uint8_t fl_dir = buffer[1];
  uint8_t fl_spd = buffer[2];
  uint8_t rl_dir = buffer[3];
  uint8_t rl_spd = buffer[4];
  uint8_t fr_dir = buffer[5];
  uint8_t fr_spd = buffer[6];
  uint8_t rr_dir = buffer[7];
  uint8_t rr_spd = buffer[8];
  uint8_t h_dir  = buffer[9];
  uint8_t h_spd  = buffer[10];
  uint8_t led    = buffer[11];

  // Example: Turn on LED if requested
  digitalWrite(LED_PIN, led == 1 ? HIGH : LOW);
  
  // TODO: Send speed and direction to your Motor Drivers (e.g., analogWrite / PWM)
  /*
  if (fl_dir == 1) {
     // Drive Forward
  } else {
     // Drive Reverse
  }
  */
}
```

### Next Steps:
1. Copy the code into your `main.c` or `.ino` file.
2. Map your physical motor driver pins (e.g., L298N, MX1508) in the `TODO` section.
3. Click the **Build** and **Flash** buttons in your Espressif extension toolbar.
