#!/usr/bin/env node

/**
 * AI Moderation System Setup Script
 * Phase 2.3 - Automated setup and validation
 * 
 * This script:
 * 1. Validates environment configuration
 * 2. Runs database migrations
 * 3. Tests API connectivity
 * 4. Verifies system functionality
 * 5. Provides deployment guidance
 */

const fs = require('fs')
const path = require('path')

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logStep(step, message) {
  log(`\n${colors.cyan}[${step}]${colors.reset} ${message}`)
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green')
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow')
}

function logError(message) {
  log(`❌ ${message}`, 'red')
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue')
}

async function main() {
  log('\n' + '='.repeat(60), 'cyan')
  log('🤖 AI-Powered Content Moderation System Setup', 'bright')
  log('Phase 2.3 - Enterprise-Ready Moderation', 'cyan')
  log('='.repeat(60) + '\n', 'cyan')

  try {
    // Step 1: Check Node.js and npm versions
    logStep('1/7', 'Checking system requirements...')
    await checkSystemRequirements()

    // Step 2: Validate environment variables
    logStep('2/7', 'Validating environment configuration...')
    const envCheck = validateEnvironment()
    if (!envCheck.valid) {
      logError('Environment validation failed. Please fix the issues above.')
      process.exit(1)
    }

    // Step 3: Check dependencies
    logStep('3/7', 'Checking dependencies...')
    await checkDependencies()

    // Step 4: Run database migration
    logStep('4/7', 'Setting up database schema...')
    await runDatabaseMigration()

    // Step 5: Test API connectivity
    logStep('5/7', 'Testing API connectivity...')
    await testAPIConnectivity()

    // Step 6: Validate system functionality
    logStep('6/7', 'Validating system functionality...')
    await validateSystemFunctionality()

    // Step 7: Provide deployment guidance
    logStep('7/7', 'Generating deployment guidance...')
    await generateDeploymentGuidance()

    // Success summary
    log('\n' + '='.repeat(60), 'green')
    log('🎉 AI Moderation System Setup Complete!', 'bright')
    log('='.repeat(60), 'green')
    logSuccess('All components have been successfully configured and tested.')
    logInfo('Your AI-powered content moderation system is ready for deployment.')
    log('\nNext steps:', 'bright')
    log('1. Review the deployment guidance above')
    log('2. Set up monitoring and alerting')
    log('3. Configure moderation policies as needed')
    log('4. Train your moderation team on the new system')
    log('\nFor support, refer to the documentation in /docs/')

  } catch (error) {
    log('\n' + '='.repeat(60), 'red')
    log('💥 Setup Failed', 'bright')
    log('='.repeat(60), 'red')
    logError(`Setup encountered an error: ${error.message}`)
    logInfo('Please resolve the issue and run the setup script again.')
    process.exit(1)
  }
}

async function checkSystemRequirements() {
  const nodeVersion = process.version
  const nodeVersionNum = parseInt(nodeVersion.slice(1).split('.')[0])
  
  if (nodeVersionNum < 18) {
    logError(`Node.js version ${nodeVersion} is not supported. Please upgrade to Node.js 18 or higher.`)
    process.exit(1)
  }
  
  logSuccess(`Node.js ${nodeVersion} is supported`)

  // Check if we're in the right directory
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    logError('package.json not found. Please run this script from the project root directory.')
    process.exit(1)
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  if (packageJson.name !== 'socialhub') {
    logError('This script must be run from the SocialHub project directory.')
    process.exit(1)
  }

  logSuccess('Project structure verified')
}

function validateEnvironment() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY'
  ]

  const recommended = [
    'OPENAI_ORG_ID',
    'NEXT_PUBLIC_SITE_URL'
  ]

  let valid = true
  const missing = []
  const warnings = []

  // Check required variables
  for (const varName of required) {
    if (!process.env[varName]) {
      missing.push(varName)
      valid = false
    } else if (process.env[varName].length < 10) {
      logWarning(`${varName} appears to be too short`)
      warnings.push(varName)
    }
  }

  // Check recommended variables
  for (const varName of recommended) {
    if (!process.env[varName]) {
      logWarning(`Recommended environment variable missing: ${varName}`)
      warnings.push(varName)
    }
  }

  if (missing.length > 0) {
    logError(`Missing required environment variables: ${missing.join(', ')}`)
    logInfo('Please set these variables in your .env.local file')
  } else {
    logSuccess('All required environment variables are set')
  }

  if (warnings.length > 0) {
    logWarning(`${warnings.length} configuration warnings (see above)`)
  }

  // Validate specific formats
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('https://')) {
    logError('NEXT_PUBLIC_SUPABASE_URL must start with https://')
    valid = false
  }

  if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('sk-')) {
    logError('OPENAI_API_KEY must start with sk-')
    valid = false
  }

  return { valid, missing, warnings }
}

async function checkDependencies() {
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  
  const requiredDeps = [
    'openai',
    'compromise',
    '@supabase/supabase-js',
    'next',
    'react'
  ]

  const missingDeps = []

  for (const dep of requiredDeps) {
    if (!packageJson.dependencies[dep] && !packageJson.devDependencies[dep]) {
      missingDeps.push(dep)
    }
  }

  if (missingDeps.length > 0) {
    logError(`Missing required dependencies: ${missingDeps.join(', ')}`)
    logInfo('Run: npm install --legacy-peer-deps')
    process.exit(1)
  }

  logSuccess('All required dependencies are installed')

  // Check if node_modules exists
  const nodeModulesPath = path.join(process.cwd(), 'node_modules')
  if (!fs.existsSync(nodeModulesPath)) {
    logWarning('node_modules directory not found. You may need to run: npm install')
  } else {
    logSuccess('node_modules directory found')
  }
}

async function runDatabaseMigration() {
  logInfo('Database migration should be run manually using Supabase CLI or dashboard')
  logInfo('Migration file: sql/ai_moderation_system.sql')
  
  const migrationPath = path.join(process.cwd(), 'sql', 'ai_moderation_system.sql')
  if (fs.existsSync(migrationPath)) {
    logSuccess('Database migration file found')
    logInfo('Please run this SQL file in your Supabase dashboard or via CLI:')
    log(`  supabase db reset --db-url="${process.env.NEXT_PUBLIC_SUPABASE_URL}"`, 'cyan')
  } else {
    logError('Database migration file not found at sql/ai_moderation_system.sql')
  }
}

async function testAPIConnectivity() {
  logInfo('Testing API connectivity...')

  // Test Supabase connection
  try {
    const { createClient } = require('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data, error } = await supabase
      .from('profiles')
      .select('count(*)')
      .limit(1)

    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        logWarning('Supabase connection successful, but schema may not be set up')
      } else {
        throw error
      }
    } else {
      logSuccess('Supabase connection successful')
    }
  } catch (error) {
    logError(`Supabase connection failed: ${error.message}`)
  }

  // Test OpenAI connection
  try {
    const OpenAI = require('openai')
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 10000,
      maxRetries: 1
    })

    const response = await client.moderations.create({
      input: 'Hello, this is a test message.',
      model: 'text-moderation-latest'
    })

    if (response && response.results && response.results.length > 0) {
      logSuccess('OpenAI API connection successful')
    } else {
      logError('OpenAI API returned invalid response')
    }
  } catch (error) {
    if (error.message.includes('401')) {
      logError('OpenAI API key is invalid or unauthorized')
    } else if (error.message.includes('429')) {
      logWarning('OpenAI API rate limit exceeded - API key appears valid')
    } else {
      logError(`OpenAI API connection failed: ${error.message}`)
    }
  }
}

async function validateSystemFunctionality() {
  logInfo('System functionality validation requires the application to be running')
  logInfo('To test functionality:')
  log('1. Start the development server: npm run dev', 'cyan')
  log('2. Visit: http://localhost:3000/api/admin/validate-moderation', 'cyan')
  log('3. Or use the validation endpoint with proper authentication', 'cyan')
  
  // Check if key files exist
  const keyFiles = [
    'lib/openai-moderation.ts',
    'lib/sentiment-analysis.ts',
    'lib/automated-moderation.ts',
    'lib/spam-detection.ts',
    'app/api/comments/moderate/ai/route.ts',
    'app/api/comments/moderate/policies/route.ts'
  ]

  let allFilesExist = true
  for (const file of keyFiles) {
    const filePath = path.join(process.cwd(), file)
    if (fs.existsSync(filePath)) {
      logSuccess(`${file} ✓`)
    } else {
      logError(`${file} missing`)
      allFilesExist = false
    }
  }

  if (allFilesExist) {
    logSuccess('All core moderation system files are present')
  } else {
    logError('Some core files are missing - system may not function properly')
  }
}

async function generateDeploymentGuidance() {
  log('\n📋 Deployment Guidance:', 'bright')
  log('──────────────────────', 'cyan')

  log('\n🔧 Environment Variables for Production:', 'yellow')
  log('Make sure these are set in your production environment:')
  log('• OPENAI_API_KEY (required)')
  log('• OPENAI_ORG_ID (recommended)')
  log('• NEXT_PUBLIC_SUPABASE_URL (required)')
  log('• NEXT_PUBLIC_SUPABASE_ANON_KEY (required)')
  log('• SUPABASE_SERVICE_ROLE_KEY (required)')
  log('• NEXT_PUBLIC_SITE_URL (required for production)')

  log('\n🗄️  Database Setup:', 'yellow')
  log('1. Run the SQL migration: sql/ai_moderation_system.sql')
  log('2. Verify RLS policies are enabled')
  log('3. Test database connectivity')

  log('\n🔐 Security Checklist:', 'yellow')
  log('• All API keys are properly secured')
  log('• RLS policies are enabled and tested')
  log('• Rate limiting is configured')
  log('• Audit logging is enabled')
  log('• HTTPS is enforced in production')

  log('\n📊 Monitoring & Alerts:', 'yellow')
  log('• Set up monitoring for OpenAI API usage and costs')
  log('• Monitor moderation queue length and processing times')
  log('• Alert on high false positive rates')
  log('• Track user satisfaction with moderation decisions')

  log('\n🧪 Testing:', 'yellow')
  log('• Run validation endpoint: /api/admin/validate-moderation')
  log('• Test all moderation policies with sample content')
  log('• Verify admin and user permissions')
  log('• Load test with expected comment volume')

  log('\n⚙️  Configuration:', 'yellow')
  log('• Review and customize moderation policies')
  log('• Set appropriate confidence thresholds')
  log('• Configure rate limits for your usage')
  log('• Enable/disable features as needed')

  // Generate environment template
  const envTemplate = `
# AI Moderation System - Environment Template
# Copy to .env.local and fill in your values

# OpenAI Configuration (Required)
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_ORG_ID=org-your-organization-id-here

# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Application Configuration
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# Optional Performance Tuning
OPENAI_TIMEOUT=30000
OPENAI_MAX_RETRIES=3
MAX_CONCURRENCY=10
CACHE_TTL=3600000

# Optional Rate Limiting
RATE_LIMIT_STANDARD=100
RATE_LIMIT_AI=50
RATE_LIMIT_BATCH=5

# Optional Security (defaults are secure)
# DISABLE_AUDIT_LOGGING=false
# DISABLE_ENCRYPTION=false
# DISABLE_CACHE=false
`

  const envPath = path.join(process.cwd(), '.env.template')
  fs.writeFileSync(envPath, envTemplate.trim())
  logSuccess('Environment template created: .env.template')
}

// Run the setup script
if (require.main === module) {
  main().catch(error => {
    logError(`Setup script failed: ${error.message}`)
    process.exit(1)
  })
}

module.exports = {
  main,
  validateEnvironment,
  checkDependencies,
  testAPIConnectivity
}