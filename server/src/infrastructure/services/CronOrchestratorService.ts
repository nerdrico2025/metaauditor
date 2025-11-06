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
   */
  public setupCronJobs(): void {
    // Exemplo: Agendar sincronização de planilhas a cada hora (sem iniciar)
    const sheetsSyncJob = cron.schedule('0 * * * *', async () => {
      console.log('Iniciando sincronização de planilhas...');
      try {
        await this.sheetsSyncService.sync();
        console.log('Sincronização de planilhas concluída com sucesso.');
      } catch (error) {
        console.error('Erro ao sincronizar planilhas:', error);
      }
    }, {
      scheduled: false
    });
    this.cronJobs.push(sheetsSyncJob);
    console.log('Job de sincronização de planilhas configurado.');
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