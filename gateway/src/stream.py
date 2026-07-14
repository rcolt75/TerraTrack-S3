import cv2
import numpy as np
import socket
import struct
import threading
import time
import subprocess
import os
from typing import Optional, Tuple, Any

class CameraStreamer:
    def __init__(self, host='0.0.0.0', port=5006, width=1920, height=1080, fps=10):
        self.host = host
        self.port = port
        self.width = width
        self.height = height
        self.fps = fps
        # The Arducam IMX477 on Raspberry Pi 5 runs natively via libcamera (rpicam-apps).
        # OpenCV's V4L2 and GStreamer backends can be flaky on Pi OS Bookworm.
        # We will use a subprocess to pipe raw YUV frames from rpicam-vid into numpy arrays.
        self.ir_mode = False
        self.hdr_mode = False
        self.roi_level = 1.0
        self.ai_mode = True
        self.process: Optional[subprocess.Popen[Any]] = None
        
        self.use_mock = False
        self.streaming = False
        self.thread: Optional[threading.Thread] = None
        self.server_socket: Optional[socket.socket] = None
        self.target_address: Optional[Tuple[str, int]] = None # Where to send TCP frames

    def _get_rpicam_cmd(self):
        # Hardware RoI Geometry Translation (Scale down sensor FOV)
        # 1x = 0,0,1,1;   2x = 0.25,0.25,0.5,0.5
        roi = getattr(self, 'roi_level', 1.0)
        roi_w = 1.0 / roi
        roi_x = (1.0 - roi_w) / 2.0
        roi_str = f"{roi_x:.3f},{roi_x:.3f},{roi_w:.3f},{roi_w:.3f}"

        cmd = [
            "rpicam-vid",
            "-n", # Disable HDMI preview
            "--timeout", "0",
            "--codec", "mjpeg",
            "--quality", "25",
            "--roi", roi_str,
            "--width", str(self.width),
            "--height", str(self.height),
            "--framerate", str(self.fps),
            "--hdr", "auto" if getattr(self, 'hdr_mode', False) else "off"
        ]
        
        if getattr(self, 'ai_mode', True):
            script_dir = os.path.dirname(os.path.abspath(__file__))
            json_path = os.path.join(script_dir, "imx500_mobilenet_custom.json")
            cmd.extend([
                "--post-process-file", json_path
            ])
            
        cmd.extend([
            "--inline",
            "--listen", "0",
            "-o", "-"
        ])
        
        return cmd

    def restart(self):
        print("Restarting video stream due to configuration change...")
        if not self.target_address: return
        ip, port = self.target_address
        self.stop()
        time.sleep(1)
        self.start(ip, port)

    def start(self, target_ip, target_port):
        if self.streaming:
            return
            
        self.target_address = (target_ip, target_port)
        
        try:
            # Upgrade to TCP Socket to overcome UDP 65KB fragmentation limits for high-res streams
            self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.server_socket.settimeout(3.0)
            self.server_socket.connect(self.target_address)
            self.server_socket.settimeout(None)
        except Exception as e:
            print(f"Failed to connect TCP stream to {self.target_address}: {e}")
            self.server_socket = None
            return
        
        try:
            # Attempt to start the rpicam-vid subprocess
            self.process = subprocess.Popen(self._get_rpicam_cmd(), stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            
            # Allow a moment for the camera to initialize and check if process died immediately
            time.sleep(1)
            proc = self.process
            if proc is not None and proc.poll() is not None:
                print("Failed to start rpicam-vid subprocess. Falling back to synthetic test stream.")
                self.use_mock = True
            else:
                print("Hardware camera initialized via rpicam-vid.")

            self.streaming = True
            self.thread = threading.Thread(target=self._stream_loop)
            t = self.thread
            if t is not None:
                t.daemon = True
                t.start()
            print(f"Started streaming TCP HD MJPEG to {self.target_address}")
            
        except Exception as e:
            print(f"Error starting camera: {e}")

    def _stream_loop(self):
        frame_counter: int = 0
        buf = b""

        while self.streaming:
            proc = self.process
            if not self.use_mock and proc is not None:
                stdout = proc.stdout
                if stdout is not None:
                    # Read an arbitrary chunk from the MJPEG pipeline
                    chunk = stdout.read(8192)
                    if not chunk:
                        if proc.poll() is not None:
                            print("rpicam-vid process died. Switching to synthetic stream.")
                            self.use_mock = True
                            self.process = None
                        else:
                            time.sleep(0.01)
                        continue
                        
                    buf += chunk # pyre-ignore
                    
                    # Extract completely intact JPEGs using SOI and EOI markers
                    while True:
                        start_idx = buf.find(b'\xff\xd8')
                        if start_idx == -1:
                            # No start marker found, chuck it to save RAM
                            buf = b""
                            break
                            
                        end_idx = buf.find(b'\xff\xd9', start_idx)
                        if end_idx == -1:
                            # Found the start, but waiting on the rest of the frame...
                            if start_idx > 0:
                                buf = buf[start_idx:] # pyre-ignore
                            break
                            
                        # Full Frame Acquired!
                        end_idx += 2
                        jpg_data = buf[start_idx:end_idx] # pyre-ignore
                        
                        # Advance buffer past this frame
                        buf = buf[end_idx:] # pyre-ignore
                        
                        if self.server_socket is not None:
                            try:
                                # Pack the 4-byte Big-Endian length header before sending frame
                                header = struct.pack(">L", len(jpg_data))
                                self.server_socket.sendall(header + jpg_data)
                            except Exception as e:
                                print(f"Video TCP connection lost: {e}")
                                self.streaming = False
                                break

            else:
                # Generate a synthetic moving frame for testing without hardware
                frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
                cv2.putText(frame, "IMX477 CAMERA OFFLINE", (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2) # pyre-ignore
                
                fc_int = int(frame_counter)
                cv2.putText(frame, ("TCP STREAM ACTIVE: " + str(fc_int)), (50, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2) # pyre-ignore
                
                # Bouncing square
                x_pos = int((fc_int * 5) % (self.width - 50))
                cv2.rectangle(frame, (x_pos, 300), (x_pos+50, 350), (255, 0, 0), -1) # pyre-ignore
                
                frame_counter = int(fc_int + 1)

                # Encode frame as JPEG
                encode_param = [cv2.IMWRITE_JPEG_QUALITY, 40]
                result, encimg = cv2.imencode('.jpg', frame, encode_param)
                
                if not result:
                    continue

                data = encimg.tobytes()
                if self.server_socket is not None:
                    try:
                        header = struct.pack(">L", len(data))
                        self.server_socket.sendall(header + data)
                    except Exception:
                        self.streaming = False
                        break
                
                time.sleep(1.0 / self.fps)

    def stop(self):
        self.streaming = False
        t = self.thread
        if t is not None:
            t.join(timeout=1.0)
        p = self.process
        if p is not None:
            p.terminate()
            p.wait()
            self.process = None
        sock = self.server_socket
        if sock is not None:
            try:
                sock.close()
            except Exception:
                pass
            self.server_socket = None
        print("Camera streaming stopped.")
