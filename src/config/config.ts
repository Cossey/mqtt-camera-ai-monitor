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

export const config = loadConfig();