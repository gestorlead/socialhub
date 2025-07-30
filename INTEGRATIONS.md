# Social Media Integrations

This document provides comprehensive information about the Instagram and Facebook integrations implemented in the social media hub application.

## Overview

The application now supports three independent social media integrations:
- **TikTok** - Video content publishing and analytics
- **Instagram** - Posts, Stories, Reels content management
- **Facebook** - Page management and content publishing

Each integration is completely independent with its own:
- Database tables and settings
- API endpoints and authentication
- Configuration forms and testing
- OAuth flows and credentials management

## Instagram Integration

### Features
- Instagram Business Account management
- Content publishing for Posts, Stories, Reels, and IGTV
- Instagram API version selection (v18.0, v17.0, v16.0, v15.0)
- Comprehensive permission management
- OAuth authentication flow
- Development/Production environment support

### Database Schema
**Table**: `instagram_settings`

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `app_id` | TEXT | Instagram App ID |
| `app_secret` | TEXT | Instagram App Secret (encrypted) |
| `access_token` | TEXT | Long-lived access token (encrypted) |
| `instagram_business_account_id` | TEXT | Business Account ID |
| `api_version` | VARCHAR(10) | API version (default: v18.0) |
| `environment` | VARCHAR(20) | development/production |
| `oauth_redirect_uri` | TEXT | OAuth callback URL |
| `webhook_url` | TEXT | Webhook endpoint URL |
| `webhook_verify_token` | TEXT | Webhook verification token |
| `permissions` | JSONB | Required API permissions array |
| `content_types` | JSONB | Enabled content types object |
| `is_active` | BOOLEAN | Integration status |

### Required Permissions
- `instagram_basic` (Required) - Basic profile access
- `instagram_content_publish` (Required) - Content publishing
- `instagram_manage_insights` (Optional) - Analytics and insights
- `instagram_manage_comments` (Optional) - Comment management
- `instagram_manage_messages` (Optional) - Direct message management
- `pages_show_list` (Required) - Facebook Page list access
- `pages_read_engagement` (Optional) - Page engagement metrics

### Content Types
- **Posts** - Regular feed posts with images/videos
- **Stories** - 24-hour temporary stories
- **Reels** - Short-form vertical videos
- **IGTV** - Long-form video content (optional)

### API Endpoints
- `GET /api/admin/integrations/instagram` - Get settings
- `PUT /api/admin/integrations/instagram` - Update settings
- `POST /api/admin/integrations/instagram/test` - Test connection
- `GET /api/auth/instagram` - Initiate OAuth
- `GET /api/auth/instagram/callback` - OAuth callback

### Environment Variables
```env
# Instagram Configuration
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret
INSTAGRAM_ACCESS_TOKEN=your_access_token
INSTAGRAM_BUSINESS_ACCOUNT_ID=your_business_account_id
INSTAGRAM_API_VERSION=v18.0
INSTAGRAM_ENVIRONMENT=development
INSTAGRAM_OAUTH_REDIRECT_URI=https://yourdomain.com/api/auth/instagram/callback
INSTAGRAM_WEBHOOK_URL=https://yourdomain.com/webhooks/instagram
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=your_verify_token
INSTAGRAM_PERMISSIONS=instagram_basic,instagram_content_publish,instagram_manage_insights
INSTAGRAM_CONTENT_POSTS=true
INSTAGRAM_CONTENT_STORIES=true
INSTAGRAM_CONTENT_REELS=true
INSTAGRAM_CONTENT_IGTV=false
INSTAGRAM_IS_ACTIVE=true
```

## Facebook Integration

### Features
- Multiple Facebook Page management
- Privacy settings configuration
- Post scheduling capabilities
- Audience targeting options
- Comprehensive permission system
- OAuth authentication with page discovery
- Development/Production environment support

### Database Schema
**Table**: `facebook_settings`

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `app_id` | TEXT | Facebook App ID |
| `app_secret` | TEXT | Facebook App Secret (encrypted) |
| `access_token` | TEXT | User access token (encrypted) |
| `api_version` | VARCHAR(10) | API version (default: v18.0) |
| `environment` | VARCHAR(20) | development/production |
| `oauth_redirect_uri` | TEXT | OAuth callback URL |
| `webhook_url` | TEXT | Webhook endpoint URL |
| `webhook_verify_token` | TEXT | Webhook verification token |
| `permissions` | JSONB | Required API permissions array |
| `pages` | JSONB | Facebook Pages configuration array |
| `privacy_settings` | JSONB | Privacy and messaging settings |
| `scheduling` | JSONB | Post scheduling configuration |
| `audience_targeting` | JSONB | Audience targeting settings |
| `is_active` | BOOLEAN | Integration status |

### Required Permissions
- `pages_show_list` (Required) - List user's pages
- `pages_read_engagement` (Required) - Read page engagement
- `pages_manage_posts` (Required) - Publish and manage posts
- `pages_manage_metadata` (Optional) - Manage page information
- `pages_read_user_content` (Optional) - Read user content on page
- `pages_manage_ads` (Optional) - Manage page advertisements
- `pages_manage_engagement` (Optional) - Manage comments and reactions
- `pages_messaging` (Optional) - Send messages to page users

### Privacy Settings
- **Default Privacy**: PUBLIC, FRIENDS, ONLY_ME, CUSTOM
- **Message Replies**: Allow/disallow message replies on posts
- **Location Restriction**: Restrict location information sharing

### Scheduling Configuration
- **Enabled**: Enable/disable post scheduling
- **Max Scheduled Posts**: Maximum number of scheduled posts (default: 50)
- **Min Schedule Time**: Minimum scheduling time in minutes (default: 10)

### Audience Targeting
- **Enabled**: Enable/disable audience targeting
- **Age Range**: Default minimum and maximum age (18-65)
- **Countries**: Default target countries array

### API Endpoints
- `GET /api/admin/integrations/facebook` - Get settings
- `PUT /api/admin/integrations/facebook` - Update settings
- `POST /api/admin/integrations/facebook/test` - Test connection
- `GET /api/auth/facebook` - Initiate OAuth
- `GET /api/auth/facebook/callback` - OAuth callback

### Environment Variables
```env
# Facebook Configuration
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
FACEBOOK_ACCESS_TOKEN=your_access_token
FACEBOOK_API_VERSION=v18.0
FACEBOOK_ENVIRONMENT=development
FACEBOOK_OAUTH_REDIRECT_URI=https://yourdomain.com/api/auth/facebook/callback
FACEBOOK_WEBHOOK_URL=https://yourdomain.com/webhooks/facebook
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your_verify_token
FACEBOOK_PERMISSIONS=pages_show_list,pages_manage_posts,pages_read_engagement
FACEBOOK_DEFAULT_PRIVACY=PUBLIC
FACEBOOK_ALLOW_MESSAGE_REPLIES=true
FACEBOOK_RESTRICT_LOCATION=false
FACEBOOK_SCHEDULING_ENABLED=true
FACEBOOK_MAX_SCHEDULED_POSTS=50
FACEBOOK_MIN_SCHEDULE_MINUTES=10
FACEBOOK_AUDIENCE_TARGETING_ENABLED=false
FACEBOOK_DEFAULT_AGE_MIN=18
FACEBOOK_DEFAULT_AGE_MAX=65
FACEBOOK_DEFAULT_COUNTRIES=US,CA,GB
FACEBOOK_IS_ACTIVE=true
```

## Setup Instructions

### 1. Database Migration
Execute the SQL migration to create the required tables:
```bash
# Apply the migration
psql -d your_database -f sql/instagram_facebook_integrations.sql
```

### 2. Instagram Setup
1. Create an Instagram Business Account
2. Create a Facebook App in Facebook Developer Console
3. Add Instagram Basic Display and Instagram Graph API products
4. Configure OAuth redirect URIs in your app settings
5. Update environment variables or use the admin interface
6. Test the connection using the built-in test functionality

### 3. Facebook Setup
1. Create a Facebook App in Facebook Developer Console
2. Add Facebook Login and Pages API products
3. Configure OAuth redirect URIs in your app settings
4. Set up webhooks for real-time updates (optional)
5. Update environment variables or use the admin interface
6. Connect your Facebook pages through the OAuth flow

### 4. Permission Requirements

#### Instagram App Review
For production use, you'll need to submit your app for review to access:
- `instagram_content_publish` - Required for publishing content
- `instagram_manage_insights` - Required for analytics
- `pages_show_list` - Required for page access

#### Facebook App Review
For production use, you'll need to submit your app for review to access:
- `pages_manage_posts` - Required for publishing posts
- `pages_read_engagement` - Required for engagement metrics
- Additional permissions based on your use case

## Security Features

### Data Protection
- All sensitive credentials are stored encrypted in the database
- Access tokens are masked in the UI with show/hide functionality
- Row Level Security (RLS) policies restrict access to Super Admins only
- Comprehensive audit logging for all configuration changes

### Authentication Security
- OAuth state parameter for CSRF protection
- Secure token exchange flows
- Long-lived token management for Instagram
- Page-specific token management for Facebook

### Environment Separation
- Separate development and production configurations
- Environment-specific API endpoints and credentials
- Fallback to environment variables when database config is unavailable

## Testing and Validation

### Built-in Testing
Both integrations include comprehensive test suites that validate:
- Credential configuration
- API connectivity
- Permission verification
- Account/page access
- Token validity

### Test Results
Test results include:
- Pass/fail status for each test component
- Detailed error messages and debugging information
- Environment and configuration source information
- Summary statistics and recommendations

## Architecture

### Independent Design
Each integration is completely separate:
- **Database**: Separate tables with independent schemas
- **API Routes**: Dedicated endpoints for each platform
- **Forms**: Platform-specific configuration interfaces
- **Authentication**: Independent OAuth flows
- **Testing**: Separate validation logic

### UI Components
Built using shadcn/ui components for consistency:
- **Cards** - Content organization
- **Tabs** - Multi-section forms
- **Forms** - Input validation and submission
- **Alerts** - Status messages and notifications
- **Badges** - Permission and status indicators
- **Switches** - Boolean configuration options
- **Select/Radio** - Choice selection
- **Buttons** - Actions and navigation

### Extensibility
The architecture supports easy addition of new integrations:
- Follow the established patterns for new platforms
- Implement similar database schemas and API endpoints
- Use the same UI components and testing frameworks
- Maintain independence between integrations

## Troubleshooting

### Common Issues

#### Instagram
- **Invalid App ID/Secret**: Verify credentials in Facebook Developer Console
- **OAuth Redirect Mismatch**: Ensure redirect URI matches exactly
- **Permission Denied**: Check app review status and required permissions
- **Business Account Required**: Instagram publishing requires Business Account

#### Facebook
- **Page Access Issues**: Ensure user has admin access to pages
- **Token Expiration**: Facebook tokens expire, implement refresh logic
- **Permission Scope**: Verify all required permissions are approved
- **Webhook Verification**: Ensure webhook verify token matches

### Debug Mode
Enable debug logging by setting environment variables:
```env
DEBUG=true
LOG_LEVEL=debug
```

### Support Resources
- [Instagram Graph API Documentation](https://developers.facebook.com/docs/instagram-api)
- [Facebook Pages API Documentation](https://developers.facebook.com/docs/pages)
- [Facebook App Review Process](https://developers.facebook.com/docs/app-review)
- [Instagram Business Account Setup](https://business.instagram.com/)

## Contributing

When adding new integrations or modifying existing ones:

1. **Follow Patterns**: Use the established patterns for consistency
2. **Maintain Independence**: Keep integrations completely separate
3. **Security First**: Implement proper encryption and access controls
4. **Test Thoroughly**: Include comprehensive test coverage
5. **Document Changes**: Update this documentation and code comments
6. **UI Consistency**: Use shadcn/ui components and follow design patterns

## License

This integration system is part of the social media hub application and follows the same licensing terms as the main project.