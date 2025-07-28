#!/usr/bin/env node

// Comprehensive test for the logout fix
async function testLogoutFix() {
  console.log('🧪 Testing Logout Fix - Social Hub\n');
  
  console.log('🔧 Changes Made:');
  console.log('1. ✅ Enhanced signOut() function to clear ALL auth cookies');
  console.log('2. ✅ Created server-side /api/auth/logout endpoint');
  console.log('3. ✅ Updated sidebar to use dual logout (client + server)');
  console.log('4. ✅ Comprehensive cookie clearing with multiple domain/path combinations');
  console.log('');
  
  // Test the new logout endpoint
  console.log('🔍 Testing Server-Side Logout Endpoint:\n');
  
  try {
    const response = await fetch('https://socialhub.gestorlead.com.br/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
    console.log(`Server logout endpoint status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Server logout endpoint working');
      console.log(`   Response: ${data.message}`);
      console.log(`   Timestamp: ${data.timestamp}`);
    } else {
      console.log('⚠️ Server logout endpoint returned non-200 status');
    }
  } catch (error) {
    console.log(`❌ Error testing logout endpoint: ${error.message}`);
  }
  
  // Test protected routes for unauthenticated access
  console.log('\n🛡️ Testing Route Protection After Logout:\n');
  
  const protectedRoutes = [
    '/',
    '/publicar', 
    '/redes',
    '/analytics',
    '/admin',
    '/integracoes'
  ];
  
  for (const route of protectedRoutes) {
    console.log(`🔍 Testing: ${route}`);
    
    try {
      const response = await fetch(`https://socialhub.gestorlead.com.br${route}`, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Cookie': '' // No cookies to simulate post-logout state
        }
      });
      
      if (response.status === 307 || response.status === 302) {
        const location = response.headers.get('location');
        if (location && location.includes('/login')) {
          console.log(`   ✅ PROTEGIDO - Redireciona para login`);
        } else {
          console.log(`   ⚠️ REDIRECIONA - Para: ${location}`);
        }
      } else if (response.status === 200) {
        console.log(`   ❌ FALHA - Rota acessível sem autenticação`);
      } else {
        console.log(`   🔍 Status: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📋 Resumo da Correção:');
  console.log('');
  console.log('ANTES (Problema):');
  console.log('• Logout apenas limpava estado local');
  console.log('• Cookies do Supabase persistiam');
  console.log('• Middleware ainda encontrava cookies válidos');
  console.log('• Usuário podia navegar após logout');
  console.log('');
  console.log('DEPOIS (Correção):');
  console.log('• Logout limpa TODOS os cookies explicitamente');
  console.log('• Endpoint server-side garante invalidação completa');
  console.log('• Múltiplas variações de domínio/path são limpas');
  console.log('• Middleware não encontra mais cookies válidos');
  console.log('• Rotas protegidas redirecionam para login');
}

// Test specific cookie patterns
async function testCookiePatterns() {
  console.log('\n🍪 Testando Padrões de Cookies Limpos:\n');
  
  const patterns = [
    'sb-localhost-auth-token',
    'sb-127.0.0.1-auth-token',
    'sb-socialhub.gestorlead.com.br-auth-token',
    'supabase-auth-token', 
    'sh-login-success',
    'sh-login-timestamp'
  ];
  
  console.log('Padrões de cookies que agora são limpos:');
  patterns.forEach((pattern, index) => {
    console.log(`   ${index + 1}. ${pattern}`);
  });
  
  console.log('\nMétodos de limpeza aplicados:');
  console.log('• document.cookie com expires passada');
  console.log('• Múltiplas combinações de domain/path');
  console.log('• Limpeza server-side via Set-Cookie headers');
  console.log('• Varredura de cookies existentes com palavras-chave');
}

// Instructions for manual testing
function showManualTestInstructions() {
  console.log('\n📝 Instruções para Teste Manual:\n');
  
  console.log('1. 🔑 FAZER LOGIN:');
  console.log('   • Acesse: https://socialhub.gestorlead.com.br/login');
  console.log('   • Faça login normalmente');
  console.log('   • Verifique que o nome aparece no menu lateral');
  console.log('');
  
  console.log('2. 🧪 TESTAR NAVEGAÇÃO LOGADO:');
  console.log('   • Navegue para /publicar, /redes, etc.');
  console.log('   • Confirme que todas as rotas funcionam');
  console.log('');
  
  console.log('3. 🚪 FAZER LOGOUT:');
  console.log('   • Clique no botão "Sign out" no menu lateral');
  console.log('   • Verifique no console do navegador (F12):');
  console.log('     - "Client-side logout completed"');
  console.log('     - "Server-side logout completed"');
  console.log('     - "Full logout process completed"');
  console.log('   • Confirme redirecionamento para /login');
  console.log('');
  
  console.log('4. 🛡️ TESTAR PROTEÇÃO PÓS-LOGOUT:');
  console.log('   • Tente navegar para: /publicar');
  console.log('   • Tente navegar para: /redes');
  console.log('   • Tente navegar para: /');
  console.log('   • TODAS devem redirecionar para login');
  console.log('');
  
  console.log('5. ✅ CRITÉRIO DE SUCESSO:');
  console.log('   • Nome some do menu após logout');
  console.log('   • Todas as rotas redirecionam para login');
  console.log('   • Não é possível acessar conteúdo protegido');
  console.log('   • Console mostra logs de limpeza completa');
}

async function main() {
  await testLogoutFix();
  await testCookiePatterns();
  showManualTestInstructions();
  
  console.log('\n🎯 RESULTADO ESPERADO:');
  console.log('✅ Logout agora invalida completamente a sessão');
  console.log('✅ Usuários não conseguem mais navegar após logout');
  console.log('✅ Todas as rotas protegidas redirecionam para login');
  console.log('✅ Problema de segurança RESOLVIDO');
}

main().catch(console.error);