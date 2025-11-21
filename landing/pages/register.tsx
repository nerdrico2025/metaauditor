import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { CheckCircle2, Sparkles, ArrowRight, Eye, EyeOff } from 'lucide-react'

const PLATFORM_URL = 'https://70ee3bc2-1ccd-4e6b-9da8-7c85536912ab-00-33s1eutyget0m.riker.replit.dev'

export default function Register(): ReactElement {
  const router = useRouter()
  const { plan } = router.query
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    company: '',
    phone: '',
    plan: (plan as string) || 'bronze'
  })
  
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch(`${PLATFORM_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Erro ao criar conta')
      }

      const data = await response.json()
      
      localStorage.setItem('token', data.token)
      
      window.location.href = `${PLATFORM_URL}/dashboard`
    } catch (error: any) {
      console.error('Erro ao registrar:', error)
      setError(error.message || 'Erro ao criar conta. Tente novamente.')
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <>
      <Head>
        <title>Criar Conta - Click Auditor</title>
        <meta name="description" content="Crie sua conta e comece seu trial gratuito de 3 dias no Click Auditor" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Navigation */}
      <nav className="fixed w-full bg-white/95 backdrop-blur-sm shadow-sm z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
              Click Auditor
            </div>
          </Link>
          <a 
            href={`${PLATFORM_URL}/login`}
            className="text-gray-600 hover:text-orange-600 transition font-medium"
            data-testid="link-login"
          >
            Já tem conta? <span className="text-orange-600 font-semibold">Entrar</span>
          </a>
        </div>
      </nav>

      {/* Registration Form */}
      <section className="pt-32 pb-24 px-4 min-h-screen bg-gradient-to-b from-orange-50 via-white to-white">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium mb-6">
              <CheckCircle2 className="w-4 h-4" />
              <span>Trial de 3 dias grátis - sem cartão de crédito</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
              Crie sua Conta
            </h1>
            <p className="text-xl text-gray-600">
              Comece a auditar suas campanhas em minutos
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 md:p-12">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nome Completo */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none transition text-gray-900"
                  placeholder="João Silva"
                  data-testid="input-fullname"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Profissional *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none transition text-gray-900"
                  placeholder="joao@empresa.com"
                  data-testid="input-email"
                />
              </div>

              {/* Senha */}
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Senha *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none transition text-gray-900 pr-12"
                    placeholder="Mínimo 6 caracteres"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Empresa */}
              <div>
                <label htmlFor="company" className="block text-sm font-semibold text-gray-700 mb-2">
                  Empresa *
                </label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none transition text-gray-900"
                  placeholder="Minha Agência Ltda"
                  data-testid="input-company"
                />
              </div>

              {/* Telefone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                  Telefone *
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none transition text-gray-900"
                  placeholder="(11) 99999-9999"
                  data-testid="input-phone"
                />
              </div>

              {/* Plano */}
              <div>
                <label htmlFor="plan" className="block text-sm font-semibold text-gray-700 mb-2">
                  Plano Selecionado
                </label>
                <select
                  id="plan"
                  name="plan"
                  value={formData.plan}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none transition text-gray-900"
                  data-testid="select-plan"
                >
                  <option value="bronze">Bronze - R$ 149/mês</option>
                  <option value="prata">Prata - R$ 499/mês</option>
                  <option value="ouro">Ouro - R$ 999/mês</option>
                  <option value="diamante">Diamante - R$ 1.990/mês</option>
                  <option value="customizado">Customizado - Sob consulta</option>
                </select>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold text-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                data-testid="button-submit-register"
              >
                {isLoading ? (
                  'Criando conta...'
                ) : (
                  <>
                    Começar Trial de 3 Dias
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {/* Termos */}
              <p className="text-center text-sm text-gray-500">
                Ao criar sua conta, você concorda com nossos{' '}
                <a href="#" className="text-orange-600 hover:underline">Termos de Serviço</a>
                {' '}e{' '}
                <a href="#" className="text-orange-600 hover:underline">Política de Privacidade</a>
              </p>
            </form>
          </div>

          {/* Benefits */}
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              { icon: <CheckCircle2 className="w-6 h-6" />, text: 'Trial de 3 dias grátis' },
              { icon: <CheckCircle2 className="w-6 h-6" />, text: 'Sem cartão de crédito' },
              { icon: <CheckCircle2 className="w-6 h-6" />, text: 'Cancele quando quiser' }
            ].map((benefit, index) => (
              <div key={index} className="flex items-center gap-3 text-gray-700">
                <div className="text-green-500">{benefit.icon}</div>
                <span className="font-medium">{benefit.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="text-xl font-bold">Click Auditor</div>
          </div>
          <p className="text-gray-400">&copy; 2024 Click Auditor. Todos os direitos reservados.</p>
        </div>
      </footer>
    </>
  )
}
