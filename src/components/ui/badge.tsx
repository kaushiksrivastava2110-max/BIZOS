import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-700',
        green: 'bg-[#82BC0D]/10 text-[#5a8409] border border-[#82BC0D]/30',
        blue: 'bg-[#0EA2E8]/10 text-[#0c7db5] border border-[#0EA2E8]/30',
        yellow: 'bg-[#F9B710]/10 text-[#b8890a] border border-[#F9B710]/30',
        red: 'bg-red-50 text-red-700 border border-red-200',
        amber: 'bg-amber-50 text-amber-700 border border-amber-200',
        navy: 'bg-[#1A1A2E]/10 text-[#1A1A2E]',
        outline: 'border border-gray-200 text-gray-700',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
