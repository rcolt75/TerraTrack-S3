import serial
import json
import time
import glob
import threading

def find_serial_port():
    ports = glob.glob('/dev/ttyACM*') + glob.glob('/dev/ttyUSB*')
    return ports[0] if ports else '/dev/serial0'

class MotorController:
    def __init__(self, port=None, baudrate=115200, on_telemetry=None):
        self.on_telemetry = on_telemetry
        if port is None:
            port = find_serial_port()
        try:
            self.ser = serial.Serial(port, baudrate, timeout=1)
            print(f"MotorController initialized on {port} at {baudrate} baud.")
            
            # Start background reader thread (which will init the feedback stream)
            self.read_thread = threading.Thread(target=self._serial_reader, daemon=True)
            self.read_thread.start()
        except Exception as e:
            print(f"Failed to initialize serial port {port}: {e}")
            self.ser = None

        self.last_l_spd = None
        self.last_r_spd = None
        self.last_led_val = None

    def send_json(self, cmd_dict):
        if not self.ser:
            return
        cmd_str = json.dumps(cmd_dict) + "\n"
        try:
            self.ser.write(cmd_str.encode('utf-8'))
            self.ser.flush()
        except Exception as e:
            print(f"Error sending to UART: {e}")

    def _serial_reader(self):
        # The ESP32 tends to reboot or ignore serial inputs during the first 1-2 seconds after UART is connected due to DTR
        time.sleep(2.0)
        self.send_json({"T": 131, "cmd": 1}) # Attempt to enable continuous feedback
        
        last_poll_time = 0
        while self.ser and self.ser.is_open:
            try:
                # Robustly poll battery telemetry every 2 seconds in case continuous feedback is disabled
                if time.time() - last_poll_time > 2.0:
                    self.send_json({"T": 130})
                    last_poll_time = time.time()
                
                if self.ser.in_waiting:
                    line = self.ser.readline()
                    if line:
                        decoded = line.decode('utf-8', errors='ignore').strip()
                        if decoded.startswith('{') and decoded.endswith('}'):
                            data = json.loads(decoded)
                            # Handle both T:1001 (continuous) and T:130 (polled) battery responses
                            if (data.get('T') == 1001 or data.get('T') == 130) and ('v' in data or 'V' in data):
                                v = data.get('v', data.get('V', 0))
                                if self.on_telemetry:
                                    # ESP32 voltage is usually sent multiplied by 100 (e.g. 1260 for 12.6V)
                                    self.on_telemetry({'battery': v / 100.0 if v > 100 else v})
            except Exception:
                pass
            time.sleep(0.01)

    def send_command(self, front_left, rear_left, front_right, rear_right, hook_speed=0, led_state=False):
        """
        Send motor speeds to ESP32 over UART using the native Waveshare UGV JSON protocol.
        """
        if not self.ser:
            return

        # The hardware likely expects integers from -255 to 255, not floats.
        # Floats like 1.0 were being interpreted as 1/255th power!
        l_spd = int(max(-255, min(255, (front_left + rear_left) / 2.0)))
        r_spd = int(max(-255, min(255, (front_right + rear_right) / 2.0)))
        
        if self.last_l_spd != l_spd or self.last_r_spd != r_spd:
            self.send_json({"T": 1, "L": l_spd, "R": r_spd})
            self.last_l_spd = l_spd
            self.last_r_spd = r_spd
        
        led_val = 255 if led_state else 0
        if self.last_led_val != led_val:
            self.send_json({"T": 132, "IO1": led_val, "IO2": led_val})
            self.last_led_val = led_val

    def stop(self):
        if not self.ser: return
        self.send_json({"T": 1, "L": 0, "R": 0})
        
    def close(self):
        self.stop()
        if self.ser:
            self.ser.close()

if __name__ == '__main__':
    # Test block
    motors = MotorController()
    motors.send_command(100, 100, 100, 100, -50, True)
    time.sleep(1)
    motors.stop()
    motors.close()
