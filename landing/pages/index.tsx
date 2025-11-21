import Head from 'next/head'
import Link from 'next/link'
import { CheckCircle2, Zap, BarChart3, Shield } from 'lucide-react'

export default function Home() {
  return (
    <>
      <Head>
        <title>Click Auditor - Auditoria de Campanhas com IA</title>
        <meta name="description" content="Automatize a auditoria de criativos em Meta e Google Ads com inteligência artificial avançada" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Navigation */}
      <nav className="fixed w-full bg-white dark:bg-click-dark-gray shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="text-2xl font-bold text-click-orange">Click Auditor</div>
          <Link href="/login" className="px-6 py-2 bg-click-orange text-white rounded-lg hover:bg-orange-700 transition">
            Acessar
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-click-white-2 to-white dark:from-click-dark-gray dark:to-click-black">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 text-click-black dark:text-white">
            Auditoria Inteligente de Campanhas
          </h1>
          <p className="text-xl text-click-dark-gray dark:text-click-white-2 mb-8">
            Automatize a análise de conformidade e performance de seus anúncios em Meta e Google Ads usando inteligência artificial avançada
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/login" className="px-8 py-3 bg-click-orange text-white rounded-lg font-semibold hover:bg-orange-700 transition">
              Começar Gratuitamente
            </Link>
            <button className="px-8 py-3 border-2 border-click-orange text-click-orange rounded-lg font-semibold hover:bg-orange-50 dark:hover:bg-opacity-10 transition">
              Ver Demo
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 text-click-black dark:text-white">
            Recursos Poderosos
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8 bg-click-white-2 dark:bg-gray-800 rounded-lg">
              <Zap className="w-12 h-12 text-click-orange mb-4" />
              <h3 className="text-2xl font-bold mb-3 text-click-black dark:text-white">Análise com IA</h3>
              <p className="text-click-dark-gray dark:text-click-white-2">
                GPT-4o analisa automaticamente conformidade de marca e performance de cada criativo
              </p>
            </div>

            <div className="p-8 bg-click-white-2 dark:bg-gray-800 rounded-lg">
              <BarChart3 className="w-12 h-12 text-click-orange mb-4" />
              <h3 className="text-2xl font-bold mb-3 text-click-black dark:text-white">Dashboard em Tempo Real</h3>
              <p className="text-click-dark-gray dark:text-click-white-2">
                Visualize métricas, relatórios e recomendações atualizadas em tempo real
              </p>
            </div>

            <div className="p-8 bg-click-white-2 dark:bg-gray-800 rounded-lg">
              <Shield className="w-12 h-12 text-click-orange mb-4" />
              <h3 className="text-2xl font-bold mb-3 text-click-black dark:text-white">Conformidade Garantida</h3>
              <p className="text-click-dark-gray dark:text-click-white-2">
                Valide políticas de marca e identifique violações antes que afetem suas campanhas
              </p>
            </div>

            <div className="p-8 bg-click-white-2 dark:bg-gray-800 rounded-lg">
              <CheckCircle2 className="w-12 h-12 text-click-orange mb-4" />
              <h3 className="text-2xl font-bold mb-3 text-click-black dark:text-white">Automação Inteligente</h3>
              <p className="text-click-dark-gray dark:text-click-white-2">
                Pause automaticamente criativos com baixo desempenho ou não conformes
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4 bg-click-white-2 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 text-click-black dark:text-white">
            Planos Simples e Transparentes
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: 'Starter', price: 'R$ 99', desc: 'Para pequenas agências', features: ['1 conta de anúncios', 'Até 100 criativos/mês', 'Análise básica', 'Suporte por email'] },
              { name: 'Professional', price: 'R$ 299', desc: 'Para agências em crescimento', features: ['Até 5 contas', 'Criativos ilimitados', 'Análise avançada + IA', 'Relatórios customizados', 'Suporte prioritário'], highlight: true },
              { name: 'Enterprise', price: 'Customizado', desc: 'Para grandes operações', features: ['Contas ilimitadas', 'SLA garantido', 'Integração API', 'Conta dedicada', 'Suporte 24/7'] },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`p-8 rounded-lg transition ${
                  plan.highlight
                    ? 'bg-click-orange text-white shadow-lg scale-105'
                    : 'bg-white dark:bg-gray-800 text-click-black dark:text-white border-2 border-gray-200 dark:border-gray-700'
                }`}
              >
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className={plan.highlight ? 'text-orange-100 mb-4' : 'text-click-dark-gray dark:text-click-white-2 mb-4'}>{plan.desc}</p>
                <div className="text-3xl font-bold mb-6">{plan.price}</div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button className={`w-full py-3 rounded-lg font-semibold transition ${
                  plan.highlight
                    ? 'bg-white text-click-orange hover:bg-orange-50'
                    : 'bg-click-orange text-white hover:bg-orange-700'
                }`}>
                  Começar Agora
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-click-orange to-orange-600 rounded-lg p-12 text-center text-white">
          <h2 className="text-4xl font-bold mb-6">Pronto para Começar?</h2>
          <p className="text-xl mb-8 text-orange-100">Automatize sua auditoria de campanhas hoje mesmo</p>
          <Link href="/login" className="inline-block px-8 py-4 bg-white text-click-orange rounded-lg font-bold text-lg hover:bg-orange-50 transition">
            Acessar Click Auditor
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-click-dark-gray text-white py-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-click-white-2">&copy; 2024 Click Auditor. Todos os direitos reservados.</p>
        </div>
      </footer>
    </>
  )
}
