import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata = {
  title: 'UPAX Marketing Dashboard',
  description: 'Weekly marketing meeting system',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={inter.variable}>
      <body style={{ fontFamily: "var(--sans)", margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  )
}
