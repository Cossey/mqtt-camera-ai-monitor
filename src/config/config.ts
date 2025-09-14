import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { Config } from '../types';

const loadConfig = (): Config => {
    let configPath: string;

    // Check if running in Docker and CONFIG_FILE environment variable is set
    if (process.env.CONFIG_FILE && fs.existsSync('/.dockerenv')) {
        configPath = process.env.CONFIG_FILE;
        console.log(`Running in Docker: Using config file from environment variable: ${configPath}`);
    } else {
        configPath = path.join(__dirname, '../../config.yaml');
        console.log(`Using default config file: ${configPath}`);
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

        console.log(`Configuration loaded successfully with ${Object.keys(config.cameras).length} cameras`);
        return config;
    } catch (e) {
        console.error('Error loading configuration:', e);
        process.exit(20);
    }
};

function processCameraConfig(config: Config) {
    // Validate and process camera configurations
    for (const [name, camera] of Object.entries(config.cameras)) {
        if (!camera.endpoint) {
            throw new Error(`Invalid camera configuration for ${name}: Missing endpoint`);
        }

        // Support both 'prompt' and 'prompts' fields
        if (!camera.prompt) {
            throw new Error(`Invalid camera configuration for ${name}: Missing prompt`);
        }

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
