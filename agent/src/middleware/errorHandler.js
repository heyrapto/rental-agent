/**
 * Error handling middleware for AO agent
 */

const { logger, logError } = require('../utils/logger');
const { config } = require('../config');

/**
 * Global error handler middleware
 */
const errorHandler = (error, req, res, next) => {
    // Log the error with context
    logError(error, {
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.walletAddress,
        body: req.body,
        headers: req.headers
    });

    // Determine error type and create appropriate response
    const errorResponse = createErrorResponse(error);
    
    // Send error response
    res.status(errorResponse.status).json(errorResponse);
};

/**
 * Create standardized error response
 */
const createErrorResponse = (error) => {
    // Default error response
    let status = 500;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details = null;

    // Handle different types of errors
    if (error.name === 'ValidationError') {
        status = 400;
        message = 'Validation failed';
        code = 'VALIDATION_ERROR';
        details = error.details || error.message;
    } else if (error.name === 'UnauthorizedError') {
        status = 401;
        message = 'Unauthorized';
        code = 'UNAUTHORIZED';
    } else if (error.name === 'ForbiddenError') {
        status = 403;
        message = 'Forbidden';
        code = 'FORBIDDEN';
    } else if (error.name === 'NotFoundError') {
        status = 404;
        message = 'Resource not found';
        code = 'NOT_FOUND';
    } else if (error.name === 'ConflictError') {
        status = 409;
        message = 'Resource conflict';
        code = 'CONFLICT';
    } else if (error.name === 'RateLimitError') {
        status = 429;
        message = 'Too many requests';
        code = 'RATE_LIMIT_EXCEEDED';
    } else if (error.name === 'ArweaveError') {
        status = 502;
        message = 'Arweave service error';
        code = 'ARWEAVE_ERROR';
        details = error.details || error.message;
    } else if (error.name === 'EthereumError') {
        status = 502;
        message = 'Ethereum service error';
        code = 'ETHEREUM_ERROR';
        details = error.details || error.message;
    } else if (error.name === 'SchedulerError') {
        status = 500;
        message = 'Scheduler error';
        code = 'SCHEDULER_ERROR';
        details = error.details || error.message;
    }

    // Create response object
    const response = {
        ok: false,
        error: message,
        code,
        timestamp: new Date().toISOString()
    };

    // Add details in development mode
    if (config.DEBUG_MODE && details) {
        response.details = details;
    }

    // Add stack trace in development mode
    if (config.DEBUG_MODE && error.stack) {
        response.stack = error.stack;
    }

    return {
        status,
        body: response
    };
};

/**
 * Custom error classes
 */
class ValidationError extends Error {
    constructor(message, details = null) {
        super(message);
        this.name = 'ValidationError';
        this.details = details;
    }
}

class UnauthorizedError extends Error {
    constructor(message = 'Unauthorized') {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

class ForbiddenError extends Error {
    constructor(message = 'Forbidden') {
        super(message);
        this.name = 'ForbiddenError';
    }
}

class NotFoundError extends Error {
    constructor(message = 'Resource not found') {
        super(message);
        this.name = 'NotFoundError';
    }
}

class ConflictError extends Error {
    constructor(message = 'Resource conflict') {
        super(message);
        this.name = 'ConflictError';
    }
}

class RateLimitError extends Error {
    constructor(message = 'Rate limit exceeded') {
        super(message);
        this.name = 'RateLimitError';
    }
}

class ArweaveError extends Error {
    constructor(message, details = null) {
        super(message);
        this.name = 'ArweaveError';
        this.details = details;
    }
}

class EthereumError extends Error {
    constructor(message, details = null) {
        super(message);
        this.name = 'EthereumError';
        this.details = details;
    }
}

class SchedulerError extends Error {
    constructor(message, details = null) {
        super(message);
        this.name = 'SchedulerError';
        this.details = details;
    }
}

/**
 * Async error wrapper for route handlers
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Validation error handler for Joi
 */
const handleJoiValidationError = (error) => {
    if (error.isJoi) {
        const details = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
        }));
        
        throw new ValidationError('Validation failed', details);
    }
    throw error;
};

/**
 * Database error handler
 */
const handleDatabaseError = (error) => {
    if (error.code === 'SQLITE_CONSTRAINT') {
        if (error.message.includes('UNIQUE constraint failed')) {
            throw new ConflictError('Resource already exists');
        }
        if (error.message.includes('FOREIGN KEY constraint failed')) {
            throw new ValidationError('Invalid reference');
        }
    }
    
    if (error.code === 'SQLITE_BUSY') {
        throw new Error('Database busy, please try again');
    }
    
    throw error;
};

/**
 * Arweave error handler
 */
const handleArweaveError = (error) => {
    if (error.message.includes('insufficient funds')) {
        throw new ArweaveError('Insufficient funds for transaction', {
            required: error.required,
            available: error.available
        });
    }
    
    if (error.message.includes('network error')) {
        throw new ArweaveError('Network connection failed', {
            host: error.host,
            port: error.port
        });
    }
    
    if (error.message.includes('timeout')) {
        throw new ArweaveError('Request timeout', {
            timeout: error.timeout
        });
    }
    
    throw new ArweaveError('Arweave operation failed', error.message);
};

/**
 * Ethereum error handler
 */
const handleEthereumError = (error) => {
    if (error.message.includes('insufficient funds')) {
        throw new EthereumError('Insufficient funds for transaction', {
            required: error.required,
            available: error.available
        });
    }
    
    if (error.message.includes('nonce too low')) {
        throw new EthereumError('Invalid nonce', {
            expected: error.expected,
            received: error.received
        });
    }
    
    if (error.message.includes('gas limit exceeded')) {
        throw new EthereumError('Gas limit exceeded', {
            limit: error.limit,
            required: error.required
        });
    }
    
    throw new EthereumError('Ethereum operation failed', error.message);
};

/**
 * Not found handler for unmatched routes
 */
const notFoundHandler = (req, res) => {
    const error = new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);
    const errorResponse = createErrorResponse(error);
    res.status(errorResponse.status).json(errorResponse.body);
};

module.exports = {
    errorHandler,
    asyncHandler,
    handleJoiValidationError,
    handleDatabaseError,
    handleArweaveError,
    handleEthereumError,
    notFoundHandler,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    ArweaveError,
    EthereumError,
    SchedulerError
};