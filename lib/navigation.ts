import { UserRole } from './types/auth'
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  Cog,
  UserCog
} from 'lucide-react'

export interface MenuItem {
  id: string
  label: string
  href: string
  icon?: any
  requiredRole: UserRole
}

export interface MenuGroup {
  id: string
  label: string
  requiredRole: UserRole
  items: MenuItem[]
}

// Grupo Redes Sociais - Todos os usuários
export const redesGroup: MenuGroup = {
  id: 'redes',
  label: 'Redes Sociais',
  requiredRole: UserRole.USER,
  items: [
    {
      id: 'tiktok',
      label: 'TikTok',
      href: '/redes/tiktok',
      requiredRole: UserRole.USER
    },
    {
      id: 'instagram',
      label: 'Instagram',
      href: '/redes/instagram',
      requiredRole: UserRole.USER
    },
    {
      id: 'facebook',
      label: 'Facebook',
      href: '/redes/facebook',
      requiredRole: UserRole.USER
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      href: '/redes/linkedin',
      requiredRole: UserRole.USER
    },
    {
      id: 'youtube',
      label: 'YouTube',
      href: '/redes/youtube',
      requiredRole: UserRole.USER
    },
    {
      id: 'threads',
      label: 'Threads',
      href: '/redes/threads',
      requiredRole: UserRole.USER
    }
  ]
}

// Grupo Settings - Admins
export const settingsGroup: MenuGroup = {
  id: 'settings',
  label: 'Settings',
  requiredRole: UserRole.ADMIN,
  items: [
    {
      id: 'equipes',
      label: 'Equipes',
      href: '/settings/equipes',
      icon: UserCog,
      requiredRole: UserRole.ADMIN
    },
    {
      id: 'usuarios',
      label: 'Usuários',
      href: '/settings/usuarios',
      icon: Users,
      requiredRole: UserRole.ADMIN
    }
  ]
}

// Grupo Integrações - Super Admin
export const integracoesGroup: MenuGroup = {
  id: 'integracoes',
  label: 'Integrações',
  requiredRole: UserRole.SUPER_ADMIN,
  items: [
    {
      id: 'tiktok-integration',
      label: 'TikTok',
      href: '/integracoes/tiktok',
      requiredRole: UserRole.SUPER_ADMIN
    },
    {
      id: 'meta-integration',
      label: 'Meta',
      href: '/integracoes/meta',
      requiredRole: UserRole.SUPER_ADMIN
    },
    {
      id: 'google-integration',
      label: 'Google',
      href: '/integracoes/google',
      requiredRole: UserRole.SUPER_ADMIN
    }
  ]
}

// Item principal Dashboard
export const dashboardItem: MenuItem = {
  id: 'dashboard',
  label: 'Dashboard',
  href: '/',
  icon: LayoutDashboard,
  requiredRole: UserRole.USER
}

export const menuGroups: MenuGroup[] = [
  redesGroup,
  settingsGroup,
  integracoesGroup
]

export const getMenuGroupsForRole = (userRole: UserRole): MenuGroup[] => {
  return menuGroups.filter(group => userRole >= group.requiredRole)
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

export const hasMenuAccess = (userRole: UserRole, menuId: string): boolean => {
  // Check dashboard access
  if (menuId === 'dashboard') {
    return userRole >= dashboardItem.requiredRole
  }
  
  // Check group access
  for (const group of menuGroups) {
    const item = group.items.find(item => item.id === menuId)
    if (item) {
      return userRole >= item.requiredRole
    }
  }
  
  return false
}