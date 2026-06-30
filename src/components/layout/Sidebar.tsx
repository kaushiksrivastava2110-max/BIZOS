'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Building2, Briefcase, Users, BarChart3,
  FileText, Settings, ClipboardList, LogOut, ChevronRight, HeartPulse, Radar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { User } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'recruiter', 'viewer'] },
  { href: '/clients', label: 'Clients', icon: Building2, roles: ['admin', 'manager', 'recruiter'] },
  { href: '/openings', label: 'Openings', icon: Briefcase, roles: ['admin', 'manager', 'recruiter'] },
  { href: '/candidates', label: 'Candidates', icon: Users, roles: ['admin', 'manager', 'recruiter'] },
  { href: '/daily-log', label: 'Daily Log', icon: ClipboardList, roles: ['admin', 'manager', 'recruiter'] },
  { href: '/pipeline', label: 'Pipeline', icon: Radar, roles: ['admin', 'manager'] },
  { href: '/productivity', label: 'Productivity', icon: BarChart3, roles: ['admin', 'manager'] },
  { href: '/reports', label: 'Reports', icon: FileText, roles: ['admin', 'manager'] },
  { href: '/hrms', label: 'HRMS', icon: HeartPulse, roles: ['admin', 'manager', 'recruiter'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
]

interface SidebarProps {
  user: User
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const visibleItems = navItems.filter(item => item.roles.includes(user.role))

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-56 bg-[#1A1A2E] flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="grid grid-cols-2 gap-0.5 shrink-0">
          <div className="w-3 h-3 bg-[#82BC0D] rounded-sm" />
          <div className="w-3 h-3 bg-[#0EA2E8] rounded-sm" />
          <div className="w-3 h-3 bg-[#F9B710] rounded-sm" />
          <div className="w-3 h-3 bg-white/20 rounded-sm" />
        </div>
        <div>
          <div className="text-white font-bold text-base tracking-wide">BIZOS</div>
          <div className="text-white/40 text-[10px] font-medium tracking-wider uppercase">Bizquad Ops</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/90'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-[#82BC0D]' : 'text-white/50 group-hover:text-white/70')} />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight className="h-3 w-3 text-[#82BC0D]" />}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="px-3 py-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-[#82BC0D] flex items-center justify-center text-white text-xs font-bold shrink-0">
            {getInitials(user.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user.name}</p>
            <p className="text-white/40 text-xs capitalize">{user.role}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2 mt-1 text-white/50 hover:text-white/80 hover:bg-white/5 rounded-lg text-sm transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
