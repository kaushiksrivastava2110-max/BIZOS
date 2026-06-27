import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BIZOS — Bizquad Operations',
  description: 'Internal operations platform for Bizquad Consultants',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full">{children}</body>
    </html>
  )
}
