import './globals.css'
import Providers from '@/components/Providers'
export const metadata = {
  title: { default: 'Chronicle — Ваш личный ритм', template: '%s · Chronicle' },
  description: 'Задачи, привычки, челленджи и заметки. Пространство для того, что важно.',
  manifest: '/manifest.json',
  icons: { icon: '/logo.svg', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Chronicle' },
}
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f7' },
    { media: '(prefers-color-scheme: dark)', color: '#161618' },
  ],
}
export default function RootLayout({ children }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
