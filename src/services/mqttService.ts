import { MqttClient, connect } from 'mqtt';
import { EventEmitter } from 'events';
import { MqttConfig } from '../types';
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
        logger.info(`Base topic configured as: "${this.config.basetopic}"`);
        logger.info(`Expected topic structure: ${this.config.basetopic}/<cameraname>/<topicname>`);
        this.initializeConnection();
    }

    private initializeConnection() {
        try {
            logger.info(`Connecting to MQTT broker at ${this.config.server}:${this.config.port}`);

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

                // Subscribe to both wildcard pattern and debug with all messages
                const triggerPattern = `${this.config.basetopic}/+/trigger`;
                const allPattern = `${this.config.basetopic}/#`; // Subscribe to everything for debugging

                logger.info(`Subscribing to trigger pattern: "${triggerPattern}"`);
                logger.info(`Subscribing to debug pattern: "${allPattern}"`);

                this.subscribe(triggerPattern);
                this.subscribe(allPattern); // This will help us see all messages

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
                logger.info(`Received MQTT message - Topic: "${topic}", Message: "${message.toString()}"`);
                this.handleMessage(topic, message.toString());
            });
        } catch (error) {
            logger.error(`Failed to initialize MQTT connection: ${error}. Retrying in ${this.reconnectInterval}ms...`);
            setTimeout(() => this.initializeConnection(), this.reconnectInterval);
        }
    }

    private handleMessage(topic: string, message: string) {
        logger.info(`Processing message - Topic: "${topic}", Message: "${message}"`);

        // Expected format: <basetopic>/<cameraname>/<topicname>
        const topicParts = topic.split('/');
        logger.debug(`Topic breakdown: [${topicParts.map((part, index) => `${index}:"${part}"`).join(', ')}]`);

        // Verify the topic structure matches our expected pattern
        if (topicParts.length < 3) {
            logger.warn(
                `Topic "${topic}" has insufficient parts (expected at least 3: basetopic/cameraname/topicname)`
            );
            return;
        }

        const receivedBasetopic = topicParts[0];
        const cameraName = topicParts[1];
        const topicName = topicParts[2];

        logger.debug(
            `Parsed topic - Basetopic: "${receivedBasetopic}", Camera: "${cameraName}", TopicName: "${topicName}"`
        );

        // Verify basetopic matches our configuration
        if (receivedBasetopic !== this.config.basetopic) {
            logger.warn(`Basetopic mismatch - Expected: "${this.config.basetopic}", Received: "${receivedBasetopic}"`);
            return;
        }

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

    public initializeChannels(cameras: Record<string, any>) {
        logger.info(`Initializing MQTT channels for ${Object.keys(cameras).length} cameras...`);
        logger.info(`Using basetopic: "${this.config.basetopic}"`);

        Object.keys(cameras).forEach((cameraName) => {
            const triggerTopic = `${this.config.basetopic}/${cameraName}/trigger`;
            const imageTopic = `${this.config.basetopic}/${cameraName}/image`;
            const aiTopic = `${this.config.basetopic}/${cameraName}/ai`;

            logger.info(`Initializing channels for camera: "${cameraName}"`);
            logger.debug(`Trigger topic: "${triggerTopic}"`);
            logger.debug(`Image topic: "${imageTopic}"`);
            logger.debug(`AI topic: "${aiTopic}"`);

            // Initialize channels
            this.publish(triggerTopic, 'NO', true);
            this.publishBinary(imageTopic, Buffer.alloc(0), true); // Empty binary data
            this.publish(aiTopic, '', true);
        });
        logger.info('Channel initialization complete');
    }

    public subscribeToSpecificCameras(cameras: Record<string, any>) {
        logger.info('Subscribing to specific camera trigger topics...');
        Object.keys(cameras).forEach((cameraName) => {
            const triggerTopic = `${this.config.basetopic}/${cameraName}/trigger`;
            logger.info(`Subscribing to specific trigger topic: "${triggerTopic}"`);
            this.subscribe(triggerTopic);
        });
    }

    public gracefulShutdown() {
        logger.info('Performing graceful MQTT shutdown...');
        if (this.client && this.client.connected) {
            const onlineTopic = `${this.config.basetopic}/Online`;
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
