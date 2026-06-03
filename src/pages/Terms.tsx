import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Scale, Check, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SECTIONS = [
    { id: 'intro', title: '1. Introdução' },
    { id: 'definitions', title: '2. Definições' },
    { id: 'account', title: '3. Conta e Acesso' },
    { id: 'usage', title: '4. Uso Aceitável' },
    { id: 'ai-disclaimer', title: '5. Inteligência Artificial' },
    { id: 'payments', title: '6. Pagamentos e Planos' },
    { id: 'intellectual-property', title: '7. Propriedade Intelectual' },
    { id: 'liability', title: '8. Limitação de Responsabilidade' },
    { id: 'privacy', title: '9. Privacidade de Dados' },
    { id: 'termination', title: '10. Rescisão' },
    { id: 'changes', title: '11. Alterações' },
    { id: 'contact', title: '12. Contato' },
];

export default function Terms() {
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
                            <Scale className="w-5 h-5 text-ch-orange" />
                            <h1 className="text-lg font-bold uppercase tracking-tight hidden md:block">Termos de Uso</h1>
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
                                    Bem-vindo ao <strong>Click Auditor</strong> ("Click Auditor", "Nós", "Plataforma"). Estes Termos de Uso ("Termos") regem seu acesso e uso de nossa plataforma de inteligência de dados, análise preditiva e ferramentas de otimização de publicidade (o "Serviço").
                                </p>
                                <p className="text-muted-foreground leading-relaxed">
                                    Ao criar uma conta ou acessar o Serviço, você ("Usuário", "Cliente") concorda expressamente com estes Termos. Se você estiver usando o Serviço em nome de uma empresa, você declara ter autoridade para vincular essa entidade a estes Termos.
                                </p>
                            </section>

                            {/* 2. Definições */}
                            <section id="definitions" className="scroll-mt-32">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">02</span>
                                    Definições
                                </h2>
                                <ul className="space-y-4 text-muted-foreground">
                                    <li className="flex gap-4">
                                        <div className="w-1.5 h-1.5 rounded-full bg-ch-orange mt-2.5 flex-shrink-0" />
                                        <span><strong>"Dados do Usuário":</strong> Refere-se a todos os dados, métricas, criativos e informações que você conecta, envia ou gera através da plataforma (ex: dados do Meta Ads).</span>
                                    </li>
                                    <li className="flex gap-4">
                                        <div className="w-1.5 h-1.5 rounded-full bg-ch-orange mt-2.5 flex-shrink-0" />
                                        <span><strong>"Insights":</strong> Análises, relatórios, pontuações e recomendações geradas pelos nossos algoritmos e IA baseados nos Dados do Usuário.</span>
                                    </li>
                                    <li className="flex gap-4">
                                        <div className="w-1.5 h-1.5 rounded-full bg-ch-orange mt-2.5 flex-shrink-0" />
                                        <span><strong>"API de Terceiros":</strong> Interfaces de programação de aplicativos fornecidas por plataformas como Meta (Facebook/Instagram), Google e TikTok.</span>
                                    </li>
                                </ul>
                            </section>

                            {/* 3. Conta e Acesso */}
                            <section id="account" className="scroll-mt-32">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">03</span>
                                    Conta e Acesso
                                </h2>
                                <div className="space-y-4 text-muted-foreground">
                                    <p><strong>3.1 Elegibilidade:</strong> Você deve ter pelo menos 18 anos de idade para usar o Serviço.</p>
                                    <p><strong>3.2 Segurança:</strong> Você é o único responsável por manter a confidencialidade de suas credenciais de login. Qualquer atividade realizada através de sua conta é de sua responsabilidade.</p>
                                    <p><strong>3.3 Conexão de Contas:</strong> Para utilizar as funcionalidades principais do Click Auditor, você deverá autorizar a conexão com suas contas de anúncio (ex: Facebook Ads Manager). Ao fazer isso, você nos concede permissão para ler, analisar e (se habilitado por você) modificar dados dessas contas.</p>
                                </div>
                            </section>

                            {/* 4. Uso Aceitável */}
                            <section id="usage" className="scroll-mt-32">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">04</span>
                                    Uso Aceitável
                                </h2>
                                <p className="text-muted-foreground mb-4">Você concorda em não:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        "Utilizar o serviço para promover produtos ilegais ou fraudulentos.",
                                        "Tentar violar a segurança ou integridade da nossa infraestrutura.",
                                        "Revender, sublicenciar ou redistribuir o Serviço sem autorização.",
                                        "Utilizar bots ou scrapers para extrair dados da nossa plataforma."
                                    ].map((item, i) => (
                                        <div key={i} className="bg-muted/50 p-4 rounded-xl border border-border flex items-start gap-3">
                                            <div className="bg-red-500/10 p-1 rounded text-red-500 mt-0.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                            </div>
                                            <span className="text-sm text-muted-foreground">{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* 5. Inteligência Artificial */}
                            <section id="ai-disclaimer" className="scroll-mt-32">
                                <div className="bg-gradient-to-br from-ch-orange/10 to-transparent p-6 rounded-xl border border-ch-orange/20">
                                    <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                        <span className="bg-ch-orange text-black text-sm font-mono py-1 px-2 rounded font-bold">05</span>
                                        Uso de Inteligência Artificial
                                    </h2>
                                    <p className="text-muted-foreground mb-4">
                                        O Click Auditor utiliza modelos avançados de Inteligência Artificial (LLMs) para fornecer diagnósticos e sugestões de copy. É importante entender que:
                                    </p>
                                    <ul className="space-y-3 text-sm text-muted-foreground">
                                        <li className="flex gap-2">
                                            <Check className="w-4 h-4 text-ch-orange shrink-0" />
                                            <span>A IA é uma ferramenta probabilística e pode gerar informações imprecisas ("alucinações").</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <Check className="w-4 h-4 text-ch-orange shrink-0" />
                                            <span>Você deve sempre revisar as sugestões geradas pela IA antes de aplicá-las em campanhas reais.</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <Check className="w-4 h-4 text-ch-orange shrink-0" />
                                            <span>Não garantimos que o uso das sugestões da IA resultará em aprovação de anúncios ou melhoria de performance.</span>
                                        </li>
                                    </ul>
                                </div>
                            </section>

                            {/* 6. Pagamentos */}
                            <section id="payments" className="scroll-mt-32">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">06</span>
                                    Pagamentos e Planos
                                </h2>
                                <p className="text-muted-foreground mb-4">
                                    O Serviço é oferecido em regime de assinatura (SaaS). Os pagamentos são processados por gateways seguros (Stripe/Pagar.me).
                                </p>
                                <div className="space-y-4 border-l-2 border-border pl-6">
                                    <div>
                                        <h4 className="text-foreground font-bold text-sm uppercase">Renovação Automática</h4>
                                        <p className="text-sm text-muted-foreground">As assinaturas renovam-se automaticamente ao final de cada período, a menos que canceladas.</p>
                                    </div>
                                    <div>
                                        <h4 className="text-foreground font-bold text-sm uppercase">Política de Reembolso</h4>
                                        <p className="text-sm text-muted-foreground">Devido à natureza digital do serviço e aos custos de API/IA incorridos, não oferecemos reembolsos para períodos parciais já iniciados.</p>
                                    </div>
                                    <div>
                                        <h4 className="text-foreground font-bold text-sm uppercase">Inadimplência</h4>
                                        <p className="text-sm text-muted-foreground">O não pagamento resultará na suspensão imediata do acesso às funcionalidades pro.</p>
                                    </div>
                                </div>
                            </section>

                            {/* 7. Propriedade Intelectual */}
                            <section id="intellectual-property" className="scroll-mt-32">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">07</span>
                                    Propriedade Intelectual
                                </h2>
                                <p className="text-muted-foreground">
                                    A plataforma Click Auditor, incluindo seu código-fonte, design, algoritmos, logotipos e "look and feel", é propriedade exclusiva do Click Auditor.
                                </p>
                                <p className="text-muted-foreground mt-4">
                                    <strong>Seus Dados:</strong> Você mantém total propriedade sobre os dados de suas campanhas, criativos e métricas que importar para a plataforma. Você nos concede uma licença limitada para processar esses dados a fim de fornecer o Serviço.
                                </p>
                            </section>

                            {/* 8. Responsabilidade */}
                            <section id="liability" className="scroll-mt-32">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">08</span>
                                    Limitação de Responsabilidade
                                </h2>
                                <p className="text-muted-foreground">
                                    O Click Auditor fornece a plataforma "como está". Não garantimos que a plataforma estará livre de erros ou que funcionará ininterruptamente.
                                </p>
                                <div className="bg-muted/50 p-6 rounded-xl mt-6">
                                    <p className="text-sm font-medium text-foreground">
                                        IMPORTANTE: Não nos responsabilizamos por perdas financeiras em suas campanhas de publicidade. A decisão final de investimento, orçamento e estratégia é inteiramente do usuário. Nossa ferramenta é um auxílio à análise, não um gestor financeiro.
                                    </p>
                                </div>
                            </section>

                            {/* 9. Privacidade */}
                            <section id="privacy" className="scroll-mt-32">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">09</span>
                                    Privacidade de Dados
                                </h2>
                                <p className="text-muted-foreground">
                                    O tratamento de seus dados pessoais e empresariais é regido por nossa Política de Privacidade. Ao aceitar estes Termos, você também concorda com os termos lá descritos.
                                </p>
                            </section>

                            {/* 10. Rescisão */}
                            <section id="termination" className="scroll-mt-32">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">10</span>
                                    Rescisão
                                </h2>
                                <p className="text-muted-foreground">
                                    Podemos suspender ou encerrar sua conta imediatamente, sem aviso prévio, se você violar estes Termos, especialmente as seções de Uso Aceitável (4) e Pagamentos (6).
                                </p>
                            </section>

                            {/* 11. Alterações */}
                            <section id="changes" className="scroll-mt-32">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">11</span>
                                    Alterações nos Termos
                                </h2>
                                <p className="text-muted-foreground">
                                    Reservamo-nos o direito de modificar estes termos a qualquer momento. Notificaremos sobre alterações significativas através do e-mail cadastrado ou aviso na plataforma. O uso contínuo após as alterações constitui aceitação dos novos termos.
                                </p>
                            </section>

                            {/* 12. Contato */}
                            <section id="contact" className="scroll-mt-32 pb-12">
                                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                                    <span className="bg-muted/50 text-ch-orange text-sm font-mono py-1 px-2 rounded">12</span>
                                    Contato
                                </h2>
                                <div className="bg-gradient-to-r from-white/5 to-transparent p-6 rounded-xl border border-border">
                                    <p className="text-muted-foreground mb-2">Para questões legais, suporte ou denúncias:</p>
                                    <a href="mailto:legal@clickhero.com" className="text-xl font-bold text-ch-orange hover:text-foreground transition-colors">
                                        legal@clickhero.com
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
