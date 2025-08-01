import { SecureLogger } from './secure-logger'

/**
 * AI Moderation System Configuration Validator
 * Phase 2.3 - Environment validation and setup verification
 * 
 * Validates:
 * - OpenAI API configuration
 * - Supabase database connection
 * - Required environment variables
 * - Service availability and connectivity
 * - Performance requirements
 */

export interface ModerationConfig {
  openai: {
    apiKey: string
    orgId?: string
    baseUrl?: string
    timeout: number
    maxRetries: number
  }
  supabase: {
    url: string
    anonKey: string
    serviceRoleKey: string
  }
  performance: {
    cacheEnabled: boolean
    cacheTTL: number
    maxConcurrency: number
    rateLimits: {
      standard: number
      ai: number
      batch: number
    }
  }
  security: {
    auditLogging: boolean
    encryptionEnabled: boolean
    rlsEnabled: boolean
  }
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  config: Partial<ModerationConfig>
  recommendations: string[]
}

/**
 * Comprehensive configuration validator
 */
export class ModerationConfigValidator {
  private static instance: ModerationConfigValidator
  
  public static getInstance(): ModerationConfigValidator {
    if (!ModerationConfigValidator.instance) {
      ModerationConfigValidator.instance = new ModerationConfigValidator()
    }
    return ModerationConfigValidator.instance
  }
  
  /**
   * Validate complete moderation system configuration
   */
  async validateConfiguration(): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      config: {},
      recommendations: []
    }
    
    try {
      // Validate environment variables
      const envValidation = this.validateEnvironmentVariables()
      result.errors.push(...envValidation.errors)
      result.warnings.push(...envValidation.warnings)
      
      // Validate OpenAI configuration
      const openaiValidation = await this.validateOpenAIConfiguration()
      result.errors.push(...openaiValidation.errors)
      result.warnings.push(...openaiValidation.warnings)
      if (openaiValidation.config) {
        result.config.openai = openaiValidation.config
      }
      
      // Validate Supabase configuration
      const supabaseValidation = await this.validateSupabaseConfiguration()
      result.errors.push(...supabaseValidation.errors)
      result.warnings.push(...supabaseValidation.warnings)
      if (supabaseValidation.config) {
        result.config.supabase = supabaseValidation.config
      }
      
      // Validate performance settings
      const performanceValidation = this.validatePerformanceConfiguration()
      result.warnings.push(...performanceValidation.warnings)
      result.config.performance = performanceValidation.config
      
      // Validate security settings
      const securityValidation = this.validateSecurityConfiguration()
      result.errors.push(...securityValidation.errors)
      result.warnings.push(...securityValidation.warnings)
      result.config.security = securityValidation.config
      
      // Generate recommendations
      result.recommendations = this.generateRecommendations(result)
      
      // Overall validation status
      result.valid = result.errors.length === 0
      
      // Log validation results
      await SecureLogger.log({
        level: result.valid ? 'INFO' : 'ERROR',
        category: 'CONFIG_VALIDATION',
        message: `Moderation system configuration validation ${result.valid ? 'passed' : 'failed'}`,
        details: {
          valid: result.valid,
          errorCount: result.errors.length,
          warningCount: result.warnings.length,
          recommendationCount: result.recommendations.length,
          errors: result.errors,
          warnings: result.warnings
        }
      })
      
      return result
      
    } catch (error) {
      result.valid = false
      result.errors.push(`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      
      await SecureLogger.log({
        level: 'ERROR',
        category: 'CONFIG_VALIDATION',
        message: 'Configuration validation encountered an error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      })
      
      return result
    }
  }
  
  /**
   * Validate environment variables
   */
  private validateEnvironmentVariables(): { errors: string[], warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Required environment variables
    const required = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'OPENAI_API_KEY'
    ]
    
    // Optional but recommended environment variables
    const recommended = [
      'OPENAI_ORG_ID',
      'NEXT_PUBLIC_SITE_URL'
    ]
    
    // Check required variables
    for (const varName of required) {
      if (!process.env[varName]) {
        errors.push(`Missing required environment variable: ${varName}`)
      } else if (process.env[varName]!.length < 10) {
        warnings.push(`Environment variable ${varName} appears to be too short`)
      }
    }
    
    // Check recommended variables
    for (const varName of recommended) {
      if (!process.env[varName]) {
        warnings.push(`Missing recommended environment variable: ${varName}`)
      }
    }
    
    // Validate format of specific variables
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('https://')) {
      errors.push('NEXT_PUBLIC_SUPABASE_URL must start with https://')
    }
    
    if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('sk-')) {
      errors.push('OPENAI_API_KEY must start with sk-')
    }
    
    return { errors, warnings }
  }
  
  /**
   * Validate OpenAI API configuration
   */
  private async validateOpenAIConfiguration(): Promise<{
    errors: string[]
    warnings: string[]
    config?: ModerationConfig['openai']
  }> {
    const errors: string[] = []
    const warnings: string[] = []
    
    if (!process.env.OPENAI_API_KEY) {
      errors.push('OpenAI API key not configured')
      return { errors, warnings }
    }
    
    const config: ModerationConfig['openai'] = {
      apiKey: process.env.OPENAI_API_KEY,
      orgId: process.env.OPENAI_ORG_ID,
      baseUrl: process.env.OPENAI_BASE_URL,
      timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000'),
      maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3')
    }
    
    try {
      // Test OpenAI API connectivity
      const OpenAI = require('openai')
      const client = new OpenAI({
        apiKey: config.apiKey,
        organization: config.orgId,
        timeout: 10000, // Short timeout for validation
        maxRetries: 1
      })
      
      // Test with a simple moderation request
      const testResponse = await client.moderations.create({
        input: 'Hello, this is a test message.',
        model: 'text-moderation-latest'
      })
      
      if (!testResponse || !testResponse.results || testResponse.results.length === 0) {
        errors.push('OpenAI API returned invalid response')
      } else {
        // API is working
        console.log('✅ OpenAI API connection validated successfully')
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      if (errorMessage.includes('401')) {
        errors.push('OpenAI API key is invalid or unauthorized')
      } else if (errorMessage.includes('429')) {
        warnings.push('OpenAI API rate limit exceeded during validation - API key appears valid')
      } else if (errorMessage.includes('timeout')) {
        warnings.push('OpenAI API connection timeout - check network connectivity')
      } else {
        warnings.push(`OpenAI API validation failed: ${errorMessage}`)
      }
    }
    
    // Validate configuration values
    if (config.timeout < 5000) {
      warnings.push('OpenAI timeout is very low (< 5 seconds) - may cause frequent failures')
    }
    
    if (config.maxRetries > 5) {
      warnings.push('OpenAI max retries is high (> 5) - may cause slow responses')
    }
    
    return { errors, warnings, config }
  }
  
  /**
   * Validate Supabase configuration
   */
  private async validateSupabaseConfiguration(): Promise<{
    errors: string[]
    warnings: string[]
    config?: ModerationConfig['supabase']
  }> {
    const errors: string[] = []
    const warnings: string[] = []
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      errors.push('Supabase configuration incomplete')
      return { errors, warnings }
    }
    
    const config: ModerationConfig['supabase'] = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
    }
    
    try {
      // Test Supabase connectivity
      const { createClient } = require('@supabase/supabase-js')
      const supabase = createClient(config.url, config.serviceRoleKey)
      
      // Test connection with a simple query
      const { data, error } = await supabase
        .from('profiles')
        .select('count(*)')
        .limit(1)
      
      if (error) {
        if (error.message.includes('JWT')) {
          errors.push('Supabase service role key is invalid')
        } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
          warnings.push('Supabase database schema may not be fully set up')
        } else {
          warnings.push(`Supabase connection test failed: ${error.message}`)
        }
      } else {
        console.log('✅ Supabase connection validated successfully')
      }
      
      // Test moderation tables exist
      const { data: tables, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', ['moderation_policies', 'moderation_results', 'user_reputation_scores'])
      
      if (tableError) {
        warnings.push('Could not verify moderation table structure')
      } else {
        const tableNames = tables?.map(t => t.table_name) || []
        const requiredTables = ['moderation_policies', 'moderation_results', 'user_reputation_scores']
        const missingTables = requiredTables.filter(table => !tableNames.includes(table))
        
        if (missingTables.length > 0) {
          warnings.push(`Missing moderation tables: ${missingTables.join(', ')}. Run the SQL migration first.`)
        }
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      warnings.push(`Supabase validation failed: ${errorMessage}`)
    }
    
    return { errors, warnings, config }
  }
  
  /**
   * Validate performance configuration
   */
  private validatePerformanceConfiguration(): {
    warnings: string[]
    config: ModerationConfig['performance']
  } {
    const warnings: string[] = []
    
    const config: ModerationConfig['performance'] = {
      cacheEnabled: process.env.DISABLE_CACHE !== 'true',
      cacheTTL: parseInt(process.env.CACHE_TTL || '3600000'), // 1 hour default
      maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '10'),
      rateLimits: {
        standard: parseInt(process.env.RATE_LIMIT_STANDARD || '100'),
        ai: parseInt(process.env.RATE_LIMIT_AI || '50'),
        batch: parseInt(process.env.RATE_LIMIT_BATCH || '5')
      }
    }
    
    // Validate performance settings
    if (config.maxConcurrency > 20) {
      warnings.push('Max concurrency is very high (> 20) - may overwhelm APIs')
    }
    
    if (config.cacheTTL < 300000) { // 5 minutes
      warnings.push('Cache TTL is very low (< 5 minutes) - may increase API costs')
    }
    
    if (config.rateLimits.ai > 100) {
      warnings.push('AI rate limit is high (> 100/min) - ensure OpenAI quota supports this')
    }
    
    return { warnings, config }
  }
  
  /**
   * Validate security configuration
   */
  private validateSecurityConfiguration(): {
    errors: string[]
    warnings: string[]
    config: ModerationConfig['security']
  } {
    const errors: string[] = []
    const warnings: string[] = []
    
    const config: ModerationConfig['security'] = {
      auditLogging: process.env.DISABLE_AUDIT_LOGGING !== 'true',
      encryptionEnabled: process.env.DISABLE_ENCRYPTION !== 'true',
      rlsEnabled: true // Always enabled in our implementation
    }
    
    // Check security settings
    if (!config.auditLogging) {
      warnings.push('Audit logging is disabled - security compliance may be affected')
    }
    
    if (!config.encryptionEnabled) {
      warnings.push('Encryption is disabled - sensitive data may be at risk')
    }
    
    // Check for production environment settings
    if (process.env.NODE_ENV === 'production') {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('localhost')) {
        errors.push('Production environment using localhost Supabase URL')
      }
      
      if (!process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://')) {
        warnings.push('Production site URL should use HTTPS')
      }
    }
    
    return { errors, warnings, config }
  }
  
  /**
   * Generate configuration recommendations
   */
  private generateRecommendations(result: ValidationResult): string[] {
    const recommendations: string[] = []
    
    // OpenAI recommendations
    if (result.config.openai) {
      if (!result.config.openai.orgId) {
        recommendations.push('Consider setting OPENAI_ORG_ID for better API quotas and billing tracking')
      }
      
      if (result.config.openai.timeout > 60000) {
        recommendations.push('Consider reducing OpenAI timeout for better user experience')
      }
    }
    
    // Performance recommendations
    if (result.config.performance) {
      if (result.config.performance.maxConcurrency < 5) {
        recommendations.push('Consider increasing max concurrency for better throughput')
      }
      
      if (!result.config.performance.cacheEnabled) {
        recommendations.push('Enable caching to reduce API costs and improve performance')
      }
    }
    
    // Security recommendations
    if (result.config.security) {
      if (process.env.NODE_ENV === 'production') {
        recommendations.push('Regularly rotate API keys and monitor usage')
        recommendations.push('Set up monitoring and alerting for moderation failures')
        recommendations.push('Review and update moderation policies monthly')
      }
    }
    
    // General recommendations
    if (result.warnings.length > 0) {
      recommendations.push('Address configuration warnings to optimize system performance')
    }
    
    return recommendations
  }
  
  /**
   * Generate configuration summary for display
   */
  generateConfigSummary(result: ValidationResult): string {
    const lines: string[] = []
    
    lines.push('=== AI Moderation System Configuration ===')
    lines.push('')
    
    lines.push(`✅ Overall Status: ${result.valid ? 'VALID' : 'INVALID'}`)
    lines.push(`📊 Errors: ${result.errors.length}`)
    lines.push(`⚠️  Warnings: ${result.warnings.length}`)
    lines.push(`💡 Recommendations: ${result.recommendations.length}`)
    lines.push('')
    
    if (result.errors.length > 0) {
      lines.push('❌ ERRORS:')
      result.errors.forEach(error => lines.push(`   • ${error}`))
      lines.push('')
    }
    
    if (result.warnings.length > 0) {
      lines.push('⚠️  WARNINGS:')
      result.warnings.forEach(warning => lines.push(`   • ${warning}`))
      lines.push('')
    }
    
    if (result.recommendations.length > 0) {
      lines.push('💡 RECOMMENDATIONS:')
      result.recommendations.forEach(rec => lines.push(`   • ${rec}`))
      lines.push('')
    }
    
    // Configuration summary
    if (result.config.openai) {
      lines.push('🤖 OpenAI Configuration:')
      lines.push(`   • API Key: ${result.config.openai.apiKey ? '✅ Set' : '❌ Missing'}`)
      lines.push(`   • Org ID: ${result.config.openai.orgId ? '✅ Set' : '⚠️  Not set'}`)
      lines.push(`   • Timeout: ${result.config.openai.timeout}ms`)
      lines.push(`   • Max Retries: ${result.config.openai.maxRetries}`)
      lines.push('')
    }
    
    if (result.config.supabase) {
      lines.push('🗄️  Supabase Configuration:')
      lines.push(`   • URL: ${result.config.supabase.url}`)
      lines.push(`   • Service Key: ${result.config.supabase.serviceRoleKey ? '✅ Set' : '❌ Missing'}`)
      lines.push('')
    }
    
    if (result.config.performance) {
      lines.push('⚡ Performance Configuration:')
      lines.push(`   • Cache Enabled: ${result.config.performance.cacheEnabled ? '✅' : '❌'}`)
      lines.push(`   • Cache TTL: ${result.config.performance.cacheTTL / 1000}s`)
      lines.push(`   • Max Concurrency: ${result.config.performance.maxConcurrency}`)
      lines.push(`   • Rate Limits: AI=${result.config.performance.rateLimits.ai}/min, Batch=${result.config.performance.rateLimits.batch}/5min`)
      lines.push('')
    }
    
    if (result.config.security) {
      lines.push('🔒 Security Configuration:')
      lines.push(`   • Audit Logging: ${result.config.security.auditLogging ? '✅' : '❌'}`)
      lines.push(`   • Encryption: ${result.config.security.encryptionEnabled ? '✅' : '❌'}`)
      lines.push(`   • RLS Enabled: ${result.config.security.rlsEnabled ? '✅' : '❌'}`)
      lines.push('')
    }
    
    lines.push('==========================================')
    
    return lines.join('\n')
  }
}

// Export singleton instance
export const moderationConfigValidator = ModerationConfigValidator.getInstance()

// Export validation function for easy use
export async function validateModerationConfig(): Promise<ValidationResult> {
  return await moderationConfigValidator.validateConfiguration()
}