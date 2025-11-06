import cron from 'node-cron';
import { SheetsSyncService } from './SheetsSyncService';

/**
 * Orquestrador de tarefas agendadas (Cron Jobs)
 * Gerencia a sincronização automática e jobs periódicos
 */
export class CronOrchestratorService {
  private sheetsSyncService: SheetsSyncService;
  private cronJobs: cron.ScheduledTask[] = [];

  constructor() {
    this.sheetsSyncService = new SheetsSyncService();
  }

  /**
   * Configura os jobs do cron (sem iniciar).
   * NOTA: Sincronização do Google Sheets é manual via interface, não automática
   */
  public setupCronJobs(): void {
    // Google Sheets sync é manual - usuário configura via interface
    // Não há jobs automáticos configurados
    console.log('Cron jobs configurados (sincronização Google Sheets é manual).');
  }

  /**
   * Inicia todos os jobs configurados.
   */
  public startAll(): void {
    console.log('Iniciando todos os jobs do cron...');
    this.cronJobs.forEach(job => {
      job.start();
    });
    console.log('Todos os jobs do cron foram iniciados.');
  }

  /**
   * Para todos os jobs do cron em execução.
   */
  public stopAllJobs(): void {
    console.log('Parando todos os jobs do cron...');
    this.cronJobs.forEach(job => {
      job.stop();
    });
    this.cronJobs = [];
    console.log('Todos os jobs do cron foram parados.');
  }
}

export const cronOrchestratorService = new CronOrchestratorService();