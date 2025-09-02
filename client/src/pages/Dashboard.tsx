// Authentication removed - no imports needed
import Sidebar from "@/components/Layout/Sidebar";
import Header from "@/components/Layout/Header";
import MetricsCards from "@/components/Dashboard/MetricsCards";
import RecentAudits from "@/components/Dashboard/RecentAudits";
import ProblemCreatives from "@/components/Dashboard/ProblemCreatives";
import PolicyManagement from "@/components/Dashboard/PolicyManagement";
import IntegrationStatus from "@/components/Dashboard/IntegrationStatus";

export default function Dashboard() {
  // Authentication removed - direct access to dashboard

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

            {/* Recent Audits and Problem Creatives */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <RecentAudits />
                <ProblemCreatives />
              </div>
            </div>

            {/* Policy Management */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
              <PolicyManagement />
            </div>

            {/* Integration Status */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
              <IntegrationStatus />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
