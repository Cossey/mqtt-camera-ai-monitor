import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { Config } from '../types';

const configPath = path.join(__dirname, '../../config/config.yaml');

const loadConfig = (): Config => {
  try {
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContents) as Config;
    
    // Validate configuration
    if (!config.mqtt || !config.openai || !config.cameras) {
      throw new Error('Invalid configuration: Missing required sections');
    }
    
    // Ensure port is a number
    if (typeof config.mqtt.port === 'string') {
      const port = parseInt(config.mqtt.port as any, 10);
      if (isNaN(port)) {
        throw new Error('MQTT port must be a valid number');
      }
      config.mqtt.port = port;
    }
    
    return config;
  } catch (e) {
    console.error('Error loading configuration:', e);
    process.exit(20);
  }
};

export const config = loadConfig();