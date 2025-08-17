/**
 * Arweave service for immutable storage
 * Handles all interactions with the Arweave network
 */

const Arweave = require('arweave');
const { logger, logArweaveAction, logError } = require('../utils/logger');
const { config } = require('../config');
const { ArweaveError } = require('../middleware/errorHandler');

class ArweaveService {
    constructor() {
        this.arweave = null;
        this.wallet = null;
        this.isConnected = false;
        this.retryAttempts = config.ARWEAVE_RETRIES;
        this.timeout = config.ARWEAVE_TIMEOUT;
    }

    /**
     * Initialize Arweave service
     */
    async initialize() {
        try {
            // Initialize Arweave client
            this.arweave = Arweave.init({
                host: config.ARWEAVE_HOST,
                port: config.ARWEAVE_PORT,
                protocol: config.ARWEAVE_PROTOCOL,
                timeout: this.timeout
            });

            // Load wallet if available
            if (config.WALLET_PATH) {
                await this.loadWallet();
            }

            // Test connection
            await this.testConnection();
            
            this.isConnected = true;
            logger.info('Arweave service initialized successfully', {
                host: config.ARWEAVE_HOST,
                network: config.ARWEAVE_NETWORK
            });

        } catch (error) {
            logError(error, { service: 'arweave', action: 'initialize' });
            throw new ArweaveError('Failed to initialize Arweave service', error.message);
        }
    }

    /**
     * Load Arweave wallet
     */
    async loadWallet() {
        try {
            if (config.MOCK_ARWEAVE) {
                // Create mock wallet for testing
                this.wallet = await this.arweave.wallets.generate();
                logger.info('Mock wallet generated for testing');
            } else {
                // Load real wallet from file
                this.wallet = JSON.parse(require('fs').readFileSync(config.WALLET_PATH, 'utf8'));
                logger.info('Wallet loaded successfully');
            }
        } catch (error) {
            logger.warn('Failed to load wallet, running in read-only mode', error.message);
            this.wallet = null;
        }
    }

    /**
     * Test Arweave connection
     */
    async testConnection() {
        try {
            const info = await this.arweave.network.getInfo();
            logger.info('Arweave network info', {
                version: info.version,
                height: info.height,
                peers: info.peers
            });
        } catch (error) {
            throw new ArweaveError('Failed to connect to Arweave network', error.message);
        }
    }

    /**
     * Store lease terms on Arweave
     */
    async storeLeaseTerms(terms, metadata) {
        try {
            const transaction = await this.arweave.createTransaction({
                data: terms
            });

            // Add metadata tags
            transaction.addTag('Content-Type', 'application/json');
            transaction.addTag('App-Name', 'rental-contract-ao-agent');
            transaction.addTag('App-Version', require('../../../package.json').version);
            transaction.addTag('Type', 'lease-terms');
            transaction.addTag('Lease-ID', metadata.leaseId);
            transaction.addTag('Landlord', metadata.landlordAddr);
            transaction.addTag('Tenant', metadata.tenantAddr);
            transaction.addTag('Rent', metadata.rent.toString());
            transaction.addTag('Currency', metadata.currency);
            transaction.addTag('Deposit', metadata.deposit.toString());
            transaction.addTag('Start-Date', metadata.startDate);
            transaction.addTag('End-Date', metadata.endDate);
            transaction.addTag('Timestamp', new Date().toISOString());

            // Sign and post transaction
            if (this.wallet) {
                await this.arweave.transactions.sign(transaction, this.wallet);
                const response = await this.arweave.transactions.post(transaction);
                
                if (response.status === 200 || response.status === 202) {
                    logArweaveAction('stored', transaction.id, {
                        type: 'lease-terms',
                        leaseId: metadata.leaseId
                    });
                    
                    return transaction.id;
                } else {
                    throw new ArweaveError('Failed to post transaction', response.statusText);
                }
            } else {
                throw new ArweaveError('No wallet available for signing transactions');
            }

        } catch (error) {
            logError(error, { 
                service: 'arweave', 
                action: 'storeLeaseTerms',
                leaseId: metadata.leaseId 
            });
            throw new ArweaveError('Failed to store lease terms', error.message);
        }
    }

    /**
     * Store payment receipt on Arweave
     */
    async storePaymentReceipt(receiptData) {
        try {
            const transaction = await this.arweave.createTransaction({
                data: JSON.stringify(receiptData)
            });

            // Add metadata tags
            transaction.addTag('Content-Type', 'application/json');
            transaction.addTag('App-Name', 'rental-contract-ao-agent');
            transaction.addTag('Type', 'payment-receipt');
            transaction.addTag('Lease-ID', receiptData.leaseId);
            transaction.addTag('Payer', receiptData.payer);
            transaction.addTag('Amount', receiptData.amount.toString());
            transaction.addTag('Currency', receiptData.currency);
            transaction.addTag('Chain-ID', receiptData.chainId);
            transaction.addTag('TX-Hash', receiptData.txHash);
            transaction.addTag('Timestamp', receiptData.timestamp);

            // Sign and post transaction
            if (this.wallet) {
                await this.arweave.transactions.sign(transaction, this.wallet);
                const response = await this.arweave.transactions.post(transaction);
                
                if (response.status === 200 || response.status === 202) {
                    logArweaveAction('stored', transaction.id, {
                        type: 'payment-receipt',
                        leaseId: receiptData.leaseId
                    });
                    
                    return transaction.id;
                } else {
                    throw new ArweaveError('Failed to post transaction', response.statusText);
                }
            } else {
                throw new ArweaveError('No wallet available for signing transactions');
            }

        } catch (error) {
            logError(error, { 
                service: 'arweave', 
                action: 'storePaymentReceipt',
                leaseId: receiptData.leaseId 
            });
            throw new ArweaveError('Failed to store payment receipt', error.message);
        }
    }

    /**
     * Store message on Arweave
     */
    async storeMessage(messageData) {
        try {
            const transaction = await this.arweave.createTransaction({
                data: messageData.content
            });

            // Add metadata tags
            transaction.addTag('Content-Type', 'text/plain');
            transaction.addTag('App-Name', 'rental-contract-ao-agent');
            transaction.addTag('Type', 'message');
            transaction.addTag('Lease-ID', messageData.leaseId);
            transaction.addTag('Sender', messageData.sender);
            transaction.addTag('Thread-ID', messageData.threadId || 'main');
            transaction.addTag('Timestamp', messageData.timestamp);

            // Sign and post transaction
            if (this.wallet) {
                await this.arweave.transactions.sign(transaction, this.wallet);
                const response = await this.arweave.transactions.post(transaction);
                
                if (response.status === 200 || response.status === 202) {
                    logArweaveAction('stored', transaction.id, {
                        type: 'message',
                        leaseId: messageData.leaseId,
                        threadId: messageData.threadId
                    });
                    
                    return transaction.id;
                } else {
                    throw new ArweaveError('Failed to post transaction', response.statusText);
                }
            } else {
                throw new ArweaveError('No wallet available for signing transactions');
            }

        } catch (error) {
            logError(error, { 
                service: 'arweave', 
                action: 'storeMessage',
                leaseId: messageData.leaseId 
            });
            throw new ArweaveError('Failed to store message', error.message);
        }
    }

    /**
     * Store maintenance ticket on Arweave
     */
    async storeMaintenanceTicket(ticketData) {
        try {
            const transaction = await this.arweave.createTransaction({
                data: JSON.stringify(ticketData)
            });

            // Add metadata tags
            transaction.addTag('Content-Type', 'application/json');
            transaction.addTag('App-Name', 'rental-contract-ao-agent');
            transaction.addTag('Type', 'maintenance-ticket');
            transaction.addTag('Lease-ID', ticketData.leaseId);
            transaction.addTag('Title', ticketData.title);
            transaction.addTag('Priority', ticketData.priority);
            transaction.addTag('Created-By', ticketData.createdBy);
            transaction.addTag('Timestamp', ticketData.timestamp);

            // Sign and post transaction
            if (this.wallet) {
                await this.arweave.transactions.sign(transaction, this.wallet);
                const response = await this.arweave.transactions.post(transaction);
                
                if (response.status === 200 || response.status === 202) {
                    logArweaveAction('stored', transaction.id, {
                        type: 'maintenance-ticket',
                        leaseId: ticketData.leaseId,
                        priority: ticketData.priority
                    });
                    
                    return transaction.id;
                } else {
                    throw new ArweaveError('Failed to post transaction', response.statusText);
                }
            } else {
                throw new ArweaveError('No wallet available for signing transactions');
            }

        } catch (error) {
            logError(error, { 
                service: 'arweave', 
                action: 'storeMaintenanceTicket',
                leaseId: ticketData.leaseId 
            });
            throw new ArweaveError('Failed to store maintenance ticket', error.message);
        }
    }

    /**
     * Store dispute package on Arweave
     */
    async storeDisputePackage(disputeData) {
        try {
            const transaction = await this.arweave.createTransaction({
                data: JSON.stringify(disputeData)
            });

            // Add metadata tags
            transaction.addTag('Content-Type', 'application/json');
            transaction.addTag('App-Name', 'rental-contract-ao-agent');
            transaction.addTag('Type', 'dispute-package');
            transaction.addTag('Lease-ID', disputeData.leaseId);
            transaction.addTag('Dispute-ID', disputeData.disputeId);
            transaction.addTag('Merkle-Root', disputeData.merkleRoot);
            transaction.addTag('Evidence-Count', disputeData.evidenceCount.toString());
            transaction.addTag('Created-By', disputeData.createdBy);
            transaction.addTag('Timestamp', disputeData.timestamp);

            // Sign and post transaction
            if (this.wallet) {
                await this.arweave.transactions.sign(transaction, this.wallet);
                const response = await this.arweave.transactions.post(transaction);
                
                if (response.status === 200 || response.status === 202) {
                    logArweaveAction('stored', transaction.id, {
                        type: 'dispute-package',
                        leaseId: disputeData.leaseId,
                        disputeId: disputeData.disputeId
                    });
                    
                    return transaction.id;
                } else {
                    throw new ArweaveError('Failed to post transaction', response.statusText);
                }
            } else {
                throw new ArweaveError('No wallet available for signing transactions');
            }

        } catch (error) {
            logError(error, { 
                service: 'arweave', 
                action: 'storeDisputePackage',
                leaseId: disputeData.leaseId 
            });
            throw new ArweaveError('Failed to store dispute package', error.message);
        }
    }

    /**
     * Retrieve data from Arweave
     */
    async retrieveData(transactionId) {
        try {
            const data = await this.arweave.transactions.getData(transactionId, {
                decode: true
            });
            
            logArweaveAction('retrieved', transactionId, {});
            return data;

        } catch (error) {
            logError(error, { 
                service: 'arweave', 
                action: 'retrieveData',
                transactionId 
            });
            throw new ArweaveError('Failed to retrieve data', error.message);
        }
    }

    /**
     * Get transaction metadata
     */
    async getTransactionMetadata(transactionId) {
        try {
            const transaction = await this.arweave.transactions.get(transactionId);
            const tags = {};
            
            transaction.tags.forEach(tag => {
                const key = tag.get('name', { decode: true, string: true });
                const value = tag.get('value', { decode: true, string: true });
                tags[key] = value;
            });
            
            return {
                id: transaction.id,
                owner: transaction.owner,
                tags,
                timestamp: transaction.timestamp,
                block: transaction.block_id
            };

        } catch (error) {
            logError(error, { 
                service: 'arweave', 
                action: 'getTransactionMetadata',
                transactionId 
            });
            throw new ArweaveError('Failed to get transaction metadata', error.message);
        }
    }

    /**
     * Search for transactions by tags
     */
    async searchTransactions(tags) {
        try {
            const query = {
                op: 'and',
                expr1: {
                    op: 'equals',
                    expr1: 'App-Name',
                    expr2: 'rental-contract-ao-agent'
                }
            };

            // Add additional tag filters
            Object.entries(tags).forEach(([key, value]) => {
                query.expr1 = {
                    op: 'and',
                    expr1: query.expr1,
                    expr2: {
                        op: 'equals',
                        expr1: key,
                        expr2: value
                    }
                };
            });

            const results = await this.arweave.arql(query);
            
            logArweaveAction('searched', 'multiple', { 
                tagCount: Object.keys(tags).length,
                resultCount: results.length 
            });
            
            return results;

        } catch (error) {
            logError(error, { 
                service: 'arweave', 
                action: 'searchTransactions',
                tags 
            });
            throw new ArweaveError('Failed to search transactions', error.message);
        }
    }

    /**
     * Get wallet balance
     */
    async getWalletBalance() {
        try {
            if (!this.wallet) {
                throw new ArweaveError('No wallet available');
            }

            const address = await this.arweave.wallets.jwkToAddress(this.wallet);
            const balance = await this.arweave.wallets.getBalance(address);
            
            return {
                address,
                balance: this.arweave.ar.winstonToAr(balance)
            };

        } catch (error) {
            logError(error, { 
                service: 'arweave', 
                action: 'getWalletBalance' 
            });
            throw new ArweaveError('Failed to get wallet balance', error.message);
        }
    }

    /**
     * Disconnect from Arweave
     */
    disconnect() {
        this.isConnected = false;
        this.arweave = null;
        this.wallet = null;
        logger.info('Arweave service disconnected');
    }

    /**
     * Check if service is connected
     */
    isConnected() {
        return this.isConnected;
    }
}

// Create singleton instance
const arweaveService = new ArweaveService();

module.exports = { arweaveService };