'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ReportsView } from './ReportsView'
import { ClientPerformanceView } from './ClientPerformanceView'
import { FileText, BarChart3 } from 'lucide-react'
import type { User } from '@/types'

interface Props { currentUser: User }

export function ReportsPageClient({ currentUser }: Props) {
  return (
    <Tabs defaultValue="reports" className="space-y-5">
      <TabsList>
        <TabsTrigger value="reports" className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" /> Generated Reports
        </TabsTrigger>
        <TabsTrigger value="tracker" className="flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" /> Client Performance
        </TabsTrigger>
      </TabsList>

      <TabsContent value="reports">
        <ReportsView currentUser={currentUser} />
      </TabsContent>

      <TabsContent value="tracker">
        <ClientPerformanceView currentUser={currentUser} />
      </TabsContent>
    </Tabs>
  )
}
