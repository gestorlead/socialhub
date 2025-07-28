#!/usr/bin/env node

/**
 * Script to verify auth protection is working correctly
 * This script simulates different authentication states
 */

const fs = require('fs')
const path = require('path')

// Simulate cookie clearing by creating a test script
function generateCookieClearingTest() {
  const testScript = `
<!DOCTYPE html>
<html>
<head>
    <title>Auth Test - Clear All Cookies</title>
</head>
<body>
    <h1>Authentication Cookie Test</h1>
    <div id="status">Testing...</div>
    
    <script>
        // Clear all possible authentication cookies
        const cookiePatterns = [
            'sb-localhost-auth-token',
            'sb-127.0.0.1-auth-token',
            'supabase-auth-token',
            'sh-login-success',
            'sh-login-timestamp'
        ];
        
        // Clear cookies for current domain
        cookiePatterns.forEach(pattern => {
            document.cookie = pattern + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
            console.log('Cleared cookie:', pattern);
        });
        
        // Clear cookies for localhost and 127.0.0.1
        const hosts = ['localhost', '127.0.0.1'];
        hosts.forEach(host => {
            document.cookie = 'sb-' + host + '-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + host;
        });
        
        // Clear all cookies that contain 'supabase' or 'auth'
        document.cookie.split(';').forEach(cookie => {
            const eqPos = cookie.indexOf('=');
            const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
            if (name.includes('supabase') || name.includes('auth') || name.includes('sb-')) {
                document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
                console.log('Cleared cookie:', name);
            }
        });
        
        document.getElementById('status').innerHTML = 
            '<h2>✅ All authentication cookies cleared!</h2>' +
            '<p>Now test accessing a protected route like <a href="/publicar">/publicar</a></p>' +
            '<p>You should be redirected to login if auth protection is working correctly.</p>' +
            '<button onclick="window.location.reload()">Clear Again</button> ' +
            '<button onclick="window.location.href=\\'/publicar\\'">Test Protected Route</button>';
    </script>
</body>
</html>
  `
  
  return testScript
}

function generateSessionTestPage() {
  const testPage = `
<!DOCTYPE html>
<html>
<head>
    <title>Session Test Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .button { background: #007cba; color: white; padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer; }
        .danger { background: #dc3545; }
        .success { background: #28a745; }
        .info { background: #17a2b8; }
        .result { margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px; }
        .loading { color: #007cba; }
        .error { color: #dc3545; }
    </style>
</head>
<body>
    <h1>🧪 Session Management Test Dashboard</h1>
    
    <div class="section">
        <h2>Current Session Status</h2>
        <button class="button info" onclick="checkSessions()">Check Current Sessions</button>
        <button class="button info" onclick="getDetailedSessions()">Get Detailed Sessions</button>
        <div id="session-result" class="result"></div>
    </div>
    
    <div class="section">
        <h2>Force Logout Actions</h2>
        <button class="button danger" onclick="forceLogoutAll()">Force Logout All Users</button>
        <button class="button danger" onclick="logoutSpecificUser()">Logout Specific User</button>
        <div id="logout-result" class="result"></div>
    </div>
    
    <div class="section">
        <h2>Cookie Management</h2>
        <button class="button" onclick="clearAllCookies()">Clear All Auth Cookies</button>
        <button class="button" onclick="showCookies()">Show Current Cookies</button>
        <div id="cookie-result" class="result"></div>
    </div>
    
    <div class="section">
        <h2>Auth Protection Test</h2>
        <button class="button success" onclick="testProtectedRoute()">Test Protected Route</button>
        <button class="button success" onclick="testPublicRoute()">Test Public Route</button>
        <div id="auth-result" class="result"></div>
    </div>

    <script>
        async function apiCall(endpoint, options = {}) {
            try {
                const response = await fetch(endpoint, {
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    },
                    ...options
                });
                
                const data = await response.json();
                return { success: response.ok, data, status: response.status };
            } catch (error) {
                return { success: false, error: error.message };
            }
        }

        async function checkSessions() {
            const result = document.getElementById('session-result');
            result.innerHTML = '<div class="loading">Checking sessions...</div>';
            
            const response = await apiCall('/api/admin/auth/force-logout');
            
            if (response.success) {
                result.innerHTML = \`
                    <strong>✅ Session Check Results:</strong><br>
                    Active Sessions: \${response.data.count}<br>
                    Recent Sessions: \${response.data.recent_count}<br>
                    <details>
                        <summary>Session Details</summary>
                        <pre>\${JSON.stringify(response.data.active_sessions, null, 2)}</pre>
                    </details>
                \`;
            } else {
                result.innerHTML = \`<div class="error">❌ Error: \${response.error || response.data?.error}</div>\`;
            }
        }

        async function getDetailedSessions() {
            const result = document.getElementById('session-result');
            result.innerHTML = '<div class="loading">Getting detailed sessions...</div>';
            
            const response = await apiCall('/api/admin/auth/force-logout', {
                method: 'POST',
                body: JSON.stringify({ action: 'get_sessions' })
            });
            
            if (response.success) {
                result.innerHTML = \`
                    <strong>✅ Detailed Sessions (\${response.data.count} total):</strong><br>
                    <details>
                        <summary>Full Session Data</summary>
                        <pre>\${JSON.stringify(response.data.sessions, null, 2)}</pre>
                    </details>
                \`;
            } else {
                result.innerHTML = \`<div class="error">❌ Error: \${response.error || response.data?.error}</div>\`;
            }
        }

        async function forceLogoutAll() {
            if (!confirm('Are you sure you want to logout ALL users? This will clear all authentication cookies.')) {
                return;
            }
            
            const result = document.getElementById('logout-result');
            result.innerHTML = '<div class="loading">Forcing logout of all users...</div>';
            
            const response = await apiCall('/api/admin/auth/force-logout', {
                method: 'POST',
                body: JSON.stringify({ action: 'logout_all' })
            });
            
            if (response.success) {
                result.innerHTML = \`<strong>✅ \${response.data.message}</strong><br>Timestamp: \${response.data.timestamp}\`;
                // Auto-refresh session status
                setTimeout(checkSessions, 1000);
            } else {
                result.innerHTML = \`<div class="error">❌ Error: \${response.error || response.data?.error}</div>\`;
            }
        }

        async function logoutSpecificUser() {
            const email = prompt('Enter user email to logout:');
            if (!email) return;
            
            const result = document.getElementById('logout-result');
            result.innerHTML = \`<div class="loading">Logging out user: \${email}...</div>\`;
            
            const response = await apiCall('/api/admin/auth/force-logout', {
                method: 'POST',
                body: JSON.stringify({ 
                    action: 'logout_user',
                    userEmail: email
                })
            });
            
            if (response.success) {
                result.innerHTML = \`<strong>✅ \${response.data.message}</strong>\`;
                setTimeout(getDetailedSessions, 1000);
            } else {
                result.innerHTML = \`<div class="error">❌ Error: \${response.error || response.data?.error}</div>\`;
            }
        }

        function clearAllCookies() {
            const result = document.getElementById('cookie-result');
            
            const cookiePatterns = [
                'sb-localhost-auth-token',
                'sb-127.0.0.1-auth-token',
                'supabase-auth-token',
                'sh-login-success',
                'sh-login-timestamp'
            ];
            
            let cleared = [];
            
            cookiePatterns.forEach(pattern => {
                document.cookie = pattern + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
                cleared.push(pattern);
            });
            
            // Clear any cookie containing auth-related keywords
            document.cookie.split(';').forEach(cookie => {
                const name = cookie.split('=')[0].trim();
                if (name.includes('supabase') || name.includes('auth') || name.includes('sb-')) {
                    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
                    cleared.push(name);
                }
            });
            
            result.innerHTML = \`<strong>✅ Cleared \${cleared.length} cookies:</strong><br>\${cleared.join(', ')}\`;
        }

        function showCookies() {
            const result = document.getElementById('cookie-result');
            const cookies = document.cookie.split(';').map(c => c.trim()).filter(c => c);
            
            if (cookies.length > 0) {
                result.innerHTML = \`
                    <strong>Current Cookies (\${cookies.length}):</strong><br>
                    <pre>\${cookies.join('\\n')}</pre>
                \`;
            } else {
                result.innerHTML = '<strong>No cookies found</strong>';
            }
        }

        async function testProtectedRoute() {
            const result = document.getElementById('auth-result');
            result.innerHTML = '<div class="loading">Testing protected route /publicar...</div>';
            
            try {
                const response = await fetch('/publicar', { redirect: 'manual' });
                
                if (response.status === 200) {
                    result.innerHTML = '✅ <strong>Access granted</strong> - User is authenticated';
                } else if (response.status === 302 || response.status === 307) {
                    const location = response.headers.get('location');
                    result.innerHTML = \`🔄 <strong>Redirected</strong> - Likely to login (Location: \${location})\`;
                } else if (response.status === 401 || response.status === 403) {
                    result.innerHTML = '🔒 <strong>Access denied</strong> - User is not authenticated';
                } else {
                    result.innerHTML = \`❓ <strong>Unexpected status:</strong> \${response.status}\`;
                }
            } catch (error) {
                result.innerHTML = \`<div class="error">❌ Error: \${error.message}</div>\`;
            }
        }

        async function testPublicRoute() {
            const result = document.getElementById('auth-result');
            result.innerHTML = '<div class="loading">Testing public route /login...</div>';
            
            try {
                const response = await fetch('/login');
                
                if (response.status === 200) {
                    result.innerHTML = '✅ <strong>Public route accessible</strong> - Working correctly';
                } else {
                    result.innerHTML = \`❓ <strong>Unexpected status for public route:</strong> \${response.status}\`;
                }
            } catch (error) {
                result.innerHTML = \`<div class="error">❌ Error: \${error.message}</div>\`;
            }
        }

        // Auto-load session status on page load
        window.onload = function() {
            checkSessions();
        };
    </script>
</body>
</html>
  `
  
  return testPage
}

function main() {
  console.log('🧪 Generating Authentication Test Tools')
  console.log('=====================================\n')
  
  // Create test directory
  const testDir = path.join(__dirname, '..', 'public', 'test-auth')
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
  }
  
  // Generate cookie clearing test
  const cookieTestPath = path.join(testDir, 'clear-cookies.html')
  fs.writeFileSync(cookieTestPath, generateCookieClearingTest())
  console.log('✅ Created cookie clearing test:', cookieTestPath)
  
  // Generate session test dashboard
  const sessionTestPath = path.join(testDir, 'session-dashboard.html')
  fs.writeFileSync(sessionTestPath, generateSessionTestPage())
  console.log('✅ Created session test dashboard:', sessionTestPath)
  
  console.log('\n📋 Test Instructions:')
  console.log('====================')
  console.log('1. Start your development server: npm run dev')
  console.log('2. Open in browser: http://localhost:3000/test-auth/session-dashboard.html')
  console.log('3. Test the current session status')
  console.log('4. Use "Clear All Auth Cookies" to simulate a logout')
  console.log('5. Test accessing protected routes to verify auth protection')
  console.log('6. Use force logout to clear server-side sessions\n')
  
  console.log('🔍 Manual Testing Steps:')
  console.log('========================')
  console.log('1. Check current session: Look for sergio@gestorlead.com.br')
  console.log('2. Clear cookies: Should remove client-side authentication')
  console.log('3. Test protected route: Should redirect to login if truly logged out')
  console.log('4. Force logout all: Should clear server-side sessions')
  console.log('5. Verify protection: Unauthenticated users should be blocked\n')
  
  console.log('🚨 Expected Behavior:')
  console.log('=====================')
  console.log('- Valid session = Access granted to protected routes')
  console.log('- No session + No cookies = Redirect to login')
  console.log('- After force logout = All users should be logged out')
  console.log('- Auth middleware should block truly unauthenticated users\n')
}

main()