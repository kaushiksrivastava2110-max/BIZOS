'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Bell, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { User } from '@/types'

interface TopbarProps {
  user: User
  title?: string
}

export function Topbar({ user, title }: TopbarProps) {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/candidates?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-4 sticky top-0 z-20">
      {/* Page title */}
      {title && (
        <h1 className="text-base font-semibold text-[#1A1A2E] shrink-0">{title}</h1>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search candidates, clients, openings..."
            className="pl-9 h-8 text-xs bg-gray-50 border-gray-200"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </form>

      <div className="flex items-center gap-3 ml-auto">
        {/* Date */}
        <span className="text-xs text-gray-400 hidden lg:block">{today}</span>

        {/* Role badge */}
        <Badge variant={user.role === 'admin' ? 'green' : user.role === 'manager' ? 'blue' : 'default'}>
          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
        </Badge>
      </div>
    </header>
  )
}
