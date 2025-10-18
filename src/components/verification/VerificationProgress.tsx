import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, XCircle, Loader2, Shield } from "lucide-react";

interface VerificationProgressProps {
  progress: number;
  currentStage: "syntax" | "dns" | "dmarc" | "smtp";
  totalEmails: number;
  processedEmails: number;
}

export const VerificationProgress = ({
  progress,
  currentStage,
  totalEmails,
  processedEmails,
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
    <Card className="border-primary/20 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          Verification in Progress
        </CardTitle>
        <CardDescription>
          Processing {processedEmails} of {totalEmails} emails
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-semibold">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
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
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  isCurrent
                    ? "border-primary bg-primary/5"
                    : isComplete
                    ? "border-success/20 bg-success/5"
                    : "border-border bg-muted/20"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isCurrent
                      ? "bg-primary/10"
                      : isComplete
                      ? "bg-success/10"
                      : "bg-muted"
                  }`}
                >
                  {isCurrent ? (
                    <Loader2 className={`w-5 h-5 animate-spin ${stage.color}`} />
                  ) : (
                    <Icon
                      className={`w-5 h-5 ${
                        isComplete ? "text-success" : "text-muted-foreground"
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
                      ? "bg-success text-success-foreground"
                      : isCurrent
                      ? "bg-primary/10 text-primary"
                      : ""
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
