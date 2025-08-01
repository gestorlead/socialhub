# Configuração do App Facebook para Social Hub

## Erro: "O domínio dessa URL não está incluído nos domínios do app"

Este erro ocorre quando o domínio do seu site não está configurado corretamente no Facebook Developer Console.

## Passos para Resolver

### 1. Acesse o Facebook Developer Console
- Vá para [https://developers.facebook.com](https://developers.facebook.com)
- Faça login com sua conta do Facebook
- Selecione seu app (App ID: 1793146754879347)

### 2. Configure os Domínios do App

#### Na seção "Configurações" > "Básico":
1. **Domínios do app**: Adicione:
   ```
   socialhub.gestorlead.com.br
   ```

2. **URL do site**: Adicione:
   ```
   https://socialhub.gestorlead.com.br
   ```

#### Na seção "Produtos" > "Facebook Login" > "Configurações":
1. **URIs de redirecionamento OAuth válidos**: Adicione:
   ```
   https://socialhub.gestorlead.com.br/api/auth/facebook/callback
   ```

2. **Domínios permitidos para SDK JavaScript**: Adicione:
   ```
   https://socialhub.gestorlead.com.br
   ```

3. Certifique-se de que as seguintes opções estão habilitadas:
   - ✅ Login OAuth do cliente
   - ✅ Login OAuth da Web
   - ✅ Forçar HTTPS

### 3. Configure o Modo do App

Em "Configurações" > "Básico":
- Certifique-se de que o app está em modo "Produção" (não "Desenvolvimento")
- Se estiver em desenvolvimento, apenas testadores aprovados podem usar o app

### 4. Permissões Necessárias

Verifique se seu app tem acesso às seguintes permissões:
- `pages_show_list`
- `pages_read_engagement`
- `pages_read_user_content`
- `pages_manage_posts`
- `pages_manage_engagement`
- `business_management`

**Nota**: Algumas permissões podem requerer revisão do Facebook antes de serem usadas em produção.

### 5. Adicione Testadores (se necessário)

Se o app estiver em modo de desenvolvimento:
1. Vá para "Funções" > "Testadores"
2. Adicione os emails dos usuários que precisam testar
3. Os testadores precisam aceitar o convite

## Verificação no Social Hub

Após fazer essas configurações no Facebook:

1. Aguarde alguns minutos para as mudanças propagarem
2. Tente conectar novamente no Social Hub
3. Se o erro persistir, limpe o cache do navegador

## Troubleshooting

### Se ainda receber erro de domínio:
1. Verifique se digitou o domínio exatamente como aparece na URL
2. Não inclua "https://" ou barras no campo de domínios
3. Certifique-se de salvar as alterações no Facebook Developer Console

### Se receber erro de permissões:
1. Algumas permissões precisam de aprovação do Facebook
2. Para desenvolvimento, use contas de teste ou adicione usuários como testadores
3. Para produção, submeta o app para revisão do Facebook

## URLs Importantes

- **Facebook Developer Console**: https://developers.facebook.com/apps/1793146754879347
- **Documentação OAuth**: https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow
- **Permissões**: https://developers.facebook.com/docs/permissions/reference

## Contato para Suporte

Se precisar de ajuda adicional:
- Verifique o status do Facebook Platform: https://developers.facebook.com/status/
- Documentação oficial: https://developers.facebook.com/docs/facebook-login/