/**
 * Maintenance service for AO agent
 * Handles maintenance ticket creation and management
 */

const { v4: uuidv4 } = require('uuid');
const { logger, logMaintenanceAction } = require('../utils/logger');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');
const { config } = require('../config');

class MaintenanceService {
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
            logger.info('Maintenance service database initialized');
        } catch (error) {
            logger.error('Failed to initialize maintenance service database:', error);
            throw error;
        }
    }

    /**
     * Create a maintenance ticket
     */
    async createTicket(ticketData) {
        try {
            const ticketId = uuidv4();
            
            // Validate ticket data
            this.validateTicketData(ticketData);
            
            // Create ticket object
            const ticket = {
                id: ticketId,
                leaseId: ticketData.leaseId,
                reportedBy: ticketData.reportedBy,
                title: ticketData.title,
                description: ticketData.description,
                priority: ticketData.priority || 'medium',
                category: ticketData.category || 'general',
                status: 'open',
                assignedTo: null,
                estimatedCost: ticketData.estimatedCost || 0,
                actualCost: 0,
                dueDate: ticketData.dueDate ? new Date(ticketData.dueDate) : null,
                createdAt: new Date(),
                updatedAt: new Date(),
                arweaveTxId: ticketData.arweaveTxId || null
            };
            
            // Store ticket in database
            this.db.set(ticketId, ticket);
            
            // TODO: In production, this would be a real database insert
            // await this.db.query(
            //     'INSERT INTO maintenance_tickets (id, lease_id, reported_by, title, description, priority, category, status, estimated_cost, due_date, created_at, updated_at, arweave_tx_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            //     [ticketId, ticket.leaseId, ticket.reportedBy, ticket.title, ticket.description, ticket.priority, ticket.category, ticket.status, ticket.estimatedCost, ticket.dueDate, ticket.createdAt, ticket.updatedAt, ticket.arweaveTxId]
            // );
            
            logMaintenanceAction('created', ticketId, ticketData.leaseId, ticketData.reportedBy, {
                title: ticketData.title,
                priority: ticket.priority,
                category: ticket.category
            });
            
            return ticket;
            
        } catch (error) {
            logger.error('Failed to create maintenance ticket:', error);
            throw error;
        }
    }

    /**
     * Update a maintenance ticket
     */
    async updateTicket(ticketId, updates, walletAddress) {
        try {
            const ticket = this.db.get(ticketId);
            if (!ticket) {
                throw new NotFoundError('Maintenance ticket not found');
            }
            
            // Validate user can update ticket
            if (ticket.reportedBy !== walletAddress && !this.isMaintenanceManager(walletAddress)) {
                throw new ValidationError('Only ticket reporter or maintenance manager can update');
            }
            
            // Validate status transitions
            if (updates.status && !this.isValidStatusTransition(ticket.status, updates.status)) {
                throw new ValidationError('Invalid status transition');
            }
            
            // Apply updates
            Object.assign(ticket, updates);
            ticket.updatedAt = new Date();
            ticket.updatedBy = walletAddress;
            
            // Update ticket in database
            this.db.set(ticketId, ticket);
            
            // TODO: In production, this would be a real database update
            // const updateFields = Object.keys(updates).map(field => `${field} = ?`).join(', ');
            // const updateValues = [...Object.values(updates), ticket.updatedAt, walletAddress, ticketId];
            // await this.db.query(`UPDATE maintenance_tickets SET ${updateFields}, updated_at = ?, updated_by = ? WHERE id = ?`, updateValues);
            
            logMaintenanceAction('updated', ticketId, ticket.leaseId, walletAddress, updates);
            
            return ticket;
            
        } catch (error) {
            logger.error('Failed to update maintenance ticket:', error);
            throw error;
        }
    }

    /**
     * Get ticket by ID
     */
    async getTicket(ticketId) {
        try {
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query('SELECT * FROM maintenance_tickets WHERE id = ?', [ticketId]);
            // if (rows.length === 0) {
            //     throw new NotFoundError('Maintenance ticket not found');
            // }
            // return rows[0];
            
            const ticket = this.db.get(ticketId);
            if (!ticket) {
                throw new NotFoundError('Maintenance ticket not found');
            }
            
            return ticket;
            
        } catch (error) {
            logger.error('Failed to get maintenance ticket:', error);
            throw error;
        }
    }

    /**
     * Get tickets for a lease
     */
    async getLeaseTickets(leaseId) {
        try {
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query(
            //     'SELECT * FROM maintenance_tickets WHERE lease_id = ? ORDER BY created_at DESC',
            //     [leaseId]
            // );
            // return rows;
            
            const leaseTickets = [];
            
            for (const ticket of this.db.values()) {
                if (ticket.leaseId === leaseId) {
                    leaseTickets.push(ticket);
                }
            }
            
            return leaseTickets.sort((a, b) => b.createdAt - a.createdAt);
            
        } catch (error) {
            logger.error('Failed to get lease tickets:', error);
            throw error;
        }
    }

    /**
     * Get tickets for a user
     */
    async getUserTickets(walletAddress) {
        try {
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query(
            //     'SELECT * FROM maintenance_tickets WHERE reported_by = ? OR assigned_to = ? ORDER BY created_at DESC',
            //     [walletAddress, walletAddress]
            // );
            // return rows;
            
            const userTickets = [];
            
            for (const ticket of this.db.values()) {
                if (ticket.reportedBy === walletAddress || ticket.assignedTo === walletAddress) {
                    userTickets.push(ticket);
                }
            }
            
            return userTickets.sort((a, b) => b.createdAt - a.createdAt);
            
        } catch (error) {
            logger.error('Failed to get user tickets:', error);
            throw error;
        }
    }

    /**
     * Get tickets by status
     */
    async getTicketsByStatus(status) {
        try {
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query(
            //     'SELECT * FROM maintenance_tickets WHERE status = ? ORDER BY priority DESC, created_at ASC',
            //     [status]
            // );
            // return rows;
            
            const statusTickets = [];
            
            for (const ticket of this.db.values()) {
                if (ticket.status === status) {
                    statusTickets.push(ticket);
                }
            }
            
            // Sort by priority (high, medium, low) then by creation date
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return statusTickets.sort((a, b) => {
                const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
                if (priorityDiff !== 0) return priorityDiff;
                return a.createdAt - b.createdAt;
            });
            
        } catch (error) {
            logger.error('Failed to get tickets by status:', error);
            throw error;
        }
    }

    /**
     * Get overdue tickets
     */
    async getOverdueTickets() {
        try {
            const now = new Date();
            
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query(`
            //     SELECT *, 
            //     DATEDIFF(due_date, CURDATE()) as days_overdue
            //     FROM maintenance_tickets 
            //     WHERE status IN ('open', 'in_progress') 
            //     AND due_date < CURDATE()
            //     ORDER BY due_date ASC
            // `);
            // return rows;
            
            const overdueTickets = [];
            
            for (const ticket of this.db.values()) {
                if ((ticket.status === 'open' || ticket.status === 'in_progress') && 
                    ticket.dueDate && ticket.dueDate < now) {
                    const daysOverdue = Math.ceil((now - ticket.dueDate) / (24 * 60 * 60 * 1000));
                    overdueTickets.push({
                        ...ticket,
                        daysOverdue
                    });
                }
            }
            
            return overdueTickets.sort((a, b) => a.dueDate - b.dueDate);
            
        } catch (error) {
            logger.error('Failed to get overdue tickets:', error);
            throw error;
        }
    }

    /**
     * Assign ticket to maintenance worker
     */
    async assignTicket(ticketId, assignedTo, walletAddress) {
        try {
            const ticket = this.db.get(ticketId);
            if (!ticket) {
                throw new NotFoundError('Maintenance ticket not found');
            }
            
            // Only maintenance managers can assign tickets
            if (!this.isMaintenanceManager(walletAddress)) {
                throw new ValidationError('Only maintenance managers can assign tickets');
            }
            
            // Update assignment
            ticket.assignedTo = assignedTo;
            ticket.status = 'assigned';
            ticket.updatedAt = new Date();
            ticket.updatedBy = walletAddress;
            
            // Update ticket in database
            this.db.set(ticketId, ticket);
            
            // TODO: In production, this would be a real database update
            // await this.db.query(
            //     'UPDATE maintenance_tickets SET assigned_to = ?, status = ?, updated_at = ?, updated_by = ? WHERE id = ?',
            //     [assignedTo, 'assigned', ticket.updatedAt, walletAddress, ticketId]
            // );
            
            logMaintenanceAction('assigned', ticketId, ticket.leaseId, walletAddress, {
                assignedTo,
                status: 'assigned'
            });
            
            return ticket;
            
        } catch (error) {
            logger.error('Failed to assign ticket:', error);
            throw error;
        }
    }

    /**
     * Update ticket cost
     */
    async updateTicketCost(ticketId, actualCost, walletAddress) {
        try {
            const ticket = this.db.get(ticketId);
            if (!ticket) {
                throw new NotFoundError('Maintenance ticket not found');
            }
            
            // Only maintenance managers can update costs
            if (!this.isMaintenanceManager(walletAddress)) {
                throw new ValidationError('Only maintenance managers can update costs');
            }
            
            // Update cost
            ticket.actualCost = actualCost;
            ticket.updatedAt = new Date();
            ticket.updatedBy = walletAddress;
            
            // Update ticket in database
            this.db.set(ticketId, ticket);
            
            // TODO: In production, this would be a real database update
            // await this.db.query(
            //     'UPDATE maintenance_tickets SET actual_cost = ?, updated_at = ?, updated_by = ? WHERE id = ?',
            //     [actualCost, ticket.updatedAt, walletAddress, ticketId]
            // );
            
            logMaintenanceAction('cost_updated', ticketId, ticket.leaseId, walletAddress, {
                actualCost,
                estimatedCost: ticket.estimatedCost
            });
            
            return ticket;
            
        } catch (error) {
            logger.error('Failed to update ticket cost:', error);
            throw error;
        }
    }

    /**
     * Get maintenance statistics
     */
    async getMaintenanceStats() {
        try {
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query(`
            //     SELECT 
            //         COUNT(*) as total,
            //         SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
            //         SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned,
            //         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
            //         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            //         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
            //         SUM(estimated_cost) as total_estimated_cost,
            //         SUM(actual_cost) as total_actual_cost
            //     FROM maintenance_tickets
            // `);
            // return rows[0];
            
            const stats = {
                total: this.db.size,
                open: 0,
                assigned: 0,
                in_progress: 0,
                completed: 0,
                cancelled: 0,
                totalEstimatedCost: 0,
                totalActualCost: 0
            };
            
            for (const ticket of this.db.values()) {
                stats[ticket.status]++;
                stats.totalEstimatedCost += ticket.estimatedCost;
                stats.totalActualCost += ticket.actualCost;
            }
            
            return stats;
            
        } catch (error) {
            logger.error('Failed to get maintenance stats:', error);
            throw error;
        }
    }

    /**
     * Validate ticket data
     */
    validateTicketData(ticketData) {
        if (!ticketData.leaseId) {
            throw new ValidationError('Lease ID is required');
        }
        
        if (!ticketData.reportedBy) {
            throw new ValidationError('Reporter address is required');
        }
        
        if (!ticketData.title || ticketData.title.trim().length === 0) {
            throw new ValidationError('Title is required');
        }
        
        if (!ticketData.description || ticketData.description.trim().length === 0) {
            throw new ValidationError('Description is required');
        }
        
        if (ticketData.priority && !['low', 'medium', 'high'].includes(ticketData.priority)) {
            throw new ValidationError('Invalid priority level');
        }
        
        if (ticketData.category && !['plumbing', 'electrical', 'hvac', 'structural', 'appliance', 'general'].includes(ticketData.category)) {
            throw new ValidationError('Invalid category');
        }
        
        if (ticketData.estimatedCost && ticketData.estimatedCost < 0) {
            throw new ValidationError('Estimated cost cannot be negative');
        }
        
        if (ticketData.dueDate && new Date(ticketData.dueDate) <= new Date()) {
            throw new ValidationError('Due date must be in the future');
        }
    }

    /**
     * Check if user is a maintenance manager
     */
    isMaintenanceManager(walletAddress) {
        // In production, this would check against a real role/permission system
        // For now, using a simple check against config
        return config.MAINTENANCE_MANAGERS && 
               config.MAINTENANCE_MANAGERS.includes(walletAddress);
    }

    /**
     * Validate status transition
     */
    isValidStatusTransition(currentStatus, newStatus) {
        const validTransitions = {
            'open': ['assigned', 'cancelled'],
            'assigned': ['in_progress', 'cancelled'],
            'in_progress': ['completed', 'cancelled'],
            'completed': [], // Terminal state
            'cancelled': []  // Terminal state
        };
        
        return validTransitions[currentStatus] && 
               validTransitions[currentStatus].includes(newStatus);
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
            logger.info('Maintenance service database connection closed');
        } catch (error) {
            logger.error('Failed to close maintenance service database:', error);
        }
    }
}

// Create singleton instance
const maintenanceService = new MaintenanceService();

module.exports = { maintenanceService };