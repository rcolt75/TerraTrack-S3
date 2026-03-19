import socket
import json
import threading
import time
from typing import Optional
from motors import MotorController
from stream import CameraStreamer

class HVACServer:
    def __init__(self, host='0.0.0.0', port=5005):
        self.host = host
        self.port = port
        self.running = False
        self.server_socket: Optional[socket.socket] = None
        
        self.motors = MotorController()
        # The stream will be directed to the IP that connects to this command server
        self.camera = CameraStreamer()
        self.client_address = None

    def start(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
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
                self.client_address = address
                print(f"Connected to controller at {address}")
                
                # Start camera stream to the connected client on a predefined UDP port
                self.camera.start(target_ip=address[0], target_port=5006)

                self.handle_client(client_sock)
                
                # If handle_client returns, the connection was lost
                print("Client disconnected. Stopping motors and stream.")
                self.motors.stop()
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
                led = cmd.get('led_state', False)
                self.motors.send_command(fl, rl, fr, rr, hook, led)
            
            elif action == 'toggle_ir':
                state = cmd.get('state', False)
                self.camera.ir_mode = state
                addr = self.client_address
                if self.camera.streaming and addr is not None:
                    print(f"IR Mode toggled to {state}. Restarting camera stream...")
                    self.camera.stop()
                    time.sleep(0.5)
                    self.camera.start(target_ip=addr[0], target_port=5006)
            
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

    def stop(self):
        self.running = False
        self.motors.close()
        self.camera.stop()
        sock = self.server_socket
        if sock is not None:
            sock.close()

if __name__ == '__main__':
    server = HVACServer()
    server.start()
