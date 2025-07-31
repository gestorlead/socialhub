#!/bin/bash

# Script para testar permissões do Instagram Business API
# Substitua os valores abaixo pelos seus dados

ACCESS_TOKEN="IGAAaA4R6r1ZBBBZAE1HbjB2NnJRTDhUV3hRTV9USlNmcmgxREFXT09IXy01NmtGdjRsU01ndWhteW9aRVN2MkNjQml6Qk1YeFlmNjJkR3NCWjRfSjdPQnVIc3BpNmRoMmVITWplcTlydGFERTRuRXNRQVhR"
IG_BUSINESS_ACCOUNT_ID="30495922110053176"

echo "🚀 Iniciando testes de permissões do Instagram Business API..."
echo ""

# Test 1: instagram_business_manage_comments
echo "📝 Testando: instagram_business_manage_comments"
echo "Buscando posts recentes..."

# Primeiro, pegar um post recente
MEDIA_RESPONSE=$(curl -s -X GET \
  "https://graph.instagram.com/v18.0/${IG_BUSINESS_ACCOUNT_ID}/media?fields=id,caption&limit=1&access_token=${ACCESS_TOKEN}")

echo "Resposta media: $MEDIA_RESPONSE"

# Extrair o ID do primeiro post (você pode precisar instalar jq para isso funcionar automaticamente)
# MEDIA_ID=$(echo $MEDIA_RESPONSE | jq -r '.data[0].id')

# Se você não tem jq, pegue o ID manualmente da resposta acima e use:
# MEDIA_ID="SEU_MEDIA_ID_AQUI"

echo ""
echo "Para testar comentários, use o media_id da resposta acima:"
echo "curl -X GET \"https://graph.instagram.com/v18.0/MEDIA_ID/comments?fields=id,text,username&access_token=${ACCESS_TOKEN}\""

echo ""
echo "---"
echo ""

# Test 2: instagram_business_manage_insights
echo "📊 Testando: instagram_business_manage_insights"
curl -X GET \
  "https://graph.instagram.com/v18.0/${IG_BUSINESS_ACCOUNT_ID}/insights?metric=impressions,reach,profile_views&period=day&access_token=${ACCESS_TOKEN}"

echo ""
echo "---"
echo ""

# Test 3: instagram_business_content_publish
echo "📤 Testando: instagram_business_content_publish"
echo "Criando container de mídia de teste..."

curl -X POST \
  "https://graph.instagram.com/v18.0/${IG_BUSINESS_ACCOUNT_ID}/media" \
  -H "Content-Type: application/json" \
  -d "{
    \"image_url\": \"https://www.example.com/test-image.jpg\",
    \"caption\": \"Test caption for API permission test\",
    \"access_token\": \"${ACCESS_TOKEN}\"
  }"

echo ""
echo ""
echo "✨ Testes concluídos! As permissões devem estar disponíveis para solicitação em até 24 horas."
echo "ℹ️  Nota: É esperado um erro no teste de publicação pois usamos uma URL de imagem inválida."