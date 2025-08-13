# CLAUDE.md

### User Menu Implementation Plan

To enhance user experience, a dropdown menu has been added to the sidebar, providing easy access to profile, settings, and logout functions.

**1. Component Structure:**

- **`components/user-menu.tsx`**: The main component that orchestrates the dropdown functionality. It uses `DropdownMenu` from `shadcn/ui` and integrates `UserMenuTrigger` and `UserMenuContent`.
- **`components/user-menu-trigger.tsx`**: Displays the user's avatar, name, and role. Clicking this component opens the dropdown menu.
- **`components/user-menu-content.tsx`**: Contains the menu items: Profile, Settings, Support, and Log out. Each item is a `DropdownMenuItem` that links to the respective page or triggers an action.

**2. Integration with Sidebar:**

- The `UserMenu` component is placed in the `SidebarHeader` of `components/app-sidebar.tsx`.
- The previous static user information and logout button in the `SidebarFooter` have been removed to avoid redundancy.

**3. Authentication and Data Flow:**

- The `useAuth` hook provides user data (profile, role, etc.) to the menu components.
- The `signOut` function from `useAuth` is used for the logout action, ensuring a clean session termination.

**4. Styling and UX:**

- The menu follows the `shadcn/ui` design system, ensuring a consistent look and feel with the rest of the application.
- The trigger is a visually appealing element showing user context at a glance.
- The dropdown provides a clean and organized way to access user-specific actions.



## Development Commands

**Development server:**
```bash
npm run dev          # Start development server with Turbopack
```

**Build and production:**
```bash
npm run build        # Build for production
npm start           # Start production server
npm run lint        # ESLint code linting
```

**Testing:**
```bash
npm test            # Run Jest tests
npm run test:watch  # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## Core Architecture

### Tech Stack
- **Framework**: Next.js 15 with App Router and TypeScript
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Authentication**: Supabase Auth with OAuth 2.0 flows
- **Styling**: TailwindCSS 4 with shadcn/ui components
- **Charts**: Recharts for analytics visualizations
- **Internationalization**: next-intl with multi-language support
- **Testing**: Jest with React Testing Library

### Project Structure

The application follows Next.js 15 App Router conventions:

- `app/` - App Router pages and API routes
  - `api/` - API endpoints organized by feature
    - `analytics/` - Analytics data endpoints
    - `auth/` - OAuth flows (TikTok, Instagram, Facebook)
    - `social/` - Social platform integrations
    - `cron/` - Automated data collection jobs
  - `analytics/` - Analytics dashboard pages
  - `networks/` - Social network management pages
  - `integrations/` - Platform integration setup

- `components/` - React components
  - `ui/` - shadcn/ui base components
  - `analytics/` - Chart components and dashboards
  - `admin/` - Admin panel components

- `lib/` - Utilities and configurations
  - `supabase.ts` - Supabase client configuration
  - `middleware-auth.ts` - Authentication middleware helpers
  - `types/` - TypeScript type definitions

- `hooks/` - Custom React hooks for data fetching and state management

### Authentication & Authorization

The app uses a role-based access control system with three levels:
- **User (1)**: Basic access to own data
- **Admin (2)**: Access to admin routes (`/admin`, `/integrations`)
- **Super Admin (3)**: Access to super admin routes (`/super-admin`, `/users`)

Authentication flow:
1. Supabase Auth handles login/logout
2. Middleware checks authentication and role permissions
3. RLS policies enforce data access at database level

### Database Schema

Key tables:
- `social_connections` - OAuth tokens and profile data for connected accounts
- `tiktok_daily_stats` - Historical analytics data for TikTok accounts
- `profiles` - User profiles with role assignments
- `roles` - Role definitions with permission levels

All tables use RLS policies to ensure users can only access their own data.

### Social Platform Integrations

**TikTok Integration (Complete):**
- OAuth 2.0 authentication flow
- Content publishing via Content Posting API
- Analytics data collection via Display API
- Daily stats collection via cron job

**Instagram/Facebook (In Progress):**
- Meta Business API integration
- OAuth flows implemented
- Analytics collection in development

### API Patterns

All API routes follow these patterns:
- Authentication via Authorization header with Bearer token
- Input validation using Zod schemas where applicable
- Error handling with appropriate HTTP status codes
- RLS enforcement through authenticated Supabase client

Example API structure:
```typescript
export async function GET(request: NextRequest) {
  // 1. Extract and validate auth token
  const authHeader = request.headers.get('authorization')
  // 2. Create authenticated Supabase client
  const supabase = createClient(/* with auth */)
  // 3. Verify user token
  const { data: { user } } = await supabase.auth.getUser()
  // 4. Process request with user context
}
```

### Component Architecture

**Layout System:**
- Root layout provides global providers (Auth, Theme, i18n)
- Dashboard layout with sidebar and breadcrumb navigation
- Responsive design with mobile-first approach

**UI Components:**
- Based on shadcn/ui with customizations
- Chart components using Recharts with consistent styling
- Form components with react-hook-form and Zod validation

**Data Fetching:**
- Custom hooks for API data fetching
- SWR-like patterns for caching and revalidation
- Loading and error states handled consistently

### Internationalization

Uses next-intl with support for:
- Languages: en, pt, es, ja, ko, zh-CN, zh-TW
- Server-side locale detection
- Structured translation files in `locales/`
- Client and server component compatibility

### Deployment

**Vercel Configuration:**
- Automatic deployments from main branch
- Cron jobs for daily stats collection (23:00 UTC daily)
- Environment variables for API keys and secrets

**Required Environment Variables:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
TIKTOK_CLIENT_KEY
TIKTOK_CLIENT_SECRET
TIKTOK_REDIRECT_URI
NEXT_PUBLIC_SITE_URL
```

### Development Guidelines

**Code Style:**
- TypeScript strict mode enabled
- ESLint configured with Next.js rules
- Consistent import order: React → Next.js → External → Internal
- Use absolute imports with `@/` prefix

**Component Creation:**
- Use TypeScript interfaces for all props
- Follow shadcn/ui patterns for UI components
- Include proper error boundaries and loading states
- Implement proper accessibility attributes

**API Development:**
- Always authenticate requests using middleware patterns
- Use RLS policies rather than manual authorization checks
- Include proper error handling and logging
- Validate inputs and sanitize outputs

**Testing:**
- Write tests for utility functions and complex components
- Use React Testing Library for component tests
- Mock external API calls in tests
- Maintain test coverage for critical paths

### Security Considerations

- RLS policies enforce data isolation between users
- OAuth tokens encrypted at rest
- CSRF protection via Next.js built-ins
- Content Security Policy headers in middleware
- Input sanitization for user-generated content
- Rate limiting on external API calls
- Always use project_id unfdlpzcdalzvrjueanu to Supabase MCP