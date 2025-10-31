import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VerificationForm } from "@/components/verification/VerificationForm";
import { VerificationProgress } from "@/components/verification/VerificationProgress";
import { ResultsTable } from "@/components/verification/ResultsTable";
import { SummaryStats } from "@/components/verification/SummaryStats";
import { Shield, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// Supabase configuration
const SUPABASE_URL = "https://otdvogmkfvhlhqdgkppa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90ZHZvZ21rZnZobGhxZGdrcHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2Njk5MTQsImV4cCI6MjA3NzI0NTkxNH0.nMaHLKtIxFowd45tuVZdLRmHRJI5HDC641Y_iqt39ss";

export interface VerificationResult {
  email: string;
  syntax_valid: boolean;
  domain_exists: boolean;
  mx_found: boolean;
  dmarc_valid: boolean;
  disposable: boolean;
  role_account: boolean;
  catch_all: boolean;
  smtp_score: number;
  status: "valid" | "invalid" | "risky" | "unknown";
  error_message?: string;
  // Computed fields
  can_send?: "yes" | "no";
}

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [currentStage, setCurrentStage] = useState<"syntax" | "dns" | "dmarc" | "smtp">("syntax");
  const [totalEmails, setTotalEmails] = useState(0);
  const [processedEmails, setProcessedEmails] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState<string>("");
  const [startTime, setStartTime] = useState<number>(0);


  const handleStartVerification = async (sheetsUrl: string) => {
    setIsProcessing(true);
    setProgress(0);
    setResults([]);
    setTotalEmails(0);
    setProcessedEmails(0);
    setCurrentStage("syntax");
    setStartTime(Date.now());

    try {
      console.log('Starting verification with Google Sheets URL...');
      setCurrentStage("syntax");
      
      // Call edge function with sheetsUrl - it will fetch and process server-side
      const response = await fetch(`${SUPABASE_URL}/functions/v1/verify-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ sheetsUrl })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data?.results) {
        const processedResults = data.results.map((result: VerificationResult) => ({
          ...result,
          can_send: (result.status === "valid" || result.status === "risky") ? "yes" : "no"
        }));
        
        setResults(processedResults);
        setTotalEmails(processedResults.length);
        setProcessedEmails(processedResults.length);
        setProgress(100);
        
        toast.success(`✅ Verified ${processedResults.length} emails!`);
      } else {
        throw new Error('No results returned from verification');
      }
      
    } catch (error: any) {
      console.error('Verification error:', error);
      toast.error(error.message || 'Failed to verify emails. Please check the Google Sheets URL.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30">
      <header className="border-b border-emerald-100/50 bg-white/80 backdrop-blur-xl sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-900 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-900/20">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-900 to-emerald-700 bg-clip-text text-transparent">
                Email Verification Tool
              </h1>
              <p className="text-sm text-slate-600">
                Verify email deliverability without sending
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <Card className="border-emerald-200/60 shadow-xl shadow-emerald-900/5 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-900">
                <Shield className="w-5 h-5 text-emerald-600" />
                How It Works
              </CardTitle>
              <CardDescription className="text-slate-600">
                Our 4-stage verification process ensures accurate results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="flex gap-3 p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200/50 hover:shadow-md transition-all duration-300">
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm mb-1 text-emerald-900">1. Syntax</h3>
                    <p className="text-xs text-slate-600">
                      Validates email format
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200/50 hover:shadow-md transition-all duration-300">
                  <AlertCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm mb-1 text-emerald-900">2. DNS/MX</h3>
                    <p className="text-xs text-slate-600">
                      Verifies mail exchange records
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200/50 hover:shadow-md transition-all duration-300">
                  <Shield className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm mb-1 text-emerald-900">3. DMARC</h3>
                    <p className="text-xs text-slate-600">
                      Checks email authentication
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200/50 hover:shadow-md transition-all duration-300">
                  <XCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm mb-1 text-emerald-900">4. SMTP</h3>
                    <p className="text-xs text-slate-600">
                      Simulates delivery
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
                  totalEmails={totalEmails}
                  processedEmails={processedEmails}
                  estimatedTime={estimatedTime}
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
