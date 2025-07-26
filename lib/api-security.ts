import { NextRequest } from 'next/server'
import { getTranslations } from 'next-intl/server'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { supabase } from './supabase'

interface SecurityConfig {
  maxAPIKeys: number
  rateLimitHour: number
  rateLimitDay: number
  allowedPlatforms: string[]
  allowedScopes: string[]
}

export class SecureAPIManager {
  private static config: SecurityConfig = {
    maxAPIKeys: 10,
    rateLimitHour: 1000,
    rateLimitDay: 10000,
    allowedPlatforms: ['tiktok', 'instagram', 'facebook', 'youtube'],
    allowedScopes: ['read', 'publish', 'analytics', 'manage']
  }

  /**
   * Valida requisição de criação de API Key com tradução
   */
  static async validateAPIKeyRequest(
    data: unknown, 
    locale: string = 'pt'
  ): Promise<{ valid: boolean; error?: string; data?: any }> {
    const t = await getTranslations({ locale, namespace: 'validation' })
    
    const schema = z.object({
      name: z.string()
        .min(3, t('apiKey.name.minLength', { min: 3 }))
        .max(50, t('apiKey.name.maxLength', { max: 50 }))
        .regex(/^[a-zA-Z0-9\s-_]+$/, t('apiKey.name.invalidChars')),
      
      description: z.string()
        .max(200, t('apiKey.description.maxLength', { max: 200 }))
        .optional(),
      
      platforms: z.array(z.enum(['tiktok', 'instagram', 'facebook', 'youtube']))
        .min(1, t('apiKey.platforms.required'))
        .refine(
          (platforms) => platforms.every(p => this.config.allowedPlatforms.includes(p)),
          { message: t('apiKey.platforms.invalid') }
        ),
      
      scopes: z.array(z.enum(['read', 'publish', 'analytics', 'manage']))
        .min(1, t('apiKey.scopes.required'))
        .refine(
          (scopes) => scopes.every(s => this.config.allowedScopes.includes(s)),
          { message: t('apiKey.scopes.invalid') }
        ),
      
      expiresInDays: z.number()
        .int()
        .min(1, t('apiKey.expiry.minDays', { min: 1 }))
        .max(365, t('apiKey.expiry.maxDays', { max: 365 }))
        .optional(),
      
      rateLimitPerHour: z.number()
        .int()
        .min(1)
        .max(this.config.rateLimitHour)
        .optional(),
      
      allowedIPs: z.array(z.string().ip())
        .max(10, t('apiKey.ips.maxCount', { max: 10 }))
        .optional()
    })

    try {
      const validatedData = schema.parse(data)
      return { valid: true, data: validatedData }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0]
        return { valid: false, error: firstError.message }
      }
      return { valid: false, error: t('apiKey.validation.generic') }
    }
  }

  /**
   * Gera API Key segura
   */
  static generateSecureAPIKey(): string {
    const prefix = 'shub'
    const timestamp = Date.now().toString(36)
    const randomBytes = crypto.randomBytes(32).toString('hex')
    
    return `${prefix}_${timestamp}_${randomBytes}`
  }

  /**
   * Valida API Key com rate limiting e tradução de erros
   */
  static async validateAPIKey(
    request: NextRequest,
    requiredPlatform: string,
    requiredScope: string
  ): Promise<{
    valid: boolean
    user_id?: string
    api_key_id?: string
    error?: string
    needsReconnect?: boolean
  }> {
    const locale = this.getRequestLocale(request)
    const t = await getTranslations({ locale, namespace: 'errors' })
    
    try {
      // 1. Extrair e validar header
      const authHeader = request.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return { 
          valid: false, 
          error: t('apiKey.auth.missingHeader')
        }
      }
      
      const apiKey = authHeader.substring(7)
      if (!apiKey.startsWith('shub_')) {
        return { 
          valid: false, 
          error: t('apiKey.auth.invalidFormat')
        }
      }
      
      // 2. Verificar rate limit ANTES de consulta ao banco
      const rateLimitOk = await this.checkRateLimit(request, apiKey)
      if (!rateLimitOk) {
        return { 
          valid: false, 
          error: t('apiKey.auth.rateLimitExceeded')
        }
      }
      
      // 3. Buscar e validar API key no banco
      const { data: apiKeys } = await supabase
        .from('user_api_keys')
        .select('*')
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
      
      // 4. Encontrar key correta usando hash comparison
      let matchedKey = null
      for (const key of apiKeys || []) {
        const isMatch = await bcrypt.compare(apiKey, key.key_hash)
        if (isMatch) {
          matchedKey = key
          break
        }
      }
      
      if (!matchedKey) {
        return { 
          valid: false, 
          error: t('apiKey.auth.invalidOrExpired'),
          needsReconnect: true
        }
      }
      
      // 5. Validar permissões
      if (!matchedKey.platforms.includes(requiredPlatform)) {
        return { 
          valid: false, 
          error: t('apiKey.auth.platformNotAllowed', { platform: requiredPlatform })
        }
      }
      
      if (!matchedKey.scopes.includes(requiredScope)) {
        return { 
          valid: false, 
          error: t('apiKey.auth.scopeNotAllowed', { scope: requiredScope })
        }
      }
      
      // 6. Validar IP se restrito
      if (matchedKey.allowed_ips?.length > 0) {
        const clientIP = this.getClientIP(request)
        if (!matchedKey.allowed_ips.includes(clientIP)) {
          return { 
            valid: false, 
            error: t('apiKey.auth.ipNotAllowed')
          }
        }
      }
      
      // 7. Atualizar estatísticas de uso
      await this.updateAPIKeyUsage(matchedKey.id, request)
      
      return {
        valid: true,
        user_id: matchedKey.user_id,
        api_key_id: matchedKey.id
      }
      
    } catch (error) {
      console.error('API Key validation error:', error)
      return { 
        valid: false, 
        error: t('apiKey.auth.internalError')
      }
    }
  }

  /**
   * Rate limiting inteligente por endpoint
   */
  private static async checkRateLimit(
    request: NextRequest, 
    apiKey: string
  ): Promise<boolean> {
    const endpoint = request.nextUrl.pathname
    const now = new Date()
    const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours())
    
    // Rate limits específicos por tipo de endpoint
    const limits = {
      '/api/v1/*/publish': 100,     // Publicação: 100/hora
      '/api/v1/*/analytics': 1000,  // Analytics: 1000/hora
      '/api/v1/*/profile': 500,     // Perfil: 500/hora
      'default': 1000               // Padrão: 1000/hora
    }
    
    const limit = this.getEndpointLimit(endpoint, limits)
    
    // Simular incremento atômico (implementar com Redis ou PostgreSQL)
    const key = `rate_limit:${crypto.createHash('sha256').update(apiKey).digest('hex')}:${windowStart.getTime()}`
    
    const currentCount = await this.incrementRateLimit(key, limit)
    
    return currentCount <= limit
  }

  /**
   * Obtém limite específico para endpoint
   */
  private static getEndpointLimit(endpoint: string, limits: Record<string, number>): number {
    for (const [pattern, limit] of Object.entries(limits)) {
      if (pattern === 'default') continue
      
      const regex = new RegExp(pattern.replace(/\*/g, '[^/]+'))
      if (regex.test(endpoint)) {
        return limit
      }
    }
    
    return limits.default
  }

  /**
   * Implementar rate limiting (placeholder - usar Redis em produção)
   */
  private static async incrementRateLimit(key: string, limit: number): Promise<number> {
    // TODO: Implementar com Redis para produção
    // Por enquanto, simular sempre OK para desenvolvimento
    return Math.floor(Math.random() * (limit / 2))
  }

  /**
   * Extrai locale da requisição
   */
  private static getRequestLocale(request: NextRequest): string {
    const cookieLocale = request.cookies.get('PREFERRED_LOCALE')?.value
    const headerLocale = request.headers.get('accept-language')?.split(',')[0]?.split('-')[0]
    return cookieLocale || headerLocale || 'pt'
  }

  /**
   * Obtém IP do cliente com múltiplas verificações
   */
  private static getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const cloudflareIP = request.headers.get('cf-connecting-ip')
    
    if (cloudflareIP) return cloudflareIP
    if (forwarded) return forwarded.split(',')[0].trim()
    if (realIP) return realIP
    
    return 'unknown'
  }

  /**
   * Atualiza estatísticas de uso da API Key
   */
  private static async updateAPIKeyUsage(
    apiKeyId: string, 
    request: NextRequest
  ): Promise<void> {
    const requestId = crypto.randomUUID()
    
    try {
      // Log detalhado para auditoria
      await supabase.from('api_key_usage_logs').insert({
        api_key_id: apiKeyId,
        request_id: requestId,
        endpoint: request.nextUrl.pathname,
        method: request.method,
        ip_address: this.getClientIP(request),
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString()
      })
      
      // Atualizar contador da API Key
      await supabase
        .from('user_api_keys')
        .update({
          usage_count: supabase.raw('usage_count + 1'),
          last_used_at: new Date().toISOString()
        })
        .eq('id', apiKeyId)
    } catch (error) {
      console.error('Failed to update API key usage:', error)
    }
  }

  /**
   * Cria nova API Key para usuário
   */
  static async createAPIKey(
    userId: string,
    data: {
      name: string
      description?: string
      platforms: string[]
      scopes: string[]
      expiresInDays?: number
      rateLimitPerHour?: number
      allowedIPs?: string[]
    }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // 1. Verificar limite de API Keys
      const { count } = await supabase
        .from('user_api_keys')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true)
      
      if ((count || 0) >= this.config.maxAPIKeys) {
        return {
          success: false,
          error: `Maximum ${this.config.maxAPIKeys} API keys allowed`
        }
      }
      
      // 2. Gerar API Key
      const apiKey = this.generateSecureAPIKey()
      const keyHash = await bcrypt.hash(apiKey, 12)
      
      // 3. Calcular data de expiração
      const expiresAt = data.expiresInDays ? 
        new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000) : 
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 ano padrão
      
      // 4. Salvar no banco
      const { data: newKey, error } = await supabase
        .from('user_api_keys')
        .insert({
          user_id: userId,
          key_name: data.name,
          key_description: data.description,
          key_hash: keyHash,
          key_prefix: apiKey.substring(0, 8) + '...',
          platforms: data.platforms,
          scopes: data.scopes,
          is_active: true,
          rate_limit_per_hour: data.rateLimitPerHour || 1000,
          expires_at: expiresAt.toISOString(),
          allowed_ips: data.allowedIPs || []
        })
        .select()
        .single()
      
      if (error) {
        throw error
      }
      
      return {
        success: true,
        data: {
          ...newKey,
          key: apiKey, // Retorna a chave UMA VEZ
          api_base_url: process.env.NEXT_PUBLIC_APP_URL + '/api/v1'
        }
      }
    } catch (error) {
      console.error('Failed to create API key:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create API key'
      }
    }
  }
}