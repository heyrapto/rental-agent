/**
 * Communication service for AO agent
 * Handles messaging between lease parties
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

class CommunicationService {
    constructor() {
        this.messages = new Map();
        this.messageCounter = 0;
    }

    /**
     * Post a message
     */
    async postMessage(messageData) {
        try {
            const messageId = uuidv4();
            
            // Create message object
            const message = {
                id: messageId,
                leaseId: messageData.leaseId,
                sender: messageData.sender,
                content: messageData.content,
                threadId: messageData.threadId || 'main',
                arweaveTxId: messageData.arweaveTxId,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // Store message
            this.messages.set(messageId, message);
            this.messageCounter++;
            
            return message;
            
        } catch (error) {
            logger.error('Failed to post message:', error);
            throw error;
        }
    }
}

// Create singleton instance
const communicationService = new CommunicationService();

module.exports = { communicationService };