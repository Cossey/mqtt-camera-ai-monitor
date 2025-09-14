import { MqttService } from './services/mqttService';
import { CameraService } from './services/cameraService';
import { AiService } from './services/aiService';
import { config } from './config/config';
import { logger } from './utils/logger';
import fs from 'fs';

const mqttService = new MqttService(config.mqtt);
const cameraService = new CameraService();
const aiService = new AiService(config.openai.endpoint, config.openai.api_token, config.openai.model);

async function initialize() {
    try {
        logger.info('Starting MQTT Camera AI Monitor application...');

        mqttService.on('connected', () => {
            logger.info('MQTT connection established, initializing channels...');
            mqttService.initializeChannels(config.cameras);

            // Also subscribe to specific camera topics as backup
            mqttService.subscribeToSpecificCameras(config.cameras);
        });

        mqttService.on('trigger', handleTrigger);

        logger.info('Application initialization complete, waiting for MQTT connection...');
    } catch (error) {
        logger.error('Failed to initialize application: ' + error);
        process.exit(20);
    }
}

async function handleTrigger(cameraName: string) {
    logger.info(`Processing trigger for camera: ${cameraName}`);
    const cameraConfig = config.cameras[cameraName];

    if (cameraConfig) {
        let imagePath: string | null = null;

        try {
            logger.info(`Capturing image from camera: ${cameraName} at ${cameraConfig.endpoint}`);
            imagePath = await cameraService.captureImage(cameraConfig.endpoint);
            logger.info(`Image captured successfully: ${imagePath}`);

            // Read the image file as binary data for MQTT publishing
            logger.info(`Reading image file for MQTT publishing...`);
            const imageBuffer = fs.readFileSync(imagePath);
            logger.info(`Image read as binary, size: ${imageBuffer.length} bytes`);

            // Publish the binary image data to MQTT (retained)
            mqttService.publishBinary(`${config.mqtt.basetopic}/${cameraName}/image`, imageBuffer, true);
            logger.info(`Image binary data published to MQTT for camera: ${cameraName}`);

            // Now send to AI service for processing
            logger.info(`Sending image to AI service for processing...`);
            const aiResponse = await aiService.sendImageAndPrompt(
                imagePath,
                cameraConfig.prompt,
                cameraConfig.response_format
            );
            logger.info(`AI processing completed for camera: ${cameraName}`);

            // Extract the AI response content
            const aiContent =
                aiResponse.choices && aiResponse.choices.length > 0
                    ? aiResponse.choices[0].message.content
                    : 'No response generated';

            // Publish AI response with retention
            mqttService.publish(`${config.mqtt.basetopic}/${cameraName}/ai`, aiContent, true);

            // Clean up the temporary image file
            if (imagePath) {
                cameraService.cleanupImageFile(imagePath);
                imagePath = null; // Mark as cleaned up
            }

            // Reset trigger state to "NO" (retained)
            mqttService.publish(`${config.mqtt.basetopic}/${cameraName}/trigger`, 'NO', true);

            logger.info(`Trigger processing completed for camera: ${cameraName}`);
        } catch (error) {
            logger.error(`Error processing trigger for camera ${cameraName}: ${error}`);

            // Clean up the temporary image file even on error
            if (imagePath) {
                cameraService.cleanupImageFile(imagePath);
            }

            // Reset trigger state even on error
            mqttService.publish(`${config.mqtt.basetopic}/${cameraName}/trigger`, 'NO', true);
        }
    } else {
        logger.warn(`No configuration found for camera: ${cameraName}`);
    }
}

// Graceful shutdown function
async function gracefulShutdown(signal: string) {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    try {
        mqttService.gracefulShutdown();

        // Give MQTT client time to send the offline message
        await new Promise((resolve) => setTimeout(resolve, 1000));

        logger.info('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        logger.error(`Error during graceful shutdown: ${error}`);
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at: ' + promise + ' reason: ' + reason);
    process.exit(20);
});

// Handle process termination
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error}`);
    gracefulShutdown('uncaughtException');
});

logger.info('Starting application...');
initialize();
