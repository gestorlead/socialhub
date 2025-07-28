#!/usr/bin/env node

/**
 * Redis Rate Limiting Test Script
 * Tests Redis connection and rate limiting functionality
 */

const { redisManager, RedisRateLimiter } = require('../lib/redis-client')

async function testRedisConnection() {
  console.log('🚀 Testing Redis Connection and Rate Limiting...\n')
  
  try {
    // Test 1: Basic Connection
    console.log('1️⃣ Testing Redis Connection...')
    const connected = await redisManager.connect()
    if (connected) {
      console.log('✅ Redis connected successfully')
    } else {
      console.log('❌ Redis connection failed')
      return
    }
    
    // Test 2: Health Check
    console.log('\n2️⃣ Running Health Check...')
    const health = await redisManager.healthCheck()
    console.log(`   - Connected: ${health.connected ? '✅' : '❌'}`)
    console.log(`   - Ping: ${health.ping ? '✅' : '❌'}`)
    console.log(`   - Set/Get: ${health.setGet ? '✅' : '❌'}`)
    if (health.error) {
      console.log(`   - Error: ${health.error}`)
    }
    
    // Test 3: Rate Limiting
    console.log('\n3️⃣ Testing Rate Limiting...')
    const testKey = `test:${Date.now()}`
    const limit = 5
    const windowSeconds = 60
    
    console.log(`   Testing with key: ${testKey}`)
    console.log(`   Limit: ${limit} requests per ${windowSeconds} seconds`)
    
    // Make multiple requests to test rate limiting
    for (let i = 1; i <= 7; i++) {
      const result = await RedisRateLimiter.increment(testKey, windowSeconds, limit)
      const status = result.allowed ? '✅ ALLOWED' : '❌ BLOCKED'
      console.log(`   Request ${i}: ${status} (${result.count}/${result.limit}, remaining: ${result.remaining})`)
      
      // Add small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // Test 4: Clear Rate Limits
    console.log('\n4️⃣ Testing Rate Limit Clearing...')
    const cleared = await RedisRateLimiter.clear(`${testKey}:*`)
    console.log(`   Clear operation: ${cleared ? '✅ SUCCESS' : '❌ FAILED'}`)
    
    // Test 5: Verify Clearing
    console.log('\n5️⃣ Verifying Rate Limit Reset...')
    const resetResult = await RedisRateLimiter.increment(testKey, windowSeconds, limit)
    const resetStatus = resetResult.count === 1 ? '✅ RESET SUCCESS' : '❌ RESET FAILED'
    console.log(`   After reset: ${resetStatus} (count: ${resetResult.count})`)
    
    // Clean up
    await RedisRateLimiter.clear(`${testKey}:*`)
    
    console.log('\n🎉 All tests completed successfully!')
    
  } catch (error) {
    console.error('\n🔴 Test failed:', error.message)
    console.error('Stack trace:', error.stack)
  } finally {
    // Disconnect
    await redisManager.disconnect()
    console.log('\n👋 Redis disconnected')
  }
}

// Handle script execution
if (require.main === module) {
  testRedisConnection()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Script execution failed:', error)
      process.exit(1)
    })
}

module.exports = { testRedisConnection }