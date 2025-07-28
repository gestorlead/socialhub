#!/usr/bin/env node

// Test script to investigate the logout session invalidation issue
async function testLogoutIssue() {
  console.log('🔍 Testing Logout Session Invalidation Issue\n');
  
  // Test protected route access immediately after logout
  const testRoutes = [
    '/',
    '/publicar',
    '/redes',
    '/analytics'
  ];
  
  console.log('🧪 Simulating Post-Logout Navigation Test:\n');
  
  for (const route of testRoutes) {
    console.log(`🔍 Testing route: ${route}`);
    
    try {
      // Simulate request with mixed cookie state (some cleared, some not)
      const response = await fetch(`https://socialhub.gestorlead.com.br${route}`, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          // Simulate partial cookie state after client-side logout
          'Cookie': 'sh-login-success=; sh-login-timestamp=;'
        }
      });
      
      if (response.status === 307 || response.status === 302) {
        const location = response.headers.get('location');
        if (location && location.includes('/login')) {
          console.log(`   ✅ CORRETO - Redireciona para login após logout`);
        } else {
          console.log(`   ⚠️ SUSPEITO - Redireciona para: ${location}`);
        }
      } else if (response.status === 200) {
        console.log(`   ❌ FALHA CRÍTICA - Rota acessível após logout (Status 200)`);
      } else {
        console.log(`   🔍 Status inesperado: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📋 Cenário do Problema Reportado:');
  console.log('1. Usuário faz login → Sucesso');
  console.log('2. Usuário navega pelo sistema → Sucesso');
  console.log('3. Usuário clica em "Logout" → Nome desaparece do menu');
  console.log('4. Usuário tenta navegar para rota protegida → AINDA FUNCIONA');
  console.log('5. Isso indica que o logout não invalida a sessão no middleware');
  
  console.log('\n🔧 Possíveis Causas:');
  console.log('• signOut() não limpa todos os cookies necessários');
  console.log('• Middleware ainda encontra cookies de sessão válidos');
  console.log('• Falta de sincronização entre cliente e servidor após logout');
  console.log('• Cookies do Supabase não sendo limpos corretamente');
  
  console.log('\n💡 Soluções a Testar:');
  console.log('1. Melhorar a função signOut para limpar TODOS os cookies');
  console.log('2. Adicionar invalidação server-side da sessão');
  console.log('3. Forçar refresh completo da página após logout');
  console.log('4. Implementar endpoint de logout que limpe cookies server-side');
}

async function inspectMiddlewareLogic() {
  console.log('\n🔬 Análise da Lógica do Middleware:\n');
  
  console.log('Condições para isAuthenticated no middleware:');
  console.log('1. hasValidSession: session válida do Supabase');
  console.log('2. hasLoginSuccess + isRecentLogin: cookies de login + timestamp recente');
  console.log('');
  
  console.log('❌ PROBLEMA IDENTIFICADO:');
  console.log('Durante o logout:');
  console.log('• Cliente chama signOut() → limpa estado local');
  console.log('• Supabase.auth.signOut() → deveria limpar cookies');
  console.log('• MAS: cookies podem persistir ou não ser completamente limpos');
  console.log('• Middleware ainda vê cookies → permite acesso');
  console.log('');
  
  console.log('📝 Estado Esperado vs Real:');
  console.log('ESPERADO após logout:');
  console.log('  • hasValidSession: false');
  console.log('  • hasLoginSuccess: false (cookie limpo)');
  console.log('  • hasAuthCookies: false (todos limpos)');
  console.log('');
  console.log('REAL após logout (problema):');
  console.log('  • hasValidSession: talvez false');
  console.log('  • hasLoginSuccess: talvez false');
  console.log('  • hasAuthCookies: TRUE (cookies persistem!)');
  console.log('  • isAuthenticated: TRUE → problema!');
}

// Teste de cookies específico
async function testCookieLogic() {
  console.log('\n🍪 Teste da Lógica de Cookies:\n');
  
  console.log('Middleware verifica estes padrões de cookies:');
  const patterns = [
    'sb-[hostname]-auth-token',
    'sb-127.0.0.1-auth-token',
    'sb-localhost-auth-token', 
    'supabase-auth-token',
    'sh-login-success',
    'sh-login-timestamp'
  ];
  
  patterns.forEach(pattern => {
    console.log(`  • ${pattern}`);
  });
  
  console.log('\n❌ FALHA: signOut() pode não limpar TODOS estes padrões');
  console.log('✅ SOLUÇÃO: Logout deve limpar explicitamente cada padrão');
}

async function main() {
  await testLogoutIssue();
  await inspectMiddlewareLogic();
  await testCookieLogic();
  
  console.log('\n🎯 PRÓXIMOS PASSOS:');
  console.log('1. Melhorar função signOut para limpar todos os cookies');
  console.log('2. Adicionar endpoint /api/auth/logout server-side');
  console.log('3. Fazer logout invalidar sessão tanto no cliente quanto no servidor');
  console.log('4. Testar com força total de limpeza de cookies');
}

main().catch(console.error);