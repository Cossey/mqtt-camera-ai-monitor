# MQTT Camera AI Monitor

## Overview

The MQTT Camera AI Monitor is a Node application that monitors MQTT channels for commands, captures images from RTSP cameras, and interacts with an OpenAI endpoint to process these images.
The application is designed to support multiple cameras and can be easily configured through a YAML file.

## Features

- Monitors MQTT channels for trigger commands.
- Connects to RTSP cameras to capture screenshots.
- Uploads images and prompts to an OpenAI-compatible endpoint.
- Publishes AI responses and images back to specified MQTT channels.
- Configurable settings for MQTT, cameras, and OpenAI in a YAML file.

## Installation

Install dependencies:

```bash
npm install
```

Configure the application by editing the `config/config.yaml` file with your MQTT server, camera details, and OpenAI endpoint.

## Usage

To run the application, use the following command:

```bash
npm start
```

The application will start monitoring the specified MQTT channels.
When a trigger command is received, it will capture an image from the configured cameras, send it to the OpenAI endpoint, and publish the results back to the MQTT channels.

## Docker

Map your config to the `/usr/src/app/config/` folder in the container.

## Contributing

Contributions are welcome!
Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the BSD 3-Clause License.
See the LICENSE file for more details.
