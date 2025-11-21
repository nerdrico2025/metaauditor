import { useEffect } from 'react'

export default function Login() {
  useEffect(() => {
    // Redireciona para o app de login
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    window.location.href = `${apiUrl}/login`
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
        <p className="mt-2 text-gray-600 dark:text-gray-300">Redirecionando para login...</p>
      </div>
    </div>
  )
}
