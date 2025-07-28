#!/usr/bin/env node

/**
 * Script to test session management and force logout functionality
 */

const API_BASE = 'http://localhost:3000'

async function makeRequest(path, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    })
    
    const data = await response.json()
    return { success: response.ok, data, status: response.status }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

async function checkCurrentSessions() {
  console.log('🔍 Checking current sessions...')
  const result = await makeRequest('/api/admin/auth/force-logout')
  
  if (result.success) {
    console.log(`✅ Found ${result.data.count} active sessions`)
    console.log(`📊 Recent sessions: ${result.data.recent_count}`)
    
    result.data.active_sessions.forEach((session, i) => {
      console.log(`  ${i + 1}. ${session.email} - Last sign in: ${session.last_sign_in_at} ${session.is_recent ? '(Recent)' : '(Old)'}`)
    })
  } else {
    console.log('❌ Failed to check sessions:', result.error || result.data?.error)
  }
  
  return result
}

async function getDetailedSessions() {
  console.log('\n🔍 Getting detailed session information...')
  const result = await makeRequest('/api/admin/auth/force-logout', {
    method: 'POST',
    body: JSON.stringify({ action: 'get_sessions' })
  })
  
  if (result.success) {
    console.log(`✅ Found ${result.data.count} total users`)
    
    result.data.sessions.forEach((session, i) => {
      console.log(`  ${i + 1}. ${session.email}`)
      console.log(`     Created: ${session.created_at}`)
      console.log(`     Last sign in: ${session.last_sign_in_at || 'Never'}`)
      console.log(`     Confirmed: ${session.confirmed_at || 'Not confirmed'}`)
      console.log(`     Anonymous: ${session.is_anonymous}`)
      console.log('')
    })
  } else {
    console.log('❌ Failed to get detailed sessions:', result.error || result.data?.error)
  }
  
  return result
}

async function forceLogoutAll() {
  console.log('\n🚪 Force logging out all users...')
  const result = await makeRequest('/api/admin/auth/force-logout', {
    method: 'POST',
    body: JSON.stringify({ action: 'logout_all' })
  })
  
  if (result.success) {
    console.log('✅ All users logged out successfully')
    console.log(`📅 Timestamp: ${result.data.timestamp}`)
  } else {
    console.log('❌ Failed to logout all users:', result.error || result.data?.error)
  }
  
  return result
}

async function logoutUser(email) {
  console.log(`\n🚪 Logging out user: ${email}`)
  const result = await makeRequest('/api/admin/auth/force-logout', {
    method: 'POST',
    body: JSON.stringify({ 
      action: 'logout_user',
      userEmail: email
    })
  })
  
  if (result.success) {
    console.log(`✅ User ${email} logged out successfully`)
    console.log(`📅 Timestamp: ${result.data.timestamp}`)
  } else {
    console.log(`❌ Failed to logout user ${email}:`, result.error || result.data?.error)
  }
  
  return result
}

async function testAuthMiddleware() {
  console.log('\n🔍 Testing auth middleware on protected route...')
  const result = await makeRequest('/publicar')
  
  console.log(`📊 Status: ${result.status}`)
  if (result.status === 200) {
    console.log('✅ Access granted - user is authenticated')
  } else if (result.status === 401 || result.status === 403) {
    console.log('🔒 Access denied - user is not authenticated')
  } else if (result.status === 302 || result.status === 307) {
    console.log('🔄 Redirect response - likely redirecting to login')
  } else {
    console.log(`❓ Unexpected status: ${result.status}`)
  }
  
  return result
}

async function main() {
  console.log('🧪 Session Management Test Suite')
  console.log('================================\n')
  
  // Get command line argument
  const action = process.argv[2]
  const userEmail = process.argv[3]
  
  switch (action) {
    case 'check':
      await checkCurrentSessions()
      break
      
    case 'detailed':
      await getDetailedSessions()
      break
      
    case 'logout-all':
      await checkCurrentSessions()
      await forceLogoutAll()
      await checkCurrentSessions()
      break
      
    case 'logout-user':
      if (!userEmail) {
        console.log('❌ Please provide user email: node test-session-management.js logout-user email@example.com')
        process.exit(1)
      }
      await getDetailedSessions()
      await logoutUser(userEmail)
      await getDetailedSessions()
      break
      
    case 'test-auth':
      await testAuthMiddleware()
      break
      
    case 'full':
    default:
      // Full test suite
      await checkCurrentSessions()
      await getDetailedSessions()
      await testAuthMiddleware()
      
      // Ask user if they want to logout all
      if (process.argv.includes('--force-logout')) {
        await forceLogoutAll()
        await checkCurrentSessions()
        await testAuthMiddleware()
      }
      break
  }
  
  console.log('\n✅ Test completed')
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Session Management Test Script

Usage:
  node test-session-management.js [action] [options]

Actions:
  check                     - Check current sessions (quick)
  detailed                  - Get detailed session information
  logout-all               - Force logout all users
  logout-user <email>      - Logout specific user
  test-auth                - Test auth middleware
  full                     - Run full test suite (default)

Options:
  --force-logout           - Actually logout users in full test
  --help, -h               - Show this help

Examples:
  node test-session-management.js check
  node test-session-management.js logout-user sergio@gestorlead.com.br
  node test-session-management.js full --force-logout
`)
  process.exit(0)
}

main().catch(console.error)