import socket
import json
import threading
import time
import time
import subprocess
from typing import Optional
from motors import MotorController
from aux_servo import AuxServoController
from stream import CameraStreamer

class HVACServer:
    def __init__(self, host='0.0.0.0', port=5005):
        self.host = host
        self.port = port
        self.running = False
        self.server_socket: Optional[socket.socket] = None
        self.active_client_sock: Optional[socket.socket] = None
        
        self.motors = MotorController(on_telemetry=self.send_telemetry)
        self.aux_servo = AuxServoController(pin=18)
        # The stream will be directed to the IP that connects to this command server
        self.camera = CameraStreamer()
        self.client_address = None
        
        self.wifi_thread = threading.Thread(target=self._wifi_poller, daemon=True)
        self.wifi_thread.start()

    def start(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        sock.bind((self.host, self.port))
        sock.listen(1)
        self.server_socket = sock
        self.running = True

        print(f"HVAC Crawler Server listening on {self.host}:{self.port}")

        try:
            while self.running:
                # Accept a single controller connection
                print("Waiting for controller connection...")
                sock = self.server_socket
                if sock is None:
                    break
                client_sock, address = sock.accept()
                client_sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
                client_sock.settimeout(3.0) # Fixes half-open connection deadlocks
                self.client_address = address
                print(f"Connected to controller at {address}")
                self.active_client_sock = client_sock
                
                # Start camera stream to the connected client on a predefined UDP port
                self.camera.start(target_ip=address[0], target_port=5006)

                self.handle_client(client_sock)
                
                # If handle_client returns, the connection was lost
                print("Client disconnected. Stopping motors, servo, and stream.")
                self.active_client_sock = None
                self.motors.stop()
                self.aux_servo.stop()
                self.camera.stop()
                client_sock.close()

        except KeyboardInterrupt:
            print("\nShutting down server...")
        finally:
            self.stop()

    def handle_client(self, client_sock):
        buffer = ""
        while self.running:
            try:
                data = client_sock.recv(1024).decode('utf-8', errors='ignore')
                if not data:
                    break # Connection closed

                buffer += data
                # Parse newline-delimited JSON commands
                while '\n' in buffer:
                    line, buffer = buffer.split('\n', 1)
                    if not line.strip():
                        continue
                    
                    self.process_command(line)

            except socket.error as e:
                import traceback
                with open('/tmp/hvac_err.log', 'a') as f:
                    f.write(f"Socket error: {e}\n{traceback.format_exc()}\n")
                print(f"Socket error: {e}")
                break
            except Exception as e:
                import traceback
                with open('/tmp/hvac_err.log', 'a') as f:
                    f.write(f"Unhandled Exception: {e}\n{traceback.format_exc()}\n")
                print(f"Error handling client data: {e}")
                # DON'T break the connection! Just ignore the bad packet.

    def process_command(self, raw_data):
        try:
            cmd = json.loads(raw_data)
            action = cmd.get('action')
            
            if action == 'drive':
                fl = cmd.get('front_left', 0)
                rl = cmd.get('rear_left', 0)
                fr = cmd.get('front_right', 0)
                rr = cmd.get('rear_right', 0)
                hook = cmd.get('hook_speed', 0)
                aux = cmd.get('aux_speed', 0)
                led = cmd.get('led_state', False)
                self.motors.send_command(fl, rl, fr, rr, hook, led)
                self.aux_servo.set_speed(aux)
            
            elif action == 'toggle_ir':
                state = cmd.get('state', False)
                self.camera.ir_mode = state
                print(f"IR Mode toggled to {state} (Handled entirely via CSS GPU Shaders in Frontend).")
            
            elif action == 'toggle_hdr':
                state = cmd.get('state', False)
                if hasattr(self.camera, 'hdr_mode') and self.camera.hdr_mode != state:
                    self.camera.hdr_mode = state
                    print(f"HDR Mode toggled to {state}. Restarting camera ISP...")
                    if self.camera.streaming:
                        self.camera.restart()
            
            elif action == 'set_roi':
                level = float(cmd.get('level', 1.0))
                if hasattr(self.camera, 'roi_level') and self.camera.roi_level != level:
                    self.camera.roi_level = level
                    print(f"Hardware RoI mapped to {level}x bounds. Restarting ISP...")
                    if self.camera.streaming:
                        self.camera.restart()
                        
            elif action == 'toggle_ai':
                state = cmd.get('state', True)
                if hasattr(self.camera, 'ai_mode') and self.camera.ai_mode != state:
                    self.camera.ai_mode = state
                    print(f"AI Tracking Mode toggled to {state}. Restarting camera ISP...")
                    if self.camera.streaming:
                        self.camera.restart()
            
            elif action == 'toggle_led':
                pass # Handled continuously by the drive loop
                
            elif action == 'ping':
                # Basic keepalive
                pass
                
            else:
                print(f"Unknown command: {action}")

        except json.JSONDecodeError:
            print(f"Failed to decode JSON: {raw_data}")
        except Exception as e:
            import traceback
            with open('/tmp/hvac_err.log', 'a') as f:
                f.write(f"Command processing error: {e}\n{traceback.format_exc()}\nRaw: {raw_data}\n")
            print(f"Error processing command {action}: {e}")

    def send_telemetry(self, data):
        if self.active_client_sock:
            try:
                msg = json.dumps({"type": "telemetry", "data": data}) + "\n"
                self.active_client_sock.sendall(msg.encode())
            except Exception as e:
                pass # Handled by main socket loop if client disconnected

    def _wifi_poller(self):
        while True:
            if self.active_client_sock:
                try:
                    with open('/proc/net/wireless', 'r') as f:
                        lines = f.readlines()
                        if len(lines) > 2:
                            parts = lines[2].split()
                            if len(parts) >= 4:
                                level = float(parts[3].replace('.', ''))
                                self.send_telemetry({"wifi": int(level)})
                except Exception:
                    pass
            time.sleep(2.0)

    def stop(self):
        self.running = False
        self.motors.close()
        self.aux_servo.stop()
        self.camera.stop()
        sock = self.server_socket
        if sock is not None:
            sock.close()

if __name__ == '__main__':
    server = HVACServer()
    server.start()
