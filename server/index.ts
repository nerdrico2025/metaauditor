
/**
 * 🎯 PONTO DE ENTRADA DA APLICAÇÃO
 * 
 * Este arquivo é apenas responsável por inicializar o servidor.
 * Toda a lógica da aplicação está em /src
 */
import { startServer } from './src/main';

startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
