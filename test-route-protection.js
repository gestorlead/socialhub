#!/usr/bin/env node

// Test route protection after security fix
const https = require('https');

async function testRouteProtection() {
  console.log('🛡️ Testing Route Protection After Security Fix\n');
  
  const testRoutes = [
    '/',
    '/admin',
    '/integracoes',
    '/redes',
    '/publicar',
    '/analytics'
  ];
  
  console.log('🧪 Testing production site: https://socialhub.gestorlead.com.br\n');
  
  for (const route of testRoutes) {
    console.log(`🔍 Testing route: ${route}`);
    
    try {
      const response = await fetch(`https://socialhub.gestorlead.com.br${route}`, {
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.status === 307 || response.status === 302) {
        const location = response.headers.get('location');
        if (location && location.includes('/login')) {
          console.log(`✅ ${route} - Properly protected (redirects to login)`);
        } else {
          console.log(`⚠️ ${route} - Redirects but not to login: ${location}`);
        }
      } else if (response.status === 200) {
        console.log(`❌ ${route} - NOT PROTECTED (returns 200)`);
      } else {
        console.log(`🔍 ${route} - Status: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`❌ ${route} - Error: ${error.message}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Test public routes that should NOT be protected
  console.log('\n🔓 Testing public routes (should be accessible):\n');
  
  const publicRoutes = [
    '/login',
    '/api/admin/validate-environment',
    '/api/admin/integrations/test-crypto'
  ];
  
  for (const route of publicRoutes) {
    console.log(`🔍 Testing public route: ${route}`);
    
    try {
      const response = await fetch(`https://socialhub.gestorlead.com.br${route}`, {
        redirect: 'manual'
      });
      
      if (response.status === 200) {
        console.log(`✅ ${route} - Accessible (returns 200)`);
      } else {
        console.log(`⚠️ ${route} - Status: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`❌ ${route} - Error: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 Summary:');
  console.log('✅ Protected routes should redirect to /login');
  console.log('✅ Public routes should return 200');
  console.log('⚠️ Any route returning 200 when it should be protected is a security issue');
  
  console.log('\n🔧 Security Fix Applied:');
  console.log('- Removed permissive authentication logic');
  console.log('- Now requires valid session OR recent login cookies');
  console.log('- No longer accepts just auth cookies without valid session');
}

testRouteProtection().catch(console.error);