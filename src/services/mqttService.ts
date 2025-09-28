import { MqttClient, connect } from 'mqtt';
import { EventEmitter } from 'events';
import { MqttConfig, CameraStats } from '../types';
import { logger } from '../utils/logger';

export class MqttService extends EventEmitter {
    private client!: MqttClient;
    private config: MqttConfig;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = -1;
    private reconnectInterval = 5000;

    constructor(config: MqttConfig) {
        super();
        this.config = config;
        logger.info('Initializing MQTT service...');
        logger.debug(`Base topic configured as: "${this.config.basetopic}"`);
        logger.debug(`Expected topic structure: ${this.config.basetopic}/<cameraname>/<topicname>`);
        this.initializeConnection();
    }

    private sanitizeMqttConfig(): string {
        return `mqtt://${this.config.user ? '*****' : 'anonymous'}:*****@${this.config.server}:${this.config.port}`;
    }

    private initializeConnection() {
        try {
            logger.info(`Connecting to MQTT broker at ${this.config.server}:${this.config.port}`);
            logger.debug(`MQTT connection string: ${this.sanitizeMqttConfig()}`);

            const onlineTopic = `${this.config.basetopic}/online`;

            this.client = connect(`mqtt://${this.config.server}:${this.config.port}`, {
                username: this.config.user,
                password: this.config.password,
                clientId: this.config.client,
                reconnectPeriod: this.reconnectInterval,
                connectTimeout: 30000,
                keepalive: 60,
                clean: true,
                rejectUnauthorized: false,
                // Last Will and Testament configuration
                will: {
                    topic: onlineTopic,
                    payload: 'NO',
                    qos: 1,
                    retain: true,
                },
            });

            this.client.on('connect', () => {
                logger.info('Connected to MQTT broker successfully');
                this.reconnectAttempts = 0;

                // Publish online status as "YES" when connected
                this.publish(onlineTopic, 'YES', true);
                logger.info(`Published online status to: ${onlineTopic}`);

                // Only subscribe to trigger pattern - not all topics
                const triggerPattern = `${this.config.basetopic}/+/trigger`;
                logger.debug(`Subscribing to trigger pattern: "${triggerPattern}"`);
                this.subscribe(triggerPattern);

                this.emit('connected');
            });

            this.client.on('reconnect', () => {
                this.reconnectAttempts++;
                logger.info(`Attempting to reconnect to MQTT broker (attempt ${this.reconnectAttempts})...`);
            });

            this.client.on('offline', () => {
                logger.warn('MQTT client is offline, will attempt to reconnect...');
            });

            this.client.on('error', (error) => {
                logger.error(`MQTT connection issue: ${error.message}. Retrying...`);
            });

            this.client.on('message', (topic, message) => {
                // Check if this is a binary image topic to avoid logging binary data
                const isBinaryTopic = this.isBinaryImageTopic(topic);

                if (isBinaryTopic) {
                    logger.debug(`Received MQTT message - Topic: "${topic}", Binary data: ${message.length} bytes`);
                } else {
                    logger.debug(`Received MQTT message - Topic: "${topic}", Message: "${message.toString()}"`);
                }

                this.handleMessage(topic, message.toString(), isBinaryTopic);
            });
        } catch (error) {
            logger.error(`Failed to initialize MQTT connection: ${error}. Retrying in ${this.reconnectInterval}ms...`);
            setTimeout(() => this.initializeConnection(), this.reconnectInterval);
        }
    }

    private isBinaryImageTopic(topic: string): boolean {
        // Check if topic ends with /image (binary image data)
        return topic.endsWith('/image');
    }

    private handleMessage(topic: string, message: string, isBinaryTopic: boolean = false) {
        // Don't process binary image topics as they're not meant for triggering
        if (isBinaryTopic) {
            logger.debug(`Ignoring binary image topic: "${topic}"`);
            return;
        }

        logger.debug(`Processing message - Topic: "${topic}", Message: "${message}"`);

        // Check if topic starts with our configured basetopic
        if (!topic.startsWith(this.config.basetopic + '/')) {
            logger.warn(`Topic "${topic}" does not start with configured basetopic: "${this.config.basetopic}"`);
            return;
        }

        // Remove the basetopic from the beginning to get the remaining path
        const targetTopic = topic.substring(this.config.basetopic.length + 1);

        // Check if this is the online status topic - ignore it
        if (targetTopic === 'online') {
            logger.debug(`Ignoring online status topic: "${topic}"`);
            return;
        }

        // Expected format after basetopic removal: <cameraname>/<topicname>
        const topicParts = targetTopic.split('/');
        logger.debug(`Topic breakdown: [${topicParts.map((part, index) => `${index}:"${part}"`).join(', ')}]`);

        // Verify the remaining topic structure has at least 2 parts (camera/topicname)
        if (topicParts.length < 2) {
            logger.warn(
                `Topic "${targetTopic}" has insufficient parts (expected at least 2: cameraname/topicname)`
            );
            return;
        }

        const cameraName = topicParts[0];
        const topicName = topicParts[1];

        logger.debug(
            `Parsed topic - Camera: "${cameraName}", TopicName: "${topicName}"`
        );

        // Check if this is a trigger message
        if (topicName === 'trigger') {
            logger.info(`Trigger message detected for camera: "${cameraName}"`);

            if (message.toUpperCase() === 'YES') {
                logger.info(`Trigger condition met for camera: "${cameraName}" - Processing...`);
                this.emit('trigger', cameraName);
            } else {
                logger.debug(`Message "${message}" does not match trigger condition "YES"`);
            }
        } else {
            logger.debug(`Non-trigger message on topic: "${topicName}"`);
        }
    }

    public subscribe(topic: string) {
        if (this.client && this.client.connected) {
            this.client.subscribe(topic, (err) => {
                if (err) {
                    logger.error(`Failed to subscribe to ${topic}: ${err.message}`);
                } else {
                    logger.info(`Successfully subscribed to: "${topic}"`);
                }
            });
        } else {
            logger.warn(`Cannot subscribe to ${topic}: MQTT client not connected`);
        }
    }

    public publish(topic: string, message: string, retain: boolean = false) {
        if (this.client && this.client.connected) {
            logger.info(`Publishing to "${topic}": "${message}"${retain ? ' (retained)' : ''}`);
            this.client.publish(topic, message, { retain }, (err) => {
                if (err) {
                    logger.error(`Failed to publish to ${topic}: ${err.message}`);
                } else {
                    logger.debug(`Successfully published to "${topic}"`);
                }
            });
        } else {
            logger.warn(`Cannot publish to ${topic}: MQTT client not connected`);
        }
    }

    public publishBinary(topic: string, data: Buffer, retain: boolean = false) {
        if (this.client && this.client.connected) {
            logger.info(`Publishing binary data to "${topic}": ${data.length} bytes${retain ? ' (retained)' : ''}`);
            this.client.publish(topic, data, { retain }, (err) => {
                if (err) {
                    logger.error(`Failed to publish binary data to ${topic}: ${err.message}`);
                } else {
                    logger.debug(`Successfully published binary data to "${topic}"`);
                }
            });
        } else {
            logger.warn(`Cannot publish binary data to ${topic}: MQTT client not connected`);
        }
    }

    public publishStats(cameraName: string, stats: CameraStats) {
        const topic = `${this.config.basetopic}/${cameraName}/stats`;
        const message = JSON.stringify(stats);
        this.publish(topic, message, true); // Retained
    }

    public publishStatus(cameraName: string, status: string) {
        const topic = `${this.config.basetopic}/${cameraName}/status`;
        this.publish(topic, status, true); // Retained
    }

    public initializeChannels(cameras: Record<string, any>) {
        logger.info(`Initializing MQTT channels for ${Object.keys(cameras).length} cameras...`);
        logger.debug(`Using basetopic: "${this.config.basetopic}"`);

        Object.keys(cameras).forEach((cameraName) => {
            const triggerTopic = `${this.config.basetopic}/${cameraName}/trigger`;
            const imageTopic = `${this.config.basetopic}/${cameraName}/image`;
            const aiTopic = `${this.config.basetopic}/${cameraName}/ai`;
            const statsTopic = `${this.config.basetopic}/${cameraName}/stats`;
            const statusTopic = `${this.config.basetopic}/${cameraName}/status`;

            logger.info(`Initializing channels for camera: "${cameraName}"`);
            logger.debug(`Trigger topic: "${triggerTopic}"`);
            logger.debug(`Image topic: "${imageTopic}"`);
            logger.debug(`AI topic: "${aiTopic}"`);
            logger.debug(`Stats topic: "${statsTopic}"`);
            logger.debug(`Status topic: "${statusTopic}"`);

            // Initialize channels
            this.publish(triggerTopic, 'NO', true);
            this.publishBinary(imageTopic, Buffer.alloc(0), true); // Empty binary data
            this.publish(aiTopic, '', true);
            this.publish(statsTopic, JSON.stringify({}), true); // Empty stats object
            this.publish(statusTopic, 'Idle', true); // Initial status
        });
        logger.info('Channel initialization complete');
    }

    public subscribeToSpecificCameras(cameras: Record<string, any>) {
        logger.debug('Subscribing to specific camera trigger topics...');
        Object.keys(cameras).forEach((cameraName) => {
            const triggerTopic = `${this.config.basetopic}/${cameraName}/trigger`;
            logger.info(`Subscribing to specific trigger topic: "${triggerTopic}"`);
            this.subscribe(triggerTopic);
        });
    }

    public gracefulShutdown() {
        logger.info('Performing graceful MQTT shutdown...');
        if (this.client && this.client.connected) {
            const onlineTopic = `${this.config.basetopic}/online`;
            // Publish offline status before disconnecting
            this.client.publish(onlineTopic, 'NO', { retain: true }, (err) => {
                if (err) {
                    logger.error(`Failed to publish offline status: ${err.message}`);
                } else {
                    logger.info('Published offline status');
                }
                this.client.end();
            });
        }
    }

    public connect() {
        logger.info('Manual connection requested...');
        if (this.client) {
            this.client.reconnect();
        } else {
            this.initializeConnection();
        }
    }

    public isConnected(): boolean {
        return this.client && this.client.connected;
    }
}
