#!/bin/bash

# Script simplificado para configurar certificado separado para socialhub.gestorlead.com.br

echo "=== Configurando certificado SSL para socialhub.gestorlead.com.br ==="
echo ""

# 1. Gerar certificado usando certbot
echo "📜 Gerando certificado para socialhub.gestorlead.com.br..."
echo "   Isso irá parar temporariamente o nginx..."

sudo certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email admin@gestorlead.com.br \
    --domains socialhub.gestorlead.com.br \
    --pre-hook "docker exec mailcowdockerized-nginx-mailcow-1 nginx -s stop 2>/dev/null || true" \
    --post-hook "docker exec mailcowdockerized-nginx-mailcow-1 nginx 2>/dev/null || true"

# Verificar se foi bem sucedido
if [ ! -d "/etc/letsencrypt/live/socialhub.gestorlead.com.br" ]; then
    echo "❌ Falha ao gerar certificado."
    echo "   Certifique-se que:"
    echo "   - O domínio socialhub.gestorlead.com.br aponta para este servidor"
    echo "   - A porta 80 está acessível externamente"
    exit 1
fi

echo "✅ Certificado gerado com sucesso!"
echo ""

# 2. Copiar certificados para o container nginx
echo "📦 Copiando certificados para o container nginx..."

sudo docker cp /etc/letsencrypt/live/socialhub.gestorlead.com.br/fullchain.pem \
    mailcowdockerized-nginx-mailcow-1:/etc/ssl/mail/socialhub.gestorlead.com.br.crt

sudo docker cp /etc/letsencrypt/live/socialhub.gestorlead.com.br/privkey.pem \
    mailcowdockerized-nginx-mailcow-1:/etc/ssl/mail/socialhub.gestorlead.com.br.key

# 3. Ajustar permissões
echo "🔐 Ajustando permissões..."
docker exec mailcowdockerized-nginx-mailcow-1 sh -c "
    chmod 644 /etc/ssl/mail/socialhub.gestorlead.com.br.crt
    chmod 600 /etc/ssl/mail/socialhub.gestorlead.com.br.key
    chown root:root /etc/ssl/mail/socialhub.gestorlead.com.br.*
    ls -la /etc/ssl/mail/socialhub.gestorlead.com.br.*
"

# 4. Atualizar configuração nginx
echo ""
echo "🔧 Atualizando configuração nginx..."

docker exec mailcowdockerized-nginx-mailcow-1 sh -c "
    # Backup
    cp /etc/nginx/conf.d/socialhub.gestorlead.conf /etc/nginx/conf.d/socialhub.gestorlead.conf.bak
    
    # Atualizar certificados
    sed -i 's|ssl_certificate /etc/ssl/mail/dev.gestorlead.com.br.crt;|ssl_certificate /etc/ssl/mail/socialhub.gestorlead.com.br.crt;|' /etc/nginx/conf.d/socialhub.gestorlead.conf
    sed -i 's|ssl_certificate_key /etc/ssl/mail/dev.gestorlead.com.br.key;|ssl_certificate_key /etc/ssl/mail/socialhub.gestorlead.com.br.key;|' /etc/nginx/conf.d/socialhub.gestorlead.conf
    
    echo 'Configuração atualizada.'
"

# 5. Testar e recarregar
echo ""
echo "🔄 Testando configuração..."
docker exec mailcowdockerized-nginx-mailcow-1 nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração válida!"
    echo "🔄 Recarregando nginx..."
    docker exec mailcowdockerized-nginx-mailcow-1 nginx -s reload
    
    # Aguardar um momento
    sleep 2
    
    # Testar o certificado
    echo ""
    echo "=== Verificando certificado instalado ==="
    echo ""
    
    # Mostrar informações do certificado
    echo "📋 Informações do certificado socialhub.gestorlead.com.br:"
    openssl s_client -connect socialhub.gestorlead.com.br:443 -servername socialhub.gestorlead.com.br </dev/null 2>/dev/null | \
        openssl x509 -noout -text | grep -A 2 "Subject:" | sed 's/^/   /'
    
    openssl s_client -connect socialhub.gestorlead.com.br:443 -servername socialhub.gestorlead.com.br </dev/null 2>/dev/null | \
        openssl x509 -noout -text | grep -A 2 "Subject Alternative Name" | sed 's/^/   /'
    
    echo ""
    echo "✅ Certificado separado configurado com sucesso!"
    echo ""
    echo "📝 Notas importantes:"
    echo "   - socialhub.gestorlead.com.br agora usa seu próprio certificado"
    echo "   - dev.gestorlead.com.br continua com seu certificado original"
    echo "   - Para renovar: sudo certbot renew"
    echo ""
    
else
    echo "❌ Erro na configuração nginx!"
    echo "🔙 Restaurando configuração anterior..."
    docker exec mailcowdockerized-nginx-mailcow-1 sh -c "
        mv /etc/nginx/conf.d/socialhub.gestorlead.conf.bak /etc/nginx/conf.d/socialhub.gestorlead.conf
        nginx -s reload
    "
    exit 1
fi