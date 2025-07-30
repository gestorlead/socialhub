# Guia de Configuração do Facebook Login para Social Hub

## Informações de Preenchimento do Formulário

### 1. **Nome do App**
```
Social Hub - Gerenciador de Redes Sociais
```

### 2. **Categoria do App**
Selecione: **Business and Pages** ou **Productivity**

### 3. **Tipo de App**
Selecione: **Business**

### 4. **URLs de Redirecionamento OAuth Válidas**
```
https://socialhub.gestorlead.com.br/api/auth/facebook/callback
https://socialhub.gestorlead.com.br/api/auth/instagram/callback
https://www.socialhub.gestorlead.com.br/api/auth/facebook/callback
https://www.socialhub.gestorlead.com.br/api/auth/instagram/callback
http://localhost:3000/api/auth/facebook/callback (para desenvolvimento)
http://localhost:3000/api/auth/instagram/callback (para desenvolvimento)
```

### 5. **URLs de Desautorização**
```
https://socialhub.gestorlead.com.br/api/auth/facebook/deauth
http://localhost:3000/api/auth/facebook/deauth (para desenvolvimento)
```

### 6. **URLs de Exclusão de Dados**
```
https://socialhub.gestorlead.com.br/api/auth/facebook/delete
http://localhost:3000/api/auth/facebook/delete (para desenvolvimento)
```

### 7. **Domínios do App**
```
socialhub.gestorlead.com.br
gestorlead.com.br
localhost (para desenvolvimento)
```

### 8. **Política de Privacidade URL**
```
https://seu-dominio.com/privacy-policy
```

### 9. **Termos de Serviço URL**
```
https://seu-dominio.com/terms-of-service
```

### 10. **Descrição do App** (em inglês)
```
Social Hub is a comprehensive social media management platform that allows users 
to manage multiple social media accounts from a single dashboard. Our app enables 
users to schedule posts, analyze performance metrics, and manage content across 
Facebook, Instagram, and other social platforms efficiently.
```

### 11. **Descrição do App** (em português)
```
Social Hub é uma plataforma completa de gerenciamento de redes sociais que permite 
aos usuários gerenciar múltiplas contas de mídia social a partir de um único painel. 
Nosso aplicativo permite agendar publicações, analisar métricas de desempenho e 
gerenciar conteúdo em Facebook, Instagram e outras plataformas sociais de forma eficiente.
```

### 12. **Categoria de Negócios**
Selecione: **Apps and Technology** ou **Media/News/Publishing**

### 13. **Endereço de Email de Contato**
```
suporte@seu-dominio.com
```

### 14. **Ícone do App**
- Dimensões: 1024x1024 pixels
- Formato: PNG ou JPG
- Fundo: Preferencialmente sem transparência

### 15. **Configurações de Login**

#### Configurações de Login do Facebook:
- **Client OAuth Login**: SIM ✓
- **Web OAuth Login**: SIM ✓
- **Enforce HTTPS**: SIM ✓ (em produção)
- **Embedded Browser OAuth Login**: SIM ✓
- **Use Strict Mode for Redirect URIs**: SIM ✓

### 16. **Permissões Necessárias**

Para o Social Hub, você precisará solicitar as seguintes permissões:

#### Permissões Básicas (disponíveis imediatamente):
- `email`
- `public_profile`

#### Permissões Avançadas (requerem revisão do Facebook):
- `pages_show_list` - Listar páginas do usuário
- `pages_read_engagement` - Ler engajamento das páginas
- `pages_manage_posts` - Gerenciar posts nas páginas
- `pages_manage_metadata` - Gerenciar metadados das páginas
- `instagram_basic` - Acesso básico ao Instagram
- `instagram_manage_insights` - Insights do Instagram
- `instagram_content_publish` - Publicar conteúdo no Instagram
- `business_management` - Gerenciamento de negócios

### 17. **Webhooks (se aplicável)**

#### URL do Webhook:
```
https://seu-dominio.com/api/webhooks/facebook
```

#### Token de Verificação:
```
social-hub-webhook-verify-token-2024
```

### 18. **Configurações de Segurança**

- **App Secret**: Será gerado automaticamente pelo Facebook
- **Client Token**: Será gerado automaticamente
- **Require App Secret**: SIM ✓
- **Require 2-factor authentication**: Recomendado ativar

### 19. **Plataformas**

Adicione as seguintes plataformas:
- **Website** (URL: https://seu-dominio.com)
- **Server** (para chamadas server-side)

### 20. **Configurações Avançadas**

- **Native or desktop app**: NÃO
- **Is your app a test version**: NÃO (SIM para apps de desenvolvimento)
- **App Type**: Consumer
- **Business Verification**: Será necessário para usar certas APIs

## Próximos Passos Após o Preenchimento

1. **Salvar as Credenciais**:
   - App ID
   - App Secret
   - Client Token

2. **Configurar no Social Hub**:
   - Adicione as credenciais no arquivo `.env.local`
   - Configure as URLs de callback no código

3. **Solicitar Revisão de Permissões**:
   - Prepare screenshots do app
   - Grave vídeos demonstrando o uso
   - Escreva descrições detalhadas de como cada permissão é usada

4. **Implementar Tratamento de Dados**:
   - Endpoint de desautorização
   - Endpoint de exclusão de dados
   - Política de privacidade atualizada

## Notas Importantes

- **Desenvolvimento**: Use o App Mode "Development" inicialmente
- **Produção**: Mude para "Live" apenas após testes completos
- **Segurança**: NUNCA exponha o App Secret no frontend
- **HTTPS**: Obrigatório para produção
- **Revisão**: Permissões avançadas levam 5-10 dias úteis para aprovação

## Checklist de Verificação

- [ ] Todas as URLs estão corretas e acessíveis
- [ ] Política de Privacidade está publicada
- [ ] Termos de Serviço estão publicados
- [ ] Logo do app está no formato correto
- [ ] Descrições estão claras e precisas
- [ ] Domínios estão verificados
- [ ] HTTPS está configurado (produção)
- [ ] Webhooks estão funcionando (se aplicável)