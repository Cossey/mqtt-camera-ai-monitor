import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';

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
            const command = `ffmpeg -i "${rtspUrl}" -vframes 1 -y "${outputFilePath}"`;
            logger.debug(`Executing ffmpeg command: ${command}`);
            
            await execPromise(command);
            
            logger.info(`Image captured successfully: ${outputFilePath}`);
            return outputFilePath;
        } catch (error) {
            logger.error(`Error capturing image from camera: ${error}`);
            throw new Error('Image capture failed');
        }
    }
}