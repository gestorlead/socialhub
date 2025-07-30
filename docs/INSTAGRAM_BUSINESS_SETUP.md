# Guia Completo de Configuração do Instagram Business para Social Hub

## 📋 Pré-requisitos

1. **Conta Facebook Business** configurada
2. **Instagram Business Account** vinculada à página do Facebook
3. **App do Facebook** criado e configurado

---

## 🔧 Parte 1: Configuração no Meta (Facebook) App Dashboard

### 1. Adicionar Instagram ao seu App

1. No dashboard do seu App Facebook, vá para **"Add Products"**
2. Encontre **"Instagram"** e clique em **"Set Up"**
3. Selecione **"Instagram Basic Display"** ou **"Instagram Business"**

### 2. Configurações do Instagram Basic Display

#### Instagram App ID e Secret
- Serão gerados automaticamente
- Anote ambos para usar no Social Hub

#### Valid OAuth Redirect URIs
Adicione TODAS estas URIs:
```
https://socialhub.gestorlead.com.br/api/auth/instagram/callback
https://www.socialhub.gestorlead.com.br/api/auth/instagram/callback
http://localhost:3000/api/auth/instagram/callback
```

#### Deauthorize Callback URL
```
https://socialhub.gestorlead.com.br/api/auth/instagram/deauth
```

#### Data Deletion Request URL
```
https://socialhub.gestorlead.com.br/api/auth/instagram/delete
```

### 3. Permissões Necessárias (Scopes)

Para Instagram Business, você precisa das seguintes permissões:

#### Permissões Básicas (Aprovação Automática):
- `instagram_basic` - Informações básicas do perfil
- `pages_show_list` - Listar páginas do Facebook

#### Permissões Avançadas (Requerem Revisão):
- `instagram_content_publish` - Publicar conteúdo
- `instagram_manage_insights` - Acessar insights
- `instagram_manage_comments` - Gerenciar comentários
- `instagram_manage_messages` - Gerenciar mensagens (DMs)
- `pages_read_engagement` - Ler engajamento das páginas
- `business_management` - Gerenciamento de negócios

### 4. Configurações de Revisão do App

Para solicitar permissões avançadas:

1. **App Mode**: Mantenha em "Development" durante testes
2. **Business Verification**: Necessário para algumas APIs
3. **App Review**: 
   - Prepare vídeos demonstrando cada permissão
   - Escreva descrições detalhadas do uso
   - Tempo de aprovação: 5-10 dias úteis

---

## 💻 Parte 2: Configuração no Social Hub

### 1. Configurar Variáveis de Ambiente

Adicione ao seu `.env.local`:

```env
# Instagram Business Configuration
INSTAGRAM_APP_ID=seu_instagram_app_id
INSTAGRAM_APP_SECRET=seu_instagram_app_secret
INSTAGRAM_API_VERSION=v18.0
INSTAGRAM_ENVIRONMENT=development

# OAuth Configuration
INSTAGRAM_OAUTH_REDIRECT_URI=https://socialhub.gestorlead.com.br/api/auth/instagram/callback

# Permissions (comma-separated)
INSTAGRAM_PERMISSIONS=instagram_basic,pages_show_list,instagram_content_publish,instagram_manage_insights

# Content Types
INSTAGRAM_CONTENT_POSTS=true
INSTAGRAM_CONTENT_STORIES=true
INSTAGRAM_CONTENT_REELS=true
INSTAGRAM_CONTENT_IGTV=false

# Status
INSTAGRAM_IS_ACTIVE=true
```

### 2. Configurar no Painel Admin

1. Acesse: **Integrations > Instagram**
2. Preencha os campos:
   - **App ID**: Cole o Instagram App ID
   - **App Secret**: Cole o Instagram App Secret
   - **API Version**: v18.0 (ou mais recente)
   - **Environment**: Development (para testes)
   - **OAuth Redirect URI**: Confirme que está correto
   - **Permissions**: Selecione as necessárias
   - **Content Types**: Ative os tipos desejados

### 3. Conectar Conta Instagram

1. Clique em **"Connect Instagram"**
2. Você será redirecionado para o Instagram
3. Faça login com a conta Business
4. Autorize as permissões solicitadas
5. Será redirecionado de volta ao Social Hub

---

## 🔄 Parte 3: Fluxo de Autenticação

### Fluxo OAuth Correto:

1. **Autorização**:
   - URL: `https://www.instagram.com/oauth/authorize`
   - Parâmetros: client_id, redirect_uri, scope, response_type=code

2. **Troca de Token**:
   - URL: `https://api.instagram.com/oauth/access_token`
   - Método: POST
   - Parâmetros: client_id, client_secret, grant_type=authorization_code, redirect_uri, code

3. **Token de Longa Duração**:
   - URL: `https://graph.instagram.com/access_token`
   - Parâmetros: grant_type=ig_exchange_token, client_secret, access_token

4. **Refresh Token** (a cada 60 dias):
   - URL: `https://graph.instagram.com/refresh_access_token`
   - Parâmetros: grant_type=ig_refresh_token, access_token

---

## 🧪 Parte 4: Teste de Integração

### 1. Teste de Conectividade

No painel admin, clique em **"Test Connection"** para verificar:
- ✅ Credenciais válidas
- ✅ Permissões concedidas
- ✅ Conta Business conectada
- ✅ Acesso à API

### 2. Endpoints de API Disponíveis

Após configuração, você poderá usar:

```javascript
// Obter informações do perfil
GET https://graph.instagram.com/me?fields=id,username,account_type,media_count

// Publicar conteúdo (imagem)
POST https://graph.instagram.com/{ig-user-id}/media
{
  "image_url": "https://example.com/image.jpg",
  "caption": "Texto da publicação"
}

// Publicar conteúdo (vídeo/reel)
POST https://graph.instagram.com/{ig-user-id}/media
{
  "video_url": "https://example.com/video.mp4",
  "caption": "Texto do reel",
  "media_type": "REELS"
}

// Obter insights
GET https://graph.instagram.com/{ig-media-id}/insights?metric=impressions,reach,engagement
```

---

## ⚠️ Problemas Comuns e Soluções

### 1. "Invalid redirect_uri"
- Verifique se a URI está EXATAMENTE igual no App e no código
- Inclua versões com/sem www
- Use HTTPS em produção

### 2. "Insufficient permissions"
- Verifique se solicitou todas as permissões necessárias
- Para contas que não possui, precisa de "Advanced Access"

### 3. "Token expired"
- Tokens de curta duração: 1 hora
- Tokens de longa duração: 60 dias
- Configure renovação automática

### 4. "Account not found"
- Certifique-se que é uma conta Business/Creator
- Verifique se está vinculada a uma página do Facebook

---

## 📊 Diferenças entre Personal e Business

### Instagram Basic Display API:
- Para contas pessoais
- Acesso limitado a dados básicos
- Não permite publicação

### Instagram Business API:
- Requer conta Business/Creator
- Acesso completo a insights
- Permite publicação de conteúdo
- Gerenciamento de comentários/mensagens

---

## 🔐 Segurança

1. **NUNCA** exponha o App Secret no frontend
2. **SEMPRE** valide tokens no backend
3. **USE** HTTPS em produção
4. **IMPLEMENTE** renovação automática de tokens
5. **ARMAZENE** tokens de forma segura (criptografados)

---

## 📝 Checklist Final

- [ ] App Facebook criado e configurado
- [ ] Instagram Product adicionado ao App
- [ ] URIs de redirecionamento configuradas
- [ ] Credenciais salvas no `.env.local`
- [ ] Configurações salvas no painel admin
- [ ] Conta Instagram Business conectada
- [ ] Teste de conexão bem-sucedido
- [ ] Permissões necessárias aprovadas (se aplicável)
- [ ] Token de longa duração obtido
- [ ] Renovação automática configurada

---

## 🚀 Próximos Passos

1. **Desenvolvimento**: Teste todas as funcionalidades com conta de teste
2. **Revisão do App**: Solicite permissões avançadas se necessário
3. **Produção**: Mude App Mode para "Live"
4. **Monitoramento**: Configure webhooks para eventos em tempo real