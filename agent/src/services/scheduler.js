/**
 * Autonomous scheduler service for AO agent
 * Handles automated tasks and reminders
 */

const cron = require('node-cron');
const { logger, logSchedulerAction, logError } = require('../utils/logger');
const { config } = require('../config');
const { SchedulerError } = require('../middleware/errorHandler');

class SchedulerService {
    constructor() {
        this.jobs = new Map();
        this.isRunning = false;
        this.retryAttempts = 3;
        this.retryDelay = 5000; // 5 seconds
    }

    /**
     * Initialize the scheduler
     */
    initialize() {
        if (!config.SCHEDULER_ENABLED) {
            logger.info('Scheduler is disabled');
            return;
        }

        try {
            this.setupJobs();
            this.isRunning = true;
            logger.info('Scheduler initialized successfully');
        } catch (error) {
            logError(error, { service: 'scheduler', action: 'initialize' });
            throw new SchedulerError('Failed to initialize scheduler', error.message);
        }
    }

    /**
     * Setup all scheduled jobs
     */
    setupJobs() {
        // Rent reminders - run daily at 9 AM
        this.scheduleJob('rent-reminders', '0 9 * * *', () => {
            this.processRentReminders();
        });

        // Overdue notices - run daily at 2 PM
        this.scheduleJob('overdue-notices', '0 14 * * *', () => {
            this.processOverdueNotices();
        });

        // Deposit checks - run every 6 hours
        this.scheduleJob('deposit-checks', '0 */6 * * *', () => {
            this.processDepositChecks();
        });

        // SLA monitoring - run every hour
        this.scheduleJob('sla-monitoring', '0 * * * *', () => {
            this.processSLAMonitoring();
        });

        // Lease expiry checks - run daily at 10 AM
        this.scheduleJob('lease-expiry', '0 10 * * *', () => {
            this.processLeaseExpiry();
        });

        // Maintenance ticket follow-ups - run every 4 hours
        this.scheduleJob('maintenance-followup', '0 */4 * * *', () => {
            this.processMaintenanceFollowups();
        });

        // Dispute package expiry - run daily at 11 AM
        this.scheduleJob('dispute-expiry', '0 11 * * *', () => {
            this.processDisputeExpiry();
        });

        // System health checks - run every 30 minutes
        this.scheduleJob('health-checks', '*/30 * * * *', () => {
            this.processHealthChecks();
        });

        // Data backup - run daily at 2 AM
        this.scheduleJob('data-backup', '0 2 * * *', () => {
            this.processDataBackup();
        });

        // Metrics collection - run every 15 minutes
        this.scheduleJob('metrics-collection', '*/15 * * * *', () => {
            this.processMetricsCollection();
        });
    }

    /**
     * Schedule a job with retry logic
     */
    scheduleJob(name, schedule, task) {
        try {
            const job = cron.schedule(schedule, async () => {
                await this.executeWithRetry(name, task);
            }, {
                scheduled: true,
                timezone: 'UTC'
            });

            this.jobs.set(name, job);
            logger.info(`Scheduled job: ${name} with schedule: ${schedule}`);

        } catch (error) {
            logError(error, { 
                service: 'scheduler', 
                action: 'scheduleJob',
                jobName: name,
                schedule 
            });
            throw new SchedulerError(`Failed to schedule job: ${name}`, error.message);
        }
    }

    /**
     * Execute task with retry logic
     */
    async executeWithRetry(jobName, task) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                const startTime = Date.now();
                
                logSchedulerAction('started', { jobName, attempt });
                
                await task();
                
                const duration = Date.now() - startTime;
                logSchedulerAction('completed', { 
                    jobName, 
                    attempt, 
                    duration 
                });
                
                return; // Success, exit retry loop
                
            } catch (error) {
                lastError = error;
                
                logSchedulerAction('failed', { 
                    jobName, 
                    attempt, 
                    error: error.message 
                });
                
                if (attempt < this.retryAttempts) {
                    // Wait before retry
                    await this.sleep(this.retryDelay * attempt);
                }
            }
        }
        
        // All retries failed
        logSchedulerAction('failed_final', { 
            jobName, 
            attempts: this.retryAttempts,
            error: lastError.message 
        });
        
        throw new SchedulerError(`Job ${jobName} failed after ${this.retryAttempts} attempts`, lastError.message);
    }

    /**
     * Process rent reminders
     */
    async processRentReminders() {
        try {
            const reminderDays = config.RENT_REMINDER_DAYS;
            const now = new Date();
            
            // Get leases with rent due in the next X days
            const leases = await this.getLeasesWithRentDue(reminderDays);
            
            for (const lease of leases) {
                try {
                    await this.sendRentReminder(lease);
                    logSchedulerAction('rent_reminder_sent', { 
                        leaseId: lease.id,
                        daysUntilDue: lease.daysUntilDue 
                    });
                } catch (error) {
                    logError(error, { 
                        service: 'scheduler', 
                        action: 'sendRentReminder',
                        leaseId: lease.id 
                    });
                }
            }
            
            logger.info(`Processed ${leases.length} rent reminders`);
            
        } catch (error) {
            logError(error, { 
                service: 'scheduler', 
                action: 'processRentReminders' 
            });
            throw error;
        }
    }

    /**
     * Process overdue notices
     */
    async processOverdueNotices() {
        try {
            const overdueDays = config.OVERDUE_NOTICE_DAYS;
            const now = new Date();
            
            // Get overdue leases
            const overdueLeases = await this.getOverdueLeases(overdueDays);
            
            for (const lease of overdueLeases) {
                try {
                    await this.sendOverdueNotice(lease);
                    logSchedulerAction('overdue_notice_sent', { 
                        leaseId: lease.id,
                        daysOverdue: lease.daysOverdue 
                    });
                } catch (error) {
                    logError(error, { 
                        service: 'scheduler', 
                        action: 'sendOverdueNotice',
                        leaseId: lease.id 
                    });
                }
            }
            
            logger.info(`Processed ${overdueLeases.length} overdue notices`);
            
        } catch (error) {
            logError(error, { 
                service: 'scheduler', 
                action: 'processOverdueNotices' 
            });
            throw error;
        }
    }

    /**
     * Process deposit checks
     */
    async processDepositChecks() {
        try {
            const checkInterval = config.DEPOSIT_CHECK_INTERVAL;
            
            // Get leases with deposits that need checking
            const depositsToCheck = await this.getDepositsToCheck(checkInterval);
            
            for (const deposit of depositsToCheck) {
                try {
                    await this.verifyDeposit(deposit);
                    logSchedulerAction('deposit_verified', { 
                        leaseId: deposit.leaseId,
                        amount: deposit.amount 
                    });
                } catch (error) {
                    logError(error, { 
                        service: 'scheduler', 
                        action: 'verifyDeposit',
                        leaseId: deposit.leaseId 
                    });
                }
            }
            
            logger.info(`Processed ${depositsToCheck.length} deposit checks`);
            
        } catch (error) {
            logError(error, { 
                service: 'scheduler', 
                action: 'processDepositChecks' 
            });
            throw error;
        }
    }

    /**
     * Process SLA monitoring
     */
    async processSLAMonitoring() {
        try {
            const slaInterval = config.SLA_PING_INTERVAL;
            
            // Get maintenance tickets that need SLA monitoring
            const ticketsToMonitor = await this.getTicketsForSLAMonitoring(slaInterval);
            
            for (const ticket of ticketsToMonitor) {
                try {
                    await this.checkTicketSLA(ticket);
                    logSchedulerAction('sla_checked', { 
                        ticketId: ticket.id,
                        leaseId: ticket.leaseId,
                        slaStatus: ticket.slaStatus 
                    });
                } catch (error) {
                    logError(error, { 
                        service: 'scheduler', 
                        action: 'checkTicketSLA',
                        ticketId: ticket.id 
                    });
                }
            }
            
            logger.info(`Processed ${ticketsToMonitor.length} SLA checks`);
            
        } catch (error) {
            logError(error, { 
                service: 'scheduler', 
                action: 'processSLAMonitoring' 
            });
            throw error;
        }
    }

    /**
     * Process lease expiry
     */
    async processLeaseExpiry() {
        try {
            const now = new Date();
            
            // Get leases expiring soon
            const expiringLeases = await this.getExpiringLeases();
            
            for (const lease of expiringLeases) {
                try {
                    await this.processLeaseExpiry(lease);
                    logSchedulerAction('lease_expiry_processed', { 
                        leaseId: lease.id,
                        daysUntilExpiry: lease.daysUntilExpiry 
                    });
                } catch (error) {
                    logError(error, { 
                        service: 'scheduler', 
                        action: 'processLeaseExpiry',
                        leaseId: lease.id 
                    });
                }
            }
            
            logger.info(`Processed ${expiringLeases.length} lease expiries`);
            
        } catch (error) {
            logError(error, { 
                service: 'scheduler', 
                action: 'processLeaseExpiry' 
            });
            throw error;
        }
    }

    /**
     * Process maintenance follow-ups
     */
    async processMaintenanceFollowups() {
        try {
            // Get maintenance tickets that need follow-up
            const ticketsForFollowup = await this.getTicketsForFollowup();
            
            for (const ticket of ticketsForFollowup) {
                try {
                    await this.sendMaintenanceFollowup(ticket);
                    logSchedulerAction('maintenance_followup_sent', { 
                        ticketId: ticket.id,
                        leaseId: ticket.leaseId 
                    });
                } catch (error) {
                    logError(error, { 
                        service: 'scheduler', 
                        action: 'sendMaintenanceFollowup',
                        ticketId: ticket.id 
                    });
                }
            }
            
            logger.info(`Processed ${ticketsForFollowup.length} maintenance follow-ups`);
            
        } catch (error) {
            logError(error, { 
                service: 'scheduler', 
                action: 'processMaintenanceFollowups' 
            });
            throw error;
        }
    }

    /**
     * Process dispute expiry
     */
    async processDisputeExpiry() {
        try {
            const now = new Date();
            
            // Get expiring dispute packages
            const expiringDisputes = await this.getExpiringDisputes();
            
            for (const dispute of expiringDisputes) {
                try {
                    await this.processDisputeExpiry(dispute);
                    logSchedulerAction('dispute_expiry_processed', { 
                        disputeId: dispute.id,
                        leaseId: dispute.leaseId 
                    });
                } catch (error) {
                    logError(error, { 
                        service: 'scheduler', 
                        action: 'processDisputeExpiry',
                        disputeId: dispute.id 
                    });
                }
            }
            
            logger.info(`Processed ${expiringDisputes.length} dispute expiries`);
            
        } catch (error) {
            logError(error, { 
                service: 'scheduler', 
                action: 'processDisputeExpiry' 
            });
            throw error;
        }
    }

    /**
     * Process health checks
     */
    async processHealthChecks() {
        try {
            const healthStatus = await this.performHealthCheck();
            
            if (healthStatus.status === 'healthy') {
                logSchedulerAction('health_check_passed', { 
                    timestamp: new Date().toISOString() 
                });
            } else {
                logSchedulerAction('health_check_failed', { 
                    status: healthStatus.status,
                    issues: healthStatus.issues 
                });
            }
            
        } catch (error) {
            logError(error, { 
                service: 'scheduler', 
                action: 'processHealthChecks' 
            });
            throw error;
        }
    }

    /**
     * Process data backup
     */
    async processDataBackup() {
        try {
            const backupResult = await this.performDataBackup();
            
            logSchedulerAction('data_backup_completed', { 
                backupSize: backupResult.size,
                backupLocation: backupResult.location 
            });
            
        } catch (error) {
            logError(error, { 
                service: 'scheduler', 
                action: 'processDataBackup' 
            });
            throw error;
        }
    }

    /**
     * Process metrics collection
     */
    async processMetricsCollection() {
        try {
            const metrics = await this.collectMetrics();
            
            logSchedulerAction('metrics_collected', { 
                metricCount: Object.keys(metrics).length,
                timestamp: new Date().toISOString() 
            });
            
        } catch (error) {
            logError(error, { 
                service: 'scheduler', 
                action: 'processMetricsCollection' 
            });
            throw error;
        }
    }

    /**
     * Helper method to sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Shutdown the scheduler
     */
    shutdown() {
        if (!this.isRunning) return;
        
        try {
            // Stop all jobs
            for (const [name, job] of this.jobs) {
                job.stop();
                logger.info(`Stopped scheduled job: ${name}`);
            }
            
            this.jobs.clear();
            this.isRunning = false;
            logger.info('Scheduler shutdown complete');
            
        } catch (error) {
            logError(error, { 
                service: 'scheduler', 
                action: 'shutdown' 
            });
        }
    }

    /**
     * Get scheduler status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            jobCount: this.jobs.size,
            jobs: Array.from(this.jobs.keys()),
            enabled: config.SCHEDULER_ENABLED
        };
    }

    // Placeholder methods for actual implementation
    async getLeasesWithRentDue(days) { return []; }
    async getOverdueLeases(days) { return []; }
    async getDepositsToCheck(interval) { return []; }
    async getTicketsForSLAMonitoring(interval) { return []; }
    async getExpiringLeases() { return []; }
    async getTicketsForFollowup() { return []; }
    async getExpiringDisputes() { return []; }
    
    async sendRentReminder(lease) { /* Implementation needed */ }
    async sendOverdueNotice(lease) { /* Implementation needed */ }
    async verifyDeposit(deposit) { /* Implementation needed */ }
    async checkTicketSLA(ticket) { /* Implementation needed */ }
    async processLeaseExpiry(lease) { /* Implementation needed */ }
    async sendMaintenanceFollowup(ticket) { /* Implementation needed */ }
    async processDisputeExpiry(dispute) { /* Implementation needed */ }
    
    async performHealthCheck() { return { status: 'healthy', issues: [] }; }
    async performDataBackup() { return { size: 0, location: 'local' }; }
    async collectMetrics() { return {}; }
}

// Create singleton instance
const scheduler = new SchedulerService();

module.exports = { scheduler };