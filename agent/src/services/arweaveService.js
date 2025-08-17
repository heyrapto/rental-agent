/**
 * Arweave service for AO agent
 * Handles all Arweave interactions and data storage
 */

const Arweave = require('arweave');
const { logger, logArweaveAction } = require('../utils/logger');
const { ArweaveError, ValidationError } = require('../middleware/errorHandler');
const { config } = require('../config');
const fs = require('fs');
const path = require('path');

class ArweaveService {
    constructor() {
        this.arweave = null;
        this.wallet = null;
        this.initialized = false;
        this.initializeArweave();
    }

    /**
     * Initialize Arweave connection and wallet
     */
    async initializeArweave() {
        try {
            // Initialize Arweave instance
            this.arweave = Arweave.init({
                host: config.ARWEAVE_HOST,
                port: config.ARWEAVE_PORT,
                protocol: config.ARWEAVE_PROTOCOL,
                network: config.ARWEAVE_NETWORK
            });

            // Load wallet
            await this.loadWallet();

            // Test connection
            await this.testConnection();

            this.initialized = true;
            logger.info('Arweave service initialized successfully');

        } catch (error) {
            logger.error('Failed to initialize Arweave service:', error);
            throw new ArweaveError('Arweave initialization failed', error.message);
        }
    }

    /**
     * Load Arweave wallet
     */
    async loadWallet() {
        try {
            if (config.MOCK_ARWEAVE) {
                logger.info('Using mock Arweave wallet for testing');
                this.wallet = {
                    address: 'mock_arweave_address_' + Math.random().toString(36).substr(2, 9),
                    getAddress: () => this.wallet.address
                };
                return;
            }

            // Load wallet from file
            if (config.ARWEAVE_WALLET_PATH && fs.existsSync(config.ARWEAVE_WALLET_PATH)) {
                const walletData = fs.readFileSync(config.ARWEAVE_WALLET_PATH, 'utf8');
                this.wallet = JSON.parse(walletData);
                logger.info('Arweave wallet loaded from file');
            } else if (config.ARWEAVE_WALLET_JWK) {
                // Load wallet from environment variable
                this.wallet = JSON.parse(config.ARWEAVE_WALLET_JWK);
                logger.info('Arweave wallet loaded from environment');
            } else {
                throw new Error('No wallet configuration found');
            }

            // Validate wallet format
            if (!this.wallet.kty || !this.wallet.n) {
                throw new Error('Invalid wallet format');
            }

        } catch (error) {
            logger.error('Failed to load Arweave wallet:', error);
            throw new ArweaveError('Wallet loading failed', error.message);
        }
    }

    /**
     * Test Arweave connection
     */
    async testConnection() {
        try {
            if (config.MOCK_ARWEAVE) {
                logger.info('Mock Arweave connection test passed');
                return;
            }

            // Get network info
            const networkInfo = await this.arweave.network.getInfo();
            logger.info('Arweave network info:', networkInfo);

            // Get wallet balance
            const balance = await this.arweave.wallets.getBalance(this.wallet.address);
            const balanceInAR = this.arweave.ar.winstonToAr(balance);
            logger.info(`Wallet balance: ${balanceInAR} AR`);

            if (parseFloat(balanceInAR) < config.ARWEAVE_MIN_BALANCE) {
                logger.warn(`Low wallet balance: ${balanceInAR} AR (minimum: ${config.ARWEAVE_MIN_BALANCE} AR)`);
            }

        } catch (error) {
            logger.error('Arweave connection test failed:', error);
            throw new ArweaveError('Connection test failed', error.message);
        }
    }

    /**
     * Store lease terms on Arweave
     */
    async storeLeaseTerms(leaseData, metadata = {}) {
        try {
            if (!this.initialized) {
                throw new ArweaveError('Arweave service not initialized');
            }

            // Prepare data for storage
            const data = JSON.stringify(leaseData);
            const tags = [
                { name: 'Content-Type', value: 'application/json' },
                { name: 'App-Name', value: 'Rental-Contract-AO' },
                { name: 'App-Version', value: config.APP_VERSION },
                { name: 'Data-Type', value: 'lease-terms' },
                { name: 'Lease-ID', value: leaseData.leaseId || metadata.leaseId },
                { name: 'Landlord', value: leaseData.landlordAddr || metadata.landlordAddr },
                { name: 'Tenant', value: leaseData.tenantAddr || metadata.tenantAddr },
                { name: 'Created-At', value: new Date().toISOString() },
                { name: 'Timestamp', value: Date.now().toString() }
            ];

            // Add custom metadata tags
            Object.entries(metadata).forEach(([key, value]) => {
                if (value && typeof value === 'string') {
                    tags.push({ name: key, value });
                }
            });

            const transaction = await this.createTransaction(data, tags);
            const transactionId = await this.postTransaction(transaction);

            logArweaveAction('stored', 'lease_terms', transactionId, {
                leaseId: leaseData.leaseId || metadata.leaseId,
                dataSize: data.length
            });

            return transactionId;

        } catch (error) {
            logger.error('Failed to store lease terms on Arweave:', error);
            throw new ArweaveError('Lease terms storage failed', error.message);
        }
    }

    /**
     * Store payment receipt on Arweave
     */
    async storePaymentReceipt(paymentData, metadata = {}) {
        try {
            if (!this.initialized) {
                throw new ArweaveError('Arweave service not initialized');
            }

            // Prepare data for storage
            const data = JSON.stringify(paymentData);
            const tags = [
                { name: 'Content-Type', value: 'application/json' },
                { name: 'App-Name', value: 'Rental-Contract-AO' },
                { name: 'App-Version', value: config.APP_VERSION },
                { name: 'Data-Type', value: 'payment-receipt' },
                { name: 'Lease-ID', value: paymentData.leaseId },
                { name: 'Payer', value: paymentData.payer },
                { name: 'Amount', value: paymentData.amount.toString() },
                { name: 'Currency', value: paymentData.currency },
                { name: 'Chain-ID', value: paymentData.chainId.toString() },
                { name: 'Tx-Hash', value: paymentData.txHash },
                { name: 'Created-At', value: new Date().toISOString() },
                { name: 'Timestamp', value: Date.now().toString() }
            ];

            // Add custom metadata tags
            Object.entries(metadata).forEach(([key, value]) => {
                if (value && typeof value === 'string') {
                    tags.push({ name: key, value });
                }
            });

            const transaction = await this.createTransaction(data, tags);
            const transactionId = await this.postTransaction(transaction);

            logArweaveAction('stored', 'payment_receipt', transactionId, {
                leaseId: paymentData.leaseId,
                amount: paymentData.amount,
                currency: paymentData.currency
            });

            return transactionId;

        } catch (error) {
            logger.error('Failed to store payment receipt on Arweave:', error);
            throw new ArweaveError('Payment receipt storage failed', error.message);
        }
    }

    /**
     * Store message on Arweave
     */
    async storeMessage(messageData, metadata = {}) {
        try {
            if (!this.initialized) {
                throw new ArweaveError('Arweave service not initialized');
            }

            // Prepare data for storage
            const data = JSON.stringify(messageData);
            const tags = [
                { name: 'Content-Type', value: 'application/json' },
                { name: 'App-Name', value: 'Rental-Contract-AO' },
                { name: 'App-Version', value: config.APP_VERSION },
                { name: 'Data-Type', value: 'message' },
                { name: 'Lease-ID', value: messageData.leaseId },
                { name: 'Sender', value: messageData.sender },
                { name: 'Recipient', value: messageData.recipient },
                { name: 'Message-Type', value: messageData.messageType || 'general' },
                { name: 'Priority', value: messageData.priority || 'normal' },
                { name: 'Created-At', value: new Date().toISOString() },
                { name: 'Timestamp', value: Date.now().toString() }
            ];

            // Add custom metadata tags
            Object.entries(metadata).forEach(([key, value]) => {
                if (value && typeof value === 'string') {
                    tags.push({ name: key, value });
                }
            });

            const transaction = await this.createTransaction(data, tags);
            const transactionId = await this.postTransaction(transaction);

            logArweaveAction('stored', 'message', transactionId, {
                leaseId: messageData.leaseId,
                sender: messageData.sender,
                recipient: messageData.recipient
            });

            return transactionId;

        } catch (error) {
            logger.error('Failed to store message on Arweave:', error);
            throw new ArweaveError('Message storage failed', error.message);
        }
    }

    /**
     * Store maintenance ticket on Arweave
     */
    async storeMaintenanceTicket(ticketData, metadata = {}) {
        try {
            if (!this.initialized) {
                throw new ArweaveError('Arweave service not initialized');
            }

            // Prepare data for storage
            const data = JSON.stringify(ticketData);
            const tags = [
                { name: 'Content-Type', value: 'application/json' },
                { name: 'App-Name', value: 'Rental-Contract-AO' },
                { name: 'App-Version', value: config.APP_VERSION },
                { name: 'Data-Type', value: 'maintenance-ticket' },
                { name: 'Lease-ID', value: ticketData.leaseId },
                { name: 'Reported-By', value: ticketData.reportedBy },
                { name: 'Priority', value: ticketData.priority },
                { name: 'Category', value: ticketData.category },
                { name: 'Status', value: ticketData.status },
                { name: 'Created-At', value: new Date().toISOString() },
                { name: 'Timestamp', value: Date.now().toString() }
            ];

            // Add custom metadata tags
            Object.entries(metadata).forEach(([key, value]) => {
                if (value && typeof value === 'string') {
                    tags.push({ name: key, value });
                }
            });

            const transaction = await this.createTransaction(data, tags);
            const transactionId = await this.postTransaction(transaction);

            logArweaveAction('stored', 'maintenance_ticket', transactionId, {
                leaseId: ticketData.leaseId,
                priority: ticketData.priority,
                category: ticketData.category
            });

            return transactionId;

        } catch (error) {
            logger.error('Failed to store maintenance ticket on Arweave:', error);
            throw new ArweaveError('Maintenance ticket storage failed', error.message);
        }
    }

    /**
     * Store dispute package on Arweave
     */
    async storeDisputePackage(disputeData, metadata = {}) {
        try {
            if (!this.initialized) {
                throw new ArweaveError('Arweave service not initialized');
            }

            // Prepare data for storage
            const data = JSON.stringify(disputeData);
            const tags = [
                { name: 'Content-Type', value: 'application/json' },
                { name: 'App-Name', value: 'Rental-Contract-AO' },
                { name: 'App-Version', value: config.APP_VERSION },
                { name: 'Data-Type', value: 'dispute-package' },
                { name: 'Lease-ID', value: disputeData.leaseId },
                { name: 'Dispute-ID', value: disputeData.id },
                { name: 'Merkle-Root', value: disputeData.merkleRoot },
                { name: 'Evidence-Count', value: disputeData.evidenceTxIds.length.toString() },
                { name: 'Created-By', value: disputeData.createdBy },
                { name: 'Status', value: disputeData.status },
                { name: 'Created-At', value: new Date().toISOString() },
                { name: 'Timestamp', value: Date.now().toString() }
            ];

            // Add custom metadata tags
            Object.entries(metadata).forEach(([key, value]) => {
                if (value && typeof value === 'string') {
                    tags.push({ name: key, value });
                }
            });

            const transaction = await this.createTransaction(data, tags);
            const transactionId = await this.postTransaction(transaction);

            logArweaveAction('stored', 'dispute_package', transactionId, {
                leaseId: disputeData.leaseId,
                disputeId: disputeData.id,
                evidenceCount: disputeData.evidenceTxIds.length
            });

            return transactionId;

        } catch (error) {
            logger.error('Failed to store dispute package on Arweave:', error);
            throw new ArweaveError('Dispute package storage failed', error.message);
        }
    }

    /**
     * Create Arweave transaction
     */
    async createTransaction(data, tags) {
        try {
            if (config.MOCK_ARWEAVE) {
                // Return mock transaction for testing
                return {
                    id: 'mock_tx_' + Math.random().toString(36).substr(2, 9),
                    data: data,
                    tags: tags
                };
            }

            // Create real transaction
            const transaction = await this.arweave.createTransaction({
                data: data
            }, this.wallet);

            // Add tags
            tags.forEach(tag => {
                transaction.addTag(tag.name, tag.value);
            });

            // Sign transaction
            await this.arweave.transactions.sign(transaction, this.wallet);

            return transaction;

        } catch (error) {
            logger.error('Failed to create Arweave transaction:', error);
            throw new ArweaveError('Transaction creation failed', error.message);
        }
    }

    /**
     * Post transaction to Arweave
     */
    async postTransaction(transaction) {
        try {
            if (config.MOCK_ARWEAVE) {
                // Return mock transaction ID for testing
                return transaction.id;
            }

            // Post real transaction
            const response = await this.arweave.transactions.post(transaction);
            
            if (response.status !== 200 && response.status !== 202) {
                throw new Error(`Transaction posting failed: ${response.status} ${response.statusText}`);
            }

            return transaction.id;

        } catch (error) {
            logger.error('Failed to post Arweave transaction:', error);
            throw new ArweaveError('Transaction posting failed', error.message);
        }
    }

    /**
     * Retrieve data from Arweave
     */
    async retrieveData(transactionId) {
        try {
            if (config.MOCK_ARWEAVE) {
                logger.info('Mock data retrieval', { transactionId });
                return { data: 'mock_data', metadata: {} };
            }

            if (!this.initialized) {
                throw new ArweaveError('Arweave service not initialized');
            }

            // Get transaction data
            const data = await this.arweave.transactions.getData(transactionId, {
                decode: true
            });

            // Get transaction metadata
            const metadata = await this.getTransactionMetadata(transactionId);

            return { data, metadata };

        } catch (error) {
            logger.error('Failed to retrieve data from Arweave:', error);
            throw new ArweaveError('Data retrieval failed', error.message);
        }
    }

    /**
     * Get transaction metadata
     */
    async getTransactionMetadata(transactionId) {
        try {
            if (config.MOCK_ARWEAVE) {
                return { tags: [] };
            }

            const transaction = await this.arweave.transactions.get(transactionId);
            const tags = transaction.tags.reduce((acc, tag) => {
                acc[tag.get('name', { decode: true })] = tag.get('value', { decode: true });
                return acc;
            }, {});

            return { tags };

        } catch (error) {
            logger.error('Failed to get transaction metadata:', error);
            throw new ArweaveError('Metadata retrieval failed', error.message);
        }
    }

    /**
     * Search transactions by tags
     */
    async searchTransactions(query, options = {}) {
        try {
            if (config.MOCK_ARWEAVE) {
                logger.info('Mock transaction search', { query, options });
                return [];
            }

            if (!this.initialized) {
                throw new ArweaveError('Arweave service not initialized');
            }

            // Build query string
            let queryString = query;
            if (options.tags) {
                Object.entries(options.tags).forEach(([key, value]) => {
                    queryString += ` AND ${key}:${value}`;
                });
            }

            // Search transactions
            const transactionIds = await this.arweave.arql(queryString);
            
            // Limit results
            if (options.limit) {
                transactionIds.splice(options.limit);
            }

            return transactionIds;

        } catch (error) {
            logger.error('Failed to search Arweave transactions:', error);
            throw new ArweaveError('Transaction search failed', error.message);
        }
    }

    /**
     * Get wallet balance
     */
    async getWalletBalance() {
        try {
            if (config.MOCK_ARWEAVE) {
                return { balance: '1000000000000000000', unit: 'winston' };
            }

            if (!this.initialized || !this.wallet) {
                throw new ArweaveError('Arweave service not initialized');
            }

            const balance = await this.arweave.wallets.getBalance(this.wallet.address);
            const balanceInAR = this.arweave.ar.winstonToAr(balance);

            return {
                balance: balance,
                balanceInAR: balanceInAR,
                unit: 'winston',
                address: this.wallet.address
            };

        } catch (error) {
            logger.error('Failed to get wallet balance:', error);
            throw new ArweaveError('Balance retrieval failed', error.message);
        }
    }

    /**
     * Validate Arweave transaction ID format
     */
    validateTransactionId(txId) {
        if (!txId || typeof txId !== 'string') {
            throw new ValidationError('Transaction ID is required');
        }

        // Arweave transaction IDs are 43 characters long and contain only base64url characters
        const arweaveTxIdPattern = /^[A-Za-z0-9_-]{43}$/;
        if (!arweaveTxIdPattern.test(txId)) {
            throw new ValidationError('Invalid Arweave transaction ID format');
        }

        return true;
    }

    /**
     * Close Arweave service
     */
    async close() {
        try {
            this.initialized = false;
            this.arweave = null;
            this.wallet = null;
            logger.info('Arweave service closed');
        } catch (error) {
            logger.error('Failed to close Arweave service:', error);
        }
    }
}

// Create singleton instance
const arweaveService = new ArweaveService();

module.exports = { arweaveService };