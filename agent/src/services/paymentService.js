/**
 * Payment service for AO agent
 * Handles payment verification and recording
 */

const { v4: uuidv4 } = require('uuid');
const { logger, logPaymentAction } = require('../utils/logger');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

class PaymentService {
    constructor() {
        this.payments = new Map();
        this.paymentCounter = 0;
    }

    /**
     * Verify payment on blockchain
     */
    async verifyPayment(chainId, txHash, amount, currency) {
        try {
            // Mock payment verification for testing
            // In production, this would verify the transaction on the blockchain
            if (process.env.NODE_ENV === 'test' || process.env.MOCK_ETHEREUM === 'true') {
                logger.info('Mock payment verification', { chainId, txHash, amount, currency });
                return true;
            }

            // TODO: Implement real blockchain verification
            // This would involve:
            // 1. Querying the blockchain for the transaction
            // 2. Verifying the transaction details
            // 3. Confirming the payment amount and recipient
            // 4. Checking transaction confirmation status

            logger.warn('Real payment verification not implemented');
            return false;

        } catch (error) {
            logger.error('Payment verification failed:', error);
            return false;
        }
    }

    /**
     * Record a payment
     */
    async recordPayment(paymentData) {
        try {
            const paymentId = uuidv4();
            
            // Validate payment data
            this.validatePaymentData(paymentData);
            
            // Create payment object
            const payment = {
                id: paymentId,
                leaseId: paymentData.leaseId,
                payer: paymentData.payer,
                amount: paymentData.amount,
                currency: paymentData.currency,
                chainId: paymentData.chainId,
                txHash: paymentData.txHash,
                receiptArweaveTxId: paymentData.receiptArweaveTxId,
                confirmed: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // Store payment
            this.payments.set(paymentId, payment);
            this.paymentCounter++;
            
            logPaymentAction('recorded', paymentData.leaseId, paymentData.payer, paymentData.amount, paymentData.currency, {
                chainId: paymentData.chainId,
                txHash: paymentData.txHash
            });
            
            return payment;
            
        } catch (error) {
            logger.error('Failed to record payment:', error);
            throw error;
        }
    }

    /**
     * Get payment by ID
     */
    async getPayment(paymentId) {
        try {
            const payment = this.payments.get(paymentId);
            if (!payment) {
                throw new NotFoundError('Payment not found');
            }
            
            return payment;
            
        } catch (error) {
            logger.error('Failed to get payment:', error);
            throw error;
        }
    }

    /**
     * Get payments for a lease
     */
    async getLeasePayments(leaseId) {
        try {
            const leasePayments = [];
            
            for (const payment of this.payments.values()) {
                if (payment.leaseId === leaseId) {
                    leasePayments.push(payment);
                }
            }
            
            return leasePayments;
            
        } catch (error) {
            logger.error('Failed to get lease payments:', error);
            throw error;
        }
    }

    /**
     * Get payments for a user
     */
    async getUserPayments(walletAddress) {
        try {
            const userPayments = [];
            
            for (const payment of this.payments.values()) {
                if (payment.payer === walletAddress) {
                    userPayments.push(payment);
                }
            }
            
            return userPayments;
            
        } catch (error) {
            logger.error('Failed to get user payments:', error);
            throw error;
        }
    }

    /**
     * Confirm payment
     */
    async confirmPayment(paymentId, receiptArweaveTxId) {
        try {
            const payment = this.payments.get(paymentId);
            if (!payment) {
                throw new NotFoundError('Payment not found');
            }
            
            // Update payment
            payment.confirmed = true;
            payment.receiptArweaveTxId = receiptArweaveTxId;
            payment.updatedAt = new Date();
            
            logPaymentAction('confirmed', payment.leaseId, payment.payer, payment.amount, payment.currency, {
                paymentId,
                receiptArweaveTxId
            });
            
            return payment;
            
        } catch (error) {
            logger.error('Failed to confirm payment:', error);
            throw error;
        }
    }

    /**
     * Validate payment data
     */
    validatePaymentData(paymentData) {
        if (!paymentData.leaseId) {
            throw new ValidationError('Lease ID is required');
        }
        
        if (!paymentData.payer) {
            throw new ValidationError('Payer address is required');
        }
        
        if (!paymentData.amount || paymentData.amount <= 0) {
            throw new ValidationError('Valid amount is required');
        }
        
        if (!paymentData.currency) {
            throw new ValidationError('Currency is required');
        }
        
        if (!paymentData.chainId) {
            throw new ValidationError('Chain ID is required');
        }
        
        if (!paymentData.txHash) {
            throw new ValidationError('Transaction hash is required');
        }
    }

    /**
     * Get payment statistics
     */
    async getPaymentStats() {
        try {
            const stats = {
                total: this.payments.size,
                confirmed: 0,
                pending: 0,
                totalAmount: 0,
                byCurrency: {}
            };
            
            for (const payment of this.payments.values()) {
                if (payment.confirmed) {
                    stats.confirmed++;
                } else {
                    stats.pending++;
                }
                
                stats.totalAmount += payment.amount;
                
                if (!stats.byCurrency[payment.currency]) {
                    stats.byCurrency[payment.currency] = {
                        count: 0,
                        amount: 0
                    };
                }
                
                stats.byCurrency[payment.currency].count++;
                stats.byCurrency[payment.currency].amount += payment.amount;
            }
            
            return stats;
            
        } catch (error) {
            logger.error('Failed to get payment stats:', error);
            throw error;
        }
    }
}

// Create singleton instance
const paymentService = new PaymentService();

module.exports = { paymentService };