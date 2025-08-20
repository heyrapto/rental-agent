/**
 * Logging utility for Rental Contract AO Agent
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { config } = require('../config');

// Ensure logs directory exists
const logsDir = path.dirname(config.LOG_FILE);
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let log = `${timestamp} [${level}]: ${message}`;
        
        if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`;
        }
        
        return log;
    })
);

// Custom format for file output
const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
    level: config.LOG_LEVEL,
    format: fileFormat,
    defaultMeta: { 
        service: 'rental-contract-ao-agent',
        version: require('../../package.json').version
    },
    transports: [
        // File transport with rotation
        new winston.transports.File({
            filename: config.LOG_FILE,
            maxsize: config.LOG_MAX_SIZE,
            maxFiles: config.LOG_MAX_FILES,
            tailable: true
        }),
        
        // Error log file
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: config.LOG_MAX_SIZE,
            maxFiles: config.LOG_MAX_FILES
        })
    ]
});

// Add console transport for development
if (config.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat
    }));
}

// Add console transport for production if explicitly enabled
if (config.NODE_ENV === 'production' && config.DEBUG_MODE) {
    logger.add(new winston.transports.Console({
        format: consoleFormat,
        level: 'warn' // Only show warnings and errors in production console
    }));
}

// Create a stream object for Morgan HTTP logging
const stream = {
    write: (message) => {
        logger.info(message.trim());
    }
};

// Helper methods for structured logging
const logWithContext = (level, message, context = {}) => {
    logger.log(level, message, context);
};

const logLeaseAction = (action, leaseId, userId, details = {}) => {
    logger.info(`Lease ${action}`, {
        action,
        leaseId,
        userId,
        timestamp: new Date().toISOString(),
        ...details
    });
};

const logPaymentAction = (action, leaseId, userId, amount, currency, details = {}) => {
    logger.info(`Payment ${action}`, {
        action,
        leaseId,
        userId,
        amount,
        currency,
        timestamp: new Date().toISOString(),
        ...details
    });
};

const logDisputeAction = (action, disputeId, leaseId, userId, details = {}) => {
    logger.info(`Dispute ${action}`, {
        action,
        disputeId,
        leaseId,
        userId,
        timestamp: new Date().toISOString(),
        ...details
    });
};

const logMaintenanceAction = (action, ticketId, leaseId, userId, details = {}) => {
    logger.info(`Maintenance ${action}`, {
        action,
        ticketId,
        leaseId,
        userId,
        timestamp: new Date().toISOString(),
        ...details
    });
};

const logArweaveAction = (action, txId, details = {}) => {
    logger.info(`Arweave ${action}`, {
        action,
        txId,
        timestamp: new Date().toISOString(),
        ...details
    });
};

const logSchedulerAction = (action, details = {}) => {
    logger.info(`Scheduler ${action}`, {
        action,
        timestamp: new Date().toISOString(),
        ...details
    });
};

const logSecurityEvent = (event, userId, ip, details = {}) => {
    logger.warn(`Security event: ${event}`, {
        event,
        userId,
        ip,
        timestamp: new Date().toISOString(),
        ...details
    });
};

const logError = (error, context = {}) => {
    logger.error('Error occurred', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        ...context
    });
};

const logPerformance = (operation, duration, details = {}) => {
    logger.info(`Performance: ${operation}`, {
        operation,
        duration,
        timestamp: new Date().toISOString(),
        ...details
    });
};

// Export logger and helper methods
module.exports = {
    logger,
    stream,
    logWithContext,
    logLeaseAction,
    logPaymentAction,
    logDisputeAction,
    logMaintenanceAction,
    logArweaveAction,
    logSchedulerAction,
    logSecurityEvent,
    logError,
    logPerformance
};