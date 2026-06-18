import { motion } from "framer-motion";
import { MousePointerClick, Eye, DollarSign, Target, TrendingUp } from "lucide-react";
import Header from "@/components/Header";
import MetricCard from "@/components/MetricCard";
import PerformanceChart from "@/components/PerformanceChart";
import AdsTable from "@/components/AdsTable";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border bg-card">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--primary)_0%,_transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1 px-2 rounded-full bg-primary/10 border border-primary/20">
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Plataforma Habilitada</span>
              </div>
            </div>
            <h1 className="text-4xl font-semibold text-foreground md:text-6xl tracking-tighter">
              A era do <span className="text-primary">Click Auditor</span>
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Auditoria de anúncios com IA, inteligência de dados e otimização em tempo real para o seu ecossistema Meta Ads.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Metrics */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Impressões" value="189.4K" change="+12.5% vs semana anterior" changeType="positive" icon={Eye} />
          <MetricCard title="Cliques" value="12.7K" change="+8.2% vs semana anterior" changeType="positive" icon={MousePointerClick} />
          <MetricCard title="CTR Médio" value="6.71%" change="-0.3% vs semana anterior" changeType="negative" icon={Target} />
          <MetricCard title="Gasto Total" value="R$ 9.820" change="Dentro do orçamento" changeType="neutral" icon={DollarSign} />
        </div>

        <div className="mt-8">
          <PerformanceChart chartView="metrics" />
        </div>

        <div className="mt-8 mb-12">
          <AdsTable />
        </div>
      </main>
    </div>
  );
};

export default Index;
