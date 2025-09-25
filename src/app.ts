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
        let imagePaths: string[] = [];

        try {
            const captures = cameraConfig.captures || 1;
            const interval = cameraConfig.interval || 1000;

            logger.info(`Starting image capture for camera: ${cameraName} (${captures} captures, ${interval}ms intervals)`);

            // Capture single or multiple images based on configuration
            if (captures === 1) {
                // Backwards compatibility: single image capture
                const imagePath = await cameraService.captureImage(cameraConfig.endpoint);
                imagePaths = [imagePath];
                logger.info(`Single image captured successfully: ${imagePath}`);
            } else {
                // Multi-image capture
                imagePaths = await cameraService.captureMultipleImages(
                    cameraConfig.endpoint,
                    captures,
                    interval
                );
                logger.info(`${imagePaths.length} images captured successfully`);
            }

            // Publish the first (or only) image as binary data to MQTT (retained)
            logger.debug(`Reading primary image file for MQTT publishing...`);
            const primaryImageBuffer = fs.readFileSync(imagePaths[0]);
            logger.info(`Primary image read as binary, size: ${primaryImageBuffer.length} bytes`);

            mqttService.publishBinary(`${config.mqtt.basetopic}/${cameraName}/image`, primaryImageBuffer, true);
            logger.info(`Primary image binary data published to MQTT for camera: ${cameraName}`);

            // Send all images to AI service for processing
            logger.info(`Sending ${imagePaths.length} image(s) to AI service for processing...`);
            const aiResponse = await aiService.sendImagesAndPrompt(
                imagePaths,
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

            // Clean up all temporary image files
            await cameraService.cleanupImageFiles(imagePaths);
            logger.debug(`Cleaned up ${imagePaths.length} temporary image file(s)`);

            // Reset trigger state to "NO" (retained)
            mqttService.publish(`${config.mqtt.basetopic}/${cameraName}/trigger`, 'NO', true);

            logger.info(`Trigger processing completed for camera: ${cameraName}`);
        } catch (error) {
            logger.error(`Error processing trigger for camera ${cameraName}: ${error}`);

            // Clean up any temporary image files on error
            await cameraService.cleanupImageFiles(imagePaths);

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
