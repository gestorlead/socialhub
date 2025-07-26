import { NextRequest } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { SecureLogger } from './secure-logger'
import { InputSanitizer } from './input-sanitizer'
import { encrypt, decrypt, generateSecureToken } from './crypto'
import { supabase } from './supabase'
import { nanoid } from 'nanoid'

export type DataCategory = 'profile' | 'connections' | 'api_keys' | 'activity_logs' | 'analytics' | 'security_logs'
export type ProcessingBasis = 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interests'
export type DataExportStatus = 'requested' | 'processing' | 'ready' | 'downloaded' | 'expired'
export type ConsentStatus = 'granted' | 'withdrawn' | 'pending' | 'expired'

export interface DataProcessingRecord {
  id: string
  user_id: string
  data_category: DataCategory
  processing_basis: ProcessingBasis
  purpose: string
  retention_period_months: number
  consent_required: boolean
  consent_status?: ConsentStatus
  created_at: string
  updated_at: string
}

export interface DataExportRequest {
  id: string
  user_id: string
  status: DataExportStatus
  data_categories: DataCategory[]
  include_deleted: boolean
  secure_download_token?: string
  expires_at: string
  created_at: string
  completed_at?: string
}

export interface UserConsent {
  id: string
  user_id: string
  data_category: DataCategory
  purpose: string
  status: ConsentStatus
  granted_at?: string
  withdrawn_at?: string
  expires_at?: string
  ip_address: string
  user_agent: string
  locale: string
}

/**
 * LGPD/GDPR Compliance System
 * Handles data rights, consent management, and privacy compliance
 */
export class ComplianceSystem {
  private static readonly DATA_RETENTION_POLICIES = {
    profile: 0, // Until account deletion
    connections: 12, // 12 months
    api_keys: 0, // Until deletion
    activity_logs: 12, // 12 months
    analytics: 24, // 24 months
    security_logs: 36 // 36 months (legal requirement)
  }

  private static readonly EXPORT_EXPIRY_HOURS = 72 // 3 days

  /**
   * Record data processing activity for compliance audit
   */
  static async recordDataProcessing(
    userId: string,
    dataCategory: DataCategory,
    processingBasis: ProcessingBasis,
    purpose: string,
    consentRequired: boolean = false
  ): Promise<void> {
    try {
      const record: Omit<DataProcessingRecord, 'created_at' | 'updated_at'> = {
        id: nanoid(),
        user_id: userId,
        data_category: dataCategory,
        processing_basis: processingBasis,
        purpose,
        retention_period_months: this.DATA_RETENTION_POLICIES[dataCategory],
        consent_required: consentRequired,
        consent_status: consentRequired ? 'pending' : undefined
      }

      await supabase.from('data_processing_records').insert(record)

      await SecureLogger.log({
        level: 'INFO',
        category: 'SYSTEM',
        message: 'Data processing recorded',
        details: {
          userId,
          dataCategory,
          processingBasis,
          purpose
        },
        userId
      })
    } catch (error) {
      console.error('Failed to record data processing:', error)
    }
  }

  /**
   * Record user consent for data processing
   */
  static async recordConsent(
    userId: string,
    dataCategory: DataCategory,
    purpose: string,
    granted: boolean,
    request: NextRequest
  ): Promise<void> {
    const locale = this.getRequestLocale(request)
    
    try {
      const consent: Omit<UserConsent, 'created_at'> = {
        id: nanoid(),
        user_id: userId,
        data_category: dataCategory,
        purpose,
        status: granted ? 'granted' : 'withdrawn',
        granted_at: granted ? new Date().toISOString() : undefined,
        withdrawn_at: !granted ? new Date().toISOString() : undefined,
        expires_at: granted ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : undefined, // 1 year
        ip_address: this.getClientIP(request),
        user_agent: request.headers.get('user-agent') || '',
        locale
      }

      await supabase.from('user_consents').insert(consent)

      // Update processing records
      await supabase
        .from('data_processing_records')
        .update({ consent_status: consent.status })
        .eq('user_id', userId)
        .eq('data_category', dataCategory)
        .eq('consent_required', true)

      await SecureLogger.logUserAction(
        `consent_${granted ? 'granted' : 'withdrawn'}`,
        userId,
        {
          dataCategory,
          purpose,
          status: consent.status
        },
        request
      )
    } catch (error) {
      console.error('Failed to record consent:', error)
    }
  }

  /**
   * Check if user has valid consent for data category
   */
  static async hasValidConsent(
    userId: string,
    dataCategory: DataCategory,
    purpose?: string
  ): Promise<boolean> {
    try {
      let query = supabase
        .from('user_consents')
        .select('*')
        .eq('user_id', userId)
        .eq('data_category', dataCategory)
        .eq('status', 'granted')
        .gte('expires_at', new Date().toISOString())

      if (purpose) {
        query = query.eq('purpose', purpose)
      }

      const { data } = await query.order('granted_at', { ascending: false }).limit(1)
      
      return (data?.length || 0) > 0
    } catch (error) {
      console.error('Failed to check consent:', error)
      return false
    }
  }

  /**
   * Request data export (GDPR Article 20 - Right to data portability)
   */
  static async requestDataExport(
    userId: string,
    dataCategories: DataCategory[],
    includeDeleted: boolean = false,
    request?: NextRequest
  ): Promise<{ success: boolean; exportId?: string; error?: string }> {
    try {
      // Check for existing pending requests
      const { data: existingRequests } = await supabase
        .from('data_export_requests')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['requested', 'processing'])

      if (existingRequests && existingRequests.length > 0) {
        return {
          success: false,
          error: 'An export request is already in progress'
        }
      }

      const exportId = nanoid()
      const secureToken = generateSecureToken(32)
      const expiresAt = new Date(Date.now() + this.EXPORT_EXPIRY_HOURS * 60 * 60 * 1000)

      const exportRequest: Omit<DataExportRequest, 'created_at'> = {
        id: exportId,
        user_id: userId,
        status: 'requested',
        data_categories: dataCategories,
        include_deleted: includeDeleted,
        secure_download_token: encrypt(secureToken),
        expires_at: expiresAt.toISOString()
      }

      await supabase.from('data_export_requests').insert(exportRequest)

      // Log the request
      await SecureLogger.logUserAction(
        'data_export_requested',
        userId,
        {
          exportId,
          dataCategories,
          includeDeleted,
          expiresAt: expiresAt.toISOString()
        },
        request
      )

      // Queue export processing (in real implementation, use a job queue)
      setTimeout(() => this.processDataExport(exportId), 1000)

      return {
        success: true,
        exportId
      }
    } catch (error) {
      console.error('Failed to request data export:', error)
      return {
        success: false,
        error: 'Failed to create export request'
      }
    }
  }

  /**
   * Process data export (background task)
   */
  private static async processDataExport(exportId: string): Promise<void> {
    try {
      // Update status to processing
      await supabase
        .from('data_export_requests')
        .update({ status: 'processing' })
        .eq('id', exportId)

      const { data: exportRequest } = await supabase
        .from('data_export_requests')
        .select('*')
        .eq('id', exportId)
        .single()

      if (!exportRequest) return

      const exportData = await this.gatherUserData(
        exportRequest.user_id,
        exportRequest.data_categories,
        exportRequest.include_deleted
      )

      // In real implementation, store the export file securely
      // For now, we'll just mark as ready
      await supabase
        .from('data_export_requests')
        .update({
          status: 'ready',
          completed_at: new Date().toISOString()
        })
        .eq('id', exportId)

      await SecureLogger.log({
        level: 'INFO',
        category: 'SYSTEM',
        message: 'Data export completed',
        details: {
          exportId,
          userId: exportRequest.user_id,
          dataSize: JSON.stringify(exportData).length
        },
        userId: exportRequest.user_id
      })
    } catch (error) {
      console.error('Failed to process data export:', error)
      
      // Mark as failed
      await supabase
        .from('data_export_requests')
        .update({ status: 'requested' }) // Reset to allow retry
        .eq('id', exportId)
    }
  }

  /**
   * Gather user data for export
   */
  private static async gatherUserData(
    userId: string,
    categories: DataCategory[],
    includeDeleted: boolean
  ): Promise<Record<string, any>> {
    const exportData: Record<string, any> = {}

    try {
      for (const category of categories) {
        switch (category) {
          case 'profile':
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single()
            exportData.profile = profile ? InputSanitizer.sanitizeForLogging(profile) : null
            break

          case 'connections':
            const { data: connections } = await supabase
              .from('social_integrations')
              .select('platform, username, display_name, is_active, created_at')
              .eq('user_id', userId)
            exportData.connections = connections || []
            break

          case 'api_keys':
            const { data: apiKeys } = await supabase
              .from('user_api_keys')
              .select('key_name, key_description, platforms, scopes, created_at, last_used_at')
              .eq('user_id', userId)
            exportData.api_keys = apiKeys || []
            break

          case 'activity_logs':
            const { data: activityLogs } = await supabase
              .from('security_logs')
              .select('level, category, message, timestamp')
              .eq('user_id', userId)
              .eq('category', 'USER_ACTION')
              .order('timestamp', { ascending: false })
              .limit(1000)
            exportData.activity_logs = activityLogs || []
            break

          case 'analytics':
            // Placeholder for analytics data
            exportData.analytics = []
            break

          case 'security_logs':
            const { data: securityLogs } = await supabase
              .from('security_logs')
              .select('level, category, message, timestamp')
              .eq('user_id', userId)
              .eq('category', 'SECURITY')
              .order('timestamp', { ascending: false })
              .limit(100)
            exportData.security_logs = securityLogs || []
            break
        }
      }

      // Add metadata
      exportData._metadata = {
        export_date: new Date().toISOString(),
        user_id: userId,
        categories,
        include_deleted: includeDeleted,
        format_version: '1.0'
      }

      return exportData
    } catch (error) {
      console.error('Failed to gather user data:', error)
      throw error
    }
  }

  /**
   * Get export request status
   */
  static async getExportStatus(
    userId: string,
    exportId?: string
  ): Promise<DataExportRequest | null> {
    try {
      let query = supabase
        .from('data_export_requests')
        .select('*')
        .eq('user_id', userId)

      if (exportId) {
        query = query.eq('id', exportId)
      }

      const { data } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      return data
    } catch (error) {
      return null
    }
  }

  /**
   * Download export data (with secure token)
   */
  static async downloadExportData(
    exportId: string,
    downloadToken: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { data: exportRequest } = await supabase
        .from('data_export_requests')
        .select('*')
        .eq('id', exportId)
        .eq('status', 'ready')
        .single()

      if (!exportRequest) {
        return { success: false, error: 'Export not found or not ready' }
      }

      // Check if expired
      if (new Date() > new Date(exportRequest.expires_at)) {
        await supabase
          .from('data_export_requests')
          .update({ status: 'expired' })
          .eq('id', exportId)
        
        return { success: false, error: 'Export has expired' }
      }

      // Verify download token
      const storedToken = decrypt(exportRequest.secure_download_token)
      if (storedToken !== downloadToken) {
        return { success: false, error: 'Invalid download token' }
      }

      // Get the export data
      const exportData = await this.gatherUserData(
        exportRequest.user_id,
        exportRequest.data_categories,
        exportRequest.include_deleted
      )

      // Mark as downloaded
      await supabase
        .from('data_export_requests')
        .update({ status: 'downloaded' })
        .eq('id', exportId)

      await SecureLogger.logUserAction(
        'data_export_downloaded',
        exportRequest.user_id,
        { exportId }
      )

      return {
        success: true,
        data: exportData
      }
    } catch (error) {
      console.error('Failed to download export data:', error)
      return { success: false, error: 'Download failed' }
    }
  }

  /**
   * Delete user data (GDPR Article 17 - Right to erasure)
   */
  static async deleteUserData(
    userId: string,
    categories?: DataCategory[],
    request?: NextRequest
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const categoriesToDelete = categories || Object.keys(this.DATA_RETENTION_POLICIES) as DataCategory[]

      for (const category of categoriesToDelete) {
        switch (category) {
          case 'profile':
            await supabase.from('profiles').delete().eq('id', userId)
            break
          case 'connections':
            await supabase.from('social_integrations').delete().eq('user_id', userId)
            break
          case 'api_keys':
            await supabase.from('user_api_keys').delete().eq('user_id', userId)
            break
          case 'activity_logs':
            await supabase.from('security_logs').delete().eq('user_id', userId).eq('category', 'USER_ACTION')
            break
          case 'analytics':
            // Delete analytics data
            break
          case 'security_logs':
            // Security logs might need to be retained for legal reasons
            // Instead of deleting, anonymize
            await supabase
              .from('security_logs')
              .update({ user_id: null })
              .eq('user_id', userId)
              .eq('category', 'SECURITY')
            break
        }
      }

      await SecureLogger.logUserAction(
        'data_deletion_completed',
        userId,
        {
          categories: categoriesToDelete,
          timestamp: new Date().toISOString()
        },
        request
      )

      return { success: true }
    } catch (error) {
      console.error('Failed to delete user data:', error)
      return { success: false, error: 'Deletion failed' }
    }
  }

  /**
   * Get user's data processing records
   */
  static async getDataProcessingRecords(userId: string): Promise<DataProcessingRecord[]> {
    try {
      const { data } = await supabase
        .from('data_processing_records')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      return data || []
    } catch (error) {
      console.error('Failed to get processing records:', error)
      return []
    }
  }

  /**
   * Get user's consent records
   */
  static async getUserConsents(userId: string): Promise<UserConsent[]> {
    try {
      const { data } = await supabase
        .from('user_consents')
        .select('*')
        .eq('user_id', userId)
        .order('granted_at', { ascending: false })

      return data || []
    } catch (error) {
      console.error('Failed to get user consents:', error)
      return []
    }
  }

  /**
   * Cleanup expired data based on retention policies
   */
  static async cleanupExpiredData(): Promise<void> {
    try {
      for (const [category, retentionMonths] of Object.entries(this.DATA_RETENTION_POLICIES)) {
        if (retentionMonths === 0) continue // No automatic cleanup

        const cutoffDate = new Date()
        cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths)

        switch (category as DataCategory) {
          case 'activity_logs':
            await supabase
              .from('security_logs')
              .delete()
              .eq('category', 'USER_ACTION')
              .lt('timestamp', cutoffDate.toISOString())
            break
          case 'analytics':
            // Cleanup analytics data
            break
          case 'security_logs':
            await supabase
              .from('security_logs')
              .delete()
              .eq('category', 'SECURITY')
              .lt('timestamp', cutoffDate.toISOString())
            break
        }
      }

      // Cleanup expired export requests
      await supabase
        .from('data_export_requests')
        .delete()
        .lt('expires_at', new Date().toISOString())

      await SecureLogger.log({
        level: 'INFO',
        category: 'SYSTEM',
        message: 'Data retention cleanup completed',
        details: {
          timestamp: new Date().toISOString()
        }
      })
    } catch (error) {
      console.error('Failed to cleanup expired data:', error)
    }
  }

  // Helper methods
  private static getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const cloudflareIP = request.headers.get('cf-connecting-ip')
    
    if (cloudflareIP) return cloudflareIP
    if (forwarded) return forwarded.split(',')[0].trim()
    if (realIP) return realIP
    
    return 'unknown'
  }

  private static getRequestLocale(request: NextRequest): string {
    const cookieLocale = request.cookies.get('PREFERRED_LOCALE')?.value
    const headerLocale = request.headers.get('accept-language')?.split(',')[0]?.split('-')[0]
    return cookieLocale || headerLocale || 'pt'
  }
}