# SocialHub

## 📱 Visão Geral

SocialHub é uma plataforma moderna e completa para gerenciamento de redes sociais, desenvolvida com **Next.js 15**, **TypeScript**, **Supabase** e **TailwindCSS**. A aplicação permite aos usuários conectar, monitorar e publicar conteúdo em suas redes sociais de forma centralizada e eficiente.

### 🎯 Funcionalidades Principais

- **🔗 Integração com Redes Sociais**: Conecte e gerencie múltiplas contas de redes sociais
- **📊 Analytics Avançados**: Monitore crescimento, engajamento e métricas em tempo real
- **📝 Publicação de Conteúdo**: Publique vídeos e posts diretamente nas plataformas
- **📈 Estatísticas Históricas**: Acompanhe o histórico de desempenho com gráficos interativos
- **🌙 Tema Dark/Light**: Interface adaptável com alternância de tema
- **🔄 Coleta Automática**: Sistema de coleta automatizada de estatísticas diárias
- **🔐 Autenticação Segura**: Login seguro com OAuth 2.0 via Supabase

### 🌐 Redes Sociais Suportadas

#### ✅ TikTok (Completo)
- Conexão via OAuth 2.0
- Coleta de estatísticas (seguidores, curtidas, vídeos)
- Publicação de vídeos com legendas
- Analytics detalhados com gráficos
- Monitoramento em tempo real

#### 🚧 Em Desenvolvimento
- **Instagram** - Planejado
- **Facebook** - Planejado
- **YouTube** - Planejado
- **Twitter/X** - Planejado

## 🚀 Tecnologias Utilizadas

### Frontend
- **Next.js 15** - Framework React com App Router
- **TypeScript** - Tipagem estática
- **TailwindCSS 4** - Estilização utilitária
- **Radix UI** - Componentes acessíveis
- **Lucide React** - Ícones modernos
- **Recharts** - Gráficos e visualizações
- **Next Themes** - Gerenciamento de temas

### Backend & Database
- **Supabase** - Backend-as-a-Service
- **PostgreSQL** - Banco de dados principal
- **Row Level Security (RLS)** - Segurança de dados
- **Supabase Auth** - Sistema de autenticação

### APIs Externas
- **TikTok Content Posting API** - Integração com TikTok
- **TikTok Display API** - Coleta de estatísticas

### DevOps & Deploy
- **Vercel** - Hospedagem e deploy
- **Vercel Cron Jobs** - Tarefas agendadas
- **ESLint** - Linting de código

## 📁 Estrutura do Projeto

```
socialhub/
├── app/                          # App Router (Next.js 15)
│   ├── (auth)/                   # Grupo de rotas de autenticação
│   │   ├── login/               # Página de login
│   │   └── signup/              # Página de cadastro
│   ├── analise/                 # Analytics e relatórios
│   │   ├── page.tsx            # Dashboard geral de analytics
│   │   └── tiktok/             # Analytics específicos do TikTok
│   ├── api/                     # API Routes
│   │   ├── analytics/          # Endpoints de analytics
│   │   ├── auth/               # Autenticação OAuth
│   │   ├── cron/               # Jobs automatizados
│   │   ├── social/             # Integrações de redes sociais
│   │   └── upload/             # Upload de arquivos
│   ├── auth/                    # Callbacks de autenticação
│   ├── integracoes/            # Configurações de integrações
│   ├── publicar/               # Interface de publicação
│   ├── redes/                  # Gerenciamento de redes sociais
│   │   └── tiktok/            # Dashboard específico do TikTok
│   └── page.tsx               # Página inicial
├── components/                  # Componentes React
│   ├── analytics/              # Componentes de gráficos
│   ├── ui/                     # Componentes base (shadcn/ui)
│   └── dashboard-layout.tsx    # Layout principal
├── hooks/                      # Custom hooks
├── lib/                        # Utilitários e configurações
│   └── supabase/              # Configuração do Supabase
├── public/                     # Arquivos estáticos
│   └── images/                # Imagens e ícones
└── styles/                     # Estilos globais
```

## ⚙️ Configuração e Instalação

### Pré-requisitos

- **Node.js** 18+ 
- **npm/yarn/pnpm** 
- **Conta Supabase**
- **Conta TikTok Developer**

### 1. Clone o Repositório

```bash
git clone https://github.com/seu-usuario/socialhub.git
cd socialhub
```

### 2. Instale as Dependências

```bash
npm install
# ou
yarn install
# ou
pnpm install
```

### 3. Configuração do Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# TikTok API Configuration
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
TIKTOK_REDIRECT_URI=https://yourdomain.com/api/auth/tiktok/callback

# Application URLs
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

### 4. Configuração do Supabase

#### Database Schema

Execute os seguintes comandos SQL no Supabase SQL Editor:

```sql
-- Tabela de conexões de redes sociais
CREATE TABLE social_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  platform TEXT NOT NULL,
  platform_user_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  profile_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform, platform_user_id)
);

-- Tabela de estatísticas diárias do TikTok
CREATE TABLE tiktok_daily_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  platform_user_id TEXT NOT NULL,
  date DATE NOT NULL,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  likes_count BIGINT DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform_user_id, date)
);

-- Políticas RLS
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_daily_stats ENABLE ROW LEVEL SECURITY;

-- Políticas para social_connections
CREATE POLICY "Users can view their own connections" ON social_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connections" ON social_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connections" ON social_connections
  FOR UPDATE USING (auth.uid() = user_id);

-- Políticas para tiktok_daily_stats
CREATE POLICY "Users can view their own stats" ON tiktok_daily_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stats" ON tiktok_daily_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### 5. Configuração do TikTok Developer

1. Acesse [TikTok for Developers](https://developers.tiktok.com/)
2. Crie uma nova aplicação
3. Configure os escopos necessários:
   - `user.info.basic`
   - `user.info.profile` 
   - `user.info.stats`
   - `video.publish`
   - `video.list`
4. Configure a URL de callback: `https://yourdomain.com/api/auth/tiktok/callback`

### 6. Execute o Projeto

```bash
npm run dev
```

Acesse `http://localhost:3000` para ver a aplicação.

## 🔧 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev          # Inicia servidor de desenvolvimento (com Turbopack)

# Build e Deploy
npm run build        # Gera build de produção
npm start           # Inicia servidor de produção
npm run lint        # Executa linting do código
```

## 📊 Funcionalidades Detalhadas

### 🔐 Sistema de Autenticação

- **Login/Cadastro** via Supabase Auth
- **OAuth 2.0** para integrações de redes sociais
- **JWT Tokens** para autenticação de APIs
- **Row Level Security** para proteção de dados

### 📱 Dashboard TikTok

**Página**: `/redes/tiktok`

- **Perfil do Usuário**: Avatar, username, bio, verificação
- **Estatísticas em Tempo Real**: Seguidores, curtidas, vídeos, seguindo
- **Comparação de Crescimento**: Indicadores visuais de mudanças
- **Gerenciamento de Token**: Visualização e cópia do access token
- **Status do Token**: Monitoramento de expiração e refresh automático

### 📈 Analytics Avançados

**Páginas**: `/analise` (geral) e `/analise/tiktok` (TikTok específico)

#### Analytics Geral (`/analise`)
- **Visão Geral**: Cards com métricas de todas as redes conectadas
- **Redes Conectadas**: Status de conexão de cada plataforma
- **Insights Rápidos**: Resumo de performance por rede social

#### Analytics TikTok (`/analise/tiktok`)
- **Métricas Overview**: Cards com comparação de períodos
- **Gráfico de Área**: Crescimento de seguidores ao longo do tempo
- **Gráfico de Linha**: Taxa de crescimento percentual
- **Gráfico de Barras**: Métricas de engajamento detalhadas
- **Seletor de Período**: 7d, 30d, 60d, 90d
- **Exportação**: Funcionalidade para export de dados

### 📝 Sistema de Publicação

**Página**: `/publicar`

- **Upload de Vídeos**: Drag & drop ou seleção manual
- **Editor de Legendas**: Interface para criar descrições
- **Preview**: Visualização antes da publicação
- **Publicação Direta**: Via TikTok Content Posting API

### 🤖 Coleta Automática de Dados

**Endpoint**: `/api/cron/collect-daily-stats`

- **Agendamento**: Execução diária via Vercel Cron Jobs
- **Coleta**: Estatísticas de todas as contas conectadas
- **Armazenamento**: Dados históricos no Supabase
- **Monitoramento**: Logs de execução e errors

## 🔗 API Endpoints

### Autenticação TikTok
```
GET  /api/auth/tiktok              # Inicia OAuth flow
GET  /api/auth/tiktok/callback     # Callback OAuth
POST /api/auth/tiktok/refresh-token # Refresh do token
GET  /api/auth/tiktok/status       # Status do token
```

### TikTok Social
```
GET  /api/social/tiktok/stats       # Estatísticas atuais
POST /api/social/tiktok/refresh     # Atualiza dados do perfil
POST /api/social/tiktok/publish     # Publica vídeo
GET  /api/social/tiktok/live-stats  # Stats em tempo real
```

### Analytics
```
GET /api/analytics/data            # Dados para gráficos
```

### Cron Jobs
```
POST /api/cron/collect-daily-stats # Coleta automática (Vercel Cron)
```

## 🎨 Componentes UI

### Gráficos Analytics
- **FollowersGrowthChart**: Gráfico de área para crescimento
- **GrowthRateChart**: Gráfico de linha para taxas
- **MultiMetricChart**: Gráfico combinado (barras + linha)
- **MetricCard**: Cards de métricas com comparação

### Componentes Base (shadcn/ui)
- **Button**, **Card**, **Input**, **Select**
- **Tabs**, **Tooltip**, **Dialog**
- **Chart Container** com configurações personalizadas

## 🔒 Segurança

### Proteção de Dados
- **Row Level Security (RLS)** no Supabase
- **JWT Authentication** para todas as APIs
- **Environment Variables** para credenciais sensíveis
- **API Rate Limiting** (TikTok APIs)

### Validações
- **TypeScript** para type safety
- **Zod Schemas** para validação de dados
- **CSRF Protection** via Next.js
- **Input Sanitization** para uploads

## 🚀 Deploy

### Vercel (Recomendado)

1. **Fork o repositório**
2. **Conecte ao Vercel**
3. **Configure as variáveis de ambiente**
4. **Configure Vercel Cron Jobs**:

```javascript
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/collect-daily-stats",
      "schedule": "0 23 * * *"
    }
  ]
}
```

### Configurações de Deploy

**Environment Variables necessárias**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI`
- `NEXT_PUBLIC_SITE_URL`

## 🧪 Desenvolvimento

### Estrutura de Hooks
```typescript
// Hooks personalizados
useSocialConnections()    // Gerencia conexões de redes sociais
useAnalyticsData()       // Dados para gráficos
useTikTokLiveStats()     // Estatísticas em tempo real
useTikTokTokenStatus()   // Status e refresh de tokens
```

### Utilitários
```typescript
// lib/utils.ts
formatNumber()           // Formatação de números
cn()                     // Class name merger
```

## 🐛 Troubleshooting

### Problemas Comuns

**1. Erro de autenticação TikTok**
```bash
# Verifique as credenciais
# Confirme a URL de callback
# Verifique os escopos configurados
```

**2. Dados de analytics não aparecem**
```bash
# Verifique se o cron job está executando
# Confirme as políticas RLS
# Verifique logs da API
```

**3. Erro de build**
```bash
# Limpe o cache
npm run clean
npm install
npm run build
```

## 📝 Roadmap

### Próximas Versões

#### v0.2.0 - Instagram Integration
- [ ] OAuth Instagram
- [ ] Posts e Stories
- [ ] Analytics Instagram
- [ ] Agendamento de posts

#### v0.3.0 - Enhanced Analytics
- [ ] Relatórios personalizados
- [ ] Comparação entre redes
- [ ] Export para PDF/Excel
- [ ] Alertas de performance

#### v0.4.0 - Team Collaboration
- [ ] Múltiplos usuários
- [ ] Permissões por conta
- [ ] Comentários e aprovações
- [ ] Workflow de publicação

## 🤝 Contribuição

1. **Fork** o repositório
2. **Crie** uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. **Commit** suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. **Push** para a branch (`git push origin feature/AmazingFeature`)
5. **Abra** um Pull Request

### Guidelines
- Siga as convenções do TypeScript
- Adicione testes para novas funcionalidades
- Mantenha a documentação atualizada
- Use Conventional Commits

## 📄 Licença

Este projeto está sob a licença **MIT**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Suporte

Para suporte e dúvidas:

- **Email**: suporte@socialhub.com
- **Discord**: [Link do servidor](#)
- **GitHub Issues**: [Issues do projeto](https://github.com/seu-usuario/socialhub/issues)

---

**Desenvolvido com ❤️ usando Next.js, TypeScript e Supabase**