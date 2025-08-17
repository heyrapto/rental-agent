/**
 * Test setup for AO agent
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.MOCK_ARWEAVE = 'true';
process.env.MOCK_ETHEREUM = 'true';
process.env.SCHEDULER_ENABLED = 'false';
process.env.JWT_SECRET = 'test-secret-key';
process.env.WALLET_PATH = './test-wallet.json';

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

// Global test timeout
jest.setTimeout(30000);

// Mock fs module for wallet loading
jest.mock('fs', () => ({
    readFileSync: jest.fn(() => '{"mock": "wallet"}'),
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn()
}));

// Mock Arweave module
jest.mock('arweave', () => ({
    init: jest.fn(() => ({
        wallets: {
            generate: jest.fn(() => Promise.resolve({ mock: 'wallet' })),
            jwkToAddress: jest.fn(() => Promise.resolve('mock-address')),
            getBalance: jest.fn(() => Promise.resolve('1000000000000'))
        },
        network: {
            getInfo: jest.fn(() => Promise.resolve({
                version: '1.0.0',
                height: 1000000,
                peers: 100
            }))
        },
        createTransaction: jest.fn(() => ({
            addTag: jest.fn(),
            id: 'mock-transaction-id'
        })),
        transactions: {
            sign: jest.fn(() => Promise.resolve()),
            post: jest.fn(() => Promise.resolve({ status: 200 })),
            get: jest.fn(() => Promise.resolve({
                id: 'mock-tx-id',
                owner: 'mock-owner',
                tags: [],
                timestamp: Date.now(),
                block_id: 'mock-block-id'
            })),
            getData: jest.fn(() => Promise.resolve('mock-data'))
        },
        arql: jest.fn(() => Promise.resolve([]))
    }))
}));

// Mock crypto module
jest.mock('crypto', () => ({
    createHash: jest.fn(() => ({
        update: jest.fn(() => ({
            digest: jest.fn(() => 'mock-hash')
        }))
    })),
    createHmac: jest.fn(() => ({
        update: jest.fn(() => ({
            digest: jest.fn(() => 'mock-signature')
        }))
    }))
}));

// Mock winston logger
jest.mock('winston', () => ({
    createLogger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        log: jest.fn(),
        add: jest.fn()
    })),
    format: {
        combine: jest.fn(),
        timestamp: jest.fn(),
        errors: jest.fn(),
        json: jest.fn(),
        colorize: jest.fn(),
        printf: jest.fn()
    },
    transports: {
        File: jest.fn(),
        Console: jest.fn()
    }
}));

// Mock node-cron
jest.mock('node-cron', () => ({
    schedule: jest.fn(() => ({
        stop: jest.fn()
    }))
}));

// Mock express
jest.mock('express', () => {
    const mockApp = {
        use: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        listen: jest.fn((port, callback) => {
            if (callback) callback();
            return {
                close: jest.fn(),
                on: jest.fn()
            };
        })
    };
    return jest.fn(() => mockApp);
});

// Mock middleware
jest.mock('cors', () => jest.fn());
jest.mock('helmet', () => jest.fn());
jest.mock('express-rate-limit', () => jest.fn(() => jest.fn()));
jest.mock('compression', () => jest.fn());
jest.mock('morgan', () => jest.fn());

// Global test utilities
global.createMockWalletAddress = () => {
    return 'mock-wallet-address-1234567890123456789012345678901234567890123';
};

global.createMockSignature = () => {
    return 'mock-signature-1234567890abcdef';
};

global.createMockTimestamp = () => {
    return new Date().toISOString();
};

global.createMockAuthHeaders = () => ({
    'x-sender-wallet': global.createMockWalletAddress(),
    'x-sig': global.createMockSignature(),
    'x-timestamp': global.createMockTimestamp()
});

// Cleanup after each test
afterEach(() => {
    jest.clearAllMocks();
});