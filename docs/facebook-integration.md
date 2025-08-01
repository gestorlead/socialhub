# Facebook Pages API Integration

## Overview

This document describes the complete Facebook Pages API integration implementation for SocialHub, following the same patterns established by the Instagram integration. The implementation provides OAuth authentication, multi-page support, content publishing, and analytics collection.

## Architecture

### Tech Stack
- **Facebook API**: Pages API v18.0
- **Authentication**: OAuth 2.0 with Facebook Login
- **Database**: Supabase (social_connections table)
- **Frontend**: Next.js 15 + TypeScript + TailwindCSS

### Key Features
- OAuth 2.0 authentication flow
- Multi-page support (users can manage multiple Facebook pages)
- Content publishing (text, photo, video, carousel)
- Page insights and analytics
- Unified integration with existing publish system

## Database Schema

The Facebook integration uses the existing `social_connections` table with the following structure:

```sql
CREATE TABLE social_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  platform_user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  profile_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Facebook Profile Data Structure
```json
{
  "id": "facebook_user_id",
  "name": "User Name",
  "email": "user@email.com",
  "pages": [
    {
      "id": "page_id",
      "name": "Page Name",
      "access_token": "page_access_token",
      "category": "Business",
      "followers_count": 1000,
      "fan_count": 1000,
      "engagement_rate": 3.5,
      "posts_count": 50
    }
  ]
}
```

## API Endpoints

### Authentication

#### 1. Initiate OAuth Flow
```
GET /api/auth/facebook
```

**Response:**
```json
{
  "success": true,
  "auth_url": "https://facebook.com/dialog/oauth?..."
}
```

#### 2. OAuth Callback
```
GET /api/auth/facebook/callback?code=...&state=...
```

**Process:**
1. Exchange authorization code for access token
2. Fetch user profile information
3. Get all user's pages with extended permissions
4. Store connection data in database

### Publishing

#### 3. Publish Content
```
POST /api/social/facebook/publish
Authorization: Bearer <user_token>
```

**Request Body:**
```json
{
  "page_id": "page_id",
  "message": "Post content",
  "media_urls": ["https://example.com/image.jpg"],
  "media_type": "photo",
  "privacy": { "value": "EVERYONE" },
  "scheduled_publish_time": "2024-01-01T12:00:00Z"
}
```

**Supported Media Types:**
- `photo`: Single or multiple images
- `video`: Single video file
- `carousel`: Multiple images/videos

### Analytics

#### 4. Refresh Page Data
```
POST /api/social/facebook/refresh
Authorization: Bearer <user_token>
```

Updates page information and basic metrics.

#### 5. Get Page Statistics
```
GET /api/social/facebook/stats?period=week
Authorization: Bearer <user_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "page_fans": 1000,
    "page_impressions": 5000,
    "page_engaged_users": 250,
    "page_post_engagements": 150,
    "recent_posts": [...]
  }
}
```

## File Structure

### Frontend Components

#### Page Management
- `/app/networks/facebook/page.tsx` - Main Facebook network page
- `/components/facebook-stat-card.tsx` - Facebook-specific stat cards

#### Publishing Integration
- `/components/publish/NetworkPreviews.tsx` - Facebook preview component
- `/components/publish/PublishButton.tsx` - Facebook publishing logic

### API Routes

#### Authentication
- `/app/api/auth/facebook/route.ts` - OAuth initiation
- `/app/api/auth/facebook/callback/route.ts` - OAuth callback handler

#### Social Operations
- `/app/api/social/facebook/publish/route.ts` - Content publishing
- `/app/api/social/facebook/refresh/route.ts` - Page data refresh
- `/app/api/social/facebook/stats/route.ts` - Analytics endpoint

### Configuration Files
- `/lib/hooks/use-social-connections.ts` - Social connections hook
- `/lib/navigation.ts` - Facebook navigation items
- `/lib/network-configs.ts` - Facebook network configuration

## Environment Variables

Add the following to your `.env.local`:

```env
# Facebook App Configuration
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
FACEBOOK_REDIRECT_URI=https://yourdomain.com/api/auth/facebook/callback
```

## Facebook App Configuration

### Required Permissions
- `pages_manage_posts` - Publish content to pages
- `pages_read_engagement` - Read page insights
- `pages_show_list` - Access user's pages
- `public_profile` - Basic profile information
- `email` - User email address

### App Settings
1. **App Type**: Business
2. **Platform**: Website
3. **Valid OAuth Redirect URIs**: Add your callback URL
4. **App Review**: Submit for required permissions

## Usage Examples

### 1. Connect Facebook Account

```typescript
import { useSocialConnections } from '@/lib/hooks/use-social-connections'

const { connectFacebook } = useSocialConnections()

// Initiate connection
await connectFacebook()
```

### 2. Publish Content

```typescript
// From PublishButton component
const publishToFacebook = async (optionId: string) => {
  const payload = {
    page_id: selectedPageId,
    message: caption,
    media_urls: uploadedUrls,
    media_type: 'photo',
  }
  
  const response = await fetch('/api/social/facebook/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify(payload)
  })
}
```

### 3. Get Analytics

```typescript
const stats = await fetch('/api/social/facebook/stats?period=week', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
})
```

## Multi-Page Support

The Facebook integration supports managing multiple pages:

1. **Page Selection**: Users can select which page to publish to
2. **Page-Specific Tokens**: Each page has its own access token
3. **Page Analytics**: Separate analytics for each page
4. **Page Settings**: Different privacy and scheduling settings per page

### Page Selector Component

```typescript
// In FacebookPage component
const [selectedPage, setSelectedPage] = useState(pages[0]?.id)

<select 
  value={selectedPage} 
  onChange={(e) => setSelectedPage(e.target.value)}
>
  {pages.map(page => (
    <option key={page.id} value={page.id}>
      {page.name}
    </option>
  ))}
</select>
```

## Error Handling

### Common Errors
1. **Invalid Access Token**: Token expired or revoked
2. **Insufficient Permissions**: Missing required permissions
3. **Rate Limiting**: Too many API calls
4. **Content Policy**: Content violates Facebook policies

### Error Recovery
```typescript
try {
  // API call
} catch (error) {
  if (error.code === 190) {
    // Token expired - redirect to re-auth
    window.location.href = '/networks/facebook'
  } else if (error.code === 613) {
    // Rate limited - show retry message
    setError('Rate limited. Please try again later.')
  }
}
```

## Testing

### Test Cases
1. **OAuth Flow**: Complete authentication process
2. **Page Loading**: Fetch and display user pages
3. **Content Publishing**: Test all media types
4. **Analytics**: Verify metrics display
5. **Multi-Page**: Test page switching

### Test Data
Use Facebook's test users and pages for development testing.

## Security Considerations

1. **Token Storage**: Access tokens encrypted at rest
2. **API Validation**: All inputs validated and sanitized
3. **Rate Limiting**: Respect Facebook's rate limits
4. **HTTPS Only**: All API calls over HTTPS
5. **User Consent**: Clear permission explanations

## Performance Optimizations

1. **Caching**: Page data cached for 5 minutes
2. **Batch Requests**: Multiple operations in single API call
3. **Lazy Loading**: Analytics loaded on demand
4. **Error Boundaries**: Graceful error handling

## Deployment Notes

1. **Domain Verification**: Verify domain in Facebook App settings
2. **SSL Certificate**: Required for OAuth callbacks
3. **Webhook URLs**: Configure for real-time updates
4. **App Review**: Submit for production permissions

## Monitoring and Logs

- API response times tracked
- Error rates monitored
- User engagement metrics collected
- Performance alerts configured

## Future Enhancements

1. **Facebook Groups**: Support for group publishing
2. **Instagram Integration**: Cross-post to Instagram
3. **Advanced Scheduling**: Recurring posts
4. **A/B Testing**: Content variation testing
5. **Analytics Dashboard**: Advanced reporting

## Support and Troubleshooting

### Common Issues

1. **"Application not approved"**: App needs Facebook review
2. **"Invalid redirect URI"**: Check callback URL configuration
3. **"Insufficient permissions"**: Request additional permissions
4. **"Token expired"**: Implement token refresh logic

### Debug Tools
- Facebook Graph API Explorer
- Facebook App Dashboard
- Browser Developer Tools
- Application logs

---

**Last Updated**: December 2024  
**Version**: 1.0  
**Maintainer**: SocialHub Development Team