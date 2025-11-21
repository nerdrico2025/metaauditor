import Head from 'next/head'
import Link from 'next/link'
import type { ReactElement } from 'react'
import { CheckCircle2, Zap, BarChart3, Shield, Target, TrendingUp, Award, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

const PLATFORM_URL = 'https://70ee3bc2-1ccd-4e6b-9da8-7c85536912ab-00-33s1eutyget0m.riker.replit.dev'
const API_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : (process.env.NEXT_PUBLIC_API_URL || 'https://70ee3bc2-1ccd-4e6b-9da8-7c85536912ab-00-33s1eutyget0m.riker.replit.dev')

interface Plan {
  id: string
  name: string
  slug: string
  price: string
  monthlyPricing: string
  annualPricing: string
  billingCycle: string
  enableTrial: boolean
  isPopular: boolean
  investmentRange: string
  maxUsers: number
  features: string[]
}

const fallbackPlans = [
  {
    name: 'Bronze',
    price: 'R$ 149',
    period: '/mês',
    investment: 'Até R$ 20k',
    accounts: '1 conta',
    features: [
      'Análise de métricas e indicadores',
      'Análise de performance',
      'Dashboard em tempo real',
      'Suporte via email'
    ],
    highlight: false,
    trial: true
  },
  {
    name: 'Prata',
    price: 'R$ 499',
    period: '/mês',
    investment: 'R$ 21k a R$ 100k',
    accounts: 'Até 3 contas',
    features: [
      'Análise de métricas e indicadores',
      'Análise de branding e uso da marca',
      'Análise de performance',
      'Dashboard avançado',
      'Suporte prioritário'
    ],
    highlight: false,
    trial: true
  },
  {
    name: 'Ouro',
    price: 'R$ 999',
    period: '/mês',
    investment: 'R$ 21k a R$ 100k',
    accounts: '4 a 5 contas',
    features: [
      'Análise de métricas e indicadores',
      'Análise de branding e uso da marca',
      'Análise de performance',
      'Automação de ajustes',
      'Relatórios customizados',
      'Suporte prioritário'
    ],
    highlight: true,
    trial: true
  },
  {
    name: 'Diamante',
    price: 'R$ 1.990',
    period: '/mês',
    investment: 'Acima de R$ 100k',
    accounts: '6 a 10 contas',
    features: [
      'Análise de métricas e indicadores',
      'Análise de branding e uso da marca',
      'Análise de performance',
      'Automação de ajustes',
      'API de integração',
      'Gerente de contas dedicado',
      'Suporte 24/7'
    ],
    highlight: false,
    trial: true
  }
]

export default function Home(): ReactElement {
  const [plans, setPlans] = useState(fallbackPlans)
  const [loading, setLoading] = useState(true)
  const [isAnnual, setIsAnnual] = useState(false)
  const [apiPlans, setApiPlans] = useState<Plan[]>([])

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await fetch(`${API_URL}/api/plans`)
        if (response.ok) {
          const data = await response.json()
          setApiPlans(data)
          formatPlans(data, false)
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.error('Error fetching plans:', error)
        setLoading(false)
      }
    }

    const formatPlans = (data: Plan[], annual: boolean) => {
      const formattedPlans = data.map((plan: Plan) => {
        const priceToUse = annual && plan.annualPricing ? plan.annualPricing : plan.monthlyPricing || plan.price
        const priceNum = parseInt(priceToUse)
        const savings = annual && plan.annualPricing ? Math.round((1 - (parseInt(plan.annualPricing) / (parseInt(plan.monthlyPricing) * 12))) * 100) : 0
        return {
          name: plan.name,
          price: `R$ ${priceNum.toLocaleString('pt-BR')}`,
          period: annual ? '/ano' : '/mês',
          investment: plan.investmentRange || 'Personalizado',
          accounts: plan.maxUsers === 1 ? '1 conta' : plan.maxUsers <= 3 ? `Até ${plan.maxUsers} contas` : `${plan.maxUsers - 1} a ${plan.maxUsers} contas`,
          features: plan.features,
          highlight: plan.isPopular,
          trial: plan.enableTrial ?? true,
          savings: savings
        }
      })
      setPlans(formattedPlans)
      setLoading(false)
    }

    fetchPlans()
  }, [])

  const handleToggleAnnual = (annual: boolean) => {
    setIsAnnual(annual)
    if (apiPlans.length > 0) {
      const formattedPlans = apiPlans.map((plan: Plan) => {
        const priceToUse = annual && plan.annualPricing ? plan.annualPricing : plan.monthlyPricing || plan.price
        const priceNum = parseInt(priceToUse)
        const savings = annual && plan.annualPricing ? Math.round((1 - (parseInt(plan.annualPricing) / (parseInt(plan.monthlyPricing) * 12))) * 100) : 0
        return {
          name: plan.name,
          price: `R$ ${priceNum.toLocaleString('pt-BR')}`,
          period: annual ? '/ano' : '/mês',
          investment: plan.investmentRange || 'Personalizado',
          accounts: plan.maxUsers === 1 ? '1 conta' : plan.maxUsers <= 3 ? `Até ${plan.maxUsers} contas` : `${plan.maxUsers - 1} a ${plan.maxUsers} contas`,
          features: plan.features,
          highlight: plan.isPopular,
          trial: plan.enableTrial ?? true,
          savings: savings
        }
      })
      setPlans(formattedPlans)
    }
  }

  return (
    <>
      <Head>
        <title>Click Auditor - Auditoria Inteligente de Campanhas Meta Ads</title>
        <meta name="description" content="Automatize a auditoria de criativos em Meta Ads com IA. Análise de performance, branding e conformidade em tempo real." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Navigation */}
      <nav className="fixed w-full bg-white/95 backdrop-blur-sm shadow-sm z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
              Click Auditor
            </div>
          </div>
          <a 
            href={PLATFORM_URL}
            className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg font-medium"
            data-testid="button-login-nav"
          >
            Acessar Plataforma
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-4 bg-gradient-to-b from-orange-50 via-white to-white relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-full text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4" />
              <span>Trial de 3 dias grátis em todos os planos</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent leading-tight">
              Auditoria Inteligente de Campanhas Meta Ads
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 mb-10 leading-relaxed">
              Automatize a análise de conformidade, branding e performance dos seus anúncios com <span className="text-orange-600 font-semibold">inteligência artificial GPT-4o</span>
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/register" 
                className="px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl text-lg"
                data-testid="button-trial-hero"
              >
                Começar Trial de 3 Dias
              </Link>
              <a 
                href="#pricing" 
                className="px-8 py-4 border-2 border-orange-500 text-orange-600 rounded-xl font-semibold hover:bg-orange-50 transition-all text-lg"
                data-testid="link-see-plans"
              >
                Ver Planos
              </a>
            </div>

            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span>Sem cartão de crédito</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span>Cancele quando quiser</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
              Recursos que Fazem a Diferença
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Tudo que você precisa para garantir qualidade e performance nas suas campanhas
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <BarChart3 className="w-8 h-8" />,
                title: 'Análise Completa de Performance',
                description: 'Métricas detalhadas e em tempo real de todas as suas campanhas Meta Ads'
              },
              {
                icon: <Shield className="w-8 h-8" />,
                title: 'Conformidade Garantida',
                description: 'Validação automática contra normas e guidelines da Meta, Google e sua marca'
              },
              {
                icon: <Target className="w-8 h-8" />,
                title: 'Otimização Inteligente',
                description: 'Recomendações baseadas em IA para melhorar ROI e reduzir custos'
              },
              {
                icon: <TrendingUp className="w-8 h-8" />,
                title: 'Relatórios Avançados',
                description: 'Visualizações poderosas e exportação de dados em múltiplos formatos'
              },
              {
                icon: <CheckCircle2 className="w-8 h-8" />,
                title: 'Multi-Conta',
                description: 'Gerencie múltiplas contas de anúncios em uma única plataforma centralizada'
              },
              {
                icon: <Sparkles className="w-8 h-8" />,
                title: 'Suporte Dedicado',
                description: 'Equipe especializada pronta para ajudar você a extrair o máximo da plataforma'
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 hover:border-orange-200 hover:shadow-lg transition-all duration-300 group"
                data-testid={`feature-card-${index}`}
              >
                <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
              Planos para Cada Necessidade
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Escolha o plano ideal baseado no seu investimento em Meta Ads
            </p>
            
            {/* Billing Toggle */}
            <div className="mt-8 flex justify-center">
              <div className="inline-flex items-center bg-gray-200 rounded-full p-1">
                <button
                  onClick={() => handleToggleAnnual(false)}
                  className={`px-6 py-2 rounded-full font-semibold transition-all ${
                    !isAnnual
                      ? 'bg-orange-500 text-white shadow-lg'
                      : 'bg-transparent text-gray-700 hover:text-gray-900'
                  }`}
                  data-testid="toggle-monthly"
                >
                  Mensal
                </button>
                <button
                  onClick={() => handleToggleAnnual(true)}
                  className={`px-6 py-2 rounded-full font-semibold transition-all ${
                    isAnnual
                      ? 'bg-orange-500 text-white shadow-lg'
                      : 'bg-transparent text-gray-700 hover:text-gray-900'
                  }`}
                  data-testid="toggle-annual"
                >
                  Anual
                </button>
              </div>
            </div>

            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>3 dias de trial grátis - sem cartão de crédito</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-8 mb-12">
            {plans.map((plan, index) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 transition-all duration-300 ${
                  plan.highlight
                    ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-2xl scale-105 border-4 border-orange-400'
                    : 'bg-white border-2 border-gray-200 hover:border-orange-300 hover:shadow-xl'
                }`}
                data-testid={`plan-card-${plan.name.toLowerCase()}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-yellow-400 text-yellow-900 rounded-full text-sm font-bold">
                    MAIS POPULAR
                  </div>
                )}
                
                <div className="mb-6">
                  <h3 className={`text-2xl font-bold mb-2 ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                    {plan.name}
                  </h3>
                  <div className={`text-sm font-medium mb-4 ${plan.highlight ? 'text-orange-100' : 'text-gray-500'}`}>
                    Investimento Meta: {plan.investment}
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className={`text-4xl font-bold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                      {plan.price}
                    </span>
                    <span className={plan.highlight ? 'text-orange-100' : 'text-gray-500'}>
                      {plan.period}
                    </span>
                  </div>
                  {plan.savings > 0 && (
                    <div className={`text-xs font-semibold px-2 py-1 rounded inline-block ${
                      plan.highlight ? 'bg-yellow-400 text-yellow-900' : 'bg-green-100 text-green-700'
                    }`}>
                      Economize {plan.savings}%
                    </div>
                  )}
                  <div className={`text-sm font-medium ${plan.highlight ? 'text-orange-100' : 'text-gray-600'}`}>
                    {plan.accounts}
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start gap-3">
                      <CheckCircle2 className={`w-5 h-5 flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-white' : 'text-orange-500'}`} />
                      <span className={plan.highlight ? 'text-orange-50' : 'text-gray-700'}>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/register?plan=${plan.name.toLowerCase()}`}
                  className={`block w-full py-4 rounded-xl font-bold text-center transition-all ${
                    plan.highlight
                      ? 'bg-white text-orange-600 hover:bg-orange-50 shadow-lg'
                      : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-md hover:shadow-lg'
                  }`}
                  data-testid={`button-start-${plan.name.toLowerCase()}`}
                >
                  Iniciar Trial de 3 Dias
                </Link>
              </div>
            ))}
          </div>

          {/* Plano Customizado CTA */}
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl p-12 bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 text-center">
              <h3 className="text-3xl font-bold mb-4 text-gray-900">Plano Customizado</h3>
              <p className="text-xl text-gray-600 mb-6">
                Precisa de uma solução personalizada? Nossa equipe pode criar um plano sob medida com módulos adicionais, integrações customizadas e suporte white-glove.
              </p>
              <a
                href="mailto:contato@clickauditor.com?subject=Interesse em Plano Customizado"
                className="inline-block px-8 py-4 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-xl font-bold hover:from-orange-700 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl"
                data-testid="button-contact-custom"
              >
                Falar com Vendas
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="max-w-4xl mx-auto text-center relative">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
            Pronto para Revolucionar suas Campanhas?
          </h2>
          <p className="text-xl md:text-2xl mb-10 text-orange-100">
            Comece seu trial gratuito de 3 dias agora mesmo. Sem cartão de crédito.
          </p>
          <Link 
            href="/register" 
            className="inline-block px-10 py-5 bg-white text-orange-600 rounded-xl font-bold text-lg hover:bg-orange-50 transition-all shadow-2xl hover:shadow-3xl hover:scale-105"
            data-testid="button-trial-cta"
          >
            Iniciar Trial Gratuito
          </Link>
          <p className="mt-6 text-orange-100">
            Junte-se a centenas de agências que já automatizaram suas auditorias
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="text-2xl font-bold">Click Auditor</div>
              </div>
              <p className="text-gray-400 mb-6 max-w-md">
                A plataforma de auditoria inteligente que ajuda agências e anunciantes a garantir qualidade e performance em campanhas Meta Ads.
              </p>
            </div>
            
            <div>
              <h4 className="font-bold mb-4">Produto</h4>
              <ul className="space-y-3 text-gray-400">
                <li><a href="#pricing" className="hover:text-white transition">Preços</a></li>
                <li><a href="/login" className="hover:text-white transition">Login</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-4">Contato</h4>
              <ul className="space-y-3 text-gray-400">
                <li>contato@clickauditor.com</li>
                <li>Suporte 24/7</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-700 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Click Auditor. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </>
  )
}
