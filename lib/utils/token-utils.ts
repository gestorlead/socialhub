import { TikTokTokenManager } from '@/lib/tiktok-token-manager'

/**
 * Ensures a valid TikTok access token for the user
 * Automatically refreshes if needed
 * 
 * @param userId - User ID to get token for
 * @returns Valid access token or throws error
 */
export async function ensureValidTikTokToken(userId: string): Promise<string> {
  if (!userId) {
    throw new Error('User ID is required')
  }

  try {
    const token = await TikTokTokenManager.getValidAccessToken(userId)
    
    if (!token) {
      throw new Error('Unable to get valid TikTok token. User may need to reconnect their account.')
    }

    return token
  } catch (error) {
    console.error('Error ensuring valid TikTok token:', error)
    throw new Error('Failed to get valid TikTok token')
  }
}

/**
 * Gets TikTok token status for a user
 * 
 * @param userId - User ID to check
 * @returns Token status information
 */
export async function getTikTokTokenStatus(userId: string) {
  try {
    const status = await TikTokTokenManager.getTokenStatus(userId)
    return status
  } catch (error) {
    console.error('Error getting TikTok token status:', error)
    return null
  }
}