# SocialHub API Quick Reference

## Authentication
All endpoints require `Authorization: Bearer <token>` header unless specified.

## Endpoints by Category

### 🔐 Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/tiktok?user_id={id}` | Start TikTok OAuth |
| GET | `/api/auth/instagram?user_id={id}` | Start Instagram OAuth |
| GET | `/api/auth/facebook?user_id={id}` | Start Facebook OAuth |
| GET | `/api/auth/tiktok/callback` | TikTok OAuth callback |
| GET | `/api/auth/instagram/callback` | Instagram OAuth callback |
| POST | `/api/auth/tiktok/refresh-token` | Refresh TikTok token |
| GET | `/api/auth/tiktok/status?user_id={id}` | Check token status |
| POST | `/api/auth/logout` | Logout user |

### 📱 TikTok
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/social/tiktok/stats?user_id={id}` | Get account stats |
| GET | `/api/social/tiktok/live-stats` | Get real-time stats |
| POST | `/api/social/tiktok/publish` | Publish content |
| GET | `/api/social/tiktok/videos` | Get user videos |
| GET | `/api/social/tiktok/daily-stats` | Get historical stats |
| POST | `/api/social/tiktok/refresh` | Refresh profile data |
| GET | `/api/social/tiktok/status` | Check connection status |

### 📷 Instagram
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/social/instagram/check-permissions` | Check permissions |
| GET | `/api/social/instagram/daily-stats` | Get daily stats |
| POST | `/api/social/instagram/refresh` | Refresh profile |

### 📊 Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/data?platform_user_id={id}&period={period}` | Get analytics data |

### 🔧 Admin (Requires Admin Role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/integrations/tiktok` | Configure TikTok |
| POST | `/api/admin/integrations/instagram` | Configure Instagram |
| POST | `/api/admin/integrations/facebook` | Configure Facebook |
| GET | `/api/admin/integrations/{platform}/test` | Test integration |

### ⏰ Cron Jobs (Requires Cron Secret)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cron/collect-daily-stats` | Collect TikTok stats |
| POST | `/api/cron/collect-instagram-daily-stats` | Collect Instagram stats |

### 🛠️ Utilities
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload media files |
| GET | `/api/profile` | Get user profile |

## Common Request Examples

### Get TikTok Stats
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.socialhub.com/api/social/tiktok/stats?user_id=USER_ID"
```

### Publish to TikTok
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "mediaFile": {
      "name": "video.mp4",
      "size": 1024000,
      "type": "video/mp4",
      "data": "base64_data"
    },
    "caption": "My video",
    "settings": {
      "privacy": "PUBLIC_TO_EVERYONE",
      "allowComments": true,
      "allowDuet": true,
      "allowStitch": true
    }
  }' \
  "https://api.socialhub.com/api/social/tiktok/publish"
```

### Get Analytics Data
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.socialhub.com/api/analytics/data?platform_user_id=123&period=30d"
```

## Response Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Server Error

## Rate Limits
- Auth endpoints: 5 req/min
- Social APIs: 60 req/min
- Analytics: 30 req/min
- Publishing: 10 req/min