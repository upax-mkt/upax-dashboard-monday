import { NextResponse } from 'next/server'

const PASSWORD = process.env.DASHBOARD_PASSWORD || 'upax2026'

export function middleware(request) {
  // Excluir health checks y assets estáticos
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next()
  }

  const authHeader = request.headers.get('authorization')

  if (authHeader) {
    // Basic Auth: "Basic base64(user:password)"
    const encoded = authHeader.replace('Basic ', '')
    try {
      const decoded = atob(encoded)
      const [, pass] = decoded.split(':')
      if (pass === PASSWORD) {
        return NextResponse.next()
      }
    } catch {}
  }

  // No autenticado — pedir credenciales
  return new NextResponse('Acceso restringido', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Weekly Dashboard · Mkt Corp Upax"',
    },
  })
}

export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas excepto:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
