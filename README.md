
# Click Auditor - Estrutura do Projeto

## 📁 Estrutura de Pastas

```
/
├── apps/
│   ├── client/              # 🎨 Frontend React + Vite
│   │   ├── src/
│   │   │   ├── components/  # Componentes reutilizáveis
│   │   │   ├── pages/       # Páginas da aplicação
│   │   │   ├── contexts/    # React Contexts
│   │   │   ├── hooks/       # Custom hooks
│   │   │   ├── lib/         # Utilitários frontend
│   │   │   └── locales/     # Traduções i18n
│   │   └── index.html
│   │
│   └── server/              # ⚙️ Backend Express + TypeScript
│       ├── src/
│       │   ├── routes/      # Rotas da API
│       │   ├── middleware/  # Middlewares Express
│       │   └── index.ts     # Entry point do servidor
│       └── ...
│
├── packages/                # 📦 Código compartilhado
│   ├── database/           # Schema Drizzle, migrations, DB utils
│   ├── services/           # Serviços (AI, Cron, Integrations)
│   └── shared/             # Types, validações, utils compartilhados
│
├── scripts/                # 🔧 Scripts utilitários
│   ├── resetUserPassword.ts
│   └── createSuperAdmin.ts
│
└── migrations/             # 🗄️ Migrations do banco de dados
```

## 🎯 Princípios da Arquitetura

- **Separação clara**: Frontend (`apps/client`) e Backend (`apps/server`) separados
- **Código compartilhado**: `packages/` para código usado por ambos
- **Monorepo**: Facilita compartilhamento de types e validações
- **Escalável**: Fácil adicionar novos apps ou packages

## 🚀 Como usar

### Desenvolvimento
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Produção
```bash
npm run start
```
