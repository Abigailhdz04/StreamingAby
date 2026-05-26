import type { Metadata } from 'next'
import '../styles/globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'StreamingAby — Gestión de Cuentas',
  description: 'Sistema de gestión profesional para venta de cuentas streaming',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#131c2e',
              color: '#e2e8f0',
              border: '1px solid #1e2d42',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#131c2e' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#131c2e' },
            },
          }}
        />
      </body>
    </html>
  )
}
