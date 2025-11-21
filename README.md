# Click Auditor - SaaS de Auditoria de Campanhas com IA

Uma plataforma completa para automatizar a auditoria de criativos em Meta Ads e Google Ads usando inteligência artificial avançada.

## 🏗️ Arquitetura

```
/
├── server/               # Backend Express.js + PostgreSQL (porta 5000)
├── client/               # React Vite SaaS App (porta 5173)
├── landing/              # Next.js Landing Page (porta 3000)
└── start-all.sh         # Script para iniciar tudo em paralelo
```

## 🚀 Como Iniciar

### Opção 1: Iniciar tudo de uma vez (Recomendado para desenvolvimento)
```bash
./start-all.sh
```

Isso vai iniciar os 3 projetos em paralelo:
- **Backend**: http://localhost:5000
- **Frontend**: http://localhost:5173
- **Landing**: http://localhost:3000

### Opção 2: Iniciar manualmente em terminais separados

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

**Terminal 3 - Landing:**
```bash
cd landing
npm run dev
```

## 📚 Estrutura de Pastas

### `/server`
- Express.js backend com autenticação
- PostgreSQL com Drizzle ORM
- APIs REST para integração com Meta e Google Ads
- WebSocket para atualizações em tempo real

### `/client`
- React 18 + Vite
- Dashboard com métricas de campanhas
- Gerenciamento de criativos e grupos
- Relatórios e análises
- Integração com Meta e Google Ads

### `/landing`
- Next.js 14 para performance e SEO
- Homepage com apresentação do produto
- Planos e pricing
- Call-to-action para login
- Deploy independente da app principal

## 🔗 Fluxo de Integração

1. **Landing Page** (porta 3000) - Apresentação pública
2. Clique em "Começar" ou "Acessar"
3. **Redireciona** para login da app
4. **SaaS App** (porta 5173) - Autenticação
5. **Backend** (porta 5000) - Processamento de dados

## 📦 Variáveis de Ambiente

### Backend (`.env`)
```
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
META_APP_ID=...
GOOGLE_API_KEY=...
```

### Landing (`.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## 🔄 Workflows Disponíveis

Você pode criar workflows personalizados na interface da Replit:

1. **Backend** - `npm run dev` (porta 5000)
2. **Frontend** - `cd client && npm run dev` (porta 5173)
3. **Landing** - `cd landing && npm run dev` (porta 3000)

Cada workflow pode rodar independentemente para facilitar o debug.

## 🛠️ Desenvolvimento

### Instalação de dependências
```bash
# Backend
npm install

# Frontend
cd client && npm install && cd ..

# Landing
cd landing && npm install && cd ..
```

### Build para produção
```bash
# Backend
npm run build

# Frontend
cd client && npm run build && cd ..

# Landing
cd landing && npm run build && cd ..
```

## 🚀 Deploy

### Landing Page (independente)
```bash
cd landing
npm run build
npm start
```

### SaaS App + Backend
```bash
# Build frontend
cd client
npm run build
cd ..

# Backend pode rodar em produção
npm run start
```

## 🔐 Autenticação

- **Replit Auth** para login de usuários
- **Sessions** baseado em PostgreSQL
- **JWT** para APIs

## 📊 Tecnologias

### Frontend
- React 18, Vite, TypeScript
- Tailwind CSS, Radix UI, shadcn/ui
- React Hook Form, TanStack Query
- Wouter para routing

### Backend
- Node.js, Express.js, TypeScript
- PostgreSQL, Drizzle ORM
- OpenAI GPT-4o para análise
- Meta Ads API, Google Ads API

### Landing
- Next.js 14, TypeScript
- Tailwind CSS
- Otimizado para SEO e performance

## 📝 Licença

Proprietary - Click Auditor © 2024
