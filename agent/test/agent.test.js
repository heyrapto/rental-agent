/**
 * Comprehensive tests for Rental Contract AO Agent
 */

const request = require('supertest');
const { RentalContractAOAgent } = require('../src/index');
const { config } = require('../src/config');

// Mock environment for testing
process.env.NODE_ENV = 'test';
process.env.MOCK_ARWEAVE = 'true';
process.env.MOCK_ETHEREUM = 'true';
process.env.SCHEDULER_ENABLED = 'false';

describe('Rental Contract AO Agent', () => {
    let agent;
    let server;

    beforeAll(async () => {
        // Create agent instance
        agent = new RentalContractAOAgent();
        
        // Start server
        await agent.start();
        server = agent.server;
    });

    afterAll(async () => {
        // Cleanup
        if (server) {
            server.close();
        }
    });

    describe('Health Endpoints', () => {
        test('GET /health should return healthy status', async () => {
            const response = await request(server)
                .get('/health')
                .expect(200);

            expect(response.body).toHaveProperty('status', 'healthy');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body).toHaveProperty('version');
        });

        test('GET /status should return operational status', async () => {
            const response = await request(server)
                .get('/status')
                .expect(200);

            expect(response.body).toHaveProperty('status', 'operational');
            expect(response.body).toHaveProperty('agent', 'rental-contract-ao-agent');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('arweave');
        });

        test('GET /metrics should return metrics', async () => {
            const response = await request(server)
                .get('/metrics')
                .expect(200);

            expect(response.body).toHaveProperty('totalLeases');
            expect(response.body).toHaveProperty('totalPayments');
            expect(response.body).toHaveProperty('totalDisputes');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body).toHaveProperty('memory');
            expect(response.body).toHaveProperty('timestamp');
        });
    });

    describe('Agent Message Endpoint', () => {
        const mockWalletAddress = 'mock-wallet-address-1234567890123456789012345678901234567890123';
        const mockSignature = 'mock-signature-1234567890abcdef';
        const mockTimestamp = new Date().toISOString();

        const createAuthHeaders = () => ({
            'x-sender-wallet': mockWalletAddress,
            'x-sig': mockSignature,
            'x-timestamp': mockTimestamp
        });

        test('POST /agent should require authentication headers', async () => {
            const response = await request(server)
                .post('/agent')
                .send({ action: 'createLease' })
                .expect(401);

            expect(response.body).toHaveProperty('ok', false);
            expect(response.body).toHaveProperty('error', 'Missing authentication headers');
        });

        test('POST /agent should validate action parameter', async () => {
            const response = await request(server)
                .post('/agent')
                .set(createAuthHeaders())
                .send({})
                .expect(400);

            expect(response.body).toHaveProperty('ok', false);
            expect(response.body).toHaveProperty('error', 'Action is required');
        });

        test('POST /agent should reject unknown actions', async () => {
            const response = await request(server)
                .post('/agent')
                .set(createAuthHeaders())
                .send({ action: 'unknownAction' })
                .expect(400);

            expect(response.body).toHaveProperty('ok', false);
            expect(response.body).toHaveProperty('error', 'Unknown action: unknownAction');
        });

        test('POST /agent should handle createLease action', async () => {
            const leaseData = {
                action: 'createLease',
                landlordAddr: mockWalletAddress,
                tenantAddr: 'tenant-address-1234567890123456789012345678901234567890123',
                terms: '{"rent": 1000, "deposit": 2000}',
                rent: 1000,
                currency: 'USDA',
                deposit: 2000,
                startDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
                endDate: new Date(Date.now() + 31536000000).toISOString() // 1 year from now
            };

            const response = await request(server)
                .post('/agent')
                .set(createAuthHeaders())
                .send(leaseData)
                .expect(200);

            expect(response.body).toHaveProperty('ok', true);
            expect(response.body).toHaveProperty('leaseId');
            expect(response.body).toHaveProperty('arTxId');
            expect(response.body).toHaveProperty('timestamp');
        });

        test('POST /agent should handle signLease action', async () => {
            const signData = {
                action: 'signLease',
                leaseId: 'test-lease-id-123'
            };

            const response = await request(server)
                .post('/agent')
                .set(createAuthHeaders())
                .send(signData)
                .expect(200);

            expect(response.body).toHaveProperty('ok', true);
            expect(response.body).toHaveProperty('leaseId');
            expect(response.body).toHaveProperty('timestamp');
        });

        test('POST /agent should handle recordPayment action', async () => {
            const paymentData = {
                action: 'recordPayment',
                leaseId: 'test-lease-id-123',
                amount: 1000,
                currency: 'USDA',
                chainId: 'ethereum-mainnet',
                txHash: '0x1234567890abcdef1234567890abcdef12345678'
            };

            const response = await request(server)
                .post('/agent')
                .set(createAuthHeaders())
                .send(paymentData)
                .expect(200);

            expect(response.body).toHaveProperty('ok', true);
            expect(response.body).toHaveProperty('leaseId');
            expect(response.body).toHaveProperty('paymentId');
            expect(response.body).toHaveProperty('arTxId');
            expect(response.body).toHaveProperty('timestamp');
        });

        test('POST /agent should handle postMessage action', async () => {
            const messageData = {
                action: 'postMessage',
                leaseId: 'test-lease-id-123',
                content: 'Test message content',
                threadId: 'main-thread'
            };

            const response = await request(server)
                .post('/agent')
                .set(createAuthHeaders())
                .send(messageData)
                .expect(200);

            expect(response.body).toHaveProperty('ok', true);
            expect(response.body).toHaveProperty('leaseId');
            expect(response.body).toHaveProperty('messageId');
            expect(response.body).toHaveProperty('arTxId');
            expect(response.body).toHaveProperty('timestamp');
        });

        test('POST /agent should handle createTicket action', async () => {
            const ticketData = {
                action: 'createTicket',
                leaseId: 'test-lease-id-123',
                title: 'Test maintenance ticket',
                description: 'This is a test maintenance ticket description',
                priority: 'medium'
            };

            const response = await request(server)
                .post('/agent')
                .set(createAuthHeaders())
                .send(ticketData)
                .expect(200);

            expect(response.body).toHaveProperty('ok', true);
            expect(response.body).toHaveProperty('leaseId');
            expect(response.body).toHaveProperty('ticketId');
            expect(response.body).toHaveProperty('arTxId');
            expect(response.body).toHaveProperty('timestamp');
        });

        test('POST /agent should handle updateTicket action', async () => {
            const updateData = {
                action: 'updateTicket',
                ticketId: 'test-ticket-id-123',
                status: 'in-progress',
                notes: 'Updated ticket status'
            };

            const response = await request(server)
                .post('/agent')
                .set(createAuthHeaders())
                .send(updateData)
                .expect(200);

            expect(response.body).toHaveProperty('ok', true);
            expect(response.body).toHaveProperty('ticketId');
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('timestamp');
        });

        test('POST /agent should handle buildDisputePackage action', async () => {
            const disputeData = {
                action: 'buildDisputePackage',
                leaseId: 'test-lease-id-123',
                evidenceTypes: ['lease', 'payment', 'message']
            };

            const response = await request(server)
                .post('/agent')
                .set(createAuthHeaders())
                .send(disputeData)
                .expect(200);

            expect(response.body).toHaveProperty('ok', true);
            expect(response.body).toHaveProperty('leaseId');
            expect(response.body).toHaveProperty('disputeId');
            expect(response.body).toHaveProperty('merkleRoot');
            expect(response.body).toHaveProperty('evidenceCount');
            expect(response.body).toHaveProperty('arTxId');
            expect(response.body).toHaveProperty('timestamp');
        });
    });

    describe('Validation', () => {
        const mockWalletAddress = 'mock-wallet-address-1234567890123456789012345678901234567890123';
        const mockSignature = 'mock-signature-1234567890abcdef';
        const mockTimestamp = new Date().toISOString();

        const createAuthHeaders = () => ({
            'x-sender-wallet': mockWalletAddress,
            'x-sig': mockSignature,
            'x-timestamp': mockTimestamp
        });

        test('createLease should validate required fields', async () => {
            const invalidData = {
                action: 'createLease',
                landlordAddr: mockWalletAddress
                // Missing required fields
            };

            const response = await request(server)
                .post('/agent')
                .set(createAuthHeaders())
                .send(invalidData)
                .expect(400);

            expect(response.body).toHaveProperty('ok', false);
            expect(response.body).toHaveProperty('error', 'Validation failed');
        });

        test('createLease should validate currency values', async () => {
            const invalidData = {
                action: 'createLease',
                landlordAddr: mockWalletAddress,
                tenantAddr: 'tenant-address-1234567890123456789012345678901234567890123',
                terms: '{"rent": 1000, "deposit": 2000}',
                rent: 1000,
                currency: 'INVALID_CURRENCY',
                deposit: 2000,
                startDate: new Date(Date.now() + 86400000).toISOString(),
                endDate: new Date(Date.now() + 31536000000).toISOString()
            };

            const response = await request(server)
                .post('/agent')
                .set(createAuthHeaders())
                .send(invalidData)
                .expect(400);

            expect(response.body).toHaveProperty('ok', false);
            expect(response.body).toHaveProperty('error', 'Validation failed');
        });

        test('createLease should validate date ranges', async () => {
            const invalidData = {
                action: 'createLease',
                landlordAddr: mockWalletAddress,
                tenantAddr: 'tenant-address-1234567890123456789012345678901234567890123',
                terms: '{"rent": 1000, "deposit": 2000}',
                rent: 1000,
                currency: 'USDA',
                deposit: 2000,
                startDate: new Date(Date.now() + 31536000000).toISOString(), // 1 year from now
                endDate: new Date(Date.now() + 86400000).toISOString() // Tomorrow (invalid)
            };

            const response = await request(server)
                .post('/agent')
                .set(createAuthHeaders())
                .send(invalidData)
                .expect(400);

            expect(response.body).toHaveProperty('ok', false);
            expect(response.body).toHaveProperty('error', 'Validation failed');
        });

        test('recordPayment should validate transaction hash format', async () => {
            const invalidData = {
                action: 'recordPayment',
                leaseId: 'test-lease-id-123',
                amount: 1000,
                currency: 'USDA',
                chainId: 'ethereum-mainnet',
                txHash: 'invalid-hash-format'
            };

            const response = await request(server)
                .post('/agent')
                .set(createAuthHeaders())
                .send(invalidData)
                .expect(400);

            expect(response.body).toHaveProperty('ok', false);
            expect(response.body).toHaveProperty('error', 'Validation failed');
        });

        test('createTicket should validate priority values', async () => {
            const invalidData = {
                action: 'createTicket',
                leaseId: 'test-lease-id-123',
                title: 'Test ticket',
                description: 'Test description',
                priority: 'invalid-priority'
            };

            const response = await request(server)
                .post('/agent')
                .set(createAuthHeaders())
                .send(invalidData)
                .expect(400);

            expect(response.body).toHaveProperty('ok', false);
            expect(response.body).toHaveProperty('error', 'Validation failed');
        });
    });

    describe('Error Handling', () => {
        test('Should handle 404 for unknown routes', async () => {
            const response = await request(server)
                .get('/unknown-route')
                .expect(404);

            expect(response.body).toHaveProperty('error', 'Endpoint not found');
            expect(response.body).toHaveProperty('path', '/unknown-route');
            expect(response.body).toHaveProperty('method', 'GET');
        });

        test('Should handle malformed JSON', async () => {
            const response = await request(server)
                .post('/agent')
                .set('Content-Type', 'application/json')
                .send('invalid json')
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Rate Limiting', () => {
        test('Should enforce rate limits', async () => {
            const mockWalletAddress = 'rate-limit-test-1234567890123456789012345678901234567890123';
            const mockSignature = 'mock-signature-1234567890abcdef';
            const mockTimestamp = new Date().toISOString();

            const headers = {
                'x-sender-wallet': mockWalletAddress,
                'x-sig': mockSignature,
                'x-timestamp': mockTimestamp
            };

            // Send multiple requests quickly
            const promises = [];
            for (let i = 0; i < 105; i++) {
                promises.push(
                    request(server)
                        .post('/agent')
                        .set(headers)
                        .send({ action: 'createLease' })
                );
            }

            const responses = await Promise.all(promises);
            const rateLimited = responses.filter(r => r.status === 429);

            // Should have some rate limited responses
            expect(rateLimited.length).toBeGreaterThan(0);
        });
    });
});