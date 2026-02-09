import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative" | "neutral";
  icon: LucideIcon;
}

const MetricCard = ({ title, value, change, changeType, icon: Icon }: MetricCardProps) => {
  const changeColor = changeType === "positive" 
    ? "text-success" 
    : changeType === "negative" 
    ? "text-destructive" 
    : "text-muted-foreground";

  return (
    <div className="rounded-xl border border-border bg-card p-6 transition-all hover:glow-primary hover:border-primary/30">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{title}</span>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-3xl font-bold text-foreground">{value}</p>
        <p className={`mt-1 text-sm ${changeColor}`}>{change}</p>
      </div>
    </div>
  );
};

export default MetricCard;
