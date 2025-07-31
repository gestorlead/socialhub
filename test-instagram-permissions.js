// Script para testar as permissões do Instagram Business API
// Execute com: node test-instagram-permissions.js

const ACCESS_TOKEN = 'IGAAaA4R6r1ZBBBZAE1HbjB2NnJRTDhUV3hRTV9USlNmcmgxREFXT09IXy01NmtGdjRsU01ndWhteW9aRVN2MkNjQml6Qk1YeFlmNjJkR3NCWjRfSjdPQnVIc3BpNmRoMmVITWplcTlydGFERTRuRXNRQVhR';
const IG_BUSINESS_ACCOUNT_ID = '30495922110053176';

async function testPermissions() {
  console.log('🚀 Iniciando testes de permissões do Instagram Business API...\n');

  // Test 1: instagram_business_manage_comments
  console.log('📝 Testando: instagram_business_manage_comments');
  try {
    // Primeiro, pegar um post recente
    const mediaResponse = await fetch(
      `https://graph.instagram.com/v18.0/${IG_BUSINESS_ACCOUNT_ID}/media?fields=id,caption&limit=1&access_token=${ACCESS_TOKEN}`
    );
    const mediaData = await mediaResponse.json();
    
    if (mediaData.data && mediaData.data.length > 0) {
      const mediaId = mediaData.data[0].id;
      
      // Tentar buscar comentários
      const commentsResponse = await fetch(
        `https://graph.instagram.com/v18.0/${mediaId}/comments?fields=id,text,username&access_token=${ACCESS_TOKEN}`
      );
      const commentsData = await commentsResponse.json();
      
      console.log('✅ Resposta:', JSON.stringify(commentsData, null, 2));
    } else {
      console.log('⚠️  Nenhuma mídia encontrada para testar comentários');
    }
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }

  console.log('\n---\n');

  // Test 2: instagram_business_manage_insights
  console.log('📊 Testando: instagram_business_manage_insights');
  try {
    const insightsResponse = await fetch(
      `https://graph.instagram.com/v18.0/${IG_BUSINESS_ACCOUNT_ID}/insights?metric=impressions,reach,profile_views&period=day&access_token=${ACCESS_TOKEN}`
    );
    const insightsData = await insightsResponse.json();
    
    console.log('✅ Resposta:', JSON.stringify(insightsData, null, 2));
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }

  console.log('\n---\n');

  // Test 3: instagram_business_content_publish
  console.log('📤 Testando: instagram_business_content_publish');
  try {
    // Criar um container de mídia (teste - não será publicado)
    const createMediaResponse = await fetch(
      `https://graph.instagram.com/v18.0/${IG_BUSINESS_ACCOUNT_ID}/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: 'https://www.example.com/test-image.jpg',
          caption: 'Test caption for API permission test',
          access_token: ACCESS_TOKEN
        })
      }
    );
    const createMediaData = await createMediaResponse.json();
    
    console.log('✅ Resposta:', JSON.stringify(createMediaData, null, 2));
    console.log('ℹ️  Nota: É esperado um erro aqui pois usamos uma URL de imagem inválida');
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }

  console.log('\n✨ Testes concluídos! As permissões devem estar disponíveis para solicitação em até 24 horas.');
}

// Executar os testes
testPermissions();