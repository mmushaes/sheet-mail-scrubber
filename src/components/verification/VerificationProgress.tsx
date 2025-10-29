import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, XCircle, Loader2, Shield } from "lucide-react";

interface VerificationProgressProps {
  progress: number;
  currentStage: "syntax" | "dns" | "dmarc" | "smtp";
  totalEmails: number;
  processedEmails: number;
  estimatedTime?: string;
}

export const VerificationProgress = ({
  progress,
  currentStage,
  totalEmails,
  processedEmails,
  estimatedTime,
}: VerificationProgressProps) => {
  const stages = [
    {
      name: "Syntax Check",
      key: "syntax" as const,
      icon: CheckCircle,
      color: "text-success",
    },
    {
      name: "DNS/MX Check",
      key: "dns" as const,
      icon: AlertCircle,
      color: "text-info",
    },
    {
      name: "DMARC Check",
      key: "dmarc" as const,
      icon: Shield,
      color: "text-primary",
    },
    {
      name: "SMTP Check",
      key: "smtp" as const,
      icon: XCircle,
      color: "text-warning",
    },
  ];

  const currentStageIndex = stages.findIndex((s) => s.key === currentStage);

  return (
    <Card className="border-emerald-200/60 shadow-xl shadow-emerald-900/5 bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-emerald-900">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
          Verification in Progress
        </CardTitle>
        <CardDescription className="font-semibold text-slate-600">
          Processing {processedEmails} of {totalEmails} emails
          {estimatedTime && ` • Estimated time: ${estimatedTime}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Overall Progress</span>
            <span className="font-semibold text-emerald-900">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-3 bg-emerald-100" />
        </div>

        <div className="grid gap-3">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const isComplete = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;
            const isPending = index > currentStageIndex;

            return (
              <div
                key={stage.key}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
                  isCurrent
                    ? "border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100/50 shadow-md"
                    : isComplete
                    ? "border-emerald-200 bg-emerald-50/30"
                    : "border-slate-200 bg-slate-50/30"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
                    isCurrent
                      ? "bg-gradient-to-br from-emerald-100 to-emerald-50"
                      : isComplete
                      ? "bg-gradient-to-br from-emerald-100 to-emerald-50"
                      : "bg-slate-100"
                  }`}
                >
                  {isCurrent ? (
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                  ) : (
                    <Icon
                      className={`w-5 h-5 ${
                        isComplete ? "text-emerald-600" : "text-slate-400"
                      }`}
                    />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{stage.name}</div>
                </div>
                <Badge
                  variant={
                    isComplete ? "default" : isCurrent ? "secondary" : "outline"
                  }
                  className={
                    isComplete
                      ? "bg-emerald-600 text-white shadow-md"
                      : isCurrent
                      ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                      : "border-slate-300 text-slate-600"
                  }
                >
                  {isComplete ? "Complete" : isCurrent ? "Processing" : "Pending"}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
