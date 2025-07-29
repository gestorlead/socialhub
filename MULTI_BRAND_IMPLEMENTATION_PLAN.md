# Plano de Implementação - Sistema Multi-Marca SocialHub

**Versão:** 1.0  
**Data:** 29 de Janeiro de 2025  
**Status Geral:** 🟡 Em Planejamento

---

## 📋 Visão Geral do Projeto

### Objetivo
Implementar sistema multi-marca que permite:
- Usuários participarem de múltiplas marcas
- Diferentes níveis de acesso por marca
- Sistema de convites para colaboração
- Isolamento total de dados entre marcas

### Contexto Atual
- ✅ Sistema de autenticação Supabase funcional
- ✅ Estrutura de roles básica (USER/ADMIN/SUPER_ADMIN)
- ✅ Integração Instagram no signup implementada
- ✅ Dashboard básico funcionando

---

## 🗂️ Estrutura de Implementação

### **FASE 1: FUNDAÇÃO DO SISTEMA MULTI-MARCA**
**Duração Estimada:** 4-5 dias  
**Status:** 🔴 Não Iniciado

#### 1.1 Database Schema & Migrations
**Status:** 🔴 Não Iniciado  
**Responsável:** Dev  
**Estimativa:** 1-2 dias

- [ ] **1.1.1** Criar tabela `brands`
  - [ ] Campos: id, name, description, logo_url, created_by, timestamps
  - [ ] Constraints e indexes necessários
  
- [ ] **1.1.2** Criar tabela `brand_memberships`
  - [ ] Campos: id, brand_id, user_id, role, permissions, timestamps
  - [ ] Unique constraint (brand_id, user_id)
  
- [ ] **1.1.3** Criar tabela `brand_invitations`
  - [ ] Campos: id, brand_id, email, role, invited_by, token, expires_at
  - [ ] Index no token para consultas rápidas
  
- [ ] **1.1.4** Atualizar tabelas existentes
  - [ ] Adicionar `current_brand_id` em `profiles`
  - [ ] Adicionar `brand_id` em `social_connections`
  - [ ] Adicionar `brand_id` em `tiktok_videos`
  - [ ] Adicionar `brand_id` em `tiktok_daily_stats`
  - [ ] Adicionar `brand_id` em `integration_settings`

#### 1.2 TypeScript Types & Interfaces
**Status:** 🔴 Não Iniciado  
**Responsável:** Dev  
**Estimativa:** 0.5 dia

- [ ] **1.2.1** Criar interfaces para Brand system
  ```typescript
  interface Brand {
    id: string
    name: string
    description?: string
    logo_url?: string
    created_by: string
    created_at: string
    updated_at: string
  }
  
  interface BrandMembership {
    id: string
    brand_id: string
    user_id: string
    role: 'owner' | 'admin' | 'editor' | 'viewer'
    permissions?: Record<string, boolean>
    created_at: string
    invited_by?: string
    accepted_at?: string
    is_active: boolean
    brand?: Brand
  }
  ```

- [ ] **1.2.2** Atualizar tipos do database.ts
- [ ] **1.2.3** Criar enum para brand roles
- [ ] **1.2.4** Definir matriz de permissões

#### 1.3 Brand Context & Provider
**Status:** 🔴 Não Iniciado  
**Responsável:** Dev  
**Estimativa:** 1-2 dias

- [ ] **1.3.1** Criar BrandContext com hooks
  - [ ] `useBrand()` - contexto atual
  - [ ] `useUserBrands()` - marcas do usuário
  - [ ] `useBrandPermissions()` - permissões na marca atual
  
- [ ] **1.3.2** Implementar BrandProvider
  - [ ] Gerenciamento de marca ativa
  - [ ] Cache de marcas do usuário
  - [ ] Sincronização com localStorage
  
- [ ] **1.3.3** Criar utility functions
  - [ ] `hasPermissionInBrand()`
  - [ ] `getUserRoleInBrand()`
  - [ ] `canAccessBrandResource()`

#### 1.4 Core Components
**Status:** 🔴 Não Iniciado  
**Responsável:** Dev  
**Estimativa:** 1 dia

- [ ] **1.4.1** BrandSelector component
  - [ ] Dropdown com marcas do usuário
  - [ ] Indicador de role em cada marca
  - [ ] Troca de contexto suave
  
- [ ] **1.4.2** BrandGuard HOC
  - [ ] Proteção por permissão de marca
  - [ ] Fallback para usuários sem acesso
  
- [ ] **1.4.3** Atualizar AppSidebar
  - [ ] Integrar BrandSelector
  - [ ] Mostrar marca atual no header

---

### **FASE 2: AUTENTICAÇÃO E SIGNUP MULTI-MARCA**
**Duração Estimada:** 3-4 dias  
**Status:** 🔴 Não Iniciado

#### 2.1 Atualização do Signup Form
**Status:** 🔴 Não Iniciado  
**Responsável:** Dev  
**Estimativa:** 1 dia

- [ ] **2.1.1** Adicionar campo "Nome da Primeira Marca"
  - [ ] Validação obrigatória
  - [ ] Validação de caracteres especiais
  - [ ] Preview do nome da marca
  
- [ ] **2.1.2** Tornar "Nome Completo" obrigatório
- [ ] **2.1.3** Manter compatibilidade com fluxo Instagram
- [ ] **2.1.4** Atualizar UI/UX do formulário

#### 2.2 Fluxo de Criação de Marca
**Status:** 🔴 Não Iniciado  
**Responsável:** Dev  
**Estimativa:** 1-2 dias

- [ ] **2.2.1** Implementar API `/api/brands/create`
  - [ ] Validações de entrada
  - [ ] Criação da marca
  - [ ] Associação como owner
  - [ ] Definir como marca ativa
  
- [ ] **2.2.2** Atualizar processo de signup
  - [ ] Integrar criação de marca
  - [ ] Manter trigger de profile existente
  - [ ] Vincular dados Instagram à marca (se existir)
  
- [ ] **2.2.3** Tratamento de erros
  - [ ] Rollback em caso de falha
  - [ ] Mensagens de erro específicas

#### 2.3 Auth Context Updates
**Status:** 🔴 Não Iniciado  
**Responsável:** Dev  
**Estimativa:** 1 dia

- [ ] **2.3.1** Atualizar AuthProvider
  - [ ] Carregar marcas do usuário no login
  - [ ] Definir marca ativa padrão
  - [ ] Integração com BrandProvider
  
- [ ] **2.3.2** Atualizar fetchProfile function
  - [ ] Incluir brand_memberships na query
  - [ ] Cache otimizado para marcas

---

### **FASE 3: SISTEMA DE CONVITES E GESTÃO**
**Duração Estimada:** 4-5 dias  
**Status:** 🔴 Não Iniciado

#### 3.1 Sistema de Convites
**Status:** 🔴 Não Iniciado  
**Responsável:** Dev  
**Estimativa:** 2-3 dias

- [ ] **3.1.1** API de Convites
  - [ ] `POST /api/brands/[id]/invite` - Enviar convite
  - [ ] `GET /api/invites/[token]` - Validar convite
  - [ ] `POST /api/invites/[token]/accept` - Aceitar convite
  - [ ] `DELETE /api/brands/[id]/invites/[id]` - Cancelar convite
  
- [ ] **3.1.2** Email Templates
  - [ ] Template de convite para usuário existente
  - [ ] Template de convite para novo usuário
  - [ ] Integração com serviço de email (Resend/SendGrid)
  
- [ ] **3.1.3** Página de Aceitar Convite
  - [ ] `/convite/[token]` - Página de aceitar
  - [ ] Validação de token
  - [ ] Fluxo para usuário logado/não logado

#### 3.2 Dashboard de Gestão de Usuários
**Status:** 🔴 Não Iniciado  
**Responsável:** Dev  
**Estimativa:** 2 dias

- [ ] **3.2.1** Página `/dashboard/usuarios`
  - [ ] Lista de membros da marca atual
  - [ ] Lista de convites pendentes
  - [ ] Proteção por permissão (admin/owner only)
  
- [ ] **3.2.2** UserManagementTable component
  - [ ] Exibição de role de cada membro
  - [ ] Ações: editar role, remover membro
  - [ ] Filtros e busca
  
- [ ] **3.2.3** InviteUserForm component
  - [ ] Campo de email
  - [ ] Seleção de role
  - [ ] Mensagem personalizada
  - [ ] Validação de email duplicado

---

### **FASE 4: PERMISSÕES E SEGURANÇA**
**Duração Estimada:** 3-4 dias  
**Status:** 🔴 Não Iniciado

#### 4.1 Row Level Security (RLS)
**Status:** 🔴 Não Iniciado  
**Responsável:** Dev  
**Estimativa:** 2 dias

- [ ] **4.1.1** Policies para tabela `brands`
  - [ ] Users can only access brands they're members of
  - [ ] Only owners can delete brands
  
- [ ] **4.1.2** Policies para `brand_memberships`
  - [ ] Members can view other members of same brand
  - [ ] Only admins/owners can manage memberships
  
- [ ] **4.1.3** Policies para dados existentes
  - [ ] Filtrar `social_connections` por brand_id
  - [ ] Filtrar `tiktok_videos` por brand_id
  - [ ] Filtrar `tiktok_daily_stats` por brand_id
  - [ ] Filtrar `integration_settings` por brand_id

#### 4.2 Sistema de Permissões
**Status:** 🔴 Não Iniciado  
**Responsável:** Dev  
**Estimativa:** 1-2 dias

- [ ] **4.2.1** Definir matriz de permissões
  ```typescript
  const BRAND_PERMISSIONS = {
    'owner': ['manage_brand', 'manage_members', 'delete_brand', 'manage_content', 'view_analytics'],
    'admin': ['manage_brand', 'manage_members', 'manage_content', 'view_analytics'],
    'editor': ['manage_content', 'view_analytics'],
    'viewer': ['view_analytics']
  }
  ```
  
- [ ] **4.2.2** Middleware de proteção
  - [ ] Verificação de permissões nas APIs
  - [ ] Guards para páginas protegidas
  
- [ ] **4.2.3** Helpers de permissão
  - [ ] `hasPermission(permission, brandId?)`
  - [ ] `requirePermission(permission, brandId)`

---

### **FASE 5: INTERFACE MULTI-MARCA**
**Duração Estimada:** 4-5 dias  
**Status:** 🔴 Não Iniciado

#### 5.1 Atualização da Sidebar
**Status:** 🔴 Não Iniciado  
**Responsável:** Dev  
**Estimativa:** 1 dia

- [ ] **5.1.1** Integrar BrandSelector na AppSidebar
- [ ] **5.1.2** Mostrar nome da marca atual no header
- [ ] **5.1.3** Menu "Usuários" (apenas para admin/owner)
- [ ] **5.1.4** Menu "Configurações da Marca"

#### 5.2 Filtros por Marca
**Status:** 🔴 Não Iniciado  
**Responsável:** Dev  
**Estimativa:** 2 dias

- [ ] **5.2.1** Atualizar páginas de analytics
  - [ ] Filtrar dados do TikTok por marca atual
  - [ ] Atualizar hooks de dados
  - [ ] Indicador visual da marca ativa
  
- [ ] **5.2.2** Atualizar páginas de integrações
  - [ ] Filtrar conexões sociais por marca
  - [ ] Configurações por marca
  
- [ ] **5.2.3** Atualizar página de publicações
  - [ ] Publicar no contexto da marca atual
  - [ ] Histórico por marca

#### 5.3 Páginas de Configuração
**Status:** 🔴 Não Iniciado  
**Responsável:** Dev  
**Estimativa:** 1-2 dias

- [ ] **5.3.1** Página `/dashboard/configuracoes/marca`
  - [ ] Configurações básicas da marca
  - [ ] Upload de logo
  - [ ] Configurações de integração
  
- [ ] **5.3.2** Página `/dashboard/marcas`
  - [ ] Lista de todas as marcas do usuário
  - [ ] Troca rápida entre marcas
  - [ ] Indicador de role em cada marca

---

### **FASE 6: MIGRAÇÃO E DEPLOY**
**Duração Estimada:** 2-3 dias  
**Status:** 🔴 Não Iniciado

#### 6.1 Script de Migração
**Status:** 🔴 Não Iniciado  
**Responsável:** Dev  
**Estimativa:** 1 dia

- [ ] **6.1.1** Criar marcas para usuários existentes
  - [ ] Nome padrão baseado no full_name ou email
  - [ ] Associar como owner
  - [ ] Definir como marca ativa
  
- [ ] **6.1.2** Migrar dados existentes
  - [ ] Associar social_connections à marca
  - [ ] Associar tiktok_videos à marca
  - [ ] Associar tiktok_daily_stats à marca
  - [ ] Associar integration_settings à marca

#### 6.2 Testes e Validação
**Status:** 🔴 Não Iniciado  
**Responsável:** Dev  
**Estimativa:** 1 dia

- [ ] **6.2.1** Testes de segurança
  - [ ] Verificar isolamento de dados
  - [ ] Testar políticas RLS
  - [ ] Validar permissões por role
  
- [ ] **6.2.2** Testes funcionais
  - [ ] Fluxo de signup com marca
  - [ ] Sistema de convites
  - [ ] Troca de marcas
  - [ ] Gestão de usuários

#### 6.3 Deploy Gradual
**Status:** 🔴 Não Iniciado  
**Responsável:** Dev  
**Estimativa:** 0.5 dia

- [ ] **6.3.1** Deploy das migrações
- [ ] **6.3.2** Execução do script de migração
- [ ] **6.3.3** Monitoramento pós-deploy
- [ ] **6.3.4** Ajustes e correções

---

## 📊 Resumo de Progresso

### Status por Fase
| Fase | Status | Progresso | Estimativa |
|------|--------|-----------|------------|
| **Fase 1** - Fundação | 🔴 Não Iniciado | 0% | 4-5 dias |
| **Fase 2** - Auth & Signup | 🔴 Não Iniciado | 0% | 3-4 dias |
| **Fase 3** - Convites | 🔴 Não Iniciado | 0% | 4-5 dias |
| **Fase 4** - Segurança | 🔴 Não Iniciado | 0% | 3-4 dias |
| **Fase 5** - Interface | 🔴 Não Iniciado | 0% | 4-5 dias |
| **Fase 6** - Deploy | 🔴 Não Iniciado | 0% | 2-3 dias |

### Progresso Geral
**Total:** 0% (0/84 tarefas concluídas)  
**Estimativa Total:** 20-26 dias

---

## 🎯 Critérios de Sucesso

### Funcionais
- [ ] Usuário pode criar conta com primeira marca
- [ ] Usuário pode participar de múltiplas marcas
- [ ] Sistema de convites funcional
- [ ] Permissões por marca funcionando
- [ ] Dados isolados entre marcas
- [ ] Migração de dados existentes bem-sucedida

### Técnicos
- [ ] RLS policies funcionando corretamente
- [ ] Performance mantida com multi-marca
- [ ] Compatibilidade com integrações existentes
- [ ] Testes de segurança passando

### UX/UI
- [ ] Seleção de marca intuitiva
- [ ] Gestão de usuários simples
- [ ] Fluxo de convites claro
- [ ] Indicadores visuais de marca ativa

---

## 🚨 Riscos e Mitigações

### Riscos Técnicos
| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Quebra de integrações existentes | Média | Alto | Testes extensivos, deploy gradual |
| Performance com RLS | Baixa | Médio | Índices otimizados, cache |
| Migração de dados complexa | Média | Alto | Scripts testados, rollback plan |

### Riscos de Negócio
| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Confusão de usuários existentes | Alta | Médio | Comunicação clara, onboarding |
| Perda de dados na migração | Baixa | Alto | Backup completo, testes |

---

## 📞 Comunicação

### Atualizações de Status
- **Daily:** Atualização de progresso neste documento
- **Blockers:** Comunicação imediata
- **Deploy:** Notificação 24h antes

### Stakeholders
- **Dev Team:** Implementação e testes
- **Product:** Validação de requisitos
- **Users:** Comunicação de mudanças

---

**Última Atualização:** 29/01/2025 às 13:45  
**Próxima Revisão:** 30/01/2025

## 📝 Log de Mudanças

| Data | Versão | Mudanças |
|------|--------|----------|
| 29/01/2025 | 1.0 | Criação do documento inicial |
