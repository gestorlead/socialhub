#!/bin/bash

# Script para gerar certificado SSL para socialhub.gestorlead.com.br

echo "=== Gerando certificado para socialhub.gestorlead.com.br ==="

# Adicionar o domínio socialhub.gestorlead.com.br ao mailcow ACME
docker exec -it mailcowdockerized-acme-mailcow-1 /bin/sh -c "
    # Criar diretório para o certificado se não existir
    mkdir -p /var/lib/acme/socialhub.gestorlead.com.br
    
    # Gerar certificado usando acme.sh
    acme.sh --issue -d socialhub.gestorlead.com.br \
            --webroot /var/www/acme/ \
            --keylength 4096 \
            --accountemail admin@gestorlead.com.br \
            --force
    
    # Copiar certificados para o local correto
    if [ -f /root/.acme.sh/socialhub.gestorlead.com.br/fullchain.cer ]; then
        cp /root/.acme.sh/socialhub.gestorlead.com.br/fullchain.cer /var/lib/acme/socialhub.gestorlead.com.br.crt
        cp /root/.acme.sh/socialhub.gestorlead.com.br/socialhub.gestorlead.com.br.key /var/lib/acme/socialhub.gestorlead.com.br.key
        chmod 644 /var/lib/acme/socialhub.gestorlead.com.br.crt
        chmod 600 /var/lib/acme/socialhub.gestorlead.com.br.key
        echo 'Certificado gerado com sucesso!'
    else
        echo 'Erro ao gerar certificado'
        exit 1
    fi
"

# Copiar certificados para o container nginx
echo "Copiando certificados para o nginx..."
docker exec mailcowdockerized-acme-mailcow-1 sh -c \
    "cp /var/lib/acme/socialhub.gestorlead.com.br.* /var/lib/acme/"

docker exec mailcowdockerized-nginx-mailcow-1 sh -c \
    "cp /var/lib/acme/socialhub.gestorlead.com.br.crt /etc/ssl/mail/ && \
     cp /var/lib/acme/socialhub.gestorlead.com.br.key /etc/ssl/mail/ && \
     chmod 644 /etc/ssl/mail/socialhub.gestorlead.com.br.crt && \
     chmod 600 /etc/ssl/mail/socialhub.gestorlead.com.br.key"

echo "Certificados copiados com sucesso!"