import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '🛠️ Eskwela — Developer Console',
  description: 'Reply to your app users',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
