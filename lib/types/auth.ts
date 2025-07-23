export enum UserRole {
  USER = 1,
  ADMIN = 2,
  SUPER_ADMIN = 3
}

export interface Role {
  id: string
  name: string
  level: number
  description?: string
  permissions?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  role_id: string
  full_name?: string
  avatar_url?: string
  created_at: string
  updated_at: string
  roles?: Role
}

export interface UserWithProfile {
  id: string
  email?: string
  profile?: Profile
}

export const hasPermission = (userLevel: number, requiredLevel: UserRole): boolean => {
  return userLevel >= requiredLevel
}

export const getRoleName = (level: number): string => {
  switch (level) {
    case UserRole.SUPER_ADMIN:
      return 'Super Admin'
    case UserRole.ADMIN:
      return 'Admin'
    case UserRole.USER:
    default:
      return 'User'
  }
}

export const canAccessRoute = (userLevel: number, route: string): boolean => {
  const routePermissions = {
    '/admin': UserRole.ADMIN,
    '/super-admin': UserRole.SUPER_ADMIN,
    '/users': UserRole.ADMIN,
    '/roles': UserRole.SUPER_ADMIN,
  }

  const requiredLevel = routePermissions[route as keyof typeof routePermissions]
  
  if (!requiredLevel) return true // Public route
  
  return hasPermission(userLevel, requiredLevel)
}