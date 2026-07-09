void led_pin_init(){
  ledcAttach(IO1_PIN, FREQ, ANALOG_WRITE_BITS);
  ledcAttach(IO2_PIN, FREQ, ANALOG_WRITE_BITS);
}

void led_pwm_ctrl(int io1Input, int io2Input) {
  ledcWrite(IO1_PIN, constrain(io1Input, 0, 255));
  ledcWrite(IO2_PIN, constrain(io2Input, 0, 255));
}