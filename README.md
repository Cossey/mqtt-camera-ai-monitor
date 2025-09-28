# MQTT Camera AI Monitor

## Overview

The MQTT Camera AI Monitor is a TypeScript/Node.js application that monitors MQTT channels for trigger commands, captures high-quality images from RTSP cameras using FFmpeg, and processes them through OpenAI-compatible AI endpoints for analysis. The application supports both single and multi-image capture for advanced motion detection and temporal analysis.

## Features

- **MQTT Integration**: Monitors MQTT channels for trigger commands with automatic reconnection
- **RTSP Camera Support**: Captures high-quality images from RTSP camera streams using FFmpeg
- **Multi-Image Capture**: Sequential image capture with configurable intervals for motion analysis
- **AI Processing**: Sends captured images to OpenAI-compatible endpoints for analysis
- **Binary Image Publishing**: Publishes captured images as binary data to MQTT topics
- **Real-time Status Tracking**: Live status updates during processing (e.g., "Taking snapshot 2/4")
- **Comprehensive Statistics**: Detailed performance metrics and error tracking per camera
- **Status Monitoring**: Publishes online/offline status via Last Will and Testament
- **Automatic Cleanup**: Removes temporary image files to prevent disk space issues
- **Graceful Shutdown**: Properly handles shutdown signals and cleanup
- **Docker Support**: Runs in containerized environments with configurable file paths
- **Comprehensive Logging**: Detailed logging with configurable levels for monitoring and debugging
- **Structured Output**: Optional JSON schema-based responses for consistent data format

## How it Works

### MQTT Topic Structure

The application uses the following topic structure: `<basetopic>/<cameraname>/<topicname>`

#### Status Topics

- **`<basetopic>/online`** - Application status ("YES" when running, "NO" when offline)

#### Camera Topics (for each configured camera)

- **`<basetopic>/<camera>/trigger`** - Trigger topic (set to "YES" to start analysis, automatically resets to "NO")
- **`<basetopic>/<camera>/image`** - Binary image data (JPEG format, retained) - First captured image
- **`<basetopic>/<camera>/ai`** - AI analysis response (text or JSON, retained)
- **`<basetopic>/<camera>/status`** - Current processing status (text, retained)
- **`<basetopic>/<camera>/stats`** - Performance statistics and error tracking (JSON, retained)

### Camera Status Values

The `/status` topic provides real-time updates during processing:

- **`"Idle"`** - Camera ready for triggers
- **`"Starting image capture"`** - Beginning capture process
- **`"Taking snapshot"`** - Single image capture in progress
- **`"Taking snapshot X/Y"`** - Multi-image capture progress (e.g., "Taking snapshot 2/4")
- **`"Waiting for next capture (X/Y)"`** - Interval delay between captures
- **`"Publishing image"`** - Uploading image to MQTT
- **`"Processing with AI"`** - Sending to AI service for analysis
- **`"Publishing AI response"`** - Uploading AI results to MQTT
- **`"Cleaning up"`** - Removing temporary files
- **`"Complete"`** - Successfully finished processing
- **`"Error"`** - Error occurred during processing
- **`"Offline"`** - Service shutting down

### Camera Statistics

The `/stats` topic publishes a JSON object with performance metrics:

```json
{
    "lastErrorDate": "2023-01-01T12:00:00.000Z",
    "lastErrorType": "Connection timeout",
    "lastSuccessDate": "2023-01-01T12:05:00.000Z",
    "lastAiProcessTime": 2.5,
    "lastTotalProcessTime": 8.2
}
```

**Statistics Properties:**

- **`lastErrorDate`** - ISO timestamp of most recent error
- **`lastErrorType`** - Description of the last error that occurred
- **`lastSuccessDate`** - ISO timestamp of most recent successful processing
- **`lastAiProcessTime`** - Time in seconds for AI processing only
- **`lastTotalProcessTime`** - Total time in seconds from trigger to completion

### Workflow

1. **Initialization**: Application connects to MQTT broker and initializes camera topics
2. **Trigger**: Set `<basetopic>/<camera>/trigger` to "YES" to start analysis
3. **Status Updates**: Real-time status published to `<basetopic>/<camera>/status`
4. **Image Capture**: Application captures one or multiple high-quality images from RTSP camera
5. **Image Publishing**: Binary data of the first captured image is published to `<basetopic>/<camera>/image`
6. **AI Processing**: All captured images are sent to AI endpoint with configured prompt
7. **Result Publishing**: AI response is published to `<basetopic>/<camera>/ai`
8. **Statistics Update**: Performance metrics published to `<basetopic>/<camera>/stats`
9. **Reset**: Trigger topic is automatically reset to "NO"
10. **Cleanup**: All temporary image files are automatically deleted

### Multi-Image Capture

The application supports capturing multiple sequential images to provide AI with temporal context for motion detection and analysis:

- **Single Image Mode** (default): Traditional single snapshot capture
- **Multi-Image Mode**: Capture 2-10+ sequential images with configurable intervals
- **AI Context**: Multiple images are sent in chronological order with enhanced prompts
- **Motion Analysis**: AI can detect movement, direction, and changes across the sequence
- **Progress Tracking**: Status updates show capture progress (e.g., "Taking snapshot 3/5")

## Installation & Setup

### Prerequisites

- Node.js 18+ (for bare metal installation)
- FFmpeg (for camera image capture)
- MQTT broker
- OpenAI-compatible API endpoint with vision support

## Camera Configuration Options

Create a `config.yaml` file based on the provided `config.yaml.sample`.

### Basic Settings

- **`endpoint`** (required): RTSP stream URL with authentication
- **`prompt`** (required): Text prompt for AI analysis

### Multi-Image Settings

- **`captures`** (optional): Number of images to capture (default: 1, range: 1-10+)
- **`interval`** (optional): Milliseconds between captures (default: 1000, minimum: 0)

### Advanced Settings

- **`output`** (optional): Structured output schema for consistent JSON responses

### Configuration Examples

#### Minimal Single Image

```yaml
simple_camera:
  endpoint: rtsp://user:pass@camera/stream
  prompt: "What do you see?"
```

#### Motion Detection with Multiple Images

```yaml
motion_camera:
  endpoint: rtsp://user:pass@camera/stream
  captures: 4
  interval: 2000
  prompt: "Detect and analyze movement across these 4 sequential images."
```

#### Structured Output with Multiple Images

```yaml
security_camera:
  endpoint: rtsp://user:pass@camera/stream
  captures: 3
  interval: 5000
  prompt: "Analyze security footage for people and vehicle activity."
  output:
    PeopleDetected:
      type: string
      enum: ["Yes", "No", "Unknown"]
    VehicleMovement:
      type: string
      enum: ["Entering", "Leaving", "None", "Unknown"]
```

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

   # With debug logging
   LOG_LEVEL=debug npm start
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

```bash
docker run -d \
  --name mqtt-camera-monitor \
  -e CONFIG_FILE=/app/config/custom-config.yaml \
  -e LOG_LEVEL=debug \
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
      - LOG_LEVEL=info
    volumes:
      - ./config.yaml:/app/config/config.yaml
    restart: unless-stopped
```

## Usage Examples

### Basic Single Image Analysis

```bash
# Trigger analysis
mosquitto_pub -h mqtt-server -t "mqttcaim/garage/trigger" -m "YES"

# Monitor results and status
mosquitto_sub -h mqtt-server -t "mqttcaim/garage/#"
```

### Multi-Image Motion Detection

```bash
# Trigger 5-image sequence analysis
mosquitto_pub -h mqtt-server -t "mqttcaim/driveway/trigger" -m "YES"

# The system will:
# 1. Capture 5 images over 15 seconds (3s intervals)
# 2. Send all images to AI for motion analysis
# 3. Publish results to mqttcaim/driveway/ai
```

### Monitoring Camera Status and Statistics

```bash
# Watch real-time status updates
mosquitto_sub -h mqtt-server -t "mqttcaim/driveway/status"

# Monitor performance statistics
mosquitto_sub -h mqtt-server -t "mqttcaim/driveway/stats"

# Check if application is online
mosquitto_sub -h mqtt-server -t "mqttcaim/online"

# Monitor all activity for a camera
mosquitto_sub -h mqtt-server -t "mqttcaim/driveway/#"

# Monitor everything
mosquitto_sub -h mqtt-server -t "mqttcaim/#"
```

## Multi-Image Capture Benefits

### Motion Detection

- **Direction Analysis**: Detect people/vehicles entering or leaving
- **Speed Estimation**: Understand movement speed across frames
- **Path Tracking**: Follow object movement through the scene

### Context Understanding

- **Activity Patterns**: Understand what happened over time
- **Change Detection**: Identify what changed between frames
- **Event Sequencing**: Understand the order of events

### Use Cases

- **Security Monitoring**: Detect intrusions with movement context
- **Traffic Analysis**: Monitor vehicle flow and parking changes
- **Wildlife Observation**: Track animal behavior over time
- **Package Delivery**: Detect delivery events with full context

## Monitoring & Troubleshooting

### Environment Variables

- **`LOG_LEVEL`**: Controls logging verbosity
  - `error`: Only errors
  - `warn`: Warnings and errors
  - `info`: Info, warnings, and errors (default)
  - `debug`: Debug, info, warnings, and errors
  - `verbose`: Very detailed logging
  - `silly`: Everything
- **`CONFIG_FILE`**: Custom config file path (Docker only)

### Log Files

- **Console output**: Real-time application logs
- **error.log**: Error-level logs only
- **combined.log**: All log levels

### Performance Monitoring

Use the `/stats` topic to monitor camera performance:

```bash
# Get current stats for a camera
mosquitto_sub -h mqtt-server -t "mqttcaim/camera1/stats" -C 1

# Example output:
{
  "lastSuccessDate": "2023-10-15T14:30:25.123Z",
  "lastAiProcessTime": 3.2,
  "lastTotalProcessTime": 12.8
}
```

### Common Issues

- **MQTT Connection**: Check server address, credentials, and network connectivity
- **Camera Access**: Verify RTSP URLs and camera credentials
- **AI API**: Confirm endpoint URL, API token, and model supports vision
- **Multi-Image Timeouts**: Increase AI timeout for multiple image processing
- **Disk Space**: Ensure adequate space for temporary image files
- **Memory Usage**: Multiple large images may require more RAM

### Performance Considerations

- **Capture Duration**: Total time = (captures - 1) × interval
- **AI Processing Time**: Increases with number of images
- **Network Bandwidth**: Multiple images require more upload bandwidth
- **Storage**: Temporary files are automatically cleaned up

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
- `prompt`: Text prompt for AI analysis
- `captures`: Number of sequential images (1-10+, default: 1)
- `interval`: Milliseconds between captures (≥0, default: 1000)
- `output`: Optional structured output schema

> Refer to [Structured model outputs - OpenAI API](https://platform.openai.com/docs/guides/structured-outputs) for more information about the output schema.

### Multi-Image Guidelines

- **Optimal Captures**: 3-5 images for most motion detection scenarios
- **Interval Timing**: 1-5 seconds depending on expected motion speed
- **Total Duration**: Keep under 30 seconds to avoid timeout issues
- **Prompt Design**: Include context about sequential analysis in prompts

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
- Monitor camera `/status` and `/stats` topics for real-time information
- Verify configuration settings
- Ensure network connectivity to MQTT broker and AI endpoint
- Test with single image before using multi-image capture
- Monitor disk space and memory usage for multi-image scenarios
- Open an issue on the project repository

## AI Notice

Vibe-coded in Claude Sonnet 4. No cap.
