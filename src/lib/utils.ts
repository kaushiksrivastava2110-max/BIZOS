import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return format(new Date(date), 'dd MMM yyyy')
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), 'dd MMM yyyy, HH:mm')
}

export function timeAgo(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function daysSince(date: string | Date) {
  return differenceInDays(new Date(), new Date(date))
}

export function formatCurrency(amount: number) {
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`
  }
  return `₹${amount.toLocaleString('en-IN')}`
}

export function formatLPA(amount: number) {
  return `${(amount / 100000).toFixed(1)} LPA`
}

export const HEALTH_COLORS = {
  green: '#82BC0D',
  amber: '#F9B710',
  red: '#ef4444',
} as const

export const BRAND = {
  green: '#82BC0D',
  blue: '#0EA2E8',
  yellow: '#F9B710',
  navy: '#1A1A2E',
} as const

export const PRACTICE_AREAS = [
  'SAP', 'Cloud', 'Full Stack', 'Data/AI', 'GenAI',
  'Salesforce', 'ServiceNow', 'DevOps', 'Other',
] as const

export const SUBMISSION_STAGES = [
  'Submitted', 'Client Review',
  'Interview L1', 'Interview L2', 'Offer', 'Joined', 'Dropped',
] as const

export const STAGE_COLORS: Record<string, string> = {
  Submitted: '#0EA2E8',
  'Client Review': '#F9B710',
  'Interview L1': '#8b5cf6',
  'Interview L2': '#6366f1',
  Offer: '#f97316',
  Joined: '#22c55e',
  Dropped: '#ef4444',
}
