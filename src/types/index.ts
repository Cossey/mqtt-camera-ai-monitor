export interface MqttConfig {
  server: string;
  port: number;
  basetopic: string;
  user: string;
  password: string;
  client: string;
}

export interface OpenAiConfig {
  endpoint: string;
  api_token: string;
  model: string; // Add model configuration
}

export interface CameraConfig {
  endpoint: string;
  prompt: string;
}

export interface Config {
  mqtt: MqttConfig;
  openai: OpenAiConfig;
  cameras: Record<string, CameraConfig>;
}

export interface AiResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}