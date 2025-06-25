const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, errors } = format;

const customFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
});

const logger = createLogger({
    level: 'info',
    format: combine(
        timestamp(),
        errors({ stack: true }),
        customFormat
    ),
    transports: [
        new transports.Console({
            format: combine(
                format.colorize(),
                customFormat
            ),
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        }),

        new transports.File({
            filename: 'logs/error.log',
            level: 'error',
        }),
        new transports.File({
            filename: 'logs/app.log',
            level: 'info',
        })
    ]
});

logger.stream = {
    write: (message) => {
        logger.info(message.trim());
    },
};

module.exports = logger;
