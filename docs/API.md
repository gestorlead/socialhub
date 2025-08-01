# SocialHub API Documentation

## Overview

The SocialHub API provides endpoints for social media integration, analytics, and content management. All API routes are built with Next.js 15 App Router and follow RESTful conventions.

## Base URL

```
Production: https://yourdomain.com/api
Development: http://localhost:3000/api
```

## Authentication

Most endpoints require authentication via Bearer token in the Authorization header:

```http
Authorization: Bearer <supabase_auth_token>
```

The token is obtained through Supabase Auth and must be included in all protected endpoints.

## Common Response Formats

### Success Response
```json
{
  "data": {},
  "message": "Success"
}
```

### Error Response
```json
{
  "error": "Error message",
  "details": "Additional error details",
  "code": "ERROR_CODE"
}
```

## API Endpoints

### Authentication APIs

#### Initialize OAuth Flow

##### TikTok OAuth
```http
GET /api/auth/tiktok?user_id={userId}
```

Initiates TikTok OAuth 2.0 authentication flow.

**Query Parameters:**
- `user_id` (required): The authenticated user's ID

**Response:**
- Redirects to TikTok OAuth page

**Error Codes:**
- `400`: User ID required
- `500`: TikTok integration not configured properly

##### Instagram OAuth
```http
GET /api/auth/instagram?user_id={userId}
```

Initiates Instagram OAuth authentication flow.

**Query Parameters:**
- `user_id` (required): The authenticated user's ID

**Response:**
```json
{
  "authUrl": "https://www.instagram.com/oauth/authorize?..."
}
```

**Error Codes:**
- `400`: User ID is required
- `500`: Instagram App ID not configured

##### Facebook OAuth
```http
GET /api/auth/facebook?user_id={userId}
```

Similar to Instagram OAuth flow.

#### OAuth Callbacks

##### TikTok Callback
```http
GET /api/auth/tiktok/callback?code={code}&state={state}
```

Handles TikTok OAuth callback and exchanges code for access token.

**Query Parameters:**
- `code` (required): Authorization code from TikTok
- `state` (required): CSRF state token

**Response:**
- Redirects to `/networks/tiktok` on success
- Redirects to `/integrations/tiktok?error=...` on failure

##### Instagram Callback
```http
GET /api/auth/instagram/callback?code={code}&state={state}
```

Handles Instagram OAuth callback.

**Query Parameters:**
- `code` (required): Authorization code from Instagram
- `state` (required): Base64 encoded state with user_id

**Response:**
- Redirects to `/networks/instagram` on success

#### Token Management

##### TikTok Token Refresh
```http
POST /api/auth/tiktok/refresh-token
```

Refreshes TikTok access token.

**Headers:**
```http
Authorization: Bearer <supabase_token>
```

**Request Body:**
```json
{
  "userId": "user_uuid"
}
```

**Response:**
```json
{
  "success": true,
  "expiresAt": "2024-01-01T00:00:00Z"
}
```

##### TikTok Token Status
```http
GET /api/auth/tiktok/status?user_id={userId}
```

Checks TikTok token status and validity.

**Response:**
```json
{
  "isValid": true,
  "expiresAt": "2024-01-01T00:00:00Z",
  "needsRefresh": false
}
```

#### Logout
```http
POST /api/auth/logout
```

Logs out the user from all sessions.

**Headers:**
```http
Authorization: Bearer <supabase_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Social Media APIs

#### TikTok APIs

##### Get TikTok Stats
```http
GET /api/social/tiktok/stats?user_id={userId}
```

Fetches current TikTok account statistics.

**Query Parameters:**
- `user_id` (required): User ID

**Response:**
```json
{
  "stats": {
    "follower_count": 1000,
    "following_count": 100,
    "likes_count": 5000,
    "video_count": 50,
    "display_name": "Username",
    "avatar_url": "https://..."
  }
}
```

##### Get Live Stats
```http
GET /api/social/tiktok/live-stats
```

Fetches real-time TikTok statistics.

**Headers:**
```http
Authorization: Bearer <supabase_token>
```

**Response:**
```json
{
  "current": {
    "follower_count": 1000,
    "following_count": 100,
    "likes_count": 5000,
    "video_count": 50
  },
  "changes": {
    "follower_change": 10,
    "likes_change": 50,
    "video_change": 1
  }
}
```

##### Publish Content
```http
POST /api/social/tiktok/publish
```

Publishes video or photo content to TikTok.

**Headers:**
```http
Authorization: Bearer <supabase_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "userId": "user_uuid",
  "mediaFile": {
    "name": "video.mp4",
    "size": 1024000,
    "type": "video/mp4",
    "data": "base64_encoded_data"
  },
  "caption": "Video caption",
  "settings": {
    "privacy": "PUBLIC_TO_EVERYONE",
    "allowComments": true,
    "allowDuet": true,
    "allowStitch": true,
    "coverTimestamp": 1000
  }
}
```

**Response:**
```json
{
  "publish_id": "7123456789",
  "status": "processing"
}
```

**Error Codes:**
- `400`: Invalid request data
- `401`: Authentication failed
- `413`: File too large (max 4GB)
- `500`: Publishing failed

##### Get Videos
```http
GET /api/social/tiktok/videos?limit={limit}&cursor={cursor}
```

Fetches user's TikTok videos.

**Headers:**
```http
Authorization: Bearer <supabase_token>
```

**Query Parameters:**
- `limit` (optional): Number of videos to fetch (default: 20, max: 20)
- `cursor` (optional): Pagination cursor

**Response:**
```json
{
  "videos": [
    {
      "id": "7123456789",
      "title": "Video Title",
      "cover_image_url": "https://...",
      "duration": 30,
      "create_time": 1234567890,
      "like_count": 100,
      "comment_count": 10,
      "share_count": 5,
      "view_count": 1000
    }
  ],
  "cursor": "next_page_cursor",
  "has_more": true
}
```

##### Get Daily Stats
```http
GET /api/social/tiktok/daily-stats?days={days}
```

Fetches historical daily statistics.

**Headers:**
```http
Authorization: Bearer <supabase_token>
```

**Query Parameters:**
- `days` (optional): Number of days to fetch (default: 30)

**Response:**
```json
{
  "stats": [
    {
      "date": "2024-01-01",
      "follower_count": 1000,
      "following_count": 100,
      "likes_count": 5000,
      "video_count": 50
    }
  ]
}
```

#### Instagram APIs

##### Check Permissions
```http
GET /api/social/instagram/check-permissions
```

Checks Instagram Business account permissions.

**Headers:**
```http
Authorization: Bearer <supabase_token>
```

**Response:**
```json
{
  "hasPermissions": true,
  "permissions": ["instagram_business_basic", "instagram_business_manage_insights"],
  "businessAccount": {
    "id": "17841400000000000",
    "username": "business_account"
  }
}
```

##### Get Daily Stats
```http
GET /api/social/instagram/daily-stats
```

Fetches Instagram daily statistics.

**Headers:**
```http
Authorization: Bearer <supabase_token>
```

**Response:**
```json
{
  "metrics": {
    "impressions": 1000,
    "reach": 800,
    "profile_views": 100,
    "website_clicks": 50
  },
  "follower_count": 5000,
  "media_count": 100
}
```

##### Refresh Profile
```http
POST /api/social/instagram/refresh
```

Refreshes Instagram profile data.

**Headers:**
```http
Authorization: Bearer <supabase_token>
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "username": "username",
    "follower_count": 5000,
    "following_count": 500,
    "media_count": 100
  }
}
```

### Analytics APIs

#### Get Analytics Data
```http
GET /api/analytics/data?platform_user_id={id}&period={period}
```

Fetches analytics data for charts and dashboards.

**Headers:**
```http
Authorization: Bearer <supabase_token>
```

**Query Parameters:**
- `platform_user_id` (required): Platform-specific user ID
- `period` (optional): Time period - `7d`, `30d`, `60d`, `90d` (default: `30d`)

**Response:**
```json
{
  "current": {
    "date": "2024-01-01",
    "follower_count": 1000,
    "following_count": 100,
    "likes_count": 5000,
    "video_count": 50
  },
  "previous": {
    "date": "2023-12-01",
    "follower_count": 900,
    "following_count": 90,
    "likes_count": 4500,
    "video_count": 45
  },
  "timeSeries": [
    {
      "date": "2024-01-01",
      "follower_count": 1000,
      "following_count": 100,
      "likes_count": 5000,
      "video_count": 50
    }
  ],
  "growth": [
    {
      "date": "2024-01-01",
      "follower_growth": 10,
      "likes_growth": 50,
      "video_growth": 1,
      "follower_growth_percent": 1.1,
      "likes_growth_percent": 1.0,
      "video_growth_percent": 2.0
    }
  ]
}
```

### Admin APIs

#### Integration Management

##### Configure TikTok
```http
POST /api/admin/integrations/tiktok
```

Updates TikTok integration settings (Admin only).

**Headers:**
```http
Authorization: Bearer <supabase_token>
```

**Request Body:**
```json
{
  "client_key": "aw...",
  "client_secret": "xxx",
  "app_id": "7123456789",
  "webhook_secret": "secret"
}
```

**Response:**
```json
{
  "success": true,
  "message": "TikTok configuration updated successfully"
}
```

##### Configure Instagram
```http
POST /api/admin/integrations/instagram
```

Updates Instagram integration settings (Admin only).

**Request Body:**
```json
{
  "app_id": "123456789",
  "app_secret": "xxx",
  "oauth_redirect_uri": "https://..."
}
```

##### Configure Facebook
```http
POST /api/admin/integrations/facebook
```

Updates Facebook integration settings (Admin only).

**Request Body:**
```json
{
  "app_id": "123456789",
  "app_secret": "xxx",
  "oauth_redirect_uri": "https://..."
}
```

##### Test Integration
```http
GET /api/admin/integrations/{platform}/test
```

Tests platform integration configuration.

**Platforms:** `tiktok`, `instagram`, `facebook`

**Response:**
```json
{
  "configured": true,
  "source": "database",
  "hasRequiredFields": true,
  "details": {
    "client_key": "aw...",
    "app_id": "7123456789"
  }
}
```

### Cron Jobs

#### Collect Daily Stats
```http
POST /api/cron/collect-daily-stats
```

Collects daily statistics for all connected TikTok accounts.

**Headers:**
```http
Authorization: Bearer <cron_secret>
```

**Response:**
```json
{
  "success": true,
  "processed": 10,
  "errors": 0
}
```

#### Collect Instagram Daily Stats
```http
POST /api/cron/collect-instagram-daily-stats
```

Collects daily statistics for all connected Instagram accounts.

**Headers:**
```http
Authorization: Bearer <cron_secret>
```

### Utility APIs

#### File Upload
```http
POST /api/upload
```

Uploads files for social media publishing.

**Headers:**
```http
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: The file to upload
- `type`: File type (`video`, `image`)

**Response:**
```json
{
  "url": "https://...",
  "size": 1024000,
  "type": "video/mp4"
}
```

#### User Profile
```http
GET /api/profile
```

Gets authenticated user's profile.

**Headers:**
```http
Authorization: Bearer <supabase_token>
```

**Response:**
```json
{
  "id": "user_uuid",
  "email": "user@example.com",
  "profile": {
    "full_name": "John Doe",
    "avatar_url": "https://...",
    "role": "user"
  }
}
```

## Rate Limiting

API endpoints are rate limited to prevent abuse:

- **Authentication endpoints**: 5 requests per minute
- **Social media APIs**: 60 requests per minute
- **Analytics APIs**: 30 requests per minute
- **Publishing APIs**: 10 requests per minute

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1234567890
```

## Error Handling

### HTTP Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request - Invalid parameters
- `401`: Unauthorized - Invalid or missing token
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource not found
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error
- `503`: Service Unavailable

### Error Response Format

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": "Additional context or technical details",
  "needsReconnect": true // For auth errors
}
```

### Common Error Codes

- `AUTH_REQUIRED`: Authentication token missing
- `TOKEN_INVALID`: Token is invalid or expired
- `TOKEN_REFRESH_FAILED`: Failed to refresh access token
- `PERMISSION_DENIED`: User lacks required permissions
- `PLATFORM_NOT_CONNECTED`: Social platform not connected
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INVALID_REQUEST`: Request validation failed
- `PLATFORM_API_ERROR`: External platform API error

## Security

### Authentication Flow

1. User logs in via Supabase Auth
2. Supabase returns JWT token
3. Client includes token in Authorization header
4. API verifies token with Supabase
5. Row Level Security enforces data access

### Best Practices

1. **Always use HTTPS** in production
2. **Validate all inputs** using Zod schemas
3. **Never expose sensitive tokens** in responses
4. **Use environment variables** for secrets
5. **Implement CSRF protection** for state-changing operations
6. **Log security events** for monitoring

### OAuth Security

- CSRF tokens are used for all OAuth flows
- State parameters are validated
- Tokens are encrypted at rest
- Refresh tokens are rotated on use

## Testing

### Using cURL

```bash
# Get TikTok stats
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://yourdomain.com/api/social/tiktok/stats?user_id=USER_ID"

# Publish to TikTok
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","mediaFile":{...},"caption":"Test"}' \
  "https://yourdomain.com/api/social/tiktok/publish"
```

### Using JavaScript

```javascript
// Get analytics data
const response = await fetch('/api/analytics/data?platform_user_id=123&period=30d', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();

// Publish content
const response = await fetch('/api/social/tiktok/publish', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: 'user_id',
    mediaFile: { /* ... */ },
    caption: 'My video'
  })
});
```

## Webhooks

### TikTok Webhooks

The application can receive webhooks from TikTok for:
- Video publish status updates
- Account status changes

Webhook endpoint: `POST /api/webhooks/tiktok`

### Webhook Security

- Signature verification using webhook secret
- IP allowlisting (optional)
- Timestamp validation to prevent replay attacks

## Changelog

### Version 1.0.0
- Initial API release
- TikTok integration complete
- Instagram integration (partial)
- Analytics endpoints
- Admin configuration APIs