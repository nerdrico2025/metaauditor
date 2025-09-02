import { useState } from "react";
import LoginForm from "@/components/Auth/LoginForm";
import RegisterForm from "@/components/Auth/RegisterForm";

export default function Landing() {
  const [isLoginMode, setIsLoginMode] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-click-hero-white-2 to-click-hero-white flex items-center justify-center p-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl lg:text-6xl font-bold text-click-hero-black">
              Click Auditor
            </h1>
            <p className="text-xl text-click-hero-dark-gray">
              Auditoria automática de criativos para Meta e Google Ads com IA avançada
            </p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-click-hero-white p-6 rounded-lg shadow-sm">
                <h3 className="font-semibold text-click-hero-black mb-2">🤖 Análise com IA</h3>
                <p className="text-click-hero-dark-gray">
                  Análise automática de conformidade e performance usando inteligência artificial
                </p>
              </div>
              <div className="bg-click-hero-white p-6 rounded-lg shadow-sm">
                <h3 className="font-semibold text-click-hero-black mb-2">🔗 Integrações</h3>
                <p className="text-click-hero-dark-gray">
                  Conecte-se facilmente com Meta Business e Google Ads
                </p>
              </div>
              <div className="bg-click-hero-white p-6 rounded-lg shadow-sm">
                <h3 className="font-semibold text-click-hero-black mb-2">📊 Relatórios</h3>
                <p className="text-click-hero-dark-gray">
                  Relatórios detalhados e dashboards em tempo real
                </p>
              </div>
              <div className="bg-click-hero-white p-6 rounded-lg shadow-sm">
                <h3 className="font-semibold text-click-hero-black mb-2">⚡ Automação</h3>
                <p className="text-click-hero-dark-gray">
                  Ações automáticas para otimizar suas campanhas
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <div className="w-full max-w-md space-y-6">
            <div className="bg-click-hero-white p-8 rounded-xl shadow-lg">
              <h2 className="text-2xl font-bold text-click-hero-black mb-6 text-center">
                Acesse a ferramenta
              </h2>
              
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="w-full bg-click-hero-orange hover:bg-click-hero-orange/90 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                ENTRAR
              </button>
              
              <p className="text-center text-click-hero-dark-gray text-sm mt-4">
                Acesse o Click Auditor sem necessidade de login
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}