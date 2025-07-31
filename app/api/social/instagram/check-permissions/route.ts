import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const supabase = createClient()

    // Get Instagram connection
    const { data: connection, error } = await supabase
      .from('social_connections')
      .select('access_token, profile_data, scope')
      .eq('user_id', userId)
      .eq('platform', 'instagram')
      .single()

    if (error || !connection) {
      return NextResponse.json({ error: 'Instagram connection not found' }, { status: 404 })
    }

    const profile = connection.profile_data
    if (!profile?.id) {
      return NextResponse.json({ error: 'Invalid profile data' }, { status: 400 })
    }

    // Test if we can access Instagram Graph API with current permissions
    const permissionsTests = []

    // Test 1: Basic profile access
    try {
      const profileResponse = await fetch(
        `https://graph.instagram.com/${profile.id}?fields=id,username,account_type&access_token=${connection.access_token}`
      )
      const profileResult = await profileResponse.json()
      
      permissionsTests.push({
        test: 'basic_profile_access',
        success: profileResponse.ok,
        error: profileResult.error?.message || null,
        required_permission: 'instagram_business_basic'
      })
    } catch (error) {
      permissionsTests.push({
        test: 'basic_profile_access',
        success: false,
        error: 'Network error',
        required_permission: 'instagram_business_basic'
      })
    }

    // Test 2: Insights access
    try {
      const insightsResponse = await fetch(
        `https://graph.instagram.com/${profile.id}/insights?metric=reach&period=day&access_token=${connection.access_token}`
      )
      const insightsResult = await insightsResponse.json()
      
      permissionsTests.push({
        test: 'insights_access',
        success: insightsResponse.ok,
        error: insightsResult.error?.message || null,
        required_permission: 'instagram_business_manage_insights'
      })
    } catch (error) {
      permissionsTests.push({
        test: 'insights_access',
        success: false,
        error: 'Network error',
        required_permission: 'instagram_business_manage_insights'
      })
    }

    // Test 3: Check token validity
    try {
      const tokenResponse = await fetch(
        `https://graph.instagram.com/me?access_token=${connection.access_token}`
      )
      const tokenResult = await tokenResponse.json()
      
      permissionsTests.push({
        test: 'token_validity',
        success: tokenResponse.ok,
        error: tokenResult.error?.message || null,
        required_permission: 'valid_access_token'
      })
    } catch (error) {
      permissionsTests.push({
        test: 'token_validity',
        success: false,
        error: 'Network error',
        required_permission: 'valid_access_token'
      })
    }

    // Analyze results
    const hasBasicAccess = permissionsTests.find(t => t.test === 'basic_profile_access')?.success || false
    const hasInsightsAccess = permissionsTests.find(t => t.test === 'insights_access')?.success || false
    const hasValidToken = permissionsTests.find(t => t.test === 'token_validity')?.success || false

    const diagnosis = {
      overall_status: hasBasicAccess && hasInsightsAccess && hasValidToken ? 'healthy' : 'needs_reconnection',
      account_type: profile.account_type,
      current_scope: connection.scope,
      recommended_action: null as string | null,
      permissions_tests: permissionsTests
    }

    // Provide recommendations
    if (!hasValidToken) {
      diagnosis.recommended_action = 'Token inválido ou expirado. Reconecte a conta Instagram.'
    } else if (!hasBasicAccess) {
      diagnosis.recommended_action = 'Acesso básico negado. Verifique se a conta é Business/Creator e reconecte.'
    } else if (!hasInsightsAccess) {
      diagnosis.recommended_action = 'Acesso aos Insights negado. Reconecte a conta com permissões de Business Insights.'
    } else {
      diagnosis.recommended_action = 'Tudo funcionando corretamente!'
    }

    return NextResponse.json({
      success: true,
      diagnosis,
      profile_info: {
        id: profile.id,
        username: profile.username,
        account_type: profile.account_type,
        followers_count: profile.followers_count
      }
    })

  } catch (error) {
    console.error('Instagram permissions check error:', error)
    return NextResponse.json(
      { error: 'Failed to check Instagram permissions' },
      { status: 500 }
    )
  }
}