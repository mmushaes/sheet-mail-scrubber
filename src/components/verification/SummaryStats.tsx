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
      color: "text-emerald-900",
      bgColor: "bg-gradient-to-br from-emerald-100 to-emerald-50",
    },
    {
      title: "Valid Emails",
      value: valid.toLocaleString(),
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-gradient-to-br from-emerald-100 to-emerald-50",
    },
    {
      title: "Invalid Emails",
      value: invalid.toLocaleString(),
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-gradient-to-br from-red-100 to-red-50",
    },
    {
      title: "Validity Rate",
      value: `${validityRate}%`,
      icon: TrendingUp,
      color: "text-emerald-600",
      bgColor: "bg-gradient-to-br from-emerald-100 to-emerald-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title} className="border-emerald-200/60 shadow-xl shadow-emerald-900/5 bg-white/80 backdrop-blur-sm hover:shadow-2xl hover:shadow-emerald-900/10 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold text-emerald-900">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center shadow-lg`}>
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
