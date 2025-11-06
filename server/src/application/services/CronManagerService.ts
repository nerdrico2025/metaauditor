
import * as cron from 'node-cron';
import { SheetsSyncService } from './SheetsSyncService';

interface CronJobConfig {
  name: string;
  schedule: string;
  enabled: boolean;
  description: string;
  lastRun?: Date;
  nextRun?: Date;
  status: 'idle' | 'running' | 'error';
}

export class CronManagerService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private jobConfigs: Map<string, CronJobConfig> = new Map();
  private isProduction = process.env.NODE_ENV === 'production';
  private sheetsSyncService: SheetsSyncService;

  constructor() {
    this.sheetsSyncService = new SheetsSyncService();
    this.initializeJobs();
  }

  private initializeJobs() {
    console.log(`🕐 Initializing cron jobs (${this.isProduction ? 'production' : 'development'} mode)`);

    this.scheduleJob('daily_sync', {
      name: 'Daily Google Sheets Sync',
      schedule: '0 8 * * *',
      enabled: true,
      description: 'Daily synchronization of campaign metrics from Google Sheets at 8:00 AM UTC-3',
      status: 'idle'
    }, this.runDailySync.bind(this));

    this.scheduleJob('health_check', {
      name: 'Health Check',
      schedule: '*/5 * * * *',
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
      timezone: 'America/Sao_Paulo'
    });

    this.jobs.set(jobId, task);
    this.jobConfigs.set(jobId, config);
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
    const now = new Date();
    
    if (schedule === '0 8 * * *') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(8, 0, 0, 0);
      return tomorrow;
    }
    
    if (schedule === '*/5 * * * *') {
      const next = new Date(now);
      next.setMinutes(Math.ceil(next.getMinutes() / 5) * 5, 0, 0);
      return next;
    }
    
    const next = new Date(now);
    next.setHours(next.getHours() + 1);
    return next;
  }

  private async runDailySync(): Promise<void> {
    console.log(`📊 Executing daily Google Sheets sync...`);
    
    try {
      const result = await this.sheetsSyncService.syncSingleTab();
      
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
      throw error;
    }
  }

  private async runHealthCheck(): Promise<void> {
    try {
      const status = await this.sheetsSyncService.getSyncStatus();
      
      console.log(`❤️ Health check - Records: ${status.recordCount}, Last batch: ${status.lastSyncBatch || 'none'}`);
      
      if (this.isProduction && status.latestRecord && status.latestRecord instanceof Date) {
        const hoursSinceLastSync = (Date.now() - status.latestRecord.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastSync > 25) {
          console.log(`⚠️ WARNING: Sync may be overdue (${Math.round(hoursSinceLastSync)} hours since last sync)`);
        }
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`💔 Health check failed: ${errorMsg}`);
    }
  }

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
      
      if (jobId === 'daily_sync') {
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

  public async triggerManualSync() {
    console.log(`🔄 Manual sync trigger from cron manager`);
    return await this.sheetsSyncService.syncSingleTab();
  }
}

export const cronManagerService = new CronManagerService();
