/**
 * Test environment configuration
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MOCK_ARWEAVE = 'true';
process.env.MOCK_ETHEREUM = 'true';
process.env.SCHEDULER_ENABLED = 'false';
process.env.JWT_SECRET = 'test-secret-key';
process.env.WALLET_PATH = './test-wallet.json';
process.env.ARWEAVE_HOST = 'test.arweave.net';
process.env.ARWEAVE_NETWORK = 'testnet';
process.env.PORT = '3001';
process.env.LOG_LEVEL = 'error';
process.env.DEBUG_MODE = 'false';

// Mock package.json for version info
jest.mock('../../../package.json', () => ({
    version: '1.0.0-test'
}));