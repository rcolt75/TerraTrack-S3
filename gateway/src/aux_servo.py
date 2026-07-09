from gpiozero import Servo
from gpiozero.pins.pigpio import PiGPIOFactory
import time

class AuxServoController:
    def __init__(self, pin=18):
        """
        Initialize the Feetech continuous rotation servo on the specified GPIO pin.
        We default to GPIO 18 as it supports hardware PWM on Raspberry Pi.
        """
        self.pin = pin
        try:
            # Feetech continuous servos often use 500us to 2500us pulse widths
            # Using pigpio factory provides hardware-timed, jitter-free PWM.
            factory = PiGPIOFactory()
            self.servo = Servo(pin, min_pulse_width=0.0005, max_pulse_width=0.0025, pin_factory=factory)
            print(f"AuxServo initialized on GPIO {pin} with Hardware PWM.")
        except Exception:
            # Fallback to default software PWM if pigpiod isn't available
            print(f"pigpiod not found, falling back to software PWM for AuxServo on GPIO {pin}.")
            self.servo = Servo(pin, min_pulse_width=0.0005, max_pulse_width=0.0025)
            
        self.set_speed(0) # start stopped

    def set_speed(self, speed):
        """
        Set the speed of the continuous servo.
        :param speed: Value from -255 to 255.
        """
        if not self.servo:
            return

        # Clamp speed to -255 to 255
        speed = max(-255, min(255, speed))
        
        if speed == 0:
            # To cleanly stop a continuous servo without jitter, we can either
            # set the exact center pulse (usually 0 in gpiozero representation)
            # or completely detach the PWM. 
            self.servo.detach()
        else:
            # Map -255 to 255 into gpiozero's -1.0 to 1.0 range
            normalized_speed = speed / 255.0
            self.servo.value = normalized_speed

    def stop(self):
        """Safely detach the servo."""
        if self.servo:
            self.servo.detach()

if __name__ == '__main__':
    # Test block
    aux = AuxServoController(pin=18)
    print("Testing Aux Servo Forward...")
    aux.set_speed(128)
    time.sleep(2)
    print("Testing Aux Servo Reverse...")
    aux.set_speed(-128)
    time.sleep(2)
    print("Stopping...")
    aux.stop()
