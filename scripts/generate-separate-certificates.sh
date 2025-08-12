#!/bin/bash

# Script para gerar certificados SSL separados para cada domínio

echo "=== Gerando certificados SSL separados ==="
echo ""

# Verificar se o certbot está instalado
if ! command -v certbot &> /dev/null; then
    echo "❌ Certbot não está instalado. Instalando..."
    sudo apt-get update
    sudo apt-get install -y certbot
fi

# 1. Gerar certificado para socialhub.gestorlead.com.br
echo "📜 Gerando certificado para socialhub.gestorlead.com.br..."
sudo certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email admin@gestorlead.com.br \
    --domains socialhub.gestorlead.com.br \
    --pre-hook "docker exec mailcowdockerized-nginx-mailcow-1 nginx -s stop 2>/dev/null || true" \
    --post-hook "docker exec mailcowdockerized-nginx-mailcow-1 nginx 2>/dev/null || true"

if [ $? -ne 0 ]; then
    echo "Tentando com webroot..."
    # Criar diretório webroot se não existir
    sudo mkdir -p /var/www/certbot
    
    # Usar método webroot alternativamente
    sudo certbot certonly \
        --webroot \
        --webroot-path /var/www/certbot \
        --non-interactive \
        --agree-tos \
        --email admin@gestorlead.com.br \
        --domains socialhub.gestorlead.com.br
fi

# Verificar se o certificado foi criado
if [ -d "/etc/letsencrypt/live/socialhub.gestorlead.com.br" ]; then
    echo "✅ Certificado para socialhub.gestorlead.com.br gerado com sucesso!"
    
    # 2. Copiar certificados para o container nginx
    echo ""
    echo "📦 Copiando certificados para o container nginx..."
    
    # Copiar certificado socialhub
    sudo docker cp /etc/letsencrypt/live/socialhub.gestorlead.com.br/fullchain.pem \
        mailcowdockerized-nginx-mailcow-1:/etc/ssl/mail/socialhub.gestorlead.com.br.crt
    
    sudo docker cp /etc/letsencrypt/live/socialhub.gestorlead.com.br/privkey.pem \
        mailcowdockerized-nginx-mailcow-1:/etc/ssl/mail/socialhub.gestorlead.com.br.key
    
    # Ajustar permissões
    docker exec mailcowdockerized-nginx-mailcow-1 sh -c "
        chmod 644 /etc/ssl/mail/socialhub.gestorlead.com.br.crt
        chmod 600 /etc/ssl/mail/socialhub.gestorlead.com.br.key
        chown root:root /etc/ssl/mail/socialhub.gestorlead.com.br.*
    "
    
    # Verificar se dev.gestorlead.com.br existe e copiar se necessário
    if [ -d "/etc/letsencrypt/live/dev.gestorlead.com.br" ]; then
        echo "📦 Atualizando certificado dev.gestorlead.com.br..."
        
        # Gerar certificado apenas para dev.gestorlead.com.br (sem socialhub)
        sudo certbot certonly \
            --standalone \
            --non-interactive \
            --agree-tos \
            --email admin@gestorlead.com.br \
            --domains dev.gestorlead.com.br \
            --cert-name dev.gestorlead.com.br-only \
            --pre-hook "docker exec mailcowdockerized-nginx-mailcow-1 nginx -s stop 2>/dev/null || true" \
            --post-hook "docker exec mailcowdockerized-nginx-mailcow-1 nginx 2>/dev/null || true"
        
        if [ -d "/etc/letsencrypt/live/dev.gestorlead.com.br-only" ]; then
            # Usar o novo certificado exclusivo
            sudo docker cp /etc/letsencrypt/live/dev.gestorlead.com.br-only/fullchain.pem \
                mailcowdockerized-nginx-mailcow-1:/etc/ssl/mail/dev.gestorlead.com.br.crt
            
            sudo docker cp /etc/letsencrypt/live/dev.gestorlead.com.br-only/privkey.pem \
                mailcowdockerized-nginx-mailcow-1:/etc/ssl/mail/dev.gestorlead.com.br.key
        else
            # Manter o certificado existente
            sudo docker cp /etc/letsencrypt/live/dev.gestorlead.com.br/fullchain.pem \
                mailcowdockerized-nginx-mailcow-1:/etc/ssl/mail/dev.gestorlead.com.br.crt
            
            sudo docker cp /etc/letsencrypt/live/dev.gestorlead.com.br/privkey.pem \
                mailcowdockerized-nginx-mailcow-1:/etc/ssl/mail/dev.gestorlead.com.br.key
        fi
        
        docker exec mailcowdockerized-nginx-mailcow-1 sh -c "
            chmod 644 /etc/ssl/mail/dev.gestorlead.com.br.crt
            chmod 600 /etc/ssl/mail/dev.gestorlead.com.br.key
            chown root:root /etc/ssl/mail/dev.gestorlead.com.br.*
        "
    fi
    
    # 3. Atualizar configuração nginx
    echo ""
    echo "🔧 Atualizando configuração nginx..."
    
    docker exec mailcowdockerized-nginx-mailcow-1 sh -c "
        # Backup das configurações
        cp /etc/nginx/conf.d/socialhub.gestorlead.conf /etc/nginx/conf.d/socialhub.gestorlead.conf.bak
        
        # Atualizar caminhos dos certificados
        sed -i 's|ssl_certificate /etc/ssl/mail/dev.gestorlead.com.br.crt;|ssl_certificate /etc/ssl/mail/socialhub.gestorlead.com.br.crt;|' /etc/nginx/conf.d/socialhub.gestorlead.conf
        sed -i 's|ssl_certificate_key /etc/ssl/mail/dev.gestorlead.com.br.key;|ssl_certificate_key /etc/ssl/mail/socialhub.gestorlead.com.br.key;|' /etc/nginx/conf.d/socialhub.gestorlead.conf
    "
    
    # 4. Testar e recarregar nginx
    echo ""
    echo "🔄 Testando configuração nginx..."
    docker exec mailcowdockerized-nginx-mailcow-1 nginx -t
    
    if [ $? -eq 0 ]; then
        echo "✅ Configuração válida. Recarregando nginx..."
        docker exec mailcowdockerized-nginx-mailcow-1 nginx -s reload
        
        # 5. Testar certificados
        echo ""
        echo "=== Verificando certificados ==="
        echo ""
        echo "🔍 Testando dev.gestorlead.com.br..."
        openssl s_client -connect dev.gestorlead.com.br:443 -servername dev.gestorlead.com.br </dev/null 2>/dev/null | \
            openssl x509 -noout -subject -dates | grep -E "subject=|notAfter="
        
        echo ""
        echo "🔍 Testando socialhub.gestorlead.com.br..."
        openssl s_client -connect socialhub.gestorlead.com.br:443 -servername socialhub.gestorlead.com.br </dev/null 2>/dev/null | \
            openssl x509 -noout -subject -dates | grep -E "subject=|notAfter="
        
        echo ""
        echo "✅ Certificados separados configurados com sucesso!"
        echo ""
        echo "📝 Resumo:"
        echo "  - dev.gestorlead.com.br: Certificado exclusivo"
        echo "  - socialhub.gestorlead.com.br: Certificado exclusivo"
        echo ""
        echo "🔄 Renovação automática:"
        echo "  Execute 'sudo certbot renew' periodicamente ou configure um cron job."
        
    else
        echo "❌ Erro na configuração nginx. Restaurando backup..."
        docker exec mailcowdockerized-nginx-mailcow-1 sh -c "
            mv /etc/nginx/conf.d/socialhub.gestorlead.conf.bak /etc/nginx/conf.d/socialhub.gestorlead.conf
            nginx -s reload
        "
        exit 1
    fi
else
    echo "❌ Erro ao gerar certificado para socialhub.gestorlead.com.br"
    echo "Verifique se o domínio está apontando para este servidor e a porta 80 está acessível."
    exit 1
fi