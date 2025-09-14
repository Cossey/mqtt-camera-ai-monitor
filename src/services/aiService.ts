import axios, { AxiosError } from 'axios';
import fs from 'fs';
import { AiResponse, ResponseFormatSchema } from '../types';
import { logger } from '../utils/logger';

export class AiService {
    private endpoint: string;
    private apiToken: string;
    private model: string;

    constructor(endpoint: string, apiToken: string, model: string) {
        this.endpoint = endpoint;
        this.apiToken = apiToken;
        this.model = model;
        logger.info(`AI Service initialized with endpoint: ${endpoint}`);
        logger.info(`AI Service using model: ${model}`);
    }

    public async sendImageAndPrompt(
        imagePath: string,
        prompt: string,
        responseFormat?: ResponseFormatSchema
    ): Promise<AiResponse> {
        logger.info(`Preparing to send image ${imagePath} with prompt: "${prompt}"`);

        try {
            // Read and encode the image as base64
            logger.debug(`Reading image file: ${imagePath}`);
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = imageBuffer.toString('base64');
            logger.debug(`Image encoded to base64, size: ${base64Image.length} characters`);

            // Prepare the OpenAI chat completions request
            const requestBody: any = {
                model: this.model, // Use configurable model
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt,
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`,
                                },
                            },
                        ],
                    },
                ],
                max_tokens: 300,
            };

            // Add response_format if provided
            if (responseFormat) {
                requestBody.response_format = responseFormat;
                logger.debug(`Using structured output with schema: ${responseFormat.json_schema.name}`);
            }

            logger.info(`Sending request to AI endpoint: ${this.endpoint}`);
            logger.debug(`Request body prepared with model: ${requestBody.model}`);

            const response = await axios.post(this.endpoint, requestBody, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiToken}`,
                },
                timeout: 60000, // Increase timeout to 60 seconds
            });

            logger.info(`AI response received successfully`);
            logger.debug(`AI response status: ${response.status}`);
            logger.debug(`AI response data: ${JSON.stringify(response.data)}`);

            return response.data;
        } catch (error: unknown) {
            logger.error(`AI service error: ${error}`);

            // Type guard for AxiosError
            if (error instanceof AxiosError) {
                logger.error(`AI service HTTP error status: ${error.response?.status}`);
                logger.error(`AI service HTTP error data: ${JSON.stringify(error.response?.data)}`);
            } else if (error instanceof Error) {
                logger.error(`AI service error message: ${error.message}`);
            }

            throw error;
        }
    }
}
