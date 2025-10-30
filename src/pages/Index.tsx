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
const SUPABASE_URL = "https://rrbfytfnqgdpprtjwjba.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyYmZ5dGZucWdkcHBydGp3amJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3Nzg3ODksImV4cCI6MjA3NjM1NDc4OX0.K1cmCehVSh6-7f--oCPliGHdJihLibRl-U-MBC7CqUc";

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

  const fetchEmailsFromSheet = async (sheetsUrl: string): Promise<string[]> => {
    // Convert Google Sheets URL to CSV export URL
    const sheetId = sheetsUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
    if (!sheetId) {
      throw new Error('Invalid Google Sheets URL');
    }
    
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const response = await fetch(csvUrl);
    const csvText = await response.text();
    
    // Parse CSV and extract emails (assuming first column)
    const lines = csvText.split('\n');
    const emails: string[] = [];
    
    // Skip header row (row 0), start from row 1
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const email = line.split(',')[0].replace(/"/g, '').trim();
        if (email && email.includes('@')) {
          emails.push(email);
        }
      }
    }
    
    return emails;
  };

  const handleStartVerification = async (sheetsUrl: string) => {
    setIsProcessing(true);
    setProgress(0);
    setResults([]);
    setTotalEmails(0);
    setProcessedEmails(0);
    setCurrentStage("syntax");
    setStartTime(Date.now());

    try {
      // Step 1: Fetch ALL emails from sheet directly
      console.log('Fetching all emails from sheet...');
      const allEmails = await fetchEmailsFromSheet(sheetsUrl);
      
      if (allEmails.length === 0) {
        throw new Error('No emails found in the sheet');
      }

      const CHUNK_SIZE = 1000;
      const totalChunks = Math.ceil(allEmails.length / CHUNK_SIZE);
      
      setTotalEmails(allEmails.length);
      setEstimatedTime(`${Math.ceil((allEmails.length / 1000) * 0.9)} min`);
      
      console.log(`Processing ${allEmails.length} emails in ${totalChunks} chunks`);
      toast.info(`Processing ${allEmails.length} emails in ${totalChunks} chunks...`);
      
      let allResults: VerificationResult[] = [];
      
      // Step 2: Process each chunk of 1000 emails
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, allEmails.length);
        const emailChunk = allEmails.slice(start, end);
        
        console.log(`Processing chunk ${chunkIndex + 1}/${totalChunks} (${emailChunk.length} emails)`);
        
        // Update stage based on progress
        const overallProgress = (start / allEmails.length) * 100;
        if (overallProgress < 25) setCurrentStage("syntax");
        else if (overallProgress < 50) setCurrentStage("dns");
        else if (overallProgress < 75) setCurrentStage("dmarc");
        else setCurrentStage("smtp");
        
        // Process this chunk using direct HTTP call
        const response = await fetch(`${SUPABASE_URL}/functions/v1/verify-emails`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ emails: emailChunk })
        });
        
        const chunkData = response.ok ? await response.json() : null;
        const chunkError = response.ok ? null : new Error(`HTTP ${response.status}: ${response.statusText}`);
        
        if (chunkError) {
          console.error(`Chunk ${chunkIndex + 1} failed:`, chunkError);
          toast.error(`Chunk ${chunkIndex + 1} failed. Continuing with remaining chunks...`);
          continue;
        }
        
        if (chunkData?.results) {
          const processedResults = chunkData.results.map((result: VerificationResult) => ({
            ...result,
            can_send: (result.status === "valid" || result.status === "risky") ? "yes" : "no"
          }));
          
          allResults = [...allResults, ...processedResults];
          setResults(allResults);
          setProcessedEmails(allResults.length);
          setProgress((allResults.length / allEmails.length) * 100);
          
          toast.success(`Chunk ${chunkIndex + 1}/${totalChunks} complete (${allResults.length}/${allEmails.length} emails)`);
        }
      }
      
      setProgress(100);
      toast.success(`✅ Verified ${allResults.length} emails across ${totalChunks} chunks!`);
      
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
