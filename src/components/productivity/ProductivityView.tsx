'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { format, subDays, startOfWeek, eachWeekOfInterval, parseISO } from 'date-fns'
import { BRAND } from '@/lib/utils'
import type { User } from '@/types'

interface Props { currentUser: User }

export function ProductivityView({ currentUser }: Props) {
  const [recruiters, setRecruiters] = useState<User[]>([])
  const [filterRecruiter, setFilterRecruiter] = useState('all')
  const [weeklyData, setWeeklyData] = useState<any[]>([])
  const [stageData, setStageData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const dateRange = {
    start: subDays(new Date(), 56), // 8 weeks
    end: new Date(),
  }

  useEffect(() => {
    supabase.from('users').select('id, name, role').in('role', ['recruiter', 'manager']).order('name')
      .then(({ data }) => setRecruiters(data as User[] ?? []))
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const startIso = dateRange.start.toISOString()
      const endIso = dateRange.end.toISOString()

      let logsQ = supabase
        .from('daily_logs')
        .select('*, user:users(id, name)')
        .gte('log_date', startIso.split('T')[0])
        .lte('log_date', endIso.split('T')[0])
        .order('log_date')

      if (filterRecruiter !== 'all') logsQ = logsQ.eq('user_id', filterRecruiter)

      const { data: logs } = await logsQ

      // Aggregate by week
      const weeks = eachWeekOfInterval({ start: dateRange.start, end: dateRange.end })
      const weekMap: Record<string, any> = {}

      for (const week of weeks) {
        const key = format(week, 'MMM dd')
        weekMap[key] = { week: key, resumes: 0, submissions: 0, interviews: 0, offers: 0 }
      }

      for (const log of logs ?? []) {
        const logDate = parseISO(log.log_date)
        const weekStart = startOfWeek(logDate)
        const key = format(weekStart, 'MMM dd')
        if (weekMap[key]) {
          weekMap[key].resumes += log.resumes_sourced
          weekMap[key].submissions += log.submissions_done
          weekMap[key].interviews += log.interviews_arranged
          weekMap[key].offers += log.offers_made
        }
      }

      setWeeklyData(Object.values(weekMap))

      // Stage cycle time
      const { data: submissions } = await supabase
        .from('submissions')
        .select('id, stage, stage_entered_at, created_at')
        .gte('created_at', startIso)

      const stageCounts: Record<string, { total: number; count: number }> = {}
      const STAGES = ['Sourced', 'Screened', 'Submitted', 'Client Review', 'Interview L1', 'Interview L2', 'Offer']
      STAGES.forEach(s => { stageCounts[s] = { total: 0, count: 0 } })

      for (const s of submissions ?? []) {
        if (stageCounts[s.stage]) {
          const days = Math.floor((new Date().getTime() - new Date(s.stage_entered_at).getTime()) / (1000 * 60 * 60 * 24))
          stageCounts[s.stage].total += days
          stageCounts[s.stage].count += 1
        }
      }

      setStageData(STAGES.map(s => ({
        stage: s.replace('Interview ', 'IV '),
        avgDays: stageCounts[s].count > 0 ? Math.round(stageCounts[s].total / stageCounts[s].count) : 0,
        count: stageCounts[s].count,
      })))

      setLoading(false)
    }
    load()
  }, [filterRecruiter])

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500 font-medium">Filter by:</span>
        <Select value={filterRecruiter} onValueChange={setFilterRecruiter}>
          <SelectTrigger className="h-8 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Recruiters</SelectItem>
            {recruiters.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400">Last 8 weeks</span>
      </div>

      {/* Weekly activity chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Weekly Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="resumes" name="Resumes Sourced" fill={BRAND.green} radius={[2,2,0,0]} />
              <Bar dataKey="submissions" name="Submissions" fill={BRAND.blue} radius={[2,2,0,0]} />
              <Bar dataKey="interviews" name="Interviews" fill="#8b5cf6" radius={[2,2,0,0]} />
              <Bar dataKey="offers" name="Offers" fill="#22c55e" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Stage cycle time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Average Days per Stage (active candidates)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stageData} layout="vertical" margin={{ top: 5, right: 40, left: 70, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} unit="d" />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: '#6b7280' }} width={70} />
              <Tooltip
                formatter={(v) => [`${v} days avg`, 'Avg time in stage']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="avgDays" fill={BRAND.yellow} radius={[0,4,4,0]}>
                {stageData.map((entry, index) => (
                  <rect
                    key={index}
                    fill={entry.avgDays > 10 ? '#ef4444' : entry.avgDays > 5 ? BRAND.yellow : BRAND.green}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-400 mt-2">Red = over 10 days · Yellow = over 5 days · Green = within threshold</p>
        </CardContent>
      </Card>

      {/* Stage breakdown table */}
      {stageData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Stage Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 py-2">Stage</th>
                  <th className="text-right text-xs font-medium text-gray-500 py-2">Active Count</th>
                  <th className="text-right text-xs font-medium text-gray-500 py-2">Avg Days</th>
                  <th className="text-right text-xs font-medium text-gray-500 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stageData.map(row => (
                  <tr key={row.stage}>
                    <td className="py-2.5 text-sm text-[#1A1A2E]">{row.stage}</td>
                    <td className="py-2.5 text-sm text-right text-gray-600">{row.count}</td>
                    <td className="py-2.5 text-sm font-bold text-right" style={{
                      color: row.avgDays > 10 ? '#ef4444' : row.avgDays > 5 ? '#F9B710' : '#82BC0D'
                    }}>
                      {row.avgDays}d
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={`text-xs font-medium ${row.avgDays > 10 ? 'text-red-500' : row.avgDays > 5 ? 'text-amber-500' : 'text-[#82BC0D]'}`}>
                        {row.avgDays > 10 ? '🔴 Slow' : row.avgDays > 5 ? '🟡 Monitor' : '🟢 Good'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
