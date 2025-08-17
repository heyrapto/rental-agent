/**
 * Autonomous scheduler service for AO agent
 * Handles all scheduled tasks and autonomous operations
 */

const cron = require('node-cron');
const { logger, logSchedulerAction } = require('../utils/logger');
const { config } = require('../config');

class SchedulerService {
    constructor() {
        this.jobs = new Map();
        this.isRunning = false;
        this.retryAttempts = config.SCHEDULER_RETRY_ATTEMPTS;
        this.retryDelay = config.SCHEDULER_RETRY_DELAY;
        this.maxRetries = config.SCHEDULER_MAX_RETRIES;
    }

    /**
     * Start the scheduler
     */
    async start() {
        try {
            if (this.isRunning) {
                logger.warn('Scheduler is already running');
                return;
            }

            logger.info('Starting autonomous scheduler...');

            // Initialize all scheduled jobs
            await this.initializeJobs();

            this.isRunning = true;
            logger.info('Autonomous scheduler started successfully');

        } catch (error) {
            logger.error('Failed to start scheduler:', error);
            throw error;
        }
    }

    /**
     * Stop the scheduler
     */
    async stop() {
        try {
            if (!this.isRunning) {
                logger.warn('Scheduler is not running');
                return;
            }

            logger.info('Stopping autonomous scheduler...');

            // Stop all running jobs
            for (const [jobName, job] of this.jobs.entries()) {
                if (job.task) {
                    job.task.stop();
                    logger.info(`Stopped job: ${jobName}`);
                }
            }

            this.jobs.clear();
            this.isRunning = false;
            logger.info('Autonomous scheduler stopped successfully');

        } catch (error) {
            logger.error('Failed to stop scheduler:', error);
            throw error;
        }
    }

    /**
     * Initialize all scheduled jobs
     */
    async initializeJobs() {
        try {
            // Rent reminders - daily at 9 AM
            this.scheduleJob('rent-reminders', '0 9 * * *', () => this.executeRentReminders());

            // Overdue notices - daily at 10 AM
            this.scheduleJob('overdue-notices', '0 10 * * *', () => this.executeOverdueNotices());

            // Deposit checks - weekly on Monday at 9 AM
            this.scheduleJob('deposit-checks', '0 9 * * 1', () => this.executeDepositChecks());

            // SLA monitoring - every 4 hours
            this.scheduleJob('sla-monitoring', '0 */4 * * *', () => this.executeSLAMonitoring());

            // Lease expiry reminders - daily at 8 AM
            this.scheduleJob('lease-expiry', '0 8 * * *', () => this.executeLeaseExpiryReminders());

            // Maintenance follow-ups - daily at 2 PM
            this.scheduleJob('maintenance-followups', '0 14 * * *', () => this.executeMaintenanceFollowUps());

            // Dispute expiry checks - daily at 11 AM
            this.scheduleJob('dispute-expiry', '0 11 * * *', () => this.executeDisputeExpiryChecks());

            // Health checks - every 30 minutes
            this.scheduleJob('health-checks', '*/30 * * * *', () => this.executeHealthChecks());

            // Data backup - daily at 2 AM
            this.scheduleJob('data-backup', '0 2 * * *', () => this.executeDataBackup());

            // Metrics collection - every hour
            this.scheduleJob('metrics-collection', '0 * * * *', () => this.executeMetricsCollection());

            // System cleanup - daily at 3 AM
            this.scheduleJob('system-cleanup', '0 3 * * *', () => this.executeSystemCleanup());

            logger.info(`Initialized ${this.jobs.size} scheduled jobs`);

        } catch (error) {
            logger.error('Failed to initialize scheduled jobs:', error);
            throw error;
        }
    }

    /**
     * Schedule a job
     */
    scheduleJob(jobName, cronExpression, taskFunction) {
        try {
            if (!cron.validate(cronExpression)) {
                throw new Error(`Invalid cron expression: ${cronExpression}`);
            }

            const job = {
                name: jobName,
                cronExpression,
                task: cron.schedule(cronExpression, async () => {
                    await this.executeWithRetry(jobName, taskFunction);
                }, {
                    scheduled: true,
                    timezone: config.SCHEDULER_TIMEZONE || 'UTC'
                }),
                lastRun: null,
                nextRun: null,
                runCount: 0,
                errorCount: 0,
                lastError: null
            };

            // Calculate next run time
            job.nextRun = this.calculateNextRun(cronExpression);

            this.jobs.set(jobName, job);
            logger.info(`Scheduled job: ${jobName} (${cronExpression})`);

        } catch (error) {
            logger.error(`Failed to schedule job ${jobName}:`, error);
            throw error;
        }
    }

    /**
     * Execute task with retry logic
     */
    async executeWithRetry(jobName, taskFunction) {
        const job = this.jobs.get(jobName);
        if (!job) return;

        let attempts = 0;
        let lastError = null;

        while (attempts < this.maxRetries) {
            try {
                attempts++;
                job.lastRun = new Date();
                job.runCount++;

                logger.info(`Executing job: ${jobName} (attempt ${attempts})`);

                // Execute the task
                await taskFunction();

                // Reset error tracking on success
                job.errorCount = 0;
                job.lastError = null;

                logSchedulerAction('executed', jobName, { attempts, runCount: job.runCount });
                logger.info(`Job completed successfully: ${jobName}`);

                // Calculate next run time
                job.nextRun = this.calculateNextRun(job.cronExpression);

                return;

            } catch (error) {
                lastError = error;
                job.errorCount++;
                job.lastError = error.message;

                logger.error(`Job execution failed: ${jobName} (attempt ${attempts}):`, error);

                if (attempts < this.maxRetries) {
                    // Wait before retry with exponential backoff
                    const delay = this.retryDelay * Math.pow(2, attempts - 1);
                    logger.info(`Retrying job ${jobName} in ${delay}ms...`);
                    await this.sleep(delay);
                }
            }
        }

        // All retries exhausted
        logSchedulerAction('failed', jobName, { 
            attempts, 
            errorCount: job.errorCount, 
            lastError: lastError.message 
        });

        logger.error(`Job failed after ${attempts} attempts: ${jobName}`, lastError);
    }

    /**
     * Execute rent reminders
     */
    async executeRentReminders() {
        try {
            logger.info('Executing rent reminders...');

            // Get leases with rent due in the next 7 days
            const { leaseService } = require('./leaseService');
            const dueLeases = await leaseService.getLeasesWithRentDue(7);

            for (const lease of dueLeases) {
                try {
                    // Send rent reminder notification
                    await this.sendRentReminder(lease);
                    logger.info(`Sent rent reminder for lease: ${lease.leaseId}`);
                } catch (error) {
                    logger.error(`Failed to send rent reminder for lease ${lease.leaseId}:`, error);
                }
            }

            logger.info(`Processed ${dueLeases.length} rent reminders`);

        } catch (error) {
            logger.error('Failed to execute rent reminders:', error);
            throw error;
        }
    }

    /**
     * Execute overdue notices
     */
    async executeOverdueNotices() {
        try {
            logger.info('Executing overdue notices...');

            // Get overdue leases
            const { leaseService } = require('./leaseService');
            const overdueLeases = await leaseService.getOverdueLeases(1);

            for (const lease of overdueLeases) {
                try {
                    // Send overdue notice
                    await this.sendOverdueNotice(lease);
                    logger.info(`Sent overdue notice for lease: ${lease.leaseId}`);
                } catch (error) {
                    logger.error(`Failed to send overdue notice for lease ${lease.leaseId}:`, error);
                }
            }

            logger.info(`Processed ${overdueLeases.length} overdue notices`);

        } catch (error) {
            logger.error('Failed to execute overdue notices:', error);
            throw error;
        }
    }

    /**
     * Execute deposit checks
     */
    async executeDepositChecks() {
        try {
            logger.info('Executing deposit checks...');

            // Get active leases
            const { leaseService } = require('./leaseService');
            const activeLeases = await leaseService.getLeasesByStatus('active');

            for (const lease of activeLeases) {
                try {
                    // Check deposit status
                    await this.checkDepositStatus(lease);
                    logger.info(`Checked deposit status for lease: ${lease.leaseId}`);
                } catch (error) {
                    logger.error(`Failed to check deposit status for lease ${lease.leaseId}:`, error);
                }
            }

            logger.info(`Processed ${activeLeases.length} deposit checks`);

        } catch (error) {
            logger.error('Failed to execute deposit checks:', error);
            throw error;
        }
    }

    /**
     * Execute SLA monitoring
     */
    async executeSLAMonitoring() {
        try {
            logger.info('Executing SLA monitoring...');

            // Get maintenance tickets
            const { maintenanceService } = require('./maintenanceService');
            const openTickets = await maintenanceService.getTicketsByStatus('open');
            const assignedTickets = await maintenanceService.getTicketsByStatus('assigned');

            // Check SLA compliance
            const slaViolations = await this.checkSLACompliance([...openTickets, ...assignedTickets]);

            if (slaViolations.length > 0) {
                logger.warn(`Found ${slaViolations.length} SLA violations`);
                await this.handleSLAViolations(slaViolations);
            }

            logger.info('SLA monitoring completed');

        } catch (error) {
            logger.error('Failed to execute SLA monitoring:', error);
            throw error;
        }
    }

    /**
     * Execute lease expiry reminders
     */
    async executeLeaseExpiryReminders() {
        try {
            logger.info('Executing lease expiry reminders...');

            // Get expiring leases
            const { leaseService } = require('./leaseService');
            const expiringLeases = await leaseService.getExpiringLeases();

            for (const lease of expiringLeases) {
                try {
                    // Send expiry reminder
                    await this.sendLeaseExpiryReminder(lease);
                    logger.info(`Sent expiry reminder for lease: ${lease.leaseId}`);
                } catch (error) {
                    logger.error(`Failed to send expiry reminder for lease ${lease.leaseId}:`, error);
                }
            }

            logger.info(`Processed ${expiringLeases.length} lease expiry reminders`);

        } catch (error) {
            logger.error('Failed to execute lease expiry reminders:', error);
            throw error;
        }
    }

    /**
     * Execute maintenance follow-ups
     */
    async executeMaintenanceFollowUps() {
        try {
            logger.info('Executing maintenance follow-ups...');

            // Get tickets that need follow-up
            const { maintenanceService } = require('./maintenanceService');
            const ticketsNeedingFollowUp = await this.getTicketsNeedingFollowUp();

            for (const ticket of ticketsNeedingFollowUp) {
                try {
                    // Send follow-up notification
                    await this.sendMaintenanceFollowUp(ticket);
                    logger.info(`Sent follow-up for ticket: ${ticket.id}`);
                } catch (error) {
                    logger.error(`Failed to send follow-up for ticket ${ticket.id}:`, error);
                }
            }

            logger.info(`Processed ${ticketsNeedingFollowUp.length} maintenance follow-ups`);

        } catch (error) {
            logger.error('Failed to execute maintenance follow-ups:', error);
            throw error;
        }
    }

    /**
     * Execute dispute expiry checks
     */
    async executeDisputeExpiryChecks() {
        try {
            logger.info('Executing dispute expiry checks...');

            // Get expiring disputes
            const { disputeService } = require('./disputeService');
            const expiringDisputes = await disputeService.cleanupExpiredDisputes();

            if (expiringDisputes > 0) {
                logger.info(`Cleaned up ${expiringDisputes} expired disputes`);
            }

            logger.info('Dispute expiry checks completed');

        } catch (error) {
            logger.error('Failed to execute dispute expiry checks:', error);
            throw error;
        }
    }

    /**
     * Execute health checks
     */
    async executeHealthChecks() {
        try {
            logger.debug('Executing health checks...');

            // Check system health
            const healthStatus = await this.checkSystemHealth();

            if (!healthStatus.healthy) {
                logger.warn('System health check failed:', healthStatus.issues);
                await this.handleHealthIssues(healthStatus.issues);
            }

            logger.debug('Health checks completed');

        } catch (error) {
            logger.error('Failed to execute health checks:', error);
            throw error;
        }
    }

    /**
     * Execute data backup
     */
    async executeDataBackup() {
        try {
            logger.info('Executing data backup...');

            // Perform data backup
            const backupResult = await this.performDataBackup();

            if (backupResult.success) {
                logger.info(`Data backup completed: ${backupResult.backupId}`);
            } else {
                logger.error('Data backup failed:', backupResult.error);
            }

        } catch (error) {
            logger.error('Failed to execute data backup:', error);
            throw error;
        }
    }

    /**
     * Execute metrics collection
     */
    async executeMetricsCollection() {
        try {
            logger.debug('Executing metrics collection...');

            // Collect system metrics
            const metrics = await this.collectSystemMetrics();

            // Store metrics
            await this.storeMetrics(metrics);

            logger.debug('Metrics collection completed');

        } catch (error) {
            logger.error('Failed to execute metrics collection:', error);
            throw error;
        }
    }

    /**
     * Execute system cleanup
     */
    async executeSystemCleanup() {
        try {
            logger.info('Executing system cleanup...');

            // Clean up old logs
            await this.cleanupOldLogs();

            // Clean up temporary files
            await this.cleanupTempFiles();

            // Clean up expired sessions
            await this.cleanupExpiredSessions();

            logger.info('System cleanup completed');

        } catch (error) {
            logger.error('Failed to execute system cleanup:', error);
            throw error;
        }
    }

    /**
     * Get job status
     */
    getJobStatus(jobName) {
        const job = this.jobs.get(jobName);
        if (!job) {
            return null;
        }

        return {
            name: job.name,
            cronExpression: job.cronExpression,
            isRunning: job.task.running,
            lastRun: job.lastRun,
            nextRun: job.nextRun,
            runCount: job.runCount,
            errorCount: job.errorCount,
            lastError: job.lastError
        };
    }

    /**
     * Get all jobs status
     */
    getAllJobsStatus() {
        const status = {};
        for (const [jobName, job] of this.jobs.entries()) {
            status[jobName] = this.getJobStatus(jobName);
        }
        return status;
    }

    /**
     * Manually trigger a job
     */
    async triggerJob(jobName) {
        try {
            const job = this.jobs.get(jobName);
            if (!job) {
                throw new Error(`Job not found: ${jobName}`);
            }

            logger.info(`Manually triggering job: ${jobName}`);

            // Execute the job immediately
            await this.executeWithRetry(jobName, () => this.getJobFunction(jobName)());

            return { success: true, message: `Job ${jobName} executed successfully` };

        } catch (error) {
            logger.error(`Failed to trigger job ${jobName}:`, error);
            throw error;
        }
    }

    /**
     * Get job function by name
     */
    getJobFunction(jobName) {
        const jobFunctions = {
            'rent-reminders': () => this.executeRentReminders(),
            'overdue-notices': () => this.executeOverdueNotices(),
            'deposit-checks': () => this.executeDepositChecks(),
            'sla-monitoring': () => this.executeSLAMonitoring(),
            'lease-expiry': () => this.executeLeaseExpiryReminders(),
            'maintenance-followups': () => this.executeMaintenanceFollowUps(),
            'dispute-expiry': () => this.executeDisputeExpiryChecks(),
            'health-checks': () => this.executeHealthChecks(),
            'data-backup': () => this.executeDataBackup(),
            'metrics-collection': () => this.executeMetricsCollection(),
            'system-cleanup': () => this.executeSystemCleanup()
        };

        return jobFunctions[jobName] || (() => Promise.resolve());
    }

    /**
     * Calculate next run time for a cron expression
     */
    calculateNextRun(cronExpression) {
        try {
            const parser = require('cron-parser');
            const interval = parser.parseExpression(cronExpression);
            return interval.next().toDate();
        } catch (error) {
            logger.error('Failed to calculate next run time:', error);
            return null;
        }
    }

    /**
     * Sleep utility function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Placeholder methods for actual implementations
     * These would be implemented based on your specific business logic
     */
    async sendRentReminder(lease) {
        // TODO: Implement rent reminder notification
        logger.info(`Would send rent reminder for lease: ${lease.leaseId}`);
    }

    async sendOverdueNotice(lease) {
        // TODO: Implement overdue notice notification
        logger.info(`Would send overdue notice for lease: ${lease.leaseId}`);
    }

    async checkDepositStatus(lease) {
        // TODO: Implement deposit status check
        logger.info(`Would check deposit status for lease: ${lease.leaseId}`);
    }

    async checkSLACompliance(tickets) {
        // TODO: Implement SLA compliance check
        return [];
    }

    async handleSLAViolations(violations) {
        // TODO: Implement SLA violation handling
        logger.info(`Would handle ${violations.length} SLA violations`);
    }

    async sendLeaseExpiryReminder(lease) {
        // TODO: Implement lease expiry reminder
        logger.info(`Would send expiry reminder for lease: ${lease.leaseId}`);
    }

    async getTicketsNeedingFollowUp() {
        // TODO: Implement follow-up logic
        return [];
    }

    async sendMaintenanceFollowUp(ticket) {
        // TODO: Implement maintenance follow-up
        logger.info(`Would send follow-up for ticket: ${ticket.id}`);
    }

    async checkSystemHealth() {
        // TODO: Implement system health check
        return { healthy: true, issues: [] };
    }

    async handleHealthIssues(issues) {
        // TODO: Implement health issue handling
        logger.info(`Would handle ${issues.length} health issues`);
    }

    async performDataBackup() {
        // TODO: Implement data backup
        return { success: true, backupId: 'mock_backup_' + Date.now() };
    }

    async collectSystemMetrics() {
        // TODO: Implement metrics collection
        return { timestamp: Date.now(), metrics: {} };
    }

    async storeMetrics(metrics) {
        // TODO: Implement metrics storage
        logger.debug('Would store metrics:', metrics);
    }

    async cleanupOldLogs() {
        // TODO: Implement log cleanup
        logger.info('Would cleanup old logs');
    }

    async cleanupTempFiles() {
        // TODO: Implement temp file cleanup
        logger.info('Would cleanup temp files');
    }

    async cleanupExpiredSessions() {
        // TODO: Implement session cleanup
        logger.info('Would cleanup expired sessions');
    }
}

// Create singleton instance
const schedulerService = new SchedulerService();

module.exports = { schedulerService };