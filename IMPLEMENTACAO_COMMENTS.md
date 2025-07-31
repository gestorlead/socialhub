# 🎯 Plano Executável: Sistema de Gerenciamento de Comentários

## 📋 Estrutura de Execução por Etapas Testáveis

### 🏗️ **FASE 1: INFRAESTRUTURA & SEGURANÇA** (2-3 semanas)
**Status: PENDING** | **Prioridade: CRÍTICA**

#### **Etapa 1.1: Database Schema & Security**
**Agente Responsável**: `nextjs-fullstack-expert`
**Duração**: 3-4 dias
**Status**: ❌ PENDING

**Tasks Testáveis**:
- [ ] Criar schema `comments` com particionamento
- [ ] Implementar Row Level Security (RLS) policies
- [ ] Criar índices otimizados para performance
- [ ] Setup audit trail com tabela `audit_log`

**Critérios de Aceitação**:
```sql
-- Teste 1: RLS funcional
SELECT COUNT(*) FROM comments WHERE user_id != auth.uid(); -- Deve retornar 0

-- Teste 2: Índices criados
SELECT indexname FROM pg_indexes WHERE tablename = 'comments';

-- Teste 3: Particionamento ativo
SELECT schemaname, tablename FROM pg_tables WHERE tablename LIKE 'comments_%';
```

**Agente de Validação**: `web-security-specialist`

---

#### **Etapa 1.2: Token Encryption & Input Validation**  
**Agente Responsável**: `web-security-specialist`
**Duração**: 4-5 dias
**Status**: ❌ PENDING

**Tasks Testáveis**:
- [ ] Implementar criptografia AES-256 para tokens
- [ ] Criar middleware de validação de input (Zod)
- [ ] Implementar sanitização XSS/SQL Injection
- [ ] Setup rate limiting com Redis/Upstash

**Critérios de Aceitação**:
```typescript
// Teste 1: Criptografia funcional
const encrypted = encryptToken("test-token");
const decrypted = decryptToken(encrypted);
expect(decrypted).toBe("test-token");

// Teste 2: XSS Protection
const malicious = '<script>alert("xss")</script>';
const sanitized = sanitizeComment(malicious);
expect(sanitized).not.toContain('<script>');

// Teste 3: Rate limiting
// 100 requests em 15min deve bloquear
```

**Agente de Validação**: `react-qa-specialist`

---

#### **Etapa 1.3: Core API Endpoints**
**Agente Responsável**: `nextjs-fullstack-expert`  
**Duração**: 5-6 dias
**Status**: ❌ PENDING

**Tasks Testáveis**:
- [ ] `/api/comments` - CRUD operations
- [ ] `/api/comments/platforms/[platform]` - Platform-specific
- [ ] `/api/comments/moderate` - Moderation actions
- [ ] Middleware chain (auth, validation, logging)

**Critérios de Aceitação**:
```bash
# Teste 1: CRUD endpoints funcionais
curl -X GET /api/comments?platform=instagram # 200 OK
curl -X POST /api/comments -d '{"content":"test"}' # 201 Created

# Teste 2: Authentication obrigatório
curl -X GET /api/comments # 401 Unauthorized

# Teste 3: Validation ativa
curl -X POST /api/comments -d '{"content":""}' # 400 Bad Request
```

**Agente de Validação**: `react-qa-specialist`

---

### 🚀 **FASE 2: PERFORMANCE & REAL-TIME** (3-4 semanas)
**Status**: ❌ PENDING | **Prioridade**: ALTA

#### **Etapa 2.1: Performance Optimization**
**Agente Responsável**: `nextjs-performance-optimizer`
**Duração**: 5-7 dias  
**Status**: ❌ PENDING

**Tasks Testáveis**:
- [ ] Implementar cache multi-layer (Redis/Next.js)
- [ ] Setup database connection pooling
- [ ] Otimizar queries com cursor pagination
- [ ] Implementar bundle splitting

**Critérios de Aceitação**:
```javascript
// Teste 1: Cache hit rate >90%
const cacheStats = await redis.info('stats');
expect(cacheStats.keyspaceHits / cacheStats.keyspaceMisses).toBeGreaterThan(9);

// Teste 2: Query time <200ms
const startTime = performance.now();
await getComments({ limit: 50 });
const queryTime = performance.now() - startTime;
expect(queryTime).toBeLessThan(200);

// Teste 3: Bundle size <300KB
const bundleSize = await getBundleSize();
expect(bundleSize).toBeLessThan(300 * 1024);
```

**Agente de Validação**: `nextjs-performance-optimizer`

---

#### **Etapa 2.2: Real-time Subscriptions**
**Agente Responsável**: `nextjs-fullstack-expert`
**Duração**: 4-5 dias
**Status**: ❌ PENDING

**Tasks Testáveis**:
- [ ] Setup Supabase real-time subscriptions
- [ ] Implementar connection pooling otimizado
- [ ] Criar hooks React para real-time updates
- [ ] Handle connection loss/reconnection

**Critérios de Aceitação**:
```typescript
// Teste 1: Subscription funcional
const { data, isConnected } = useRealtimeComments('instagram');
expect(isConnected).toBe(true);

// Teste 2: Updates em tempo real
// Inserir comment no DB deve aparecer em <500ms no frontend

// Teste 3: Reconnection automático  
// Simular perda de conexão deve reconectar em <2s
```

**Agente de Validação**: `react-qa-specialist`

---

#### **Etapa 2.3: Content Moderation System**
**Agente Responsável**: `web-security-specialist`
**Duração**: 6-7 dias
**Status**: ❌ PENDING

**Tasks Testáveis**:
- [ ] Integrar OpenAI Moderation API
- [ ] Implementar sentiment analysis
- [ ] Criar regras de spam detection
- [ ] Setup moderation queue workflow

**Critérios de Aceitação**:
```typescript
// Teste 1: Spam detection funcional
const spamComment = "Buy now! Click here! Urgent offer!";
const result = await detectSpam(spamComment);
expect(result.isSpam).toBe(true);

// Teste 2: Sentiment analysis
const negativeComment = "This sucks, terrible content";
const sentiment = await analyzeSentiment(negativeComment);
expect(sentiment.score).toBeLessThan(-0.5);

// Teste 3: Auto-moderation
const flaggedComment = "Inappropriate content here";
const moderation = await moderateContent(flaggedComment);
expect(moderation.action).toBe('review');
```

**Agente de Validação**: `web-security-specialist`

---

### 🎨 **FASE 3: FRONTEND & UX** (2-3 semanas)
**Status**: ❌ PENDING | **Prioridade**: MÉDIA

#### **Etapa 3.1: Core Components**
**Agente Responsável**: `ui-ux-designer`
**Duração**: 7-8 dias
**Status**: ❌ PENDING

**Tasks Testáveis**:
- [ ] `CommentsDashboard` - Layout principal
- [ ] `CommentsTable` - Lista virtualizada
- [ ] `CommentCard` - Card individual
- [ ] `CommentsFilter` - Sistema de filtros

**Critérios de Aceitação**:
```typescript
// Teste 1: Componentes renderizam sem erro
render(<CommentsDashboard />);
expect(screen.getByTestId('comments-dashboard')).toBeInTheDocument();

// Teste 2: Virtualização funcional com >1000 items
const { container } = render(<CommentsTable comments={mockComments1000} />);
expect(container.querySelectorAll('[data-testid="comment-card"]').length).toBeLessThan(20);

// Teste 3: Filtros funcionais
fireEvent.change(screen.getByLabelText('Platform'), { target: { value: 'instagram' } });
expect(mockFilterFunction).toHaveBeenCalledWith({ platform: 'instagram' });
```

**Agente de Validação**: `react-qa-specialist`

---

#### **Etapa 3.2: Responsive Design & Mobile**
**Agente Responsável**: `ui-ux-designer`
**Duração**: 4-5 dias
**Status**: ❌ PENDING  

**Tasks Testáveis**:
- [ ] Mobile-first responsive layout
- [ ] Touch gestures e swipe actions
- [ ] Bottom sheet modals
- [ ] Floating action buttons

**Critérios de Aceitação**:
```typescript
// Teste 1: Layout responsivo
Object.defineProperty(window, 'innerWidth', { value: 375 });
render(<CommentsDashboard />);
expect(screen.getByTestId('mobile-layout')).toBeInTheDocument();

// Teste 2: Touch gestures
const commentCard = screen.getByTestId('comment-card');
fireEvent.touchStart(commentCard, { touches: [{ clientX: 100, clientY: 100 }] });
fireEvent.touchEnd(commentCard, { touches: [{ clientX: 200, clientY: 100 }] });
expect(mockSwipeHandler).toHaveBeenCalled();
```

**Agente de Validação**: `ui-ux-designer`

---

#### **Etapa 3.3: Accessibility Implementation**  
**Agente Responsável**: `ui-ux-designer`
**Duração**: 3-4 dias
**Status**: ❌ PENDING

**Tasks Testáveis**:
- [ ] Keyboard navigation completa
- [ ] Screen reader support (ARIA)
- [ ] Focus management
- [ ] Color contrast WCAG 2.1 AA

**Critérios de Aceitação**:
```typescript
// Teste 1: Navegação por teclado
const { container } = render(<CommentsDashboard />);
const results = await axe(container);
expect(results).toHaveNoViolations();

// Teste 2: Focus management
fireEvent.keyDown(document, { key: 'Tab' });
expect(screen.getByRole('button', { name: /filter/i })).toHaveFocus();

// Teste 3: Screen reader
expect(screen.getByLabelText('Comment from @username on Instagram')).toBeInTheDocument();
```

**Agente de Validação**: `react-qa-specialist`

---

### 🧪 **FASE 4: QUALITY & PRODUCTION** (1-2 semanas)
**Status**: ❌ PENDING | **Prioridade**: MÉDIA

#### **Etapa 4.1: Test Suite Complete**
**Agente Responsável**: `react-qa-specialist`
**Duração**: 5-7 dias
**Status**: ❌ PENDING

**Tasks Testáveis**:
- [ ] Unit tests (>90% coverage)
- [ ] Integration tests (>80% coverage)  
- [ ] E2E tests com Playwright
- [ ] Performance tests

**Critérios de Aceitação**:
```bash
# Teste 1: Coverage targets
npm run test:coverage
# Statements: >90%, Branches: >85%, Functions: >90%, Lines: >90%

# Teste 2: E2E tests passing
npm run test:e2e
# All critical user journeys passing

# Teste 3: Performance tests
npm run test:performance
# LCP <2.5s, FID <100ms, CLS <0.1
```

**Agente de Validação**: `react-qa-specialist`

---

#### **Etapa 4.2: Production Readiness**
**Agente Responsável**: `nextjs-fullstack-expert`
**Duração**: 3-4 dias
**Status**: ❌ PENDING

**Tasks Testáveis**:
- [ ] Environment variables configuration
- [ ] CI/CD pipeline setup
- [ ] Error monitoring (Sentry)
- [ ] Performance monitoring

**Critérios de Aceitação**:
```bash
# Teste 1: Build success
npm run build
# Build completes without errors, bundle size <300KB

# Teste 2: Deploy pipeline
git push origin main  
# Auto-deploy to staging, all tests pass

# Teste 3: Monitoring active
# Error tracking functional, performance metrics collecting
```

**Agente de Validação**: `nextjs-performance-optimizer`

---

## 📊 **SISTEMA DE CONTROLE & TRACKING**

### **Status Dashboard**
```
┌─────────────────────────────────────────────────────────┐
│                    🎯 PROJECT STATUS                    │
├─────────────────────────────────────────────────────────┤
│ 📈 Overall Progress: ██████░░░░ 60% (12/20 tasks)      │
│                                                         │
│ 🔴 FASE 1: ██████████ 100% (4/4) ✅ COMPLETED         │
│ 🟡 FASE 2: ████░░░░░░  40% (2/5) 🔄 IN PROGRESS       │
│ ⚪ FASE 3: ░░░░░░░░░░   0% (0/3) ❌ PENDING            │
│ ⚪ FASE 4: ░░░░░░░░░░   0% (0/2) ❌ PENDING            │
│                                                         │
│ 🚨 Blocker: None                                       │
│ ⏰ Next Due: Etapa 2.1 (Tomorrow)                     │
│ 👥 Active Agents: nextjs-performance-optimizer        │
└─────────────────────────────────────────────────────────┘
```

### **Task Assignment Matrix**
| Agente | Tasks Ativas | Tasks Completed | Utilização |
|--------|--------------|-----------------|------------|
| `nextjs-fullstack-expert` | 1 | 3 | 🟡 Medium |
| `web-security-specialist` | 0 | 2 | 🟢 Available |
| `ui-ux-designer` | 0 | 0 | 🟢 Available |
| `react-qa-specialist` | 0 | 1 | 🟢 Available |
| `nextjs-performance-optimizer` | 1 | 1 | 🟡 Medium |

### **Quality Gates por Etapa**
```yaml
etapa_completion_criteria:
  code_quality:
    - ESLint: 0 errors, <5 warnings
    - TypeScript: 0 type errors
    - Test coverage: >85%
  
  security:
    - Security audit: No high/critical vulnerabilities
    - OWASP compliance: 100%
    - RLS policies: Functional
  
  performance:
    - Bundle size: <300KB
    - Query time: <200ms
    - Cache hit rate: >90%
  
  ux:
    - Accessibility: WCAG 2.1 AA compliant
    - Mobile usability: >90% score
    - Cross-browser: Chrome, Firefox, Safari, Edge
```

---

## 🏗️ **ESPECIFICAÇÕES TÉCNICAS DETALHADAS**

### **Database Schema**
```sql
-- Tabela principal de comentários
CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  platform text NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'facebook')),
  platform_comment_id text NOT NULL,
  platform_post_id text NOT NULL,
  platform_user_id text NOT NULL,
  author_username text CHECK (char_length(author_username) <= 100),
  author_profile_picture text,
  content text NOT NULL CHECK (char_length(content) <= 10000),
  content_hash text NOT NULL,
  thread_path ltree,
  reply_to_comment_id uuid REFERENCES comments(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'spam')),
  sentiment_score decimal(3,2) CHECK (sentiment_score >= -1.00 AND sentiment_score <= 1.00),
  engagement_metrics jsonb DEFAULT '{}',
  moderation_flags text[] DEFAULT '{}',
  created_at_platform timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  
  UNIQUE(platform, platform_comment_id),
  CONSTRAINT valid_url CHECK (
    author_profile_picture IS NULL OR 
    author_profile_picture ~* '^https?://[^\s/$.?#].[^\s]*$'
  )
) PARTITION BY RANGE (created_at);

-- Tabela de respostas
CREATE TABLE comment_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  platform_reply_id text,
  content text NOT NULL,
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'pending', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de posts/conteúdo
CREATE TABLE social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  platform_post_id text NOT NULL,
  platform_user_id text NOT NULL,
  title text,
  description text,
  url text,
  thumbnail_url text,
  post_type text CHECK (post_type IN ('image', 'video', 'carousel', 'reel', 'story')),
  metrics jsonb DEFAULT '{}',
  created_at_platform timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(platform, platform_post_id)
);

-- Tabela de audit trail
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  retention_date timestamptz DEFAULT (now() + interval '7 years')
);

-- Índices otimizados
CREATE INDEX CONCURRENTLY idx_comments_user_platform_date 
ON comments (user_id, platform, created_at DESC);

CREATE INDEX CONCURRENTLY idx_comments_platform_post 
ON comments (platform, platform_post_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_comments_thread_path 
ON comments USING GIST (thread_path);

CREATE INDEX CONCURRENTLY idx_comments_search 
ON comments USING GIN (to_tsvector('english', content));

CREATE INDEX CONCURRENTLY idx_comments_status_platform 
ON comments (status, platform, created_at DESC) 
WHERE status IN ('pending', 'approved');

-- Row Level Security
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own comments" ON comments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own comments" ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON comments
  FOR DELETE USING (auth.uid() = user_id);

-- Particionamento mensal
CREATE TABLE comments_2024_01 PARTITION OF comments
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE comments_2024_02 PARTITION OF comments
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- ... adicionar partições conforme necessário
```

### **API Structure**
```
app/api/comments/
├── route.ts                    // GET (list), POST (create)
├── [id]/
│   └── route.ts               // GET, PUT, DELETE individual
├── platforms/
│   └── [platform]/
│       ├── route.ts           // Platform-specific operations
│       ├── sync/route.ts      // Background sync
│       └── analytics/route.ts // Platform analytics
├── moderate/
│   └── route.ts               // Moderation actions
├── search/
│   └── route.ts               // Full-text search
├── bulk/
│   └── route.ts               // Bulk operations
└── real-time/
    └── route.ts               // WebSocket upgrades
```

### **Component Architecture**
```
components/comments/
├── providers/
│   ├── CommentsProvider.tsx      // Context + React Query
│   └── RealtimeProvider.tsx      // Supabase subscriptions
├── hooks/
│   ├── useComments.ts           // Data fetching
│   ├── useCommentMutations.ts   // CRUD operations
│   ├── useRealtimeComments.ts   // Real-time updates
│   ├── useCommentModeration.ts  // Moderation actions
│   └── useCommentFilters.ts     // Filter management
├── ui/
│   ├── CommentCard.tsx          // Individual comment
│   ├── CommentThread.tsx        // Nested comments
│   ├── CommentList.tsx          // Virtualized list
│   ├── CommentForm.tsx          // Create/edit form
│   ├── CommentFilters.tsx       // Filtering controls
│   ├── CommentActions.tsx       // Action buttons
│   ├── CommentStatus.tsx        // Status indicators
│   └── CommentMetrics.tsx       // Engagement metrics
├── dashboard/
│   ├── CommentsDashboard.tsx    // Main dashboard
│   ├── CommentsTable.tsx        // Data table
│   ├── CommentsAnalytics.tsx    // Charts & metrics
│   ├── ModerationQueue.tsx      // Moderation interface
│   └── CommentsHeader.tsx       // Header with filters
├── modals/
│   ├── CommentReplyModal.tsx    // Reply modal
│   ├── CommentModerationModal.tsx // Moderation modal
│   └── CommentDetailsModal.tsx  // Detail view modal
└── types/
    └── comments.ts              // TypeScript definitions
```

### **Navigation Integration**
```typescript
// lib/navigation.ts - adicionar ao contentGroup
{
  id: 'comments',
  label: 'Comments',
  href: '/comments',
  icon: MessageCircle,
  requiredRole: UserRole.USER
}

// Pages structure
app/comments/
├── page.tsx                     // Dashboard principal
├── [platform]/
│   └── page.tsx                // View específica da plataforma
├── analytics/
│   └── page.tsx                // Analytics de comentários
├── moderation/
│   └── page.tsx                // Queue de moderação
└── settings/
    └── page.tsx                // Configurações
```

---

## 🎯 **MÉTRICAS DE SUCESSO**

### **Performance Targets**
- **Database Query Time**: 500ms → <200ms (75% improvement)
- **Initial Page Load**: 4s → <2s (50% improvement)  
- **Bundle Size**: 500KB → <300KB (40% reduction)
- **Real-time Latency**: 1-3s → <500ms (80% improvement)
- **Cache Hit Rate**: N/A → >90%
- **Memory Usage**: High → <100MB (50% reduction)

### **Security Targets**
- **Security Score**: 60% → >95%
- **Vulnerabilities**: Multiple → Zero critical/high
- **GDPR/LGPD Compliance**: Partial → 100%
- **Audit Trail**: None → Complete
- **XSS Protection**: Basic → Advanced with sanitization
- **Rate Limiting**: None → 100 req/15min per user

### **UX & Accessibility Targets**
- **WCAG 2.1 AA Compliance**: 60% → 100%
- **Mobile Usability Score**: 70% → >90%
- **Cross-browser Compatibility**: Chrome only → All major browsers
- **Keyboard Navigation**: Partial → Complete
- **Screen Reader Support**: None → Full ARIA implementation

### **Quality Targets**
- **Test Coverage**: 40% → >85% overall
- **Unit Test Coverage**: 30% → >90%
- **Integration Test Coverage**: 10% → >80%
- **E2E Test Coverage**: 0% → >70%
- **Security Test Coverage**: 0% → 100%
- **Performance Test Coverage**: 0% → 100%

---

## 🚀 **COMANDOS DE EXECUÇÃO**

### **Comando de Inicialização**
```bash
# Iniciar implementação
npm run comments:init

# Setup database
npm run db:migrate:comments

# Install dependencies
npm install react-window react-virtualized zod @hookform/resolvers

# Setup testing
npm install -D @testing-library/jest-dom @testing-library/user-event axe-jest
```

### **Comandos de Desenvolvimento**
```bash
# Executar próxima etapa
npm run comments:next-phase

# Validar etapa atual
npm run comments:validate

# Executar testes específicos
npm run test:comments:unit
npm run test:comments:integration
npm run test:comments:e2e
npm run test:comments:security
npm run test:comments:performance
npm run test:comments:accessibility

# Verificar status
npm run comments:status

# Gerar relatório
npm run comments:report
```

### **Comandos de Qualidade**
```bash
# Coverage completo
npm run test:coverage:comments

# Security audit
npm run audit:security:comments

# Performance audit
npm run audit:performance:comments

# Accessibility audit
npm run audit:a11y:comments

# Build e bundle analysis
npm run build:analyze:comments
```

---

## 📝 **NOTAS DE IMPLEMENTAÇÃO**

### **Dependências Principais**
```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.0.0",
    "react-window": "^1.8.8",
    "react-hook-form": "^7.48.0",
    "zod": "^3.22.0",
    "@hookform/resolvers": "^3.3.0",
    "date-fns": "^2.30.0",
    "lucide-react": "^0.294.0",
    "recharts": "^2.8.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/react": "^13.4.0",
    "@testing-library/user-event": "^14.5.0",
    "jest-axe": "^8.0.0",
    "@playwright/test": "^1.40.0",
    "msw": "^2.0.0"
  }
}
```

### **Environment Variables**
```env
# Comments System
COMMENTS_ENCRYPTION_KEY=your_32_byte_key_here
OPENAI_API_KEY=your_openai_key_for_moderation
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000

# Feature Flags
ENABLE_COMMENT_MODERATION=true
ENABLE_REALTIME_COMMENTS=true
ENABLE_COMMENT_ANALYTICS=true
```

### **Git Strategy**
```bash
# Branch naming
feature/comments-phase-1-database
feature/comments-phase-2-performance
feature/comments-phase-3-frontend
feature/comments-phase-4-quality

# Commit convention
feat(comments): implement database schema with RLS
fix(comments): resolve XSS vulnerability in content sanitization
test(comments): add integration tests for real-time subscriptions
docs(comments): update implementation guide with security requirements
```

---

Este documento serve como guia completo para a implementação do sistema de gerenciamento de comentários, com etapas testáveis, critérios de aceitação claros e controle de qualidade rigoroso.