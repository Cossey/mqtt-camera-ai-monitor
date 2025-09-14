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

export interface JsonSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
}

export interface JsonSchema {
  type: string;
  properties: Record<string, JsonSchemaProperty>;
  additionalProperties: boolean;
  required: string[];
}

export interface ResponseFormatSchema {
  type: string;
  json_schema: {
    name: string;
    strict: boolean;
    schema: JsonSchema;
  };
}

export interface CameraConfig {
  endpoint: string;
  prompt: string;
  output?: Record<string, JsonSchemaProperty>; // Simplified user provided structured output schema
  response_format?: ResponseFormatSchema; // Fully generated structured output response format schema
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