import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, Mail, TrendingUp } from "lucide-react";
import { VerificationResult } from "@/pages/Index";

interface SummaryStatsProps {
  results: VerificationResult[];
}

export const SummaryStats = ({ results }: SummaryStatsProps) => {
  const total = results.length;
  const valid = results.filter((r) => r.can_send === "yes").length;
  const invalid = results.filter((r) => r.can_send === "no").length;
  const validityRate = total > 0 ? ((valid / total) * 100).toFixed(1) : "0";

  const stats = [
    {
      title: "Total Emails",
      value: total.toLocaleString(),
      icon: Mail,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Valid Emails",
      value: valid.toLocaleString(),
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Invalid Emails",
      value: invalid.toLocaleString(),
      icon: XCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      title: "Validity Rate",
      value: `${validityRate}%`,
      icon: TrendingUp,
      color: "text-info",
      bgColor: "bg-info/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title} className="border-primary/20 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
