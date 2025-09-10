import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import fs from 'fs';

const execPromise = promisify(exec);

export class CameraService {
    constructor() {
        logger.info('Camera Service initialized');
    }

    public async captureImage(rtspUrl: string): Promise<string> {
        const timestamp = Date.now();
        const outputFilePath = `./temp_${timestamp}.jpg`;

        logger.info(`Starting image capture from RTSP URL: ${rtspUrl}`);
        logger.debug(`Output file path: ${outputFilePath}`);

        try {
            // FFmpeg command with high quality settings
            const command = `ffmpeg -i "${rtspUrl}" -vframes 1 -q:v 1 -compression_level 0 -y "${outputFilePath}"`;
            logger.debug(`Executing ffmpeg command: ${command}`);
            
            await execPromise(command);
            
            // Verify the file was created and get its size
            const stats = fs.statSync(outputFilePath);
            logger.info(`Image captured successfully: ${outputFilePath} (${stats.size} bytes)`);
            
            return outputFilePath;
        } catch (error) {
            logger.error(`Error capturing image from camera: ${error}`);
            
            // Clean up any partial file that might have been created
            try {
                if (fs.existsSync(outputFilePath)) {
                    fs.unlinkSync(outputFilePath);
                    logger.debug(`Cleaned up partial file: ${outputFilePath}`);
                }
            } catch (cleanupError) {
                logger.warn(`Failed to clean up partial file: ${cleanupError}`);
            }
            
            throw new Error('Image capture failed');
        }
    }

    public cleanupImageFile(filePath: string): void {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                logger.debug(`Temporary image file deleted: ${filePath}`);
            } else {
                logger.warn(`Temporary image file not found for deletion: ${filePath}`);
            }
        } catch (error) {
            logger.error(`Failed to delete temporary image file ${filePath}: ${error}`);
        }
    }
}