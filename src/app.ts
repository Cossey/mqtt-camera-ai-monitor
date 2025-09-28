import { MqttService } from './services/mqttService';
import { CameraService } from './services/cameraService';
import { AiService } from './services/aiService';
import { StatusService } from './services/statusService';
import { config } from './config/config';
import { logger } from './utils/logger';
import fs from 'fs';

const mqttService = new MqttService(config.mqtt);
const cameraService = new CameraService();
const aiService = new AiService(config.openai.endpoint, config.openai.api_token, config.openai.model);
const statusService = new StatusService();

// Wire up status service events to MQTT publishing
statusService.on('statusUpdate', (cameraName: string, status: string) => {
    mqttService.publishStatus(cameraName, status);
});

statusService.on('statsUpdate', (cameraName: string, stats: any) => {
    mqttService.publishStats(cameraName, stats);
});

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
        const totalStartTime = Date.now();
        let imagePaths: string[] = [];

        try {
            statusService.updateStatus(cameraName, 'Starting image capture');

            const { captures = 1, interval = 1000 } = cameraConfig;

            logger.debug(`Starting image capture for camera: ${cameraName} (${captures} captures, ${interval}ms intervals)`);

            if (captures === 1) {
                statusService.updateStatus(cameraName, 'Taking snapshot');
                const imagePath = await cameraService.captureImage(cameraConfig.endpoint);
                imagePaths = [imagePath];
                logger.debug(`Single image captured successfully: ${imagePath}`);
            } else {
                statusService.updateStatus(cameraName, `Taking snapshot 1/${captures}`);

                for (let i = 0; i < captures; i++) {
                    statusService.updateStatus(cameraName, `Taking snapshot ${i + 1}/${captures}`);
                    const imagePath = await cameraService.captureImage(cameraConfig.endpoint);
                    imagePaths.push(imagePath);

                    if (i < captures - 1 && interval > 0) {
                        statusService.updateStatus(cameraName, `Waiting for next capture (${i + 1}/${captures})`);
                        await new Promise(resolve => setTimeout(resolve, interval));
                    }
                }

                logger.debug(`${imagePaths.length} images captured successfully`);
            }

            // Read primary image for MQTT publishing
            statusService.updateStatus(cameraName, 'Publishing image');
            logger.debug(`Reading primary image file for MQTT publishing...`);
            const primaryImageBuffer = fs.readFileSync(imagePaths[0]);
            logger.debug(`Primary image read as binary, size: ${primaryImageBuffer.length} bytes`);

            // Publish primary image to MQTT
            mqttService.publishBinary(`${config.mqtt.basetopic}/${cameraName}/image`, primaryImageBuffer, true);
            logger.debug(`Primary image binary data published to MQTT for camera: ${cameraName}`);

            // Send to AI service
            statusService.updateStatus(cameraName, 'Processing with AI');
            const aiStartTime = Date.now();

            let aiResponse;
            if (cameraConfig.response_format) {
                aiResponse = await aiService.sendImagesAndPrompt(
                    imagePaths,
                    cameraConfig.prompt,
                    cameraConfig.response_format
                );
            } else {
                aiResponse = await aiService.sendImagesAndPrompt(imagePaths, cameraConfig.prompt);
            }

            const aiEndTime = Date.now();
            const aiProcessTime = (aiEndTime - aiStartTime) / 1000; // Convert to seconds
            const totalProcessTime = (aiEndTime - totalStartTime) / 1000; // Convert to seconds

            // Extract response content
            let responseContent = '';
            if (aiResponse && aiResponse.choices && aiResponse.choices.length > 0) {
                responseContent = aiResponse.choices[0].message.content;
            }

            // Publish AI response
            statusService.updateStatus(cameraName, 'Publishing AI response');
            mqttService.publish(`${config.mqtt.basetopic}/${cameraName}/ai`, responseContent, true);

            // Clean up temporary image files
            statusService.updateStatus(cameraName, 'Cleaning up');
            await cameraService.cleanupImageFiles(imagePaths);
            logger.debug(`Cleaned up ${imagePaths.length} temporary image file(s)`);

            // Reset trigger state to "NO" (retained)
            mqttService.publish(`${config.mqtt.basetopic}/${cameraName}/trigger`, 'NO', true);

            // Record successful completion
            statusService.recordSuccess(cameraName, aiProcessTime, totalProcessTime);

            logger.info(`Trigger processing completed for camera: ${cameraName} (AI: ${aiProcessTime}s, Total: ${totalProcessTime}s)`);
        } catch (error) {
            logger.error(`Error processing trigger for camera ${cameraName}: ${error}`);

            // Record error
            statusService.recordError(cameraName, error as Error);

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
        // Update all camera statuses to offline
        const cameras = Object.keys(config.cameras);
        cameras.forEach(cameraName => {
            statusService.updateStatus(cameraName, 'Offline');
        });

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

// Handle process signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    process.exit(1);
});

// Start the application
initialize().catch((error) => {
    logger.error(`Failed to start application: ${error}`);
    process.exit(1);
});
