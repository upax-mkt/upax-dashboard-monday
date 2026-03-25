import { Bebas_Neue, DM_Sans } from 'next/font/google'
import './globals.css'

const display = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
})

const body = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
})

export const metadata = {
  title: 'UPAX Marketing Dashboard',
  description: 'Weekly marketing meeting system',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body className="bg-upax-dark text-upax-text font-body antialiased">
        {children}
      </body>
    </html>
  )
}
