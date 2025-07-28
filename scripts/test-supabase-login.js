const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://unfdlpzcdalzvrjueanu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuZmRscHpjZGFsenZyanVlYW51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTMyMjcsImV4cCI6MjA2ODY2OTIyN30.DNcGoFQ6dgjUDXZhDo1HknprDAwguEJdZPH4tNcNIrg'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testLogin() {
  console.log('🔍 Testing Supabase Authentication...\n')
  
  try {
    // Test login
    console.log('1. Attempting login with test credentials...')
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'admin@test.com',
      password: 'admin123'
    })

    if (loginError) {
      console.log('❌ Login failed:', loginError.message)
      return
    }

    console.log('✅ Login successful!')
    console.log('   User ID:', loginData.user.id)
    console.log('   Email:', loginData.user.email)
    console.log('   Access Token:', loginData.session.access_token.substring(0, 50) + '...')
    console.log('   Expires at:', new Date(loginData.session.expires_at * 1000))
    console.log('')

    // Test getting session
    console.log('2. Getting current session...')
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      console.log('❌ Session error:', sessionError.message)
    } else if (session) {
      console.log('✅ Session found!')
      console.log('   User:', session.user.email)
      console.log('   Expires:', new Date(session.expires_at * 1000))
    } else {
      console.log('⚠️  No active session')
    }
    console.log('')

    // Test getting user profile
    console.log('3. Getting user profile...')
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', loginData.user.id)
      .single()

    if (profileError) {
      console.log('❌ Profile error:', profileError.message)
    } else {
      console.log('✅ Profile found!')
      console.log('   Name:', profile.full_name)
      console.log('   Created:', profile.created_at)
    }
    console.log('')

    // Test logout
    console.log('4. Testing logout...')
    const { error: logoutError } = await supabase.auth.signOut()

    if (logoutError) {
      console.log('❌ Logout error:', logoutError.message)
    } else {
      console.log('✅ Logout successful!')
    }

    // Verify logout
    console.log('5. Verifying logout...')
    const { data: { session: afterLogout } } = await supabase.auth.getSession()
    
    if (afterLogout) {
      console.log('⚠️  Session still exists after logout')
    } else {
      console.log('✅ No session after logout - confirmed!')
    }

  } catch (error) {
    console.log('❌ Unexpected error:', error.message)
  }

  console.log('\n🏁 Test completed!')
}

testLogin()