import serial
import time
import struct

class MotorController:
    def __init__(self, port='/dev/serial0', baudrate=115200):
        try:
            self.ser = serial.Serial(port, baudrate, timeout=1)
            print(f"MotorController initialized on {port} at {baudrate} baud.")
        except serial.SerialException as e:
            print(f"Failed to initialize serial on {port}: {e}")
            self.ser = None

    def send_command(self, front_left, rear_left, front_right, rear_right, hook_speed=0, led_state=False):
        """
        Send motor speeds to ESP32 over UART for 4 independent wheels plus hook servo and global LEDs.
        Speed values should be between -255 and 255.
        """
        if not self.ser:
            return

        # Ensure speeds are within bounds
        fl_speed = max(-255, min(255, int(front_left)))
        rl_speed = max(-255, min(255, int(rear_left)))
        fr_speed = max(-255, min(255, int(front_right)))
        rr_speed = max(-255, min(255, int(rear_right)))
        h_speed = max(-255, min(255, int(hook_speed)))

        # Simple packet format: Start byte, 5 directions, 5 speeds, end byte
        # This is a conceptual example, adjust based on the exact ESP32 firmware expectation.
        # Format: <StartByte(0xAA)> <FL_Dir> <FL_Spd> <RL_Dir> <RL_Spd> <FR_Dir> <FR_Spd> <RR_Dir> <RR_Spd> <H_Dir> <H_Spd> <LED> <EndByte(0x55)>
        
        fl_dir = 1 if fl_speed >= 0 else 0
        rl_dir = 1 if rl_speed >= 0 else 0
        fr_dir = 1 if fr_speed >= 0 else 0
        rr_dir = 1 if rr_speed >= 0 else 0
        h_dir = 1 if h_speed >= 0 else 0
        led_val = 1 if led_state else 0
        
        packet = bytearray([
            0xAA, 
            fl_dir, abs(fl_speed), 
            rl_dir, abs(rl_speed), 
            fr_dir, abs(fr_speed), 
            rr_dir, abs(rr_speed), 
            h_dir, abs(h_speed),
            led_val,
            0x55
        ])
        
        try:
            self.ser.write(packet)
        except Exception as e:
            print(f"Error sending to UART: {e}")

    def stop(self):
        self.send_command(0, 0, 0, 0, 0)
        
    def close(self):
        self.stop()
        if self.ser:
            self.ser.close()

if __name__ == '__main__':
    # Test block
    motors = MotorController()
    motors.send_command(100, 100, 100, 100, -50)
    time.sleep(1)
    motors.stop()
    motors.close()
