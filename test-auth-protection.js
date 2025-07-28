#!/usr/bin/env node

// Teste de proteção de autenticação
async function testAuthProtection() {
  console.log('🛡️ Testando Proteção de Autenticação - Social Hub\n');
  
  // Testar rotas protegidas
  const protectedRoutes = [
    '/',
    '/admin',
    '/integracoes', 
    '/redes',
    '/publicar',
    '/analytics',
    '/analise'
  ];
  
  // Testar rotas públicas
  const publicRoutes = [
    '/login',
    '/api/admin/validate-environment',
    '/api/admin/integrations/test-crypto'
  ];
  
  console.log('🔐 Testando rotas protegidas (devem redirecionar para login):\n');
  
  for (const route of protectedRoutes) {
    console.log(`🔍 Testando: ${route}`);
    
    try {
      const response = await fetch(`https://socialhub.gestorlead.com.br${route}`, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (response.status === 307 || response.status === 302) {
        const location = response.headers.get('location');
        if (location && location.includes('/login')) {
          console.log(`   ✅ PROTEGIDO - Redireciona para login`);
        } else {
          console.log(`   ⚠️ REDIRECIONA - Mas não para login: ${location}`);
        }
      } else if (response.status === 200) {
        console.log(`   ❌ FALHA DE SEGURANÇA - Retorna 200 (acessível sem login)`);
      } else {
        console.log(`   🔍 Status inesperado: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }
    
    // Pausa pequena entre requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n🔓 Testando rotas públicas (devem ser acessíveis):\n');
  
  for (const route of publicRoutes) {
    console.log(`🔍 Testando: ${route}`);
    
    try {
      const response = await fetch(`https://socialhub.gestorlead.com.br${route}`, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
      
      if (response.status === 200) {
        console.log(`   ✅ PÚBLICO - Acessível (status 200)`);
      } else {
        console.log(`   ⚠️ Status: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 Resumo do Teste:');
  console.log('✅ Rotas protegidas devem redirecionar para /login');
  console.log('✅ Rotas públicas devem retornar status 200');
  console.log('❌ Qualquer rota protegida que retorna 200 é uma FALHA DE SEGURANÇA');
  
  console.log('\n💡 Instruções para teste manual:');
  console.log('1. Abra um navegador em modo incógnito');
  console.log('2. Acesse: https://socialhub.gestorlead.com.br/');
  console.log('3. Deve ser redirecionado para a página de login');
  console.log('4. Se acessar o dashboard diretamente = FALHA DE SEGURANÇA');
}

// Teste de cookies específico
async function testWithoutCookies() {
  console.log('\n🍪 Testando sem cookies (simulando usuário não autenticado):\n');
  
  try {
    const response = await fetch('https://socialhub.gestorlead.com.br/', {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Cookie': '' // Sem cookies
      }
    });
    
    console.log(`Status: ${response.status}`);
    
    if (response.status === 307 || response.status === 302) {
      const location = response.headers.get('location');
      console.log(`✅ CORRETO - Redireciona para: ${location}`);
    } else if (response.status === 200) {
      console.log(`❌ FALHA CRÍTICA - Dashboard acessível sem autenticação!`);
    }
    
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
  }
}

async function main() {
  await testAuthProtection();
  await testWithoutCookies();
  
  console.log('\n🎯 Conclusão:');
  console.log('Se todas as rotas protegidas redirecionam para login = 🛡️ SEGURO');
  console.log('Se alguma rota protegida retorna 200 = ❌ VULNERABILIDADE CRÍTICA');
}

main().catch(console.error);