import { useState } from "react";
import LoginForm from "@/components/Auth/LoginForm";
import RegisterForm from "@/components/Auth/RegisterForm";

export default function Landing() {
  const [isLoginMode, setIsLoginMode] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl lg:text-6xl font-bold text-gray-900">
              Click Auditor
            </h1>
            <p className="text-xl text-gray-600">
              Auditoria automática de criativos para Meta e Google Ads com IA avançada
            </p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-2">🤖 Análise com IA</h3>
                <p className="text-gray-600">
                  Análise automática de conformidade e performance usando inteligência artificial
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-2">🔗 Integrações</h3>
                <p className="text-gray-600">
                  Conecte-se facilmente com Meta Business e Google Ads
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-2">📊 Relatórios</h3>
                <p className="text-gray-600">
                  Relatórios detalhados e dashboards em tempo real
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-2">⚡ Automação</h3>
                <p className="text-gray-600">
                  Ações automáticas para otimizar suas campanhas
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          {isLoginMode ? (
            <LoginForm onToggleMode={() => setIsLoginMode(false)} />
          ) : (
            <RegisterForm onToggleMode={() => setIsLoginMode(true)} />
          )}
        </div>
      </div>
    </div>
  );
}