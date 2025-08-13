// Platform-specific file size limits based on official platform documentation
// These limits are enforced during publication enqueuing, not upload

export interface PlatformLimits {
  photo: number; // bytes
  video: number; // bytes
  story?: number; // bytes (optional for platforms that support stories)
}

// Platform file size limits in bytes
export const PLATFORM_LIMITS: Record<string, PlatformLimits> = {
  tiktok: {
    photo: 30 * 1024 * 1024, // 30MB (covers)
    video: 4 * 1024 * 1024 * 1024, // 4GB
  },
  instagram: {
    photo: 30 * 1024 * 1024, // 30MB
    video: 4 * 1024 * 1024 * 1024, // 4GB
    story: 100 * 1024 * 1024, // 100MB for stories
  },
  facebook: {
    photo: 100 * 1024 * 1024, // 100MB
    video: 4 * 1024 * 1024 * 1024, // 4GB
    story: 100 * 1024 * 1024, // 100MB for stories
  },
  youtube: {
    photo: 20 * 1024 * 1024, // 20MB (thumbnails)
    video: 256 * 1024 * 1024 * 1024, // 256GB (theoretical max, but 4GB is practical)
  },
  x: {
    photo: 5 * 1024 * 1024, // 5MB
    video: 512 * 1024 * 1024, // 512MB
  },
  linkedin: {
    photo: 20 * 1024 * 1024, // 20MB
    video: 5 * 1024 * 1024 * 1024, // 5GB
  },
  threads: {
    photo: 30 * 1024 * 1024, // 30MB (similar to Instagram)
    video: 4 * 1024 * 1024 * 1024, // 4GB (similar to Instagram)
    story: 100 * 1024 * 1024, // 100MB for stories
  },
};

// Helper function to get file type from MIME type
export function getFileType(mimeType: string): 'photo' | 'video' | 'unknown' {
  if (mimeType.startsWith('image/')) {
    return 'photo';
  }
  if (mimeType.startsWith('video/')) {
    return 'video';
  }
  return 'unknown';
}

// Validate file size against platform limits
export function validateFileSize(
  platform: string,
  fileSize: number,
  mimeType: string,
  isStory: boolean = false
): { valid: boolean; error?: string; limit?: number } {
  const platformLimits = PLATFORM_LIMITS[platform.toLowerCase()];
  
  if (!platformLimits) {
    return {
      valid: false,
      error: `Platform '${platform}' is not supported`,
    };
  }

  const fileType = getFileType(mimeType);
  
  if (fileType === 'unknown') {
    return {
      valid: false,
      error: `File type '${mimeType}' is not supported`,
    };
  }

  // Determine which limit to use
  let limit: number;
  if (isStory && platformLimits.story) {
    limit = platformLimits.story;
  } else {
    limit = platformLimits[fileType];
  }

  if (fileSize > limit) {
    const limitMB = Math.round(limit / (1024 * 1024));
    const limitGB = limit >= 1024 * 1024 * 1024 ? Math.round(limit / (1024 * 1024 * 1024)) : null;
    const limitStr = limitGB ? `${limitGB}GB` : `${limitMB}MB`;
    
    return {
      valid: false,
      error: `File size exceeds ${platform} limit for ${fileType}${isStory ? ' stories' : ''}: ${limitStr}`,
      limit,
    };
  }

  return {
    valid: true,
    limit,
  };
}

// Check if an option ID represents a story type
export function isStoryType(optionId: string): boolean {
  return optionId.includes('_story');
}

// Validate multiple files (for platforms like Instagram that support multiple photos)
export function validateMultipleFiles(
  optionId: string,
  files: Array<{ size: number; type: string }>,
  isStory: boolean = false
): { valid: boolean; errors: string[]; validFiles: number } {
  const errors: string[] = [];
  let validFiles = 0;
  
  // Extract base platform name from composite option ID
  const basePlatform = getBasePlatformName(optionId);
  
  // Auto-detect story type if not explicitly provided
  const actualIsStory = isStory || isStoryType(optionId);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const validation = validateFileSize(basePlatform, file.size, file.type, actualIsStory);
    
    if (validation.valid) {
      validFiles++;
    } else {
      errors.push(`File ${i + 1}: ${validation.error}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    validFiles,
  };
}

// Get human-readable platform limits
export function getPlatformLimitsInfo(optionId: string): string | null {
  const basePlatform = getBasePlatformName(optionId);
  const limits = PLATFORM_LIMITS[basePlatform.toLowerCase()];
  if (!limits) return null;

  const formatSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${Math.round(bytes / (1024 * 1024 * 1024))}GB`;
    }
    return `${Math.round(bytes / (1024 * 1024))}MB`;
  };

  let info = `Photos: ${formatSize(limits.photo)}, Videos: ${formatSize(limits.video)}`;
  
  if (limits.story) {
    info += `, Stories: ${formatSize(limits.story)}`;
  }

  return info;
}

// Get maximum file size for any platform (for general upload limits)
export function getMaxFileSize(): number {
  let maxSize = 0;
  
  Object.values(PLATFORM_LIMITS).forEach(limits => {
    maxSize = Math.max(maxSize, limits.photo, limits.video);
    if (limits.story) {
      maxSize = Math.max(maxSize, limits.story);
    }
  });
  
  return maxSize;
}

// Export for convenience
export const MAX_FILE_SIZE = getMaxFileSize(); // Will be 256GB but practical max is 5GB

// Practical maximum file size (5GB - LinkedIn videos)
export const PRACTICAL_MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

// Extract base platform name from option ID
export function getBasePlatformName(optionId: string): string {
  // Handle composite platform names (e.g., "instagram_story" -> "instagram")
  const platformMap: Record<string, string> = {
    // Instagram variants
    'instagram_feed': 'instagram',
    'instagram_story': 'instagram',
    'instagram_reels': 'instagram',
    
    // TikTok variants
    'tiktok_video': 'tiktok',
    
    // YouTube variants
    'youtube_video': 'youtube',
    'youtube_shorts': 'youtube',
    
    // Facebook variants
    'facebook_feed': 'facebook',
    'facebook_story': 'facebook',
    'facebook_reels': 'facebook',
    
    // X (Twitter) variants
    'x_post': 'x',
    
    // LinkedIn variants
    'linkedin_post': 'linkedin',
    
    // Threads variants
    'threads_post': 'threads',
  };
  
  // Check if it's a mapped composite name
  if (platformMap[optionId]) {
    return platformMap[optionId];
  }
  
  // If not found, try extracting the base name (everything before the first underscore)
  const baseName = optionId.split('_')[0];
  
  // Verify the base name exists in PLATFORM_LIMITS
  if (PLATFORM_LIMITS[baseName]) {
    return baseName;
  }
  
  // Return the original optionId if no mapping found (will fail validation)
  return optionId;
}