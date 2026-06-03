import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Lock, Check, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SECTIONS = [
    { id: 'intro', title: '1. Introdução' },
    { id: 'collected-data', title: '2. Dados Coletados' },
    { id: 'usage', title: '3. Uso das Informações' },
    { id: 'integrations', title: '4. Integrações (Meta/Google)' },
    { id: 'sharing', title: '5. Compartilhamento' },
    { id: 'security', title: '6. Segurança' },
    { id: 'cookies', title: '7. Cookies e Rastreamento' },
    { id: 'rights', title: '8. Seus Direitos' },
    { id: 'retention', title: '9. Retenção de Dados' },
    { id: 'contact', title: '10. Contato (DPO)' },
];

export default function Privacy() {
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState('intro');

    // Simple scroll spy
    useEffect(() => {
        const handleScroll = () => {
            const scrollPosition = window.scrollY + 150; // Offset

            for (const section of SECTIONS) {
                const element = document.getElementById(section.id);
                if (element && element.offsetTop <= scrollPosition) {
                    setActiveSection(section.id);
                }
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            const offset = 100;
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            window.scrollTo({
                top: offsetPosition,
                behavior: "smooth"
            });
            setActiveSection(id);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(-1)}
                            className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                        </Button>
                        <div className="h-6 w-px bg-white/10 mx-2 hidden md:block" />
                        <div className="flex items-center gap-2">
                            <Lock className="w-5 h-5 text-ch-orange" />
                            <h1 className="text-lg font-bold uppercase tracking-tight hidden md:block">Política de Privacidade</h1>
                        </div>
                    </div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                        Última atualização: {new Date().toLocaleDateString('pt-BR')}
                    </div>
                </div>
            </div>

            <div className="container mx-auto max-w-7xl px-6 py-12 flex-1 flex flex-col md:flex-row gap-12">
                {/* Sidebar Navigation */}
                <aside className="hidden md:block w-64 flex-shrink-0">
                    <div className="sticky top-32 space-y-1">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 px-3">Índice</h3>
                        {SECTIONS.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => scrollToSection(section.id)}
                                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-200 flex items-center justify-between group ${activeSection === section.id
                                        ? 'bg-ch-orange/10 text-ch-orange font-medium'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                    }`}
                            >
                                {section.title}
                                {activeSection === section.id && <ChevronRight className="w-3 h-3" />}
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 max-w-4xl">
                    <div className="bg-card border border-border rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-ch-orange to-transparent opacity-50" />

                        <div className="prose prose-invert prose-orange max-w-none space-y-16">

                            {/* 1. Introdução */}
                            <section id="intro" className="scroll-mt-32">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">01</span>
                                    Introdução
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    O <strong>Click Auditor</strong> ("Click Auditor", "Nós") respeita a sua privacidade. Esta Política descreve como coletamos, usamos, armazenamos e compartilhamos suas informações ao utilizar nossa plataforma SaaS de inteligência de dados.
                                </p>
                            </section>

                            {/* 2. Dados Coletados */}
                            <section id="collected-data" className="scroll-mt-32">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">02</span>
                                    Dados Coletados
                                </h2>
                                <p className="text-muted-foreground mb-4">Coletamos as seguintes categorias de dados:</p>
                                <ul className="space-y-4 text-muted-foreground">
                                    <li className="flex gap-4">
                                        <div className="w-1.5 h-1.5 rounded-full bg-ch-orange mt-2.5 flex-shrink-0" />
                                        <span><strong>Dados de Identificação:</strong> Nome, e-mail, telefone e informações da empresa fornecidos no cadastro.</span>
                                    </li>
                                    <li className="flex gap-4">
                                        <div className="w-1.5 h-1.5 rounded-full bg-ch-orange mt-2.5 flex-shrink-0" />
                                        <span><strong>Credenciais de Terceiros:</strong> Tokens de acesso (OAuth) para contas de anúncio (Meta Ads, Google Ads). <strong>Nota:</strong> Nunca armazenamos suas senhas dessas plataformas, apenas os tokens de autorização.</span>
                                    </li>
                                    <li className="flex gap-4">
                                        <div className="w-1.5 h-1.5 rounded-full bg-ch-orange mt-2.5 flex-shrink-0" />
                                        <span><strong>Dados de Marketing:</strong> Métricas de desempenho (CPC, CTR, ROAS), criativos (imagens/vídeos) e configurações de campanha importados através das APIs.</span>
                                    </li>
                                </ul>
                            </section>

                            {/* 3. Uso das Informações */}
                            <section id="usage" className="scroll-mt-32">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">03</span>
                                    Uso das Informações
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-muted/50 p-4 rounded-xl border border-border">
                                        <h4 className="text-foreground font-bold text-sm mb-2 uppercase">Core do Produto</h4>
                                        <p className="text-sm text-muted-foreground">Gerar dashboards, relatórios e alertas de governança.</p>
                                    </div>
                                    <div className="bg-muted/50 p-4 rounded-xl border border-border">
                                        <h4 className="text-foreground font-bold text-sm mb-2 uppercase">Inteligência Artificial</h4>
                                        <p className="text-sm text-muted-foreground">Processar criativos para sugerir melhorias. Seus dados são usados de forma efêmera e não treinam modelos públicos.</p>
                                    </div>
                                    <div className="bg-muted/50 p-4 rounded-xl border border-border">
                                        <h4 className="text-foreground font-bold text-sm mb-2 uppercase">Comunicação</h4>
                                        <p className="text-sm text-muted-foreground">Enviar alertas sobre anomalias em campanhas ou atualizações do sistema.</p>
                                    </div>
                                    <div className="bg-muted/50 p-4 rounded-xl border border-border">
                                        <h4 className="text-foreground font-bold text-sm mb-2 uppercase">Segurança</h4>
                                        <p className="text-sm text-muted-foreground">Monitorar abusos e prevenir fraudes.</p>
                                    </div>
                                </div>
                            </section>

                            {/* 4. Integrações */}
                            <section id="integrations" className="scroll-mt-32">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">04</span>
                                    Integrações de Terceiros
                                </h2>
                                <p className="text-muted-foreground mb-4">
                                    O uso de informações recebidas das APIs do Google e Meta segue as políticas de dados de usuário desses serviços, incluindo os requisitos de "Uso Limitado".
                                </p>
                                <div className="bg-muted/50 p-6 rounded-xl border-l-2 border-ch-orange">
                                    <p className="text-sm font-medium text-foreground mb-2">Meta Platforms (Facebook)</p>
                                    <p className="text-xs text-muted-foreground">
                                        Utilizamos os dados da API de Marketing do Facebook estritamente para fornecer análises. Não compartilhamos esses dados com outras redes de anúncios ou terceiros não autorizados.
                                    </p>
                                </div>
                            </section>

                            {/* 5. Compartilhamento */}
                            <section id="sharing" className="scroll-mt-32">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">05</span>
                                    Compartilhamento
                                </h2>
                                <p className="text-muted-foreground mb-4">
                                    Não vendemos seus dados pessoais. Compartilhamos apenas com:
                                </p>
                                <ul className="space-y-3 text-sm text-muted-foreground">
                                    <li className="flex gap-2">
                                        <Check className="w-4 h-4 text-ch-orange shrink-0" />
                                        <span><strong>Provedores de Nuvem:</strong> (Ex: Supabase, AWS) para hospedagem segura.</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <Check className="w-4 h-4 text-ch-orange shrink-0" />
                                        <span><strong>Processadores de Pagamento:</strong> (Ex: Stripe) para faturamento.</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <Check className="w-4 h-4 text-ch-orange shrink-0" />
                                        <span><strong>LLMs/AI:</strong> (Ex: OpenAI) para funcionalidades de IA gerativa.</span>
                                    </li>
                                </ul>
                            </section>

                            {/* 6. Segurança */}
                            <section id="security" className="scroll-mt-32">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">06</span>
                                    Segurança
                                </h2>
                                <p className="text-muted-foreground">
                                    Adotamos medidas técnicas e organizacionais rígidas, incluindo criptografia em trânsito (TLS) e em repouso (AES-256), controles de acesso baseados em função (RBAC) e auditorias de segurança regulares.
                                </p>
                            </section>

                            {/* 7. Cookies */}
                            <section id="cookies" className="scroll-mt-32">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">07</span>
                                    Cookies
                                </h2>
                                <p className="text-muted-foreground">
                                    Utilizamos cookies essenciais para autenticação e segurança. Também podemos usar cookies analíticos para entender o uso da plataforma. Você pode gerenciar suas preferências de cookies nas configurações do seu navegador.
                                </p>
                            </section>

                            {/* 8. Direitos */}
                            <section id="rights" className="scroll-mt-32">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">08</span>
                                    Seus Direitos
                                </h2>
                                <p className="text-muted-foreground mb-4">De acordo com a LGPD e GDPR, você tem direito a:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {[
                                        "Confirmar a existência de tratamento.",
                                        "Acessar os dados.",
                                        "Corrigir dados incompletos ou inexatos.",
                                        "Solicitar a anonimização ou exclusão.",
                                        "Portabilidade dos dados."
                                    ].map((item, i) => (
                                        <div key={i} className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground flex items-center gap-2 border border-border">
                                            <div className="w-1 h-1 bg-ch-orange rounded-full" />
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* 9. Retenção */}
                            <section id="retention" className="scroll-mt-32">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">09</span>
                                    Retenção de Dados
                                </h2>
                                <p className="text-muted-foreground">
                                    Mantemos seus dados enquanto sua conta estiver ativa. Após o cancelamento, dados não essenciais são excluídos em até 90 dias. Dados de faturamento podem ser mantidos por períodos maiores para cumprimento de obrigações fiscais.
                                </p>
                            </section>

                            {/* 10. Contato */}
                            <section id="contact" className="scroll-mt-32 pb-12">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">10</span>
                                    Contato
                                </h2>
                                <div className="bg-gradient-to-r from-white/5 to-transparent p-6 rounded-xl border border-border">
                                    <p className="text-muted-foreground mb-2">Para exercer seus direitos de privacidade ou contatar nosso DPO:</p>
                                    <a href="mailto:privacy@clickhero.com" className="text-xl font-bold text-ch-orange hover:text-foreground transition-colors">
                                        privacy@clickhero.com
                                    </a>
                                </div>
                            </section>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
