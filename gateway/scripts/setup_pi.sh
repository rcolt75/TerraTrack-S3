#!/bin/bash
echo "Configuring Raspberry Pi Hardware Buses..."

# 1. Free up GPIO 14/15 for ESP32 Communication (Disable Console, Enable Hardware)
sudo raspi-config nonint do_serial 2

# 2. Enable I2C (For potential sensors/Arducam control)
sudo raspi-config nonint do_i2c 0

# 3. Enable SPI (For Arducam Mini high-speed video)
sudo raspi-config nonint do_spi 0

echo "Installing Python Dependencies (pyserial and opencv)..."
sudo apt-get update
echo "Installing Python Dependencies (pyserial, opencv, and gstreamer)..."
sudo apt-get update
sudo apt-get install -y python3-serial python3-opencv \
    gstreamer1.0-tools gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly \
    gstreamer1.0-libcamera

echo "Installing systemd service to run on boot..."
sudo cp /home/hvac/hvac-crawler/scripts/hvac-crawler.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable hvac-crawler.service
sudo systemctl start hvac-crawler.service

echo "Hardware buses configured and service installed. Rebooting is recommended."
# sudo reboot
