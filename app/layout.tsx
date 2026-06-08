import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Grain Conference Intel',
  description: 'Conference Intelligence Tool for Grain Sales Team',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-surface-muted text-content-primary min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
