/**
 * Communication service for AO agent
 * Handles messaging between lease parties
 */

const { v4: uuidv4 } = require('uuid');
const { logger, logCommunicationAction } = require('../utils/logger');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');
const { config } = require('../config');

class CommunicationService {
    constructor() {
        this.db = null;
        this.initializeDatabase();
    }

    /**
     * Initialize database connection
     */
    async initializeDatabase() {
        try {
            // In production, this would connect to a real database
            this.db = new Map();
            logger.info('Communication service database initialized');
        } catch (error) {
            logger.error('Failed to initialize communication service database:', error);
            throw error;
        }
    }

    /**
     * Post a message
     */
    async postMessage(messageData) {
        try {
            const messageId = uuidv4();
            
            // Validate message data
            this.validateMessageData(messageData);
            
            // Create message object
            const message = {
                id: messageId,
                leaseId: messageData.leaseId,
                sender: messageData.sender,
                recipient: messageData.recipient,
                subject: messageData.subject || '',
                content: messageData.content,
                messageType: messageData.messageType || 'general',
                priority: messageData.priority || 'normal',
                read: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                arweaveTxId: messageData.arweaveTxId || null
            };
            
            // Store message in database
            this.db.set(messageId, message);
            
            // TODO: In production, this would be a real database insert
            // await this.db.query(
            //     'INSERT INTO messages (id, lease_id, sender, recipient, subject, content, message_type, priority, read, created_at, updated_at, arweave_tx_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            //     [messageId, message.leaseId, message.sender, message.recipient, message.subject, message.content, message.messageType, message.priority, message.read, message.createdAt, message.updatedAt, message.arweaveTxId]
            // );
            
            logCommunicationAction('sent', messageId, messageData.leaseId, messageData.sender, {
                recipient: messageData.recipient,
                subject: messageData.subject,
                messageType: message.messageType,
                priority: message.priority
            });
            
            return message;
            
        } catch (error) {
            logger.error('Failed to post message:', error);
            throw error;
        }
    }

    /**
     * Get message by ID
     */
    async getMessage(messageId) {
        try {
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query('SELECT * FROM messages WHERE id = ?', [messageId]);
            // if (rows.length === 0) {
            //     throw new NotFoundError('Message not found');
            // }
            // return rows[0];
            
            const message = this.db.get(messageId);
            if (!message) {
                throw new NotFoundError('Message not found');
            }
            
            return message;
            
        } catch (error) {
            logger.error('Failed to get message:', error);
            throw error;
        }
    }

    /**
     * Get messages for a lease
     */
    async getLeaseMessages(leaseId, walletAddress) {
        try {
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query(
            //     'SELECT * FROM messages WHERE lease_id = ? AND (sender = ? OR recipient = ?) ORDER BY created_at DESC',
            //     [leaseId, walletAddress, walletAddress]
            // );
            // return rows;
            
            const leaseMessages = [];
            
            for (const message of this.db.values()) {
                if (message.leaseId === leaseId && 
                    (message.sender === walletAddress || message.recipient === walletAddress)) {
                    leaseMessages.push(message);
                }
            }
            
            return leaseMessages.sort((a, b) => b.createdAt - a.createdAt);
            
        } catch (error) {
            logger.error('Failed to get lease messages:', error);
            throw error;
        }
    }

    /**
     * Get messages for a user
     */
    async getUserMessages(walletAddress, filters = {}) {
        try {
            let query = 'SELECT * FROM messages WHERE sender = ? OR recipient = ?';
            let queryParams = [walletAddress, walletAddress];
            
            if (filters.leaseId) {
                query += ' AND lease_id = ?';
                queryParams.push(filters.leaseId);
            }
            
            if (filters.messageType) {
                query += ' AND message_type = ?';
                queryParams.push(filters.messageType);
            }
            
            if (filters.read !== undefined) {
                query += ' AND read = ?';
                queryParams.push(filters.read);
            }
            
            query += ' ORDER BY created_at DESC';
            
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query(query, queryParams);
            // return rows;
            
            const userMessages = [];
            
            for (const message of this.db.values()) {
                if (message.sender === walletAddress || message.recipient === walletAddress) {
                    // Apply filters
                    if (filters.leaseId && message.leaseId !== filters.leaseId) continue;
                    if (filters.messageType && message.messageType !== filters.messageType) continue;
                    if (filters.read !== undefined && message.read !== filters.read) continue;
                    
                    userMessages.push(message);
                }
            }
            
            return userMessages.sort((a, b) => b.createdAt - a.createdAt);
            
        } catch (error) {
            logger.error('Failed to get user messages:', error);
            throw error;
        }
    }

    /**
     * Mark message as read
     */
    async markMessageAsRead(messageId, walletAddress) {
        try {
            const message = this.db.get(messageId);
            if (!message) {
                throw new NotFoundError('Message not found');
            }
            
            // Only recipient can mark as read
            if (message.recipient !== walletAddress) {
                throw new ValidationError('Only recipient can mark message as read');
            }
            
            // Update message
            message.read = true;
            message.updatedAt = new Date();
            
            // Update message in database
            this.db.set(messageId, message);
            
            // TODO: In production, this would be a real database update
            // await this.db.query(
            //     'UPDATE messages SET read = ?, updated_at = ? WHERE id = ?',
            //     [true, message.updatedAt, messageId]
            // );
            
            logCommunicationAction('read', messageId, message.leaseId, walletAddress);
            
            return message;
            
        } catch (error) {
            logger.error('Failed to mark message as read:', error);
            throw error;
        }
    }

    /**
     * Get unread message count for a user
     */
    async getUnreadMessageCount(walletAddress, leaseId = null) {
        try {
            let query = 'SELECT COUNT(*) as count FROM messages WHERE recipient = ? AND read = 0';
            let queryParams = [walletAddress];
            
            if (leaseId) {
                query += ' AND lease_id = ?';
                queryParams.push(leaseId);
            }
            
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query(query, queryParams);
            // return rows[0].count;
            
            let count = 0;
            
            for (const message of this.db.values()) {
                if (message.recipient === walletAddress && !message.read) {
                    if (!leaseId || message.leaseId === leaseId) {
                        count++;
                    }
                }
            }
            
            return count;
            
        } catch (error) {
            logger.error('Failed to get unread message count:', error);
            throw error;
        }
    }

    /**
     * Get conversation thread
     */
    async getConversationThread(leaseId, participant1, participant2) {
        try {
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query(`
            //     SELECT * FROM messages 
            //     WHERE lease_id = ? 
            //     AND ((sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?))
            //     ORDER BY created_at ASC
            // `, [leaseId, participant1, participant2, participant2, participant1]);
            // return rows;
            
            const conversation = [];
            
            for (const message of this.db.values()) {
                if (message.leaseId === leaseId && 
                    ((message.sender === participant1 && message.recipient === participant2) ||
                     (message.sender === participant2 && message.recipient === participant1))) {
                    conversation.push(message);
                }
            }
            
            return conversation.sort((a, b) => a.createdAt - b.createdAt);
            
        } catch (error) {
            logger.error('Failed to get conversation thread:', error);
            throw error;
        }
    }

    /**
     * Search messages
     */
    async searchMessages(walletAddress, searchTerm, filters = {}) {
        try {
            // TODO: In production, this would be a real database query with full-text search
            // const [rows] = await this.db.query(`
            //     SELECT * FROM messages 
            //     WHERE (sender = ? OR recipient = ?)
            //     AND (MATCH(subject, content) AGAINST(? IN BOOLEAN MODE))
            //     AND (? IS NULL OR lease_id = ?)
            //     AND (? IS NULL OR message_type = ?)
            //     ORDER BY created_at DESC
            // `, [walletAddress, walletAddress, searchTerm, filters.leaseId, filters.leaseId, filters.messageType, filters.messageType]);
            // return rows;
            
            const searchResults = [];
            const searchLower = searchTerm.toLowerCase();
            
            for (const message of this.db.values()) {
                if (message.sender === walletAddress || message.recipient === walletAddress) {
                    // Apply filters
                    if (filters.leaseId && message.leaseId !== filters.leaseId) continue;
                    if (filters.messageType && message.messageType !== filters.messageType) continue;
                    
                    // Search in subject and content
                    if (message.subject.toLowerCase().includes(searchLower) ||
                        message.content.toLowerCase().includes(searchLower)) {
                        searchResults.push(message);
                    }
                }
            }
            
            return searchResults.sort((a, b) => b.createdAt - a.createdAt);
            
        } catch (error) {
            logger.error('Failed to search messages:', error);
            throw error;
        }
    }

    /**
     * Get message statistics
     */
    async getMessageStats(walletAddress) {
        try {
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query(`
            //     SELECT 
            //         COUNT(*) as total,
            //         SUM(CASE WHEN sender = ? THEN 1 ELSE 0 END) as sent,
            //         SUM(CASE WHEN recipient = ? THEN 1 ELSE 0 END) as received,
            //         SUM(CASE WHEN recipient = ? AND read = 0 THEN 1 ELSE 0 END) as unread,
            //         message_type,
            //         COUNT(*) as count
            //     FROM messages 
            //     WHERE sender = ? OR recipient = ?
            //     GROUP BY message_type
            // `, [walletAddress, walletAddress, walletAddress, walletAddress, walletAddress]);
            // return rows;
            
            const stats = {
                total: 0,
                sent: 0,
                received: 0,
                unread: 0,
                byType: {}
            };
            
            for (const message of this.db.values()) {
                if (message.sender === walletAddress || message.recipient === walletAddress) {
                    stats.total++;
                    
                    if (message.sender === walletAddress) {
                        stats.sent++;
                    } else {
                        stats.received++;
                        if (!message.read) {
                            stats.unread++;
                        }
                    }
                    
                    if (!stats.byType[message.messageType]) {
                        stats.byType[message.messageType] = 0;
                    }
                    stats.byType[message.messageType]++;
                }
            }
            
            return stats;
            
        } catch (error) {
            logger.error('Failed to get message stats:', error);
            throw error;
        }
    }

    /**
     * Validate message data
     */
    validateMessageData(messageData) {
        if (!messageData.leaseId) {
            throw new ValidationError('Lease ID is required');
        }
        
        if (!messageData.sender) {
            throw new ValidationError('Sender address is required');
        }
        
        if (!messageData.recipient) {
            throw new ValidationError('Recipient address is required');
        }
        
        if (!messageData.content || messageData.content.trim().length === 0) {
            throw new ValidationError('Message content is required');
        }
        
        if (messageData.content.length > config.COMMUNICATION_MAX_MESSAGE_LENGTH) {
            throw new ValidationError(`Message content too long: ${config.COMMUNICATION_MAX_MESSAGE_LENGTH} characters maximum`);
        }
        
        if (messageData.messageType && !['general', 'maintenance', 'payment', 'legal', 'emergency'].includes(messageData.messageType)) {
            throw new ValidationError('Invalid message type');
        }
        
        if (messageData.priority && !['low', 'normal', 'high', 'urgent'].includes(messageData.priority)) {
            throw new ValidationError('Invalid priority level');
        }
        
        if (messageData.subject && messageData.subject.length > 200) {
            throw new ValidationError('Subject too long: 200 characters maximum');
        }
    }

    /**
     * Close database connection
     */
    async close() {
        try {
            // TODO: In production, this would close the real database connection
            // if (this.db) {
            //     await this.db.end();
            // }
            this.db.clear();
            logger.info('Communication service database connection closed');
        } catch (error) {
            logger.error('Failed to close communication service database:', error);
        }
    }
}

// Create singleton instance
const communicationService = new CommunicationService();

module.exports = { communicationService };