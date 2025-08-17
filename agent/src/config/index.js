/**
 * Configuration management for Rental Contract AO Agent
 */

require('dotenv').config();

const config = {
    // Server configuration
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'],

    // Arweave configuration
    ARWEAVE_HOST: process.env.ARWEAVE_HOST || 'arweave.net',
    ARWEAVE_PORT: process.env.ARWEAVE_PORT || 443,
    ARWEAVE_PROTOCOL: process.env.ARWEAVE_PROTOCOL || 'https',
    ARWEAVE_NETWORK: process.env.ARWEAVE_NETWORK || 'mainnet',
    ARWEAVE_TIMEOUT: parseInt(process.env.ARWEAVE_TIMEOUT) || 60000,
    ARWEAVE_RETRIES: parseInt(process.env.ARWEAVE_RETRIES) || 3,

    // Wallet configuration
    WALLET_PATH: process.env.WALLET_PATH || './wallet.json',
    WALLET_PASSWORD: process.env.WALLET_PASSWORD,

    // Security configuration
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    SIGNATURE_EXPIRY: parseInt(process.env.SIGNATURE_EXPIRY) || 300000, // 5 minutes in ms

    // Database configuration (for local caching)
    DB_PATH: process.env.DB_PATH || './data/agent.db',

    // Scheduler configuration
    SCHEDULER_ENABLED: process.env.SCHEDULER_ENABLED !== 'false',
    RENT_REMINDER_DAYS: parseInt(process.env.RENT_REMINDER_DAYS) || 3,
    OVERDUE_NOTICE_DAYS: parseInt(process.env.OVERDUE_NOTICE_DAYS) || 5,
    DEPOSIT_CHECK_INTERVAL: parseInt(process.env.DEPOSIT_CHECK_INTERVAL) || 24, // hours
    SLA_PING_INTERVAL: parseInt(process.env.SLA_PING_INTERVAL) || 1, // hour

    // Logging configuration
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_FILE: process.env.LOG_FILE || './logs/agent.log',
    LOG_MAX_SIZE: process.env.LOG_MAX_SIZE || '20m',
    LOG_MAX_FILES: process.env.LOG_MAX_FILES || '14d',

    // Rate limiting
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,

    // Contract addresses (Ethereum)
    RENTAL_CONTRACT_ADDRESS: process.env.RENTAL_CONTRACT_ADDRESS,
    USDA_ADAPTER_ADDRESS: process.env.USDA_ADAPTER_ADDRESS,
    DISPUTE_RESOLUTION_ADDRESS: process.env.DISPUTE_RESOLUTION_ADDRESS,
    ETHEREUM_RPC_URL: process.env.ETHEREUM_RPC_URL || 'http://localhost:8545',
    ETHEREUM_CHAIN_ID: parseInt(process.env.ETHEREUM_CHAIN_ID) || 1,

    // USDA stablecoin configuration
    USDA_CONTRACT_ADDRESS: process.env.USDA_CONTRACT_ADDRESS,
    USDA_DECIMALS: parseInt(process.env.USDA_DECIMALS) || 6,

    // File upload configuration
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    ALLOWED_FILE_TYPES: process.env.ALLOWED_FILE_TYPES ? 
        process.env.ALLOWED_FILE_TYPES.split(',') : 
        ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png'],

    // Dispute resolution configuration
    DISPUTE_EXPIRY_DAYS: parseInt(process.env.DISPUTE_EXPIRY_DAYS) || 30,
    MIN_EVIDENCE_COUNT: parseInt(process.env.MIN_EVIDENCE_COUNT) || 3,
    MAX_EVIDENCE_COUNT: parseInt(process.env.MAX_EVIDENCE_COUNT) || 100,

    // Maintenance configuration
    MAINTENANCE_TICKET_EXPIRY_DAYS: parseInt(process.env.MAINTENANCE_TICKET_EXPIRY_DAYS) || 90,
    MAINTENANCE_SLA_HOURS: parseInt(process.env.MAINTENANCE_SLA_HOURS) || 24,

    // Notification configuration
    NOTIFICATION_ENABLED: process.env.NOTIFICATION_ENABLED !== 'false',
    EMAIL_SMTP_HOST: process.env.EMAIL_SMTP_HOST,
    EMAIL_SMTP_PORT: parseInt(process.env.EMAIL_SMTP_PORT) || 587,
    EMAIL_USERNAME: process.env.EMAIL_USERNAME,
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
    EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@rental-agent.com',

    // Metrics and monitoring
    METRICS_ENABLED: process.env.METRICS_ENABLED !== 'false',
    METRICS_INTERVAL: parseInt(process.env.METRICS_INTERVAL) || 60000, // 1 minute

    // Backup configuration
    BACKUP_ENABLED: process.env.BACKUP_ENABLED !== 'false',
    BACKUP_INTERVAL_HOURS: parseInt(process.env.BACKUP_INTERVAL_HOURS) || 24,
    BACKUP_RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,

    // Development configuration
    DEBUG_MODE: process.env.DEBUG_MODE === 'true',
    MOCK_ARWEAVE: process.env.MOCK_ARWEAVE === 'true',
    MOCK_ETHEREUM: process.env.MOCK_ETHEREUM === 'true'
};

// Validation
const requiredConfigs = [
    'WALLET_PATH',
    'JWT_SECRET'
];

const validateConfig = () => {
    const missing = requiredConfigs.filter(key => !config[key]);
    
    if (missing.length > 0) {
        throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    // Validate Arweave configuration
    if (!config.ARWEAVE_HOST) {
        throw new Error('ARWEAVE_HOST is required');
    }

    // Validate Ethereum configuration for production
    if (config.NODE_ENV === 'production') {
        if (!config.ETHEREUM_RPC_URL) {
            throw new Error('ETHEREUM_RPC_URL is required in production');
        }
        if (!config.RENTAL_CONTRACT_ADDRESS) {
            throw new Error('RENTAL_CONTRACT_ADDRESS is required in production');
        }
    }

    return true;
};

// Environment-specific overrides
if (config.NODE_ENV === 'development') {
    config.LOG_LEVEL = 'debug';
    config.DEBUG_MODE = true;
}

if (config.NODE_ENV === 'test') {
    config.LOG_LEVEL = 'error';
    config.MOCK_ARWEAVE = true;
    config.MOCK_ETHEREUM = true;
    config.SCHEDULER_ENABLED = false;
}

// Validate configuration
try {
    validateConfig();
} catch (error) {
    console.error('Configuration validation failed:', error.message);
    process.exit(1);
}

module.exports = { config };