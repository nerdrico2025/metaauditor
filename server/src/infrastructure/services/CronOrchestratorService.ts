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
   * Inicializa e agenda os jobs do cron.
   */
  public async initializeJobs(): Promise<void> {
    // Exemplo: Agendar sincronização de planilhas a cada hora
    const sheetsSyncJob = cron.schedule('0 * * * *', async () => {
      console.log('Iniciando sincronização de planilhas...');
      try {
        await this.sheetsSyncService.sync();
        console.log('Sincronização de planilhas concluída com sucesso.');
      } catch (error) {
        console.error('Erro ao sincronizar planilhas:', error);
        // Aqui você pode querer lidar com o erro de forma mais robusta,
        // talvez emitindo um evento ou registrando em um sistema de monitoramento.
      }
    });
    this.cronJobs.push(sheetsSyncJob);
    console.log('Job de sincronização de planilhas agendado.');

    // Adicione outros jobs aqui conforme necessário
    // const anotherJob = cron.schedule('*/5 * * * *', async () => {
    //   console.log('Executando outro job a cada 5 minutos...');
    // });
    // this.cronJobs.push(anotherJob);
    // console.log('Outro job agendado.');
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