'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PayslipsView } from './PayslipsView'
import { LeavesView } from './LeavesView'
import { EmployeesView } from './EmployeesView'
import { Receipt, CalendarDays, Users } from 'lucide-react'
import type { User } from '@/types'

interface Props { currentUser: User }

export function HRMSView({ currentUser }: Props) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager'

  return (
    <Tabs defaultValue="payslips" className="space-y-5">
      <TabsList>
        <TabsTrigger value="payslips" className="flex items-center gap-1.5">
          <Receipt className="h-3.5 w-3.5" /> Payslips
        </TabsTrigger>
        <TabsTrigger value="leaves" className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" /> Leaves
        </TabsTrigger>
        {isAdmin && (
          <TabsTrigger value="employees" className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Employees
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="payslips">
        <PayslipsView currentUser={currentUser} />
      </TabsContent>

      <TabsContent value="leaves">
        <LeavesView currentUser={currentUser} />
      </TabsContent>

      {isAdmin && (
        <TabsContent value="employees">
          <EmployeesView currentUser={currentUser} />
        </TabsContent>
      )}
    </Tabs>
  )
}
