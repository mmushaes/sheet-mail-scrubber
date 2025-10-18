import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VerificationForm } from "@/components/verification/VerificationForm";
import { VerificationProgress } from "@/components/verification/VerificationProgress";
import { ResultsTable } from "@/components/verification/ResultsTable";
import { SummaryStats } from "@/components/verification/SummaryStats";
import { Shield, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export interface VerificationResult {
  email: string;
  can_send: "yes" | "no";
  syntax_valid: boolean;
  dns_valid: boolean;
  smtp_valid: boolean;
  error_message?: string;
}

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [currentStage, setCurrentStage] = useState<"syntax" | "dns" | "smtp">("syntax");

  const handleStartVerification = (sheetsUrl: string) => {
    setIsProcessing(true);
    setProgress(0);
    setResults([]);
    // TODO: Implement actual verification logic with backend
    console.log("Starting verification for:", sheetsUrl);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Email Verification Tool</h1>
              <p className="text-sm text-muted-foreground">
                Verify email deliverability without sending
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* How it Works Section */}
          <Card className="border-primary/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                How It Works
              </CardTitle>
              <CardDescription>
                Our 3-stage verification process ensures accurate results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="flex gap-3 p-4 rounded-lg bg-secondary/50">
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm mb-1">1. Syntax Check</h3>
                    <p className="text-xs text-muted-foreground">
                      Validates email format according to RFC standards
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 p-4 rounded-lg bg-secondary/50">
                  <AlertCircle className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm mb-1">2. DNS/MX Check</h3>
                    <p className="text-xs text-muted-foreground">
                      Verifies domain has valid mail exchange records
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 p-4 rounded-lg bg-secondary/50">
                  <XCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm mb-1">3. SMTP Check</h3>
                    <p className="text-xs text-muted-foreground">
                      Simulates delivery to verify mailbox exists
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Verification Interface */}
          <Tabs defaultValue="verify" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="verify">Verify Emails</TabsTrigger>
              <TabsTrigger value="results" disabled={results.length === 0}>
                Results {results.length > 0 && `(${results.length})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="verify" className="space-y-6">
              <VerificationForm
                onSubmit={handleStartVerification}
                isProcessing={isProcessing}
              />

              {isProcessing && (
                <VerificationProgress
                  progress={progress}
                  currentStage={currentStage}
                  totalEmails={0}
                  processedEmails={0}
                />
              )}
            </TabsContent>

            <TabsContent value="results" className="space-y-6">
              <SummaryStats results={results} />
              <ResultsTable results={results} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Index;
