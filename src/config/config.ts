import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { Config } from '../types';
import { logger } from '../utils/logger';

// Add sanitization helper
const sanitizeConfig = (config: Config): any => {
    return {
        ...config,
        mqtt: {
            ...config.mqtt,
            password: config.mqtt.password ? '*****' : undefined,
        },
        openai: {
            ...config.openai,
            api_token: config.openai.api_token ? '*****' : undefined,
        },
        cameras: Object.fromEntries(
            Object.entries(config.cameras).map(([name, camera]) => [
                name,
                {
                    ...camera,
                    endpoint: sanitizeRtspUrl(camera.endpoint),
                },
            ])
        ),
    };
};

const sanitizeRtspUrl = (rtspUrl: string): string => {
    try {
        const url = new URL(rtspUrl);
        if (url.username || url.password) {
            return `${url.protocol}//*****:*****@${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}${url.search || ''}`;
        }
        return rtspUrl;
    } catch (error) {
        return rtspUrl.replace(/rtsp:\/\/.*/, 'rtsp://*****:*****@*****/****');
    }
};

const loadConfig = (): Config => {
    let configPath: string;

    // Check if running in Docker and CONFIG_FILE environment variable is set
    if (process.env.CONFIG_FILE && fs.existsSync('/.dockerenv')) {
        configPath = process.env.CONFIG_FILE;
        logger.info(`Running in Docker: Using config file from environment variable: ${configPath}`);
    } else {
        configPath = path.join(__dirname, '../../config.yaml');
        logger.info(`Using default config file: ${configPath}`);
    }

    try {
        if (!fs.existsSync(configPath)) {
            throw new Error(`Configuration file not found: ${configPath}`);
        }

        const fileContents = fs.readFileSync(configPath, 'utf8');
        const config = yaml.load(fileContents) as Config;

        // Validate configuration
        if (!config.mqtt || !config.openai || !config.cameras) {
            throw new Error('Invalid configuration: Missing required sections (mqtt, openai, cameras)');
        }

        if (!config.mqtt.server || !config.mqtt.basetopic) {
            throw new Error('Invalid MQTT configuration: Missing server or basetopic');
        }

        if (!config.openai.endpoint || !config.openai.api_token || !config.openai.model) {
            throw new Error('Invalid OpenAI configuration: Missing endpoint, api_token, or model');
        }

        if (!config.cameras || Object.keys(config.cameras).length === 0) {
            throw new Error('Invalid configuration: No cameras configured');
        }

        processCameraConfig(config);

        // Ensure port is a number
        if (typeof config.mqtt.port === 'string') {
            const port = parseInt(config.mqtt.port as any, 10);
            if (isNaN(port)) {
                throw new Error('MQTT port must be a valid number');
            }
            config.mqtt.port = port;
        }

        logger.info(`Configuration loaded successfully with ${Object.keys(config.cameras).length} cameras`);
        logger.debug(`Configuration summary: ${JSON.stringify(sanitizeConfig(config), null, 2)}`);
        return config;
    } catch (e) {
        logger.error('Error loading configuration: ' + e);
        process.exit(20);
    }
};

function processCameraConfig(config: Config) {
    // Validate and process camera configurations
    for (const [name, camera] of Object.entries(config.cameras)) {
        if (!camera.endpoint) {
            throw new Error(`Invalid camera configuration for ${name}: Missing endpoint`);
        }

        if (!camera.prompt) {
            throw new Error(`Invalid camera configuration for ${name}: Missing prompt`);
        }

        // Set defaults for multi-capture settings
        if (camera.captures === undefined) {
            camera.captures = 1;
        }

        if (camera.interval === undefined) {
            camera.interval = 1000;
        }

        // Validate multi-capture settings
        if (camera.captures < 1) {
            throw new Error(`Invalid camera configuration for ${name}: captures must be at least 1`);
        }

        if (camera.interval < 0) {
            throw new Error(`Invalid camera configuration for ${name}: interval must be non-negative`);
        }

        logger.debug(`Camera ${name}: ${camera.captures} capture(s) with ${camera.interval}ms intervals from ${sanitizeRtspUrl(camera.endpoint)}`);

        // Auto-generate full response_format structure if simplified format is provided
        if (!camera.response_format && camera.output && typeof camera.output === 'object') {
            camera.response_format = {
                type: 'json_schema',
                json_schema: {
                    name: `${name}_output`,
                    strict: true,
                    schema: {
                        type: 'object',
                        properties: buildJsonSchema(camera.output),
                        additionalProperties: false,
                        required: Object.keys(camera.output),
                    },
                },
            };
        }
    }
}

function buildJsonSchema(properties: any): any {
    return Object.fromEntries(
        Object.entries(properties).map(([key, prop]: [string, any]) => [
            key,
            {
                ...prop,
                ...(prop.type === 'object' &&
                    prop.properties && {
                        properties: buildJsonSchema(prop.properties),
                        additionalProperties: false,
                        required: Object.keys(prop.properties),
                    }),
                ...(prop.type === 'array' &&
                    prop.items?.type === 'object' &&
                    prop.items.properties && {
                        items: {
                            ...prop.items,
                            properties: buildJsonSchema(prop.items.properties),
                            additionalProperties: false,
                            required: Object.keys(prop.items.properties),
                        },
                    }),
            },
        ])
    );
}

export const config = loadConfig();
