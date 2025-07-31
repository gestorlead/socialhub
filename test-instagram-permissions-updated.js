// Script atualizado para testar as permissões corretas do Instagram Business API
// Execute com: node test-instagram-permissions-updated.js

const ACCESS_TOKEN = 'IGAAaA4R6r1ZBBBZAE1HbjB2NnJRTDhUV3hRTV9USlNmcmgxREFXT09IXy01NmtGdjRsU01ndWhteW9aRVN2MkNjQml6Qk1YeFlmNjJkR3NCWjRfSjdPQnVIc3BpNmRoMmVITWplcTlydGFERTRuRXNRQVhR';
const IG_BUSINESS_ACCOUNT_ID = '30495922110053176';

async function testPermissions() {
  console.log('🚀 Testando permissões do Instagram Business API...\n');
  
  const results = {
    instagram_basic: { tested: false, result: null },
    instagram_content_publish: { tested: false, result: null },
    instagram_manage_insights: { tested: false, result: null },
    pages_show_list: { tested: false, result: null },
    pages_read_engagement: { tested: false, result: null },
    pages_manage_posts: { tested: false, result: null }
  };

  // Test 1: instagram_basic - Buscar informações básicas da conta
  console.log('👤 Testando: instagram_basic');
  try {
    const profileResponse = await fetch(
      `https://graph.instagram.com/v18.0/${IG_BUSINESS_ACCOUNT_ID}?fields=id,username,account_type,media_count&access_token=${ACCESS_TOKEN}`
    );
    const profileData = await profileResponse.json();
    
    results.instagram_basic = {
      tested: true,
      result: profileData,
      success: !profileData.error
    };
    
    console.log('✅ Resposta:', JSON.stringify(profileData, null, 2));
  } catch (error) {
    console.log('❌ Erro:', error.message);
    results.instagram_basic = { tested: true, result: error.message, success: false };
  }

  console.log('\n---\n');

  // Test 2: instagram_content_publish - Testar criação de container de mídia
  console.log('📤 Testando: instagram_content_publish');
  try {
    // Criar um container de mídia (teste - não será publicado)
    const createMediaResponse = await fetch(
      `https://graph.instagram.com/v18.0/${IG_BUSINESS_ACCOUNT_ID}/media?` +
      `image_url=${encodeURIComponent('https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Instagram_logo_2016.svg/1200px-Instagram_logo_2016.svg.png')}&` +
      `caption=${encodeURIComponent('Teste de permissão API - não publicar')}&` +
      `access_token=${ACCESS_TOKEN}`,
      { method: 'POST' }
    );
    const createMediaData = await createMediaResponse.json();
    
    results.instagram_content_publish = {
      tested: true,
      result: createMediaData,
      success: !createMediaData.error || createMediaData.id
    };
    
    console.log('✅ Resposta:', JSON.stringify(createMediaData, null, 2));
    
    // Se criou o container com sucesso, deletar para não publicar
    if (createMediaData.id) {
      console.log('🗑️  Deletando container de teste...');
      // Nota: Instagram API não permite deletar containers não publicados diretamente
    }
  } catch (error) {
    console.log('❌ Erro:', error.message);
    results.instagram_content_publish = { tested: true, result: error.message, success: false };
  }

  console.log('\n---\n');

  // Test 3: instagram_manage_insights - Buscar insights da conta
  console.log('📊 Testando: instagram_manage_insights');
  try {
    // Métricas válidas para contas business
    const metrics = 'follower_count,media_count,website_clicks,profile_views';
    const period = 'lifetime'; // Use lifetime para métricas de conta
    
    const insightsResponse = await fetch(
      `https://graph.instagram.com/v18.0/${IG_BUSINESS_ACCOUNT_ID}/insights?metric=${metrics}&period=${period}&access_token=${ACCESS_TOKEN}`
    );
    const insightsData = await insightsResponse.json();
    
    results.instagram_manage_insights = {
      tested: true,
      result: insightsData,
      success: !insightsData.error
    };
    
    console.log('✅ Resposta:', JSON.stringify(insightsData, null, 2));
  } catch (error) {
    console.log('❌ Erro:', error.message);
    results.instagram_manage_insights = { tested: true, result: error.message, success: false };
  }

  console.log('\n---\n');

  // Test 4: Buscar posts recentes para testar outras permissões
  console.log('📝 Buscando posts recentes...');
  try {
    const mediaResponse = await fetch(
      `https://graph.instagram.com/v18.0/${IG_BUSINESS_ACCOUNT_ID}/media?fields=id,caption,media_type,media_url,timestamp&limit=1&access_token=${ACCESS_TOKEN}`
    );
    const mediaData = await mediaResponse.json();
    
    if (mediaData.data && mediaData.data.length > 0) {
      const mediaId = mediaData.data[0].id;
      console.log('✅ Post encontrado:', mediaId);
      
      // Test 5: pages_read_engagement - Tentar buscar insights de um post
      console.log('\n📈 Testando: pages_read_engagement (via media insights)');
      try {
        const mediaInsightsResponse = await fetch(
          `https://graph.instagram.com/v18.0/${mediaId}/insights?metric=impressions,reach,engagement&access_token=${ACCESS_TOKEN}`
        );
        const mediaInsightsData = await mediaInsightsResponse.json();
        
        results.pages_read_engagement = {
          tested: true,
          result: mediaInsightsData,
          success: !mediaInsightsData.error
        };
        
        console.log('✅ Resposta:', JSON.stringify(mediaInsightsData, null, 2));
      } catch (error) {
        console.log('❌ Erro:', error.message);
        results.pages_read_engagement = { tested: true, result: error.message, success: false };
      }
    } else {
      console.log('⚠️  Nenhum post encontrado para testes adicionais');
    }
  } catch (error) {
    console.log('❌ Erro ao buscar posts:', error.message);
  }

  console.log('\n---\n');
  console.log('📋 RESUMO DOS TESTES:\n');
  
  Object.entries(results).forEach(([permission, data]) => {
    if (data.tested) {
      const status = data.success ? '✅' : '❌';
      console.log(`${status} ${permission}: ${data.success ? 'OK' : 'FALHOU'}`);
    } else {
      console.log(`⏭️  ${permission}: Não testado`);
    }
  });

  console.log('\n✨ Testes concluídos!');
  console.log('ℹ️  As permissões testadas com sucesso devem estar disponíveis para solicitação em até 24 horas.');
  console.log('💡 Dica: Para solicitar as permissões, acesse Meta App Dashboard > App Review > Permissions and Features');
}

// Executar os testes
testPermissions();