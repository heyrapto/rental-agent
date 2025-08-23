#!/usr/bin/env node

/**
 * Rental Contract AO Agent - Main Entry Point
 * 
 * This autonomous agent manages rental contracts, payments, communications,
 * maintenance, and disputes with immutable storage on Arweave.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const cron = require('node-cron');

const { logger } = require('./utils/logger');
const { config } = require('./config');
const { messageHandler } = require('./handlers/messageHandler');
const { signatureValidator } = require('./middleware/signatureValidator');
const { errorHandler } = require('./middleware/errorHandler');
const { scheduler } = require('./services/scheduler');
const { arweaveService } = require('./services/arweaveService');

class RentalContractAOAgent {
    constructor() {
        this.app = express();
        this.port = config.PORT || 6000;
        this.isShuttingDown = false;
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
        this.setupScheduler();
        this.setupGracefulShutdown();
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet());
        this.app.use(cors({
            origin: config.ALLOWED_ORIGINS || ['*'],
            credentials: true
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false
        });
        this.app.use(limiter);

        // Compression
        this.app.use(compression());

        // Logging
        this.app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: require('../../package.json').version
            });
        });
    }

    setupRoutes() {
        // Main agent message endpoint
        this.app.post('/agent', signatureValidator, messageHandler);

        // Additional endpoints for monitoring and management
        this.app.get('/status', (req, res) => {
            res.json({
                status: 'operational',
                agent: 'rental-contract-ao-agent',
                timestamp: new Date().toISOString(),
                arweave: {
                    connected: arweaveService.isConnected(),
                    network: config.ARWEAVE_NETWORK
                }
            });
        });

        // Metrics endpoint
        this.app.get('/metrics', (req, res) => {
            res.json({
                totalLeases: 0, // TODO: Implement metrics collection
                totalPayments: 0,
                totalDisputes: 0,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                timestamp: new Date().toISOString()
            });
        });
    }

    setupErrorHandling() {
        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                path: req.originalUrl,
                method: req.method
            });
        });

        // Global error handler
        this.app.use(errorHandler);
    }

    setupScheduler() {
        // Initialize the autonomous scheduler
        scheduler.initialize();
        
        logger.info('Autonomous scheduler initialized');
    }

    setupGracefulShutdown() {
        const gracefulShutdown = (signal) => {
            if (this.isShuttingDown) return;
            
            this.isShuttingDown = true;
            logger.info(`Received ${signal}. Starting graceful shutdown...`);

            // Stop accepting new requests
            this.server.close(() => {
                logger.info('HTTP server closed');
                
                // Stop scheduler
                scheduler.shutdown();
                logger.info('Scheduler shutdown complete');
                
                // Close Arweave connections
                arweaveService.disconnect();
                logger.info('Arweave connections closed');
                
                logger.info('Graceful shutdown complete');
                process.exit(0);
            });

            // Force shutdown after 30 seconds
            setTimeout(() => {
                logger.error('Forced shutdown after timeout');
                process.exit(1);
            }, 30000);
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }

    async start() {
        try {
            // Initialize Arweave service
            await arweaveService.initialize();
            logger.info('Arweave service initialized');

            // Start HTTP server
            this.server = this.app.listen(this.port, () => {
                logger.info(`Rental Contract AO Agent started on port ${this.port}`);
                logger.info(`Health check: http://localhost:${this.port}/health`);
                logger.info(`Agent endpoint: http://localhost:${this.port}/agent`);
                logger.info(`Status: http://localhost:${this.port}/status`);
            });

            // Handle server errors
            this.server.on('error', (error) => {
                logger.error('Server error:', error);
                process.exit(1);
            });

        } catch (error) {
            logger.error('Failed to start agent:', error);
            process.exit(1);
        }
    }
}

// Start the agent if this file is run directly
if (require.main === module) {
    const agent = new RentalContractAOAgent();
    agent.start().catch(error => {
        logger.error('Failed to start agent:', error);
        process.exit(1);
    });
}

module.exports = { RentalContractAOAgent };