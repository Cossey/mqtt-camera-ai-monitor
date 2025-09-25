import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import fs from 'fs';

const execPromise = promisify(exec);

export class CameraService {
    constructor() {
        logger.debug('Camera Service initialized');
    }

    private sanitizeRtspUrl(rtspUrl: string): string {
        try {
            const url = new URL(rtspUrl);
            if (url.username || url.password) {
                return `${url.protocol}//*****:*****@${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}${url.search || ''}`;
            }
            return rtspUrl;
        } catch (error) {
            // If URL parsing fails, just mask the entire URL after rtsp://
            return rtspUrl.replace(/rtsp:\/\/.*/, 'rtsp://*****:*****@*****/****');
        }
    }

    public async captureImage(rtspUrl: string): Promise<string> {
        const timestamp = Date.now();
        const outputFilePath = `./temp_${timestamp}.jpg`;

        logger.info(`Starting image capture from RTSP URL: ${this.sanitizeRtspUrl(rtspUrl)}`);
        logger.debug(`Output file path: ${outputFilePath}`);

        try {
            // FFmpeg command with high quality settings
            const command = `ffmpeg -i "${rtspUrl}" -vframes 1 -q:v 1 -compression_level 0 -y "${outputFilePath}"`;
            logger.debug(`Executing ffmpeg command: ffmpeg -i "${this.sanitizeRtspUrl(rtspUrl)}" -vframes 1 -q:v 1 -compression_level 0 -y "${outputFilePath}"`);

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

    public async captureMultipleImages(
        rtspUrl: string,
        captures: number = 1,
        interval: number = 1000
    ): Promise<string[]> {
        logger.info(`Starting multi-image capture: ${captures} images with ${interval}ms intervals from ${this.sanitizeRtspUrl(rtspUrl)}`);

        if (captures < 1) {
            throw new Error('Number of captures must be at least 1');
        }

        if (interval < 0) {
            throw new Error('Interval must be non-negative');
        }

        const imagePaths: string[] = [];

        try {
            for (let i = 0; i < captures; i++) {
                logger.info(`Capturing image ${i + 1}/${captures}...`);

                const imagePath = await this.captureImage(rtspUrl);
                imagePaths.push(imagePath);

                logger.info(`Image ${i + 1}/${captures} captured: ${imagePath}`);

                // Wait for interval before next capture (except for the last image)
                if (i < captures - 1 && interval > 0) {
                    logger.debug(`Waiting ${interval}ms before next capture...`);
                    await this.sleep(interval);
                }
            }

            logger.info(`Multi-image capture completed: ${imagePaths.length} images captured`);
            return imagePaths;
        } catch (error) {
            logger.error(`Error during multi-image capture: ${error}`);

            // Clean up any successfully captured images on error
            await this.cleanupImageFiles(imagePaths);

            throw error;
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

    public async cleanupImageFiles(filePaths: string[]): Promise<void> {
        if (!filePaths || filePaths.length === 0) {
            return;
        }

        logger.debug(`Cleaning up ${filePaths.length} temporary image files...`);

        for (const filePath of filePaths) {
            this.cleanupImageFile(filePath);
        }

        logger.debug('Temporary image files cleanup completed');
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
