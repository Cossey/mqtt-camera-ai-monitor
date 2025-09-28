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
    model: string;
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
    captures?: number; // Number of images to capture (default: 1)
    interval?: number; // Milliseconds between captures (default: 1000)
    output?: Record<string, JsonSchemaProperty>;
    response_format?: ResponseFormatSchema;
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

export interface CameraStats {
    lastErrorDate?: string; // ISO datetime string
    lastErrorType?: string;
    lastSuccessDate?: string; // ISO datetime string
    lastAiProcessTime?: number; // seconds
    lastTotalProcessTime?: number; // seconds
}

export interface CameraStatusManager {
    updateStatus(cameraName: string, status: string): void;
    updateStats(cameraName: string, stats: Partial<CameraStats>): void;
    getStats(cameraName: string): CameraStats;
    getStatus(cameraName: string): string;
}