#!/bin/bash

# Script para configurar corretamente os certificados SSL compartilhados
# O certificado contém ambos os domínios como SANs

echo "=== Configurando certificados SSL compartilhados ==="

# Criar links simbólicos no container para deixar claro que é um certificado compartilhado
docker exec mailcowdockerized-nginx-mailcow-1 sh -c "
    # Criar links simbólicos para socialhub apontando para o certificado compartilhado
    ln -sf /etc/ssl/mail/dev.gestorlead.com.br.crt /etc/ssl/mail/socialhub.gestorlead.com.br.crt
    ln -sf /etc/ssl/mail/dev.gestorlead.com.br.key /etc/ssl/mail/socialhub.gestorlead.com.br.key
    
    echo 'Links simbólicos criados:'
    ls -la /etc/ssl/mail/*.gestorlead.com.br.*
"

# Atualizar a configuração do nginx para socialhub usar seu próprio nome de certificado
echo "Atualizando configuração do nginx para socialhub..."

docker exec mailcowdockerized-nginx-mailcow-1 sh -c "
    # Fazer backup da configuração atual
    cp /etc/nginx/conf.d/socialhub.gestorlead.conf /etc/nginx/conf.d/socialhub.gestorlead.conf.bak
    
    # Atualizar os caminhos dos certificados
    sed -i 's|ssl_certificate /etc/ssl/mail/dev.gestorlead.com.br.crt;|ssl_certificate /etc/ssl/mail/socialhub.gestorlead.com.br.crt;|' /etc/nginx/conf.d/socialhub.gestorlead.conf
    sed -i 's|ssl_certificate_key /etc/ssl/mail/dev.gestorlead.com.br.key;|ssl_certificate_key /etc/ssl/mail/socialhub.gestorlead.com.br.key;|' /etc/nginx/conf.d/socialhub.gestorlead.conf
    
    echo 'Configuração atualizada.'
"

# Testar a configuração do nginx
echo "Testando configuração do nginx..."
docker exec mailcowdockerized-nginx-mailcow-1 nginx -t

if [ $? -eq 0 ]; then
    echo "Configuração válida. Recarregando nginx..."
    docker exec mailcowdockerized-nginx-mailcow-1 nginx -s reload
    echo "✅ Nginx recarregado com sucesso!"
    
    echo ""
    echo "=== Testando os certificados ==="
    echo "Verificando dev.gestorlead.com.br..."
    openssl s_client -connect dev.gestorlead.com.br:443 -servername dev.gestorlead.com.br </dev/null 2>/dev/null | openssl x509 -noout -subject
    
    echo "Verificando socialhub.gestorlead.com.br..."
    openssl s_client -connect socialhub.gestorlead.com.br:443 -servername socialhub.gestorlead.com.br </dev/null 2>/dev/null | openssl x509 -noout -subject
    
    echo ""
    echo "✅ Configuração concluída!"
    echo ""
    echo "NOTA: O certificado é compartilhado e contém ambos os domínios como SANs."
    echo "      O CN principal é 'dev.gestorlead.com.br', mas isso não afeta a validade."
else
    echo "❌ Erro na configuração do nginx. Restaurando backup..."
    docker exec mailcowdockerized-nginx-mailcow-1 sh -c "
        mv /etc/nginx/conf.d/socialhub.gestorlead.conf.bak /etc/nginx/conf.d/socialhub.gestorlead.conf
    "
    exit 1
fi