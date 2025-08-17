/**
 * Maintenance service for AO agent
 * Handles maintenance ticket creation and management
 */

const { v4: uuidv4 } = require('uuid');
const { logger, logMaintenanceAction } = require('../utils/logger');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

class MaintenanceService {
    constructor() {
        this.tickets = new Map();
        this.ticketCounter = 0;
    }

    /**
     * Create maintenance ticket
     */
    async createTicket(ticketData) {
        try {
            const ticketId = uuidv4();
            
            // Create ticket object
            const ticket = {
                id: ticketId,
                leaseId: ticketData.leaseId,
                title: ticketData.title,
                description: ticketData.description,
                priority: ticketData.priority,
                status: 'open',
                createdBy: ticketData.createdBy,
                arweaveTxId: ticketData.arweaveTxId,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // Store ticket
            this.tickets.set(ticketId, ticket);
            this.ticketCounter++;
            
            logMaintenanceAction('created', ticketId, ticketData.leaseId, ticketData.createdBy, {
                title: ticketData.title,
                priority: ticketData.priority
            });
            
            return ticket;
            
        } catch (error) {
            logger.error('Failed to create maintenance ticket:', error);
            throw error;
        }
    }

    /**
     * Update maintenance ticket
     */
    async updateTicket(ticketId, updates) {
        try {
            const ticket = this.tickets.get(ticketId);
            if (!ticket) {
                throw new NotFoundError('Ticket not found');
            }
            
            // Apply updates
            Object.assign(ticket, updates);
            ticket.updatedAt = new Date();
            
            logMaintenanceAction('updated', ticketId, ticket.leaseId, updates.updatedBy, {
                status: updates.status,
                notes: updates.notes
            });
            
            return ticket;
            
        } catch (error) {
            logger.error('Failed to update maintenance ticket:', error);
            throw error;
        }
    }
}

// Create singleton instance
const maintenanceService = new MaintenanceService();

module.exports = { maintenanceService };