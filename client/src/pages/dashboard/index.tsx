import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import MetricsCards from "./components/MetricsCards";
import RecentAudits from "./components/RecentAudits";
import ProblemCreatives from "./components/ProblemCreatives";
import PerformanceChart from "./components/PerformanceChart";
import TopCampaigns from "./components/TopCampaigns";
import ComplianceOverview from "./components/ComplianceOverview";
import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const { t } = useTranslation();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Dashboard" />

        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            {/* Metrics Cards */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <MetricsCards />
            </div>

            {/* Performance Chart and Compliance Overview */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <PerformanceChart />
                </div>
                <ComplianceOverview />
              </div>
            </div>

            {/* Top Campaigns and Problem Creatives */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <TopCampaigns />
                <ProblemCreatives />
              </div>
            </div>

            {/* Recent Audits - Full Width */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
              <RecentAudits />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
