import { register } from 'tsconfig-paths';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Register tsconfig paths
register({
  baseUrl: resolve(__dirname),
  paths: {
    '@domain/*': ['./domain/*'],
    '@application/*': ['./application/*'],
    '@infrastructure/*': ['./infrastructure/*'],
    '@presentation/*': ['./presentation/*'],
    '@shared/*': ['./shared/*'],
    '@shared/utils': ['./shared/utils'],
    '@drizzle/*': ['../drizzle/*']
  }
});

// Now import and start the server
import('./main.ts').then(({ startServer }) => {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
});
