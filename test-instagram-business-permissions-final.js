// Script FINAL para testar as permissões CORRETAS do Instagram Business API
// Execute com: node test-instagram-business-permissions-final.js
// 
// PERMISSÕES OFICIAIS BASEADAS NA DOCUMENTAÇÃO:
// 1. instagram_business_basic - Conectar contas
// 2. instagram_business_content_publish - Publicar fotos/vídeos
// 3. instagram_business_manage_insights - Recuperar estatísticas

const ACCESS_TOKEN = 'IGAAaA4R6r1ZBBBZAE1HbjB2NnJRTDhUV3hRTV9USlNmcmgxREFXT09IXy01NmtGdjRsU01ndWhteW9aRVN2MkNjQml6Qk1YeFlmNjJkR3NCWjRfSjdPQnVIc3BpNmRoMmVITWplcTlydGFERTRuRXNRQVhR';
const IG_BUSINESS_ACCOUNT_ID = '30495922110053176';

async function testInstagramBusinessPermissions() {
  console.log('🚀 TESTE FINAL - Instagram Business API Permissions');
  console.log('📋 Permissões que serão testadas:');
  console.log('   1. instagram_business_basic');
  console.log('   2. instagram_business_content_publish');
  console.log('   3. instagram_business_manage_insights');
  console.log('   4. instagram_business_manage_comments (bonus)');
  console.log('');

  const results = {};

  // TEST 1: instagram_business_basic
  console.log('1️⃣ Testando: instagram_business_basic');
  console.log('   Função: Conectar contas de usuários e acessar dados básicos');
  try {
    const response = await fetch(
      `https://graph.instagram.com/v18.0/${IG_BUSINESS_ACCOUNT_ID}?fields=id,username,account_type,media_count,followers_count,follows_count,biography&access_token=${ACCESS_TOKEN}`
    );
    const data = await response.json();
    
    results.instagram_business_basic = {
      success: !data.error,
      response: data,
      endpoint: `/${IG_BUSINESS_ACCOUNT_ID}`,
      permission_needed: 'instagram_business_basic'
    };
    
    if (data.error) {
      console.log('   ❌ ERRO:', data.error.message);
    } else {
      console.log('   ✅ SUCESSO: Dados básicos obtidos');
      console.log(`   📊 Conta: @${data.username} (${data.account_type})`);
    }
  } catch (error) {
    console.log('   ❌ ERRO:', error.message);
    results.instagram_business_basic = { success: false, error: error.message };
  }

  console.log('');

  // TEST 2: instagram_business_content_publish
  console.log('2️⃣ Testando: instagram_business_content_publish');
  console.log('   Função: Publicar fotos e vídeos no Instagram');
  try {
    // Usar uma imagem válida e pública para o teste
    const testImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Instagram_logo_2022.svg/1200px-Instagram_logo_2022.svg.png';
    
    const response = await fetch(
      `https://graph.instagram.com/v18.0/${IG_BUSINESS_ACCOUNT_ID}/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: testImageUrl,
          caption: 'Teste de permissão Instagram Business API - NÃO PUBLICAR',
          access_token: ACCESS_TOKEN
        })
      }
    );
    const data = await response.json();
    
    results.instagram_business_content_publish = {
      success: !data.error && data.id,
      response: data,
      endpoint: `/${IG_BUSINESS_ACCOUNT_ID}/media`,
      permission_needed: 'instagram_business_content_publish'
    };
    
    if (data.error) {
      console.log('   ❌ ERRO:', data.error.message);
    } else if (data.id) {
      console.log('   ✅ SUCESSO: Container de mídia criado');
      console.log(`   📦 Container ID: ${data.id}`);
      console.log('   ⚠️  IMPORTANTE: Container criado mas NÃO publicado (como planejado)');
    }
  } catch (error) {
    console.log('   ❌ ERRO:', error.message);
    results.instagram_business_content_publish = { success: false, error: error.message };
  }

  console.log('');

  // TEST 3: instagram_business_manage_insights
  console.log('3️⃣ Testando: instagram_business_manage_insights');
  console.log('   Função: Recuperar estatísticas e insights da conta');
  try {
    // Usar métricas válidas para contas business
    const metrics = 'follower_count,profile_views';
    const period = 'lifetime';
    
    const response = await fetch(
      `https://graph.instagram.com/v18.0/${IG_BUSINESS_ACCOUNT_ID}/insights?metric=${metrics}&period=${period}&access_token=${ACCESS_TOKEN}`
    );
    const data = await response.json();
    
    results.instagram_business_manage_insights = {
      success: !data.error,
      response: data,
      endpoint: `/${IG_BUSINESS_ACCOUNT_ID}/insights`,
      permission_needed: 'instagram_business_manage_insights'
    };
    
    if (data.error) {
      console.log('   ❌ ERRO:', data.error.message);
      // Tentar com métricas mais básicas
      console.log('   🔄 Tentando com métricas básicas...');
      
      const basicResponse = await fetch(
        `https://graph.instagram.com/v18.0/${IG_BUSINESS_ACCOUNT_ID}/insights?metric=follower_count&period=lifetime&access_token=${ACCESS_TOKEN}`
      );
      const basicData = await basicResponse.json();
      
      if (!basicData.error) {
        console.log('   ✅ SUCESSO: Insights básicos obtidos');
        results.instagram_business_manage_insights.success = true;
        results.instagram_business_manage_insights.response = basicData;
      }
    } else {
      console.log('   ✅ SUCESSO: Insights obtidos');
      if (data.data && data.data.length > 0) {
        console.log(`   📈 Métricas disponíveis: ${data.data.length}`);
      }
    }
  } catch (error) {
    console.log('   ❌ ERRO:', error.message);
    results.instagram_business_manage_insights = { success: false, error: error.message };
  }

  console.log('');

  // TEST 4: instagram_business_manage_comments (Bonus)
  console.log('4️⃣ Testando: instagram_business_manage_comments (Bonus)');
  console.log('   Função: Gerenciar comentários dos posts');
  try {
    // Primeiro, tentar buscar posts
    const mediaResponse = await fetch(
      `https://graph.instagram.com/v18.0/${IG_BUSINESS_ACCOUNT_ID}/media?fields=id&limit=1&access_token=${ACCESS_TOKEN}`
    );
    const mediaData = await mediaResponse.json();
    
    if (mediaData.data && mediaData.data.length > 0) {
      const mediaId = mediaData.data[0].id;
      
      // Tentar buscar comentários
      const commentsResponse = await fetch(
        `https://graph.instagram.com/v18.0/${mediaId}/comments?fields=id,text,username&access_token=${ACCESS_TOKEN}`
      );
      const commentsData = await commentsResponse.json();
      
      results.instagram_business_manage_comments = {
        success: !commentsData.error,
        response: commentsData,
        endpoint: `/${mediaId}/comments`,
        permission_needed: 'instagram_business_manage_comments'
      };
      
      if (commentsData.error) {
        console.log('   ❌ ERRO:', commentsData.error.message);
      } else {
        console.log('   ✅ SUCESSO: API de comentários acessível');
      }
    } else {
      console.log('   ⚠️  Nenhum post encontrado para testar comentários');
      results.instagram_business_manage_comments = { success: false, note: 'Nenhum post encontrado' };
    }
  } catch (error) {
    console.log('   ❌ ERRO:', error.message);
    results.instagram_business_manage_comments = { success: false, error: error.message };
  }

  // RESUMO FINAL
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO FINAL DOS TESTES');
  console.log('='.repeat(60));

  const requiredPermissions = [
    'instagram_business_basic',
    'instagram_business_content_publish', 
    'instagram_business_manage_insights'
  ];

  let successCount = 0;
  
  requiredPermissions.forEach((permission, index) => {
    const result = results[permission];
    const status = result?.success ? '✅ APROVADO' : '❌ PENDENTE';
    console.log(`${index + 1}. ${permission}: ${status}`);
    if (result?.success) successCount++;
  });

  console.log('');
  console.log(`🎯 SCORE: ${successCount}/${requiredPermissions.length} permissões funcionando`);
  
  if (successCount === requiredPermissions.length) {
    console.log('🎉 PERFEITO! Todas as permissões principais estão funcionando!');
  } else {
    console.log('⏳ Algumas permissões ainda precisam de aprovação no Meta App Dashboard');
  }

  console.log('');
  console.log('📋 PRÓXIMOS PASSOS:');
  console.log('1. ⏰ Aguarde até 24 horas após estes testes');
  console.log('2. 🌐 Acesse: Meta for Developers > Seu App > App Review');
  console.log('3. 📝 Solicite estas permissões:');
  requiredPermissions.forEach(permission => {
    console.log(`   • ${permission}`);
  });
  console.log('4. 📄 Preencha os formulários explicando o uso de cada permissão');
  console.log('5. ✅ Aguarde aprovação do Meta (pode levar alguns dias)');
  
  console.log('');
  console.log('💡 DICA: Mencione que você está criando uma plataforma de gestão');
  console.log('   de redes sociais para empresas gerenciarem seus perfis Instagram.');

  return results;
}

// Executar os testes
testInstagramBusinessPermissions().catch(console.error);