import { OpenAIModerationService, ModerationRequest, ModerationResult, ModerationPolicy } from './openai-moderation'
import { SentimentAnalysisService, SentimentRequest, SentimentResult } from './sentiment-analysis'
import { SecureLogger } from './secure-logger'
import { PerformanceCache } from './performance-cache'
import { createClient } from '@supabase/supabase-js'

/**
 * Automated Content Moderation Engine
 * Phase 2.3 - Intelligent automation with human-in-the-loop workflows
 * 
 * Features:
 * - Rule-based moderation with customizable policies
 * - Automated actions: approve, flag, reject, escalate
 * - Confidence-based decision making
 * - Human-in-the-loop workflows for edge cases
 * - Bulk moderation operations for administrators
 * - Real-time processing with performance optimization
 * 
 * Performance Targets:
 * - Decision speed: <200ms per comment
 * - Automation rate: 80% of decisions automated
 * - Accuracy: 95%+ correct classifications
 * - False positive rate: <2% for automated actions
 */

// Supabase client for database operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Moderation engine types
export interface ModerationDecision {
  action: 'approve' | 'flag' | 'reject' | 'escalate'
  confidence: number
  reasoning: string[]
  automated: boolean
  requiresHumanReview: boolean
  policy?: string
  metadata: {
    openaiResult?: ModerationResult
    sentimentResult?: SentimentResult
    spamProbability?: number
    policyViolations?: string[]
  }
}

export interface AutoModerationRequest {
  commentId: string
  content: string
  userId: string
  platform: string
  context?: {
    parentCommentId?: string
    postId?: string
    userHistory?: {
      previousViolations: number
      averageSentiment: number
      spamReports: number
    }
  }
  options?: {
    applyPolicies?: string[]
    skipCache?: boolean
    requireHumanReview?: boolean
  }
}

export interface AutoModerationResult {
  commentId: string
  decision: ModerationDecision
  applied: boolean
  appliedAt?: Date
  moderatorId?: string
  processingTime: number
}

export interface BulkModerationRequest {
  commentIds: string[]
  userId: string
  options?: {
    parallelProcessing?: boolean
    maxConcurrency?: number
    continueOnError?: boolean
    applyPolicies?: string[]
  }
}

export interface BulkModerationResult {
  results: AutoModerationResult[]
  summary: {
    total: number
    processed: number
    approved: number
    flagged: number
    rejected: number
    escalated: number
    errors: number
    processingTime: number
  }
}

// Default moderation policies
const DEFAULT_POLICIES: ModerationPolicy[] = [
  {
    id: 'standard',
    name: 'Standard Content Policy',
    rules: {
      categories: {
        'hate': { threshold: 0.7, action: 'reject' },
        'hate/threatening': { threshold: 0.5, action: 'reject' },
        'harassment': { threshold: 0.8, action: 'flag' },
        'harassment/threatening': { threshold: 0.6, action: 'reject' },
        'sexual': { threshold: 0.8, action: 'flag' },
        'sexual/minors': { threshold: 0.1, action: 'reject' },
        'violence': { threshold: 0.8, action: 'flag' },
        'violence/graphic': { threshold: 0.6, action: 'reject' },
        'self-harm': { threshold: 0.7, action: 'escalate' },
        'self-harm/intent': { threshold: 0.5, action: 'escalate' },
        'self-harm/instructions': { threshold: 0.3, action: 'reject' }
      },
      sentiment: { threshold: -0.8, action: 'flag' },
      spam: { threshold: 0.7, action: 'flag' }
    },
    enabled: true,
    priority: 1
  },
  {
    id: 'strict',
    name: 'Strict Content Policy',
    rules: {
      categories: {
        'hate': { threshold: 0.5, action: 'reject' },
        'hate/threatening': { threshold: 0.3, action: 'reject' },
        'harassment': { threshold: 0.6, action: 'reject' },
        'harassment/threatening': { threshold: 0.4, action: 'reject' },
        'sexual': { threshold: 0.6, action: 'reject' },
        'sexual/minors': { threshold: 0.05, action: 'reject' },
        'violence': { threshold: 0.6, action: 'reject' },
        'violence/graphic': { threshold: 0.4, action: 'reject' },
        'self-harm': { threshold: 0.5, action: 'escalate' },
        'self-harm/intent': { threshold: 0.3, action: 'escalate' },
        'self-harm/instructions': { threshold: 0.2, action: 'reject' }
      },
      sentiment: { threshold: -0.6, action: 'flag' },
      spam: { threshold: 0.5, action: 'flag' }
    },
    enabled: false,
    priority: 2
  },
  {
    id: 'permissive',
    name: 'Permissive Content Policy',
    rules: {
      categories: {
        'hate': { threshold: 0.9, action: 'flag' },
        'hate/threatening': { threshold: 0.7, action: 'reject' },
        'harassment': { threshold: 0.9, action: 'flag' },
        'harassment/threatening': { threshold: 0.8, action: 'flag' },
        'sexual': { threshold: 0.9, action: 'flag' },
        'sexual/minors': { threshold: 0.2, action: 'reject' },
        'violence': { threshold: 0.9, action: 'flag' },
        'violence/graphic': { threshold: 0.8, action: 'flag' },
        'self-harm': { threshold: 0.8, action: 'escalate' },
        'self-harm/intent': { threshold: 0.6, action: 'escalate' },
        'self-harm/instructions': { threshold: 0.4, action: 'reject' }
      },
      sentiment: { threshold: -0.9, action: 'flag' },
      spam: { threshold: 0.8, action: 'flag' }
    },
    enabled: false,
    priority: 0
  }
]

/**
 * Automated Moderation Engine with Intelligence and Human Oversight
 */
class AutomatedModerationEngine {
  private cache: PerformanceCache
  private policies: Map<string, ModerationPolicy> = new Map()
  
  constructor() {
    // Initialize cache for moderation decisions
    this.cache = new PerformanceCache({
      namespace: 'auto-moderation',
      defaultTTL: 30 * 60 * 1000, // 30 minutes cache
      maxSize: 30 * 1024 * 1024 // 30MB cache size
    })
    
    // Load default policies
    DEFAULT_POLICIES.forEach(policy => {
      this.policies.set(policy.id, policy)
    })
    
    SecureLogger.log({
      level: 'INFO',
      category: 'MODERATION',
      message: 'Automated Moderation Engine initialized',
      details: {
        policiesLoaded: this.policies.size,
        cacheEnabled: true,
        defaultPolicies: Array.from(this.policies.keys())
      }
    })
  }
  
  /**
   * Automatically moderate single comment
   */
  async moderateComment(request: AutoModerationRequest): Promise<AutoModerationResult> {
    const startTime = Date.now()
    
    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(request)
      
      // Check cache if not explicitly skipped
      if (!request.options?.skipCache) {
        const cachedResult = await this.cache.get<AutoModerationResult>(cacheKey)
        if (cachedResult) {
          await SecureLogger.log({
            level: 'DEBUG',
            category: 'MODERATION',
            message: 'Moderation decision served from cache',
            details: {
              commentId: request.commentId,
              decision: cachedResult.decision.action,
              confidence: cachedResult.decision.confidence,
              processingTime: Date.now() - startTime
            },
            userId: request.userId
          })
          
          return {
            ...cachedResult,
            processingTime: Date.now() - startTime
          }
        }
      }
      
      // Fetch comment data from database
      const commentData = await this.fetchCommentData(request.commentId)
      if (!commentData) {
        throw new Error(`Comment ${request.commentId} not found`)
      }
      
      // Prepare moderation request
      const moderationRequest: ModerationRequest = {
        content: request.content,
        language: commentData.language || 'en',
        context: {
          platform: request.platform,
          userId: request.userId,
          parentContent: commentData.parent_content
        },
        options: {
          enableSentimentAnalysis: true,
          enableSpamDetection: true
        }
      }
      
      // Prepare sentiment request
      const sentimentRequest: SentimentRequest = {
        content: request.content,
        language: commentData.language || 'en',
        context: {
          platform: request.platform,
          userId: request.userId,
          previousSentiments: commentData.previous_sentiments,
          conversationContext: commentData.parent_content
        },
        options: {
          includeEmotions: true,
          includeKeywords: true,
          includeConfidenceBreakdown: true
        }
      }
      
      // Run parallel analysis
      const [openaiResult, sentimentResult] = await Promise.all([
        OpenAIModerationService.moderateContent(moderationRequest),
        SentimentAnalysisService.analyzeSentiment(sentimentRequest)
      ])
      
      // Make moderation decision
      const decision = await this.makeDecision(
        openaiResult,
        sentimentResult,
        request,
        commentData
      )
      
      // Apply decision if automated and not requiring human review
      let applied = false
      let appliedAt: Date | undefined
      
      if (decision.automated && !decision.requiresHumanReview && !request.options?.requireHumanReview) {
        applied = await this.applyDecision(request.commentId, decision, request.userId)
        if (applied) {
          appliedAt = new Date()
        }
      }
      
      // Build result
      const result: AutoModerationResult = {
        commentId: request.commentId,
        decision,
        applied,
        appliedAt,
        processingTime: Date.now() - startTime
      }
      
      // Cache the result
      await this.cache.set(cacheKey, result, {
        ttl: this.getCacheTTL(decision),
        tags: ['moderation', request.platform, decision.action],
        compression: true
      })
      
      // Log the moderation action
      await SecureLogger.log({
        level: 'INFO',
        category: 'MODERATION',
        message: 'Automated moderation completed',
        details: {
          commentId: request.commentId,
          action: decision.action,
          confidence: decision.confidence,
          automated: decision.automated,
          applied,
          requiresHumanReview: decision.requiresHumanReview,
          platform: request.platform,
          userId: request.userId,
          processingTime: result.processingTime,
          reasoning: decision.reasoning,
          policyViolations: decision.metadata.policyViolations
        },
        userId: request.userId
      })
      
      return result
      
    } catch (error) {
      const processingTime = Date.now() - startTime
      
      await SecureLogger.log({
        level: 'ERROR',
        category: 'MODERATION',
        message: 'Automated moderation failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          commentId: request.commentId,
          userId: request.userId,
          platform: request.platform,
          processingTime
        },
        userId: request.userId
      })
      
      // Return conservative decision on error
      return {
        commentId: request.commentId,
        decision: {
          action: 'escalate',
          confidence: 0.1,
          reasoning: ['Error during automated moderation - requires human review'],
          automated: false,
          requiresHumanReview: true,
          metadata: {}
        },
        applied: false,
        processingTime
      }
    }
  }
  
  /**
   * Bulk moderation with parallel processing
   */
  async moderateCommentsBulk(request: BulkModerationRequest): Promise<BulkModerationResult> {
    const startTime = Date.now()
    const maxConcurrency = request.options?.maxConcurrency || 10
    const continueOnError = request.options?.continueOnError ?? true
    
    try {
      await SecureLogger.log({
        level: 'INFO',
        category: 'MODERATION',
        message: 'Starting bulk automated moderation',
        details: {
          commentCount: request.commentIds.length,
          maxConcurrency,
          continueOnError,
          parallelProcessing: request.options?.parallelProcessing ?? true,
          userId: request.userId
        },
        userId: request.userId
      })
      
      const results: AutoModerationResult[] = []
      let processed = 0
      let approved = 0
      let flagged = 0
      let rejected = 0
      let escalated = 0
      let errors = 0
      
      if (request.options?.parallelProcessing !== false) {
        // Parallel processing with concurrency control
        const batches = this.createBatches(request.commentIds, maxConcurrency)
        
        for (const batch of batches) {
          const batchPromises = batch.map(async (commentId, index) => {
            try {
              // Fetch comment content from database
              const commentData = await this.fetchCommentData(commentId)
              if (!commentData) {
                throw new Error(`Comment ${commentId} not found`)
              }
              
              const autoRequest: AutoModerationRequest = {
                commentId,
                content: commentData.content,
                userId: commentData.user_id,
                platform: commentData.platform,
                context: {
                  parentCommentId: commentData.parent_comment_id,
                  postId: commentData.post_id,
                  userHistory: commentData.user_history
                },
                options: {
                  applyPolicies: request.options?.applyPolicies
                }
              }
              
              const result = await this.moderateComment(autoRequest)
              processed++
              
              // Update counters
              switch (result.decision.action) {
                case 'approve': approved++; break
                case 'flag': flagged++; break
                case 'reject': rejected++; break
                case 'escalate': escalated++; break
              }
              
              return { result, index }
            } catch (error) {
              errors++
              if (!continueOnError) throw error
              
              return {
                error: error instanceof Error ? error.message : 'Unknown error',
                index,
                commentId
              }
            }
          })
          
          const batchResults = await Promise.allSettled(batchPromises)
          
          // Process batch results
          for (const result of batchResults) {
            if (result.status === 'fulfilled') {
              if ('result' in result.value) {
                results[result.value.index] = result.value.result
              } else {
                // Error case
                results.push({
                  commentId: result.value.commentId,
                  decision: {
                    action: 'escalate',
                    confidence: 0.1,
                    reasoning: [`Error: ${result.value.error}`],
                    automated: false,
                    requiresHumanReview: true,
                    metadata: {}
                  },
                  applied: false,
                  processingTime: 0
                })
              }
            } else {
              errors++
            }
          }
        }
      } else {
        // Sequential processing
        for (const commentId of request.commentIds) {
          try {
            const commentData = await this.fetchCommentData(commentId)
            if (!commentData) {
              throw new Error(`Comment ${commentId} not found`)
            }
            
            const autoRequest: AutoModerationRequest = {
              commentId,
              content: commentData.content,
              userId: commentData.user_id,
              platform: commentData.platform,
              options: {
                applyPolicies: request.options?.applyPolicies
              }
            }
            
            const result = await this.moderateComment(autoRequest)
            results.push(result)
            processed++
            
            // Update counters
            switch (result.decision.action) {
              case 'approve': approved++; break
              case 'flag': flagged++; break
              case 'reject': rejected++; break
              case 'escalate': escalated++; break
            }
            
          } catch (error) {
            errors++
            if (!continueOnError) break
          }
        }
      }
      
      const totalProcessingTime = Date.now() - startTime
      
      const summary = {
        total: request.commentIds.length,
        processed,
        approved,
        flagged,
        rejected,
        escalated,
        errors,
        processingTime: totalProcessingTime
      }
      
      await SecureLogger.log({
        level: 'INFO',
        category: 'MODERATION',
        message: 'Bulk automated moderation completed',
        details: {
          ...summary,
          userId: request.userId,
          automationRate: processed > 0 ? ((approved + flagged + rejected) / processed) * 100 : 0
        },
        userId: request.userId
      })
      
      return { results, summary }
      
    } catch (error) {
      await SecureLogger.log({
        level: 'ERROR',
        category: 'MODERATION',
        message: 'Bulk automated moderation failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          commentCount: request.commentIds.length,
          userId: request.userId,
          processingTime: Date.now() - startTime
        },
        userId: request.userId
      })
      
      throw error
    }
  }
  
  /**
   * Make intelligent moderation decision
   */
  private async makeDecision(
    openaiResult: ModerationResult,
    sentimentResult: SentimentResult,
    request: AutoModerationRequest,
    commentData: any
  ): Promise<ModerationDecision> {
    const reasoning: string[] = []
    let action: ModerationDecision['action'] = 'approve'
    let confidence = 0.5
    let automated = true
    let requiresHumanReview = false
    const policyViolations: string[] = []
    
    // Get applicable policies
    const applicablePolicies = this.getApplicablePolicies(
      request.options?.applyPolicies,
      request.platform
    )
    
    // Evaluate OpenAI moderation results
    if (openaiResult.flagged) {
      reasoning.push('Content flagged by OpenAI moderation')
      
      // Check category violations
      for (const [category, flagged] of Object.entries(openaiResult.categories)) {
        if (flagged) {
          const score = openaiResult.categoryScores[category as keyof typeof openaiResult.categoryScores]
          
          // Find the most restrictive policy action for this category
          let categoryAction: 'flag' | 'reject' | 'escalate' = 'flag'
          
          for (const policy of applicablePolicies) {
            const rule = policy.rules.categories[category]
            if (rule && score >= rule.threshold) {
              if (rule.action === 'reject') {
                categoryAction = 'reject'
                break
              } else if (rule.action === 'escalate' && categoryAction !== 'reject') {
                categoryAction = 'escalate'
              }
            }
          }
          
          if (categoryAction === 'reject') {
            action = 'reject'
            reasoning.push(`High-risk content detected: ${category} (score: ${score.toFixed(3)})`)
            policyViolations.push(`${category}:${score.toFixed(3)}`)
          } else if (categoryAction === 'escalate' && action !== 'reject') {
            action = 'escalate'
            reasoning.push(`Medium-risk content detected: ${category} (score: ${score.toFixed(3)})`)
            policyViolations.push(`${category}:${score.toFixed(3)}`)
            requiresHumanReview = true
          } else if (action === 'approve') {
            action = 'flag'
            reasoning.push(`Content flagged for category: ${category} (score: ${score.toFixed(3)})`)
          }
        }
      }
      
      confidence = Math.max(confidence, openaiResult.confidence)
    }
    
    // Evaluate sentiment
    if (sentimentResult.score <= -0.6) {
      reasoning.push(`Very negative sentiment detected (score: ${sentimentResult.score.toFixed(2)})`)
      
      // Check sentiment policies
      for (const policy of applicablePolicies) {
        if (sentimentResult.score <= policy.rules.sentiment.threshold) {
          if (policy.rules.sentiment.action === 'reject' && action !== 'reject') {
            action = policy.rules.sentiment.action
          } else if (policy.rules.sentiment.action === 'escalate' && action === 'approve') {
            action = 'escalate'
            requiresHumanReview = true
          } else if (action === 'approve') {
            action = 'flag'
          }
        }
      }
    }
    
    // Evaluate spam probability
    const spamProbability = openaiResult.spam?.probability || 0
    if (spamProbability > 0.5) {
      reasoning.push(`Potential spam detected (probability: ${spamProbability.toFixed(2)})`)
      
      // Check spam policies
      for (const policy of applicablePolicies) {
        if (spamProbability >= policy.rules.spam.threshold) {
          if (policy.rules.spam.action === 'reject' && action !== 'reject') {
            action = policy.rules.spam.action
          } else if (policy.rules.spam.action === 'escalate' && action === 'approve') {
            action = 'escalate'
            requiresHumanReview = true
          } else if (action === 'approve') {
            action = 'flag'
          }
        }
      }
    }
    
    // Consider user history
    if (request.context?.userHistory) {
      const history = request.context.userHistory
      
      if (history.previousViolations > 2) {
        reasoning.push(`User has ${history.previousViolations} previous violations`)
        if (action === 'flag') {
          action = 'escalate'
          requiresHumanReview = true
        }
        confidence += 0.1
      }
      
      if (history.spamReports > 1) {
        reasoning.push(`User has ${history.spamReports} spam reports`)
        if (action === 'approve') {
          action = 'flag'
        }
      }
    }
    
    // Adjust confidence based on multiple factors
    confidence = Math.min(1.0, confidence + (reasoning.length * 0.05))
    
    // Low confidence decisions require human review
    if (confidence < 0.7 && action !== 'approve') {
      requiresHumanReview = true
      automated = confidence > 0.5
    }
    
    // Special cases that always require human review
    if (action === 'escalate' || 
        policyViolations.some(v => v.includes('self-harm') || v.includes('minors'))) {
      requiresHumanReview = true
    }
    
    if (reasoning.length === 0) {
      reasoning.push('Content appears safe - no policy violations detected')
    }
    
    return {
      action,
      confidence,
      reasoning,
      automated,
      requiresHumanReview,
      policy: applicablePolicies[0]?.id,
      metadata: {
        openaiResult,
        sentimentResult,
        spamProbability,
        policyViolations: policyViolations.length > 0 ? policyViolations : undefined
      }
    }
  }
  
  /**
   * Apply moderation decision to database
   */
  private async applyDecision(
    commentId: string,
    decision: ModerationDecision,
    moderatorId: string
  ): Promise<boolean> {
    try {
      const updateData: any = {
        status: decision.action === 'approve' ? 'approved' : 
                decision.action === 'reject' ? 'rejected' : 'flagged',
        moderated_by: moderatorId,
        moderated_at: new Date().toISOString(),
        moderation_reason: decision.reasoning.join('; '),
        moderation_confidence: decision.confidence,
        moderation_automated: decision.automated,
        sentiment_score: decision.metadata.sentimentResult?.score,
        sentiment_magnitude: decision.metadata.sentimentResult?.magnitude,
        updated_at: new Date().toISOString()
      }
      
      if (decision.metadata.policyViolations) {
        updateData.moderation_flags = decision.metadata.policyViolations
      }
      
      const { error } = await supabaseAdmin
        .from('comments')
        .update(updateData)
        .eq('id', commentId)
      
      if (error) {
        throw error
      }
      
      return true
      
    } catch (error) {
      await SecureLogger.log({
        level: 'ERROR',
        category: 'MODERATION',
        message: 'Failed to apply moderation decision',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          commentId,
          decision: decision.action,
          moderatorId
        },
        userId: moderatorId
      })
      
      return false
    }
  }
  
  /**
   * Fetch comment data from database
   */
  private async fetchCommentData(commentId: string): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('comments')
      .select(`
        *,
        profiles!comments_user_id_fkey (
          full_name,
          email
        )
      `)
      .eq('id', commentId)
      .single()
    
    if (error) {
      throw new Error(`Failed to fetch comment: ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Get applicable policies for moderation
   */
  private getApplicablePolicies(
    requestedPolicies?: string[],
    platform?: string
  ): ModerationPolicy[] {
    if (requestedPolicies && requestedPolicies.length > 0) {
      return requestedPolicies
        .map(id => this.policies.get(id))
        .filter(Boolean) as ModerationPolicy[]
    }
    
    // Return enabled policies, sorted by priority
    return Array.from(this.policies.values())
      .filter(policy => policy.enabled && (!policy.platform || policy.platform === platform))
      .sort((a, b) => b.priority - a.priority)
  }
  
  /**
   * Generate cache key for moderation request
   */
  private generateCacheKey(request: AutoModerationRequest): string {
    const contentHash = require('crypto')
      .createHash('sha256')
      .update(request.content)
      .digest('hex')
      .substring(0, 16)
    
    const contextHash = request.context ? 
      require('crypto')
        .createHash('sha256')
        .update(JSON.stringify(request.context))
        .digest('hex')
        .substring(0, 8) : 'no-context'
    
    const optionsHash = request.options ? 
      require('crypto')
        .createHash('sha256')
        .update(JSON.stringify(request.options))
        .digest('hex')
        .substring(0, 8) : 'default'
    
    return `auto-mod:${contentHash}:${contextHash}:${optionsHash}:${request.platform}`
  }
  
  /**
   * Get cache TTL based on decision
   */
  private getCacheTTL(decision: ModerationDecision): number {
    // Cache high-confidence automated decisions longer
    if (decision.automated && decision.confidence > 0.8) {
      return 2 * 60 * 60 * 1000 // 2 hours
    }
    
    // Cache low-confidence or human-review-required decisions shorter
    if (decision.requiresHumanReview || decision.confidence < 0.6) {
      return 15 * 60 * 1000 // 15 minutes
    }
    
    return 60 * 60 * 1000 // 1 hour
  }
  
  /**
   * Create processing batches
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    
    return batches
  }
  
  /**
   * Add or update moderation policy
   */
  public addPolicy(policy: ModerationPolicy): void {
    this.policies.set(policy.id, policy)
    
    SecureLogger.log({
      level: 'INFO',
      category: 'MODERATION',
      message: 'Moderation policy updated',
      details: {
        policyId: policy.id,
        policyName: policy.name,
        enabled: policy.enabled,
        priority: policy.priority
      }
    })
  }
  
  /**
   * Get all policies
   */
  public getPolicies(): ModerationPolicy[] {
    return Array.from(this.policies.values())
  }
  
  /**
   * Get policy by ID
   */
  public getPolicy(id: string): ModerationPolicy | undefined {
    return this.policies.get(id)
  }
}

// Export singleton instance
export const AutomatedModerationService = new AutomatedModerationEngine()

// Export types
export {
  ModerationDecision,
  AutoModerationRequest,
  AutoModerationResult,
  BulkModerationRequest,
  BulkModerationResult
}