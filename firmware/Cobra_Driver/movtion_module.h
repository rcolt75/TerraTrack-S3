// switch parts
int switch_pwm_A = 0;
int switch_pwm_B = 0;
bool usePIDCompute = true;
float spd_rate_A = 1.0;
float spd_rate_B = 1.0;
bool heartbeatStopFlag = false;



void movtionPinInit(){

}


void switchEmergencyStop(){
  // digitalWrite(AIN1, LOW);
  // digitalWrite(AIN2, LOW);

  // digitalWrite(BIN1, LOW);
  // digitalWrite(BIN2, LOW);
}


void switchPortCtrlA(float pwmInputA){
  // int pwmIntA = round(pwmInputA * spd_rate_A);
  // if(abs(pwmIntA) < 1e-6){
  //   digitalWrite(AIN1, LOW);
  //   digitalWrite(AIN2, LOW);
  //   return;
  // }

  // if(pwmIntA > 0){
  //   digitalWrite(AIN1, LOW);
  //   digitalWrite(AIN2, HIGH);
  //   ledcWrite(PWMA, pwmIntA);
  // }
  // else{
  //   digitalWrite(AIN1, HIGH);
  //   digitalWrite(AIN2, LOW);
  //   ledcWrite(PWMA,-pwmIntA);
  // }
}


void switchPortCtrlB(float pwmInputB){
  // int pwmIntB = round(pwmInputB * spd_rate_B);
  // if(abs(pwmIntB) < 1e-6){
  //   digitalWrite(BIN1, LOW);
  //   digitalWrite(BIN2, LOW);
  //   return;
  // }

  // if(pwmIntB > 0){
  //   digitalWrite(BIN1, LOW);
  //   digitalWrite(BIN2, HIGH);
  //   ledcWrite(PWMB, pwmIntB);
  // }
  // else{
  //   digitalWrite(BIN1, HIGH);
  //   digitalWrite(BIN2, LOW);
  //   ledcWrite(PWMB,-pwmIntB);
  // }
}


void switchCtrl(int pwmIntA, int pwmIntB) {
    // switch_pwm_A = pwmIntA;
    // switch_pwm_B = pwmIntB;
    // switchPortCtrlA(switch_pwm_A);
    // switchPortCtrlB(switch_pwm_B);
}


void lightCtrl(int pwmIn) {
  // switch_pwm_A = pwmIn;
  // switchPortCtrlA(-abs(switch_pwm_A));
}


void setSpdRate(float inputL, float inputR) {
  // inputL = abs(inputL);
  // if (inputL > 1) {
  //   inputL = 1;
  // }
  // inputR = abs(inputR);
  // if (inputR > 1) {
  //   inputR = 1;
  // }
  // spd_rate_A = inputL;
  // spd_rate_B = inputR;
}


void getSpdRate() {
  // jsonInfoHttp.clear();
  // jsonInfoHttp["T"] = CMD_GET_SPD_RATE;

  // jsonInfoHttp["L"] = spd_rate_A;
  // jsonInfoHttp["R"] = spd_rate_B;

  // String getInfoJsonString;
  // serializeJson(jsonInfoHttp, getInfoJsonString);
  // Serial.println(getInfoJsonString);
}



// movtion parts.
// A-left, B-right

// ESP32Encoder encoderA;
// ESP32Encoder encoderB;

static unsigned long lastTime = 0;
// static unsigned long lastLeftSpdTime = 0;
// static unsigned long lastRightSpdTime = 0;
// int lastEncoderA = 0;
// int lastEncoderB = 0;

double speedGetA;
double speedGetB;

// double plusesRate = 3.14159265359 * WHEEL_D / ONE_CIRCLE_PLUSES;


void initEncoders() {
  // encoderA.attachHalfQuad(AENCA, AENCB);
  // encoderB.attachHalfQuad(BENCA, BENCB);
  // encoderA.setCount(0);
  // encoderB.setCount(0);
}

void getLeftSpeed() {
  // unsigned long currentTime = micros();
  // long encoderPulsesA = encoderA.getCount();
  // if (!SET_MOTOR_DIR) {
  //   speedGetA = (plusesRate * (encoderPulsesA - lastEncoderA)) / ((double)(currentTime - lastLeftSpdTime) / 1000000);
  //   en_odom_l = ((float)encoderPulsesA / ONE_CIRCLE_PLUSES) * WHEEL_D * 3.14159265359;
  // } else {
  //   speedGetA = (plusesRate * (lastEncoderA - encoderPulsesA)) / ((double)(currentTime - lastLeftSpdTime) / 1000000);
  //   en_odom_l = - ((float)encoderPulsesA / ONE_CIRCLE_PLUSES) * WHEEL_D * 3.14159265359;
  // }
  // lastEncoderA = encoderPulsesA;
  // lastLeftSpdTime = currentTime;
}

void getRightSpeed() {
  // unsigned long currentTime = micros();
  // long encoderPulsesB = encoderB.getCount();
  // if (!SET_MOTOR_DIR) {
  //   speedGetB = (plusesRate * (encoderPulsesB - lastEncoderB)) / ((double)(currentTime - lastRightSpdTime) / 1000000);
  //   en_odom_r = ((float)encoderPulsesB / ONE_CIRCLE_PLUSES) * WHEEL_D * 3.14159265359;
  // } else {
  //   speedGetB = (plusesRate * (lastEncoderB - encoderPulsesB)) / ((double)(currentTime - lastRightSpdTime) / 1000000);
  //   en_odom_r = - ((float)encoderPulsesB / ONE_CIRCLE_PLUSES) * WHEEL_D * 3.14159265359;
  // }
  // lastEncoderB = encoderPulsesB;
  // lastRightSpdTime = currentTime;
}



// --- PID Controller ---

// PID_v2 pidA(__kp, __ki, __kd, PID::Direct);
// PID_v2 pidB(__kp, __ki, __kd, PID::Direct);

double outputA = 0;
double outputB = 0;
double setpointA = 0;
double setpointB = 0;

int setpoint_interval = 200;
unsigned long setpoint_cmd_recv = millis();
unsigned long setpoint_last_time = millis();
float setpointA_buffer;
float setpointB_buffer;
float setpointA_last;
float setpointB_last;
float change_offset = 0.005;
bool new_setpoint_flag = false;

void pidControllerInit() {
  // pidA.Start(speedGetA,
  //            outputA,
  //            setpointA);
  // pidA.SetOutputLimits(-255, 255);
  // pidA.SetMode(PID::Automatic);

  // pidB.Start(speedGetB,
  //            outputB,
  //            setpointB);
  // pidB.SetOutputLimits(-255, 255);
  // pidB.SetMode(PID::Automatic);
}

void leftCtrl(float pwmInputA){
  // int pwmIntA = round(pwmInputA);
  // if(SET_MOTOR_DIR){
  //   if(pwmIntA < 0){
  //     digitalWrite(AIN1, HIGH);
  //     digitalWrite(AIN2, LOW);
  //     ledcWrite(PWMA, abs(pwmIntA));
  //   }
  //   else{
  //     digitalWrite(AIN1, LOW);
  //     digitalWrite(AIN2, HIGH);
  //     ledcWrite(PWMA, abs(pwmIntA));
  //   }
  // }else{
  //   if(pwmIntA < 0){
  //     digitalWrite(AIN1, LOW);
  //     digitalWrite(AIN2, HIGH);
  //     ledcWrite(PWMA, abs(pwmIntA));
  //   }
  //   else{
  //     digitalWrite(AIN1, HIGH);
  //     digitalWrite(AIN2, LOW);
  //     ledcWrite(PWMA, abs(pwmIntA));
  //   }
  // }
}

void rightCtrl(float pwmInputB){
  // int pwmIntB = round(pwmInputB);
  // if(SET_MOTOR_DIR){
  //   if(pwmIntB < 0){
  //     digitalWrite(BIN1, HIGH);
  //     digitalWrite(BIN2, LOW);
  //     ledcWrite(PWMB, abs(pwmIntB));
  //   }
  //   else{
  //     digitalWrite(BIN1, LOW);
  //     digitalWrite(BIN2, HIGH);
  //     ledcWrite(PWMB, abs(pwmIntB));
  //   }
  // }else{
  //   if(pwmIntB < 0){
  //     digitalWrite(BIN1, LOW);
  //     digitalWrite(BIN2, HIGH);
  //     ledcWrite(PWMB, abs(pwmIntB));
  //   }
  //   else{
  //     digitalWrite(BIN1, HIGH);
  //     digitalWrite(BIN2, LOW);
  //     ledcWrite(PWMB, abs(pwmIntB));
  //   }
  // }
}
void ddsm_id_check()
{
  dc.ddsm_id_check();
  dc.ddsm400_fb(&ddsm_fb_1,&ddsm_fb_2,&ddsm_fb_3,&ddsm_fb_4,&ddsm_id,&ddsm_posl,&ddsm_posr);
}
void ddsm_change_id(uint8_t id)
{
  dc.ddsm_change_id(id);
  dc.ddsm400_fb(&ddsm_fb_1,&ddsm_fb_2,&ddsm_fb_3,&ddsm_fb_4,&ddsm_id,&ddsm_posl,&ddsm_posr);
}
void motor_enabled()
{
  dc.ddsm400_enable(1);
  delay(DDSM_DELAY_MM);
  dc.ddsm400_enable(2);
  delay(DDSM_DELAY_MM);
  dc.ddsm400_enable(3);
  delay(DDSM_DELAY_MM);
  dc.ddsm400_enable(4);
  delay(DDSM_DELAY_MM);

  dc.ddsm400_speedLoop(1);
  delay(DDSM_DELAY_MM);
  dc.ddsm400_speedLoop(2);
  delay(DDSM_DELAY_MM);
  dc.ddsm400_speedLoop(3);
  delay(DDSM_DELAY_MM);
  dc.ddsm400_speedLoop(4);
  delay(DDSM_DELAY_MM);
}
void setGoalSpeed(int inputLeft, int inputRight) {
  ddsm_spd_1 =  inputLeft;
  ddsm_spd_2 = -inputRight;
  ddsm_spd_3 = -inputRight;
  ddsm_spd_4 =  inputLeft;
}
void ddsm_ctrl_loop_web(int inputLeft, int inputRight){
  dc.ddsm_ctrl(4, inputLeft, 1);
  dc.ddsm400_fb(&ddsm_fb_1,&ddsm_fb_2,&ddsm_fb_3,&ddsm_fb_4,&ddsm_id,&ddsm_posl,&ddsm_posr);
  delay(DDSM_DELAY_MM);
  dc.ddsm_ctrl(2, -inputRight, 1);
  dc.ddsm400_fb(&ddsm_fb_1,&ddsm_fb_2,&ddsm_fb_3,&ddsm_fb_4,&ddsm_id,&ddsm_posl,&ddsm_posr);
  delay(DDSM_DELAY_MM);
  dc.ddsm_ctrl(3, -inputRight, 1);
  dc.ddsm400_fb(&ddsm_fb_1,&ddsm_fb_2,&ddsm_fb_3,&ddsm_fb_4,&ddsm_id,&ddsm_posl,&ddsm_posr);
  delay(DDSM_DELAY_MM);
  dc.ddsm_ctrl(1, inputLeft, 1);
  dc.ddsm400_fb(&ddsm_fb_1,&ddsm_fb_2,&ddsm_fb_3,&ddsm_fb_4,&ddsm_id,&ddsm_posl,&ddsm_posr);
  delay(DDSM_DELAY_MM);
  setGoalSpeed(inputLeft,inputRight);
}

void ddsm_ctrl_loop() {
  if (millis() - ddsm_last_time < DDSM_DELAY_MM) {
    return;
  }

  switch(ddsm_ctrl_num){
  case 1: dc.ddsm_ctrl(1, ddsm_spd_1, 1);
          //ddsm_fb_1=dc.ddsm400_fb();
          break;
  case 2: dc.ddsm_ctrl(2, ddsm_spd_2, 1);
          //ddsm_fb_2=dc.ddsm400_fb();
          break;
  case 3: dc.ddsm_ctrl(3, ddsm_spd_3, 1);
          //ddsm_fb_3=dc.ddsm400_fb();
          break;
  case 4: dc.ddsm_ctrl(4, ddsm_spd_4, 1);
          //ddsm_fb_4=dc.ddsm400_fb();
          break;
  case 5: dc.ddsm_get_pos(1);
          break;
  case 6: dc.ddsm_get_pos(2);
          break;
  }
  dc.ddsm400_fb(&ddsm_fb_1,&ddsm_fb_2,&ddsm_fb_3,&ddsm_fb_4,&ddsm_id,&ddsm_posl,&ddsm_posr);
  // Serial.println( ddsm_posl);
  // Serial.println( ddsm_posr);
  if(ddsm_fb_1!=0||ddsm_fb_2!=0){

  int32_t delta_l = (ddsm_posl - ddsm_last_posl);
  int32_t delta_r = -(ddsm_posr - ddsm_last_posr);
  // Serial.println( "delta");
  // Serial.println( delta_l);
  // Serial.println( delta_r);
  
  if (delta_l < -ONE_CIRCLE_PLUSES / 2) {
    delta_l += ONE_CIRCLE_PLUSES;
  } else if (delta_l > ONE_CIRCLE_PLUSES / 2) {
    delta_l -= ONE_CIRCLE_PLUSES;
  }

  if (delta_r < -ONE_CIRCLE_PLUSES / 2) {
    delta_r += ONE_CIRCLE_PLUSES;
  } else if (delta_r > ONE_CIRCLE_PLUSES / 2) {
    delta_r -= ONE_CIRCLE_PLUSES;
  }

  if(std::abs(delta_l)>10){
    float odometry_l = ((float)delta_l / ONE_CIRCLE_PLUSES )* WHEEL_D * 3.14159265359;
    en_odom_l += odometry_l; 
  }

  if(std::abs(delta_r)>10){
    float odometry_r = ((float)delta_r / ONE_CIRCLE_PLUSES )* WHEEL_D * 3.14159265359;
    en_odom_r += odometry_r;    
  }
  } 

  
  ddsm_last_posl = ddsm_posl;
  ddsm_last_posr = ddsm_posr;

  ddsm_ctrl_num = ddsm_ctrl_num + 1;
  if (ddsm_ctrl_num > ddsm_total) {
    ddsm_ctrl_num = 1;
  }

  ddsm_last_time = millis();
  // Serial.println(dc.ddsm400_fb());
}


void setAllGoal(int M1, int M2, int M3, int M4) {
  ddsm_spd_1 =  M1;
  ddsm_spd_2 = -M2;
  ddsm_spd_3 = -M3;
  ddsm_spd_4 =  M4;
}

void LeftPidControllerCompute() {
}

void RightPidControllerCompute() {
}

void setPID(float inputP, float inputI, float inputD, float inputLimits) {
}

void rosCtrl(float rosX, float rosZ) {
  setpointA = rosX - (rosZ * TRACK_WIDTH / 2.0);
  setpointB = rosX + (rosZ * TRACK_WIDTH / 2.0);
  setpointA = setpointA*60/(M_PI*WHEEL_D);
  setpointB = setpointB*60/(M_PI*WHEEL_D);
  setGoalSpeed(setpointA*10, setpointB*10);
}

void heartBeatCtrl() {
  if (currentTimeMillis - lastCmdRecvTime > HEART_BEAT_DELAY) {
    if (!heartbeatStopFlag) {
      heartbeatStopFlag = true;
      setGoalSpeed(0, 0);
      //ddsm_ctrl_loop_web(0,0);
     
    }
    
  }
}

void changeHeartBeatDelay(int inputCmd) {
  HEART_BEAT_DELAY = inputCmd;
}

void mm_settings(byte inputMain, byte inputModule) {
}