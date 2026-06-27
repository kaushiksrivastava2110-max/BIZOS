'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[#1A1A2E] text-white hover:bg-[#1A1A2E]/90 focus-visible:ring-[#1A1A2E]',
        primary: 'bg-[#82BC0D] text-white hover:bg-[#6fa00b] focus-visible:ring-[#82BC0D]',
        blue: 'bg-[#0EA2E8] text-white hover:bg-[#0c8bc5] focus-visible:ring-[#0EA2E8]',
        destructive: 'bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500',
        outline: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900',
        ghost: 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
        link: 'text-[#0EA2E8] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
