import { EventEmitter } from 'events';
import { CameraStats } from '../types';
import { logger } from '../utils/logger';

export class StatusService extends EventEmitter {
    private cameraStats: Record<string, CameraStats> = {};
    private cameraStatus: Record<string, string> = {};

    constructor() {
        super();
        logger.debug('Status Service initialized');
    }

    public updateStatus(cameraName: string, status: string): void {
        this.cameraStatus[cameraName] = status;
        logger.debug(`Status updated for camera ${cameraName}: ${status}`);

        // Emit event for MQTT publishing
        this.emit('statusUpdate', cameraName, status);
    }

    public updateStats(cameraName: string, stats: Partial<CameraStats>): void {
        if (!this.cameraStats[cameraName]) {
            this.cameraStats[cameraName] = {};
        }

        // Update only the provided fields
        Object.assign(this.cameraStats[cameraName], stats);

        logger.debug(`Stats updated for camera ${cameraName}: ${JSON.stringify(stats)}`);

        // Emit event for MQTT publishing
        this.emit('statsUpdate', cameraName, this.cameraStats[cameraName]);
    }

    public getStats(cameraName: string): CameraStats {
        return this.cameraStats[cameraName] || {};
    }

    public getStatus(cameraName: string): string {
        return this.cameraStatus[cameraName] || 'Idle';
    }

    public recordError(cameraName: string, error: string | Error): void {
        const errorMessage = error instanceof Error ? error.message : error;
        const now = new Date().toISOString();

        this.updateStats(cameraName, {
            lastErrorDate: now,
            lastErrorType: errorMessage
        });

        this.updateStatus(cameraName, 'Error');
        logger.debug(`Error recorded for camera ${cameraName}: ${errorMessage}`);
    }

    public recordSuccess(cameraName: string, aiProcessTime: number, totalProcessTime: number): void {
        const now = new Date().toISOString();

        this.updateStats(cameraName, {
            lastSuccessDate: now,
            lastAiProcessTime: aiProcessTime,
            lastTotalProcessTime: totalProcessTime
        });

        this.updateStatus(cameraName, 'Complete');
        logger.debug(`Success recorded for camera ${cameraName}: AI=${aiProcessTime}s, Total=${totalProcessTime}s`);
    }

    public getAllCameraStats(): Record<string, CameraStats> {
        return { ...this.cameraStats };
    }

    public getAllCameraStatuses(): Record<string, string> {
        return { ...this.cameraStatus };
    }
}