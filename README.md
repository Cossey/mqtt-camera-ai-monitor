# MQTT Camera AI Monitor

## Overview

The MQTT Camera AI Monitor is a TypeScript/Node.js application that monitors MQTT channels for trigger commands, captures high-quality images from RTSP cameras using FFmpeg, and processes them through OpenAI-compatible AI endpoints for analysis.
The application is designed to support multiple cameras and can be easily configured through a YAML configuration file.

## Features

- **MQTT Integration**: Monitors MQTT channels for trigger commands with automatic reconnection
- **RTSP Camera Support**: Captures high-quality images from RTSP camera streams using FFmpeg
- **AI Processing**: Sends captured images to OpenAI-compatible endpoints for analysis
- **Binary Image Publishing**: Publishes captured images as binary data to MQTT topics
- **Status Monitoring**: Publishes online/offline status via Last Will and Testament
- **Automatic Cleanup**: Removes temporary image files to prevent disk space issues
- **Graceful Shutdown**: Properly handles shutdown signals and cleanup
- **Docker Support**: Runs in containerized environments with configurable file paths
- **Comprehensive Logging**: Detailed logging for monitoring and debugging

## How it Works

### MQTT Topic Structure

The application uses the following topic structure: `<basetopic>/<cameraname>/<topicname>`

#### Status Topics

- **`<basetopic>/online`** - Application status ("YES" when running, "NO" when offline)

#### Camera Topics (for each configured camera)

- **`<basetopic>/<camera>/trigger`** - Trigger topic (set to "YES" to start analysis, automatically resets to "NO")
- **`<basetopic>/<camera>/image`** - Binary image data (JPEG format, retained)
- **`<basetopic>/<camera>/ai`** - AI analysis response (text, retained)

### Workflow

1. **Initialization**: Application connects to MQTT broker and initializes camera topics
2. **Trigger**: Set `<basetopic>/<camera>/trigger` to "YES" to start analysis
3. **Image Capture**: Application captures high-quality image from RTSP camera
4. **Image Publishing**: Binary image data is published to `<basetopic>/<camera>/image`
5. **AI Processing**: Image is sent to AI endpoint with configured prompt
6. **Result Publishing**: AI response is published to `<basetopic>/<camera>/ai`
7. **Reset**: Trigger topic is automatically reset to "NO"
8. **Cleanup**: Temporary image files are automatically deleted

## Installation & Setup

### Prerequisites

- Node.js 18+ (for bare metal installation)
- FFmpeg (for camera image capture)
- MQTT broker
- OpenAI-compatible API endpoint

### Configuration

Create a `config.yaml` file based on the provided `config.yaml.sample`.

## Deployment Options

### Bare Metal

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Place your config file:**

   ```bash
   cp config.yaml.sample config.yaml
   # Edit config.yaml with your settings
   ```

3. **Run the application:**

   ```bash
   npm start
   ```

### Docker

#### Using Pre-built Image

```bash
docker run -d \
  --name mqtt-camera-monitor \
  -v /path/to/your/config.yaml:/usr/src/app/config.yaml \
  kosdk/mqtt-camera-ai-monitor:latest
```

#### Using Custom Config Location (Docker)

Set the `CONFIG_FILE` environment variable to specify a custom config file location:

```bash
docker run -d \
  --name mqtt-camera-monitor \
  -e CONFIG_FILE=/app/config/custom-config.yaml \
  -v /path/to/your/config.yaml:/app/config/custom-config.yaml \
  kosdk/mqtt-camera-ai-monitor:latest
```

#### Docker Compose Example

```yaml
version: '3.8'
services:
  mqtt-camera-monitor:
    image: kosdk/mqtt-camera-ai-monitor:latest
    container_name: mqtt-camera-monitor
    environment:
      - CONFIG_FILE=/app/config/config.yaml
    volumes:
      - ./config.yaml:/app/config/config.yaml
    restart: unless-stopped
```

#### Building from Source

```bash
# Clone the repository
git clone <repository-url>
cd mqtt-camera-ai-monitor

# Build the Docker image
docker build -t mqtt-camera-ai-monitor .

# Run the container
docker run -d \
  --name mqtt-camera-monitor \
  -v /path/to/your/config.yaml:/usr/src/app/config.yaml \
  mqtt-camera-ai-monitor
```

## Usage Example

1. **Start the application** (bare metal or Docker)
2. **Monitor the logs** to confirm MQTT connection and camera initialization
3. **Trigger analysis** by publishing "YES" to the trigger topic:

   ```bash
   mosquitto_pub -h your-mqtt-server -t "mqttcim/frontdoor/trigger" -m "YES"
   ```

4. **Monitor results** on the image and AI topics:

   ```bash
   # Subscribe to all topics for a camera
   mosquitto_sub -h your-mqtt-server -t "mqttcim/frontdoor/#"
   
   # Check application status
   mosquitto_sub -h your-mqtt-server -t "mqttcim/online"
   ```

## Monitoring & Troubleshooting

### Log Files

- **Console output**: Real-time application logs
- **error.log**: Error-level logs only
- **combined.log**: All log levels

### Common Issues

- **MQTT Connection**: Check server address, credentials, and network connectivity
- **Camera Access**: Verify RTSP URLs and camera credentials
- **AI API**: Confirm endpoint URL, API token, and model availability
- **File Permissions**: Ensure write permissions for temporary files

### Health Checks

Monitor the `<basetopic>/online` topic to verify application status:

- **"YES"**: Application is running and connected
- **"NO"**: Application is offline (via Last Will and Testament)

## Configuration Reference

### MQTT Settings

- `server`: MQTT broker hostname/IP
- `port`: MQTT broker port (typically 1883)
- `basetopic`: Base topic for all MQTT communications
- `user`/`password`: MQTT authentication credentials
- `client`: MQTT client identifier

### OpenAI Settings

- `endpoint`: AI API endpoint URL
- `api_token`: API authentication token
- `model`: AI model name (must support vision/image input)

### Camera Settings

- `endpoint`: RTSP stream URL with credentials
- `prompt`: Text prompt for AI analysis of camera images

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with appropriate tests
4. Submit a pull request

## License

This project is licensed under the BSD 3-Clause License. See the [LICENSE](LICENSE) file for details.

## Support

For issues and questions:

- Check the application logs for error details
- Verify configuration settings
- Ensure network connectivity to MQTT broker and AI endpoint
- Open an issue on the project repository
