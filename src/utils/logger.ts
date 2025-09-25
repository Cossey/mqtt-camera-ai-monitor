import winston from 'winston';

// Get log level from environment variable, default to 'info'
const getLogLevel = (): string => {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    const validLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];

    if (envLevel && validLevels.includes(envLevel)) {
        return envLevel;
    }

    return 'info'; // default
};

export const logger = winston.createLogger({
    level: getLogLevel(),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({
            filename: 'error.log',
            level: 'error',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),
        new winston.transports.File({
            filename: 'combined.log',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),
    ],
});

export const logInfo = (message: string) => {
    logger.info(message);
};

export const logError = (message: string) => {
    logger.error(message);
};
