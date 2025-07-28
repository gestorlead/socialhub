#!/usr/bin/env node

// Test main login functionality
const https = require('https');
const http = require('http');

async function testMainLogin() {
  console.log('🧪 Testing Main Login Page...\n');
  
  // Test 1: Check if login page loads
  console.log('1️⃣ Checking login page accessibility...');
  try {
    const response = await fetch('http://localhost:3001/login');
    if (response.ok) {
      console.log('✅ Login page loads successfully');
      console.log(`📊 Status: ${response.status} ${response.statusText}`);
    } else {
      console.log('❌ Login page failed to load');
      console.log(`📊 Status: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log('❌ Error accessing login page:', error.message);
  }
  
  // Test 2: Check if test-login still works for comparison
  console.log('\n2️⃣ Checking test-login page accessibility...');
  try {
    const response = await fetch('http://localhost:3001/test-login');
    if (response.ok) {
      console.log('✅ Test login page loads successfully');
    } else {
      console.log('❌ Test login page failed to load');
    }
  } catch (error) {
    console.log('❌ Error accessing test login page:', error.message);
  }
  
  // Test 3: Check main app redirect behavior
  console.log('\n3️⃣ Checking main app redirect behavior...');
  try {
    const response = await fetch('http://localhost:3001/', { redirect: 'manual' });
    console.log(`📊 Main app status: ${response.status}`);
    if (response.status === 302 || response.status === 307) {
      const location = response.headers.get('location');
      console.log(`🔄 Redirects to: ${location}`);
      if (location && location.includes('/login')) {
        console.log('✅ Properly redirects unauthenticated users to login');
      } else {
        console.log('⚠️ Unexpected redirect target');
      }
    } else {
      console.log('⚠️ Expected redirect but got:', response.status);
    }
  } catch (error) {
    console.log('❌ Error checking main app:', error.message);
  }
  
  console.log('\n🏁 Test completed. Manual browser testing recommended for full authentication flow.');
  console.log('📋 Next steps:');
  console.log('   1. Open: http://localhost:3001/login');
  console.log('   2. Use credentials: admin@test.com / admin123');
  console.log('   3. Submit form and verify redirect to main app');
}

// Check if server is running first
function checkServer() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3001/', (res) => {
      resolve(true);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log('🔍 Checking if server is running...');
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('❌ Server not running on port 3001');
    console.log('💡 Start the server with: npm run dev');
    process.exit(1);
  }
  
  console.log('✅ Server is running\n');
  await testMainLogin();
}

main().catch(console.error);