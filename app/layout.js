// app/layout.js — Chronicle v2.0
import Providers from '@/components/Providers'

export const metadata = {
  title: 'Chronicle',
  description: 'Your personal intelligence system',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Chronicle',
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'Chronicle',
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#030407',
  },
}

export const viewport = {
  themeColor: '#030407',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        {/* iOS PWA */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icon-152.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icon-120.png" />

        {/* iOS splash screens */}
        <link rel="apple-touch-startup-image"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)"
          href="/splash-390x844.png" />
        <link rel="apple-touch-startup-image"
          media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)"
          href="/splash-430x932.png" />

        {/* Font preconnect for faster load */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* PWA session preservation */}
        <script dangerouslySetInnerHTML={{ __html: `
          if (window.navigator.standalone) {
            sessionStorage.setItem('pwa_mode', '1');
          }
        `}} />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#030407' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
