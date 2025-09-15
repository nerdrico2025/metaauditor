import * as cron from 'node-cron';
import { syncSingleTabWithLogging as runSheetSync, getSyncStatus } from './sheetsSingleTabSync';

interface CronJobConfig {
  name: string;
  schedule: string;
  enabled: boolean;
  description: string;
  lastRun?: Date;
  nextRun?: Date;
  status: 'idle' | 'running' | 'error';
}

class CronManager {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private jobConfigs: Map<string, CronJobConfig> = new Map();
  private isProduction = process.env.NODE_ENV === 'production';

  constructor() {
    this.initializeJobs();
  }

  private initializeJobs() {
    console.log(`🕐 Initializing cron jobs (${this.isProduction ? 'production' : 'development'} mode)`);

    // Daily sync at 8:00 AM (UTC-3) - Always enabled
    this.scheduleJob('daily_sync', {
      name: 'Daily Google Sheets Sync',
      schedule: '0 8 * * *', // 8:00 AM every day (UTC-3)
      enabled: true, // Always enabled regardless of environment
      description: 'Daily synchronization of campaign metrics from Google Sheets at 8:00 AM UTC-3',
      status: 'idle'
    }, this.runDailySync.bind(this));

    // Health check every 5 minutes
    this.scheduleJob('health_check', {
      name: 'Health Check',
      schedule: '*/5 * * * *', // Every 5 minutes
      enabled: true,
      description: 'Monitor sync status and system health',
      status: 'idle'
    }, this.runHealthCheck.bind(this));

    console.log(`✅ Cron jobs initialized successfully`);
  }

  private scheduleJob(jobId: string, config: CronJobConfig, handler: () => Promise<void>) {
    if (!config.enabled) {
      console.log(`⏸️ Job '${config.name}' is disabled`);
      this.jobConfigs.set(jobId, config);
      return;
    }

    const task = cron.schedule(config.schedule, async () => {
      await this.executeJob(jobId, config, handler);
    }, {
      timezone: 'America/Sao_Paulo' // Brazilian timezone
    });

    this.jobs.set(jobId, task);
    this.jobConfigs.set(jobId, config);

    // Calculate next run time
    config.nextRun = this.getNextRunTime(config.schedule);

    console.log(`📅 Scheduled '${config.name}' - Next run: ${config.nextRun?.toLocaleString('pt-BR')}`);
  }

  private async executeJob(jobId: string, config: CronJobConfig, handler: () => Promise<void>) {
    const startTime = new Date();
    config.status = 'running';
    config.lastRun = startTime;

    console.log(`🚀 Starting job '${config.name}' at ${startTime.toLocaleString('pt-BR')}`);

    try {
      await handler();
      config.status = 'idle';
      config.nextRun = this.getNextRunTime(config.schedule);
      
      const duration = Date.now() - startTime.getTime();
      console.log(`✅ Job '${config.name}' completed in ${duration}ms`);
      
    } catch (error) {
      config.status = 'error';
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`❌ Job '${config.name}' failed: ${errorMsg}`);
    }

    this.jobConfigs.set(jobId, config);
  }

  private getNextRunTime(schedule: string): Date {
    try {
      // This is a simplified calculation - for production you might want a more robust solution
      const now = new Date();
      const parts = schedule.split(' ');
      
      if (schedule === '0 8 * * *') {
        // Daily at 8 AM
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(8, 0, 0, 0);
        return tomorrow;
      }
      
      if (schedule === '*/30 * * * *') {
        // Every 30 minutes
        const next = new Date(now);
        next.setMinutes(Math.ceil(next.getMinutes() / 30) * 30, 0, 0);
        return next;
      }
      
      if (schedule === '*/5 * * * *') {
        // Every 5 minutes
        const next = new Date(now);
        next.setMinutes(Math.ceil(next.getMinutes() / 5) * 5, 0, 0);
        return next;
      }
      
      // Default: add 1 hour
      const next = new Date(now);
      next.setHours(next.getHours() + 1);
      return next;
      
    } catch (error) {
      const fallback = new Date();
      fallback.setHours(fallback.getHours() + 1);
      return fallback;
    }
  }

  // Job handlers
  private async runDailySync(): Promise<void> {
    console.log(`📊 Executing daily Google Sheets sync...`);
    
    try {
      const result = await runSheetSync();
      
      if (result.success) {
        console.log(`🎉 Daily sync completed successfully!`);
        console.log(`   Records processed: ${result.totalProcessed}`);
        console.log(`   Records inserted: ${result.totalInserted}`);
        console.log(`   Completion: ${result.completionPercentage}%`);
      } else {
        console.log(`⚠️ Daily sync completed with errors:`);
        result.errors.forEach((error: string) => console.log(`   - ${error}`));
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`💥 Daily sync failed: ${errorMsg}`);
      throw error; // Re-throw to mark job as failed
    }
  }

  private async runDevSync(): Promise<void> {
    console.log(`🔧 Executing development sync...`);
    
    try {
      const result = await runSheetSync();
      
      console.log(`📊 Dev sync result:`);
      console.log(`   Success: ${result.success}`);
      console.log(`   Records: ${result.totalInserted}/${result.totalDownloaded}`);
      console.log(`   Completion: ${result.completionPercentage}%`);
      
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.length}`);
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`💥 Dev sync failed: ${errorMsg}`);
      throw error;
    }
  }

  private async runHealthCheck(): Promise<void> {
    try {
      const status = await getSyncStatus();
      
      console.log(`❤️ Health check - Records: ${status.recordCount}, Last batch: ${status.lastSyncBatch || 'none'}`);
      
      // Check if sync is overdue (more than 25 hours since last sync in production)
      if (this.isProduction && status.latestRecord && status.latestRecord instanceof Date) {
        const hoursSinceLastSync = (Date.now() - status.latestRecord.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastSync > 25) {
          console.log(`⚠️ WARNING: Sync may be overdue (${Math.round(hoursSinceLastSync)} hours since last sync)`);
        }
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`💔 Health check failed: ${errorMsg}`);
      // Don't throw error for health checks - they should be non-critical
    }
  }

  // Public methods for job management
  public startAll(): void {
    console.log(`▶️ Starting all enabled cron jobs...`);
    
    Array.from(this.jobs.entries()).forEach(([jobId, task]) => {
      const config = this.jobConfigs.get(jobId);
      if (config?.enabled) {
        task.start();
        console.log(`   ✅ Started '${config.name}'`);
      }
    });
    
    console.log(`🚀 All enabled cron jobs are now running`);
  }

  public stopAll(): void {
    console.log(`⏹️ Stopping all cron jobs...`);
    
    Array.from(this.jobs.entries()).forEach(([jobId, task]) => {
      const config = this.jobConfigs.get(jobId);
      task.stop();
      if (config) {
        config.status = 'idle';
        this.jobConfigs.set(jobId, config);
      }
      console.log(`   ⏹️ Stopped '${config?.name || jobId}'`);
    });
    
    console.log(`⏸️ All cron jobs stopped`);
  }

  public getJobStatus(): CronJobConfig[] {
    return Array.from(this.jobConfigs.values());
  }

  public async runJobNow(jobId: string): Promise<{ success: boolean; message: string }> {
    const config = this.jobConfigs.get(jobId);
    
    if (!config) {
      return { success: false, message: `Job '${jobId}' not found` };
    }
    
    if (config.status === 'running') {
      return { success: false, message: `Job '${config.name}' is already running` };
    }
    
    try {
      console.log(`🎯 Manual execution of job '${config.name}'`);
      
      if (jobId === 'daily_sync' || jobId === 'dev_sync') {
        await this.runDailySync();
      } else if (jobId === 'health_check') {
        await this.runHealthCheck();
      } else {
        throw new Error(`Unknown job handler for '${jobId}'`);
      }
      
      return { success: true, message: `Job '${config.name}' executed successfully` };
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: `Job failed: ${errorMsg}` };
    }
  }

  public enableJob(jobId: string): boolean {
    const config = this.jobConfigs.get(jobId);
    
    if (!config) {
      return false;
    }
    
    config.enabled = true;
    this.jobConfigs.set(jobId, config);
    
    const task = this.jobs.get(jobId);
    if (task) {
      task.start();
      console.log(`✅ Enabled and started job '${config.name}'`);
    }
    
    return true;
  }

  public disableJob(jobId: string): boolean {
    const config = this.jobConfigs.get(jobId);
    
    if (!config) {
      return false;
    }
    
    config.enabled = false;
    config.status = 'idle';
    this.jobConfigs.set(jobId, config);
    
    const task = this.jobs.get(jobId);
    if (task) {
      task.stop();
      console.log(`⏸️ Disabled and stopped job '${config.name}'`);
    }
    
    return true;
  }
}

// Create global instance
export const cronManager = new CronManager();

// Export functions for external use
export const triggerManualSync = async () => {
  console.log(`🔄 Manual sync trigger from cron manager`);
  return await runSheetSync();
};