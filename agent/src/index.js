/**
 * Rental Contract AO Agent - Main Entry Point
 * Autonomous agent for rental contract management with Arweave storage
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');

// Import configuration and utilities
const { config } = require('./config');
const { logger, logSystemAction } = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { signatureValidator } = require('./middleware/signatureValidator');

// Import services
const { arweaveService } = require('./services/arweaveService');
const { schedulerService } = require('./services/schedulerService');
const { leaseService } = require('./services/leaseService');
const { paymentService } = require('./services/paymentService');
const { disputeService } = require('./services/disputeService');
const { maintenanceService } = require('./services/maintenanceService');
const { communicationService } = require('./services/communicationService');

// Import handlers
const { messageHandler } = require('./handlers/messageHandler');

// Create Express application
const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
});

app.use('/agent', limiter);
app.use('/api', limiter);

// CORS configuration
app.use(cors({
    origin: config.CORS_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-sender-wallet', 'x-sig', 'x-timestamp'],
    credentials: true,
    maxAge: 86400 // 24 hours
}));

// Compression middleware
app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

// Logging middleware
if (config.NODE_ENV === 'production') {
    app.use(morgan('combined', {
        stream: {
            write: (message) => logger.info(message.trim())
        }
    }));
} else {
    app.use(morgan('dev'));
}

// Body parsing middleware
app.use(express.json({
    limit: config.MAX_REQUEST_SIZE,
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

app.use(express.urlencoded({
    extended: true,
    limit: config.MAX_REQUEST_SIZE
}));

// Request ID middleware
app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || uuidv4();
    res.setHeader('x-request-id', req.id);
    next();
});

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP Request', {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            requestId: req.id
        });
    });
    
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: config.APP_VERSION,
        environment: config.NODE_ENV,
        requestId: req.id
    });
});

// Status endpoint
app.get('/status', async (req, res) => {
    try {
        const status = {
            status: 'operational',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: config.APP_VERSION,
            environment: config.NODE_ENV,
            services: {
                arweave: arweaveService.initialized ? 'connected' : 'disconnected',
                scheduler: schedulerService.isRunning ? 'running' : 'stopped',
                database: 'connected', // In production, check actual DB connection
                ethereum: paymentService.ethereumProvider ? 'connected' : 'disconnected'
            },
            metrics: {
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                platform: process.platform,
                nodeVersion: process.version
            },
            requestId: req.id
        };

        res.status(200).json(status);
    } catch (error) {
        logger.error('Status check failed:', error);
        res.status(500).json({
            status: 'error',
            error: 'Status check failed',
            requestId: req.id
        });
    }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
    try {
        const metrics = {
            timestamp: new Date().toISOString(),
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                platform: process.platform,
                nodeVersion: process.version
            },
            services: {
                scheduler: await schedulerService.getAllJobsStatus(),
                arweave: await arweaveService.getWalletBalance().catch(() => ({ error: 'unavailable' })),
                leases: await leaseService.getLeaseStats().catch(() => ({ error: 'unavailable' })),
                payments: await paymentService.getPaymentStats().catch(() => ({ error: 'unavailable' })),
                disputes: await disputeService.getDisputeStats().catch(() => ({ error: 'unavailable' })),
                maintenance: await maintenanceService.getMaintenanceStats().catch(() => ({ error: 'unavailable' }))
            },
            requestId: req.id
        };

        res.status(200).json(metrics);
    } catch (error) {
        logger.error('Metrics collection failed:', error);
        res.status(500).json({
            error: 'Metrics collection failed',
            requestId: req.id
        });
    }
});

// Main agent endpoint - requires signature validation
app.use('/agent', signatureValidator, messageHandler);

// API endpoints (if needed for external integrations)
app.get('/api/leases/:leaseId', async (req, res) => {
    try {
        const lease = await leaseService.getLease(req.params.leaseId);
        res.status(200).json(lease);
    } catch (error) {
        if (error.name === 'NotFoundError') {
            res.status(404).json({ error: 'Lease not found' });
        } else {
            logger.error('API error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method,
        requestId: req.id
    });
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    try {
        // Stop accepting new requests
        server.close(() => {
            logger.info('HTTP server closed');
        });

        // Stop scheduler
        if (schedulerService.isRunning) {
            await schedulerService.stop();
            logger.info('Scheduler stopped');
        }

        // Close service connections
        await Promise.all([
            leaseService.close(),
            paymentService.close(),
            disputeService.close(),
            maintenanceService.close(),
            communicationService.close(),
            arweaveService.close()
        ]);

        logger.info('All services closed successfully');
        process.exit(0);

    } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Initialize services and start server
const initializeAndStart = async () => {
    try {
        logger.info('Initializing Rental Contract AO Agent...');

        // Wait for Arweave service to initialize
        let retries = 0;
        while (!arweaveService.initialized && retries < config.ARWEAVE_INIT_RETRIES) {
            logger.info(`Waiting for Arweave service initialization... (attempt ${retries + 1})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries++;
        }

        if (!arweaveService.initialized) {
            throw new Error('Arweave service failed to initialize');
        }

        // Start scheduler if enabled
        if (config.SCHEDULER_ENABLED) {
            await schedulerService.start();
            logger.info('Autonomous scheduler started');
        } else {
            logger.info('Scheduler is disabled');
        }

        // Start HTTP server
        const server = app.listen(config.PORT, config.HOST, () => {
            const address = server.address();
            logger.info('Rental Contract AO Agent started successfully', {
                host: address.address,
                port: address.port,
                environment: config.NODE_ENV,
                version: config.APP_VERSION,
                arweaveHost: config.ARWEAVE_HOST,
                schedulerEnabled: config.SCHEDULER_ENABLED
            });

            logSystemAction('started', {
                host: address.address,
                port: address.port,
                environment: config.NODE_ENV
            });
        });

        // Store server reference for graceful shutdown
        global.server = server;

    } catch (error) {
        logger.error('Failed to initialize AO Agent:', error);
        process.exit(1);
    }
};

// Start the application
if (require.main === module) {
    initializeAndStart();
}

module.exports = app;