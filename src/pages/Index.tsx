import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { VerificationForm } from "@/components/verification/VerificationForm";
import { VerificationProgress } from "@/components/verification/VerificationProgress";
import { ResultsTable } from "@/components/verification/ResultsTable";
import { SummaryStats } from "@/components/verification/SummaryStats";
import { Shield, CheckCircle, XCircle, AlertCircle, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Session, User } from "@supabase/supabase-js";

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

interface IndexProps {
  user: User | null;
  session: Session | null;
}

const Index = ({ user, session }: IndexProps) => {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [currentStage, setCurrentStage] = useState<"syntax" | "dns" | "dmarc" | "smtp">("syntax");
  const [totalEmails, setTotalEmails] = useState(0);
  const [processedEmails, setProcessedEmails] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState<string>("");
  const [startTime, setStartTime] = useState<number>(0);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Check authentication
    if (!session) {
      navigate("/auth");
    } else {
      setIsCheckingAuth(false);
    }
  }, [session, navigate]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
      navigate("/auth");
    } catch (error: any) {
      toast.error("Failed to log out");
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

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
        
        // Process this chunk
        const { data: chunkData, error: chunkError } = await supabase.functions.invoke('verify-emails', {
          body: { emails: emailChunk }
        });
        
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
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
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
            
            {/* User Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.email || ""} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user?.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.user_metadata?.full_name || "User"}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                Our 4-stage verification process ensures accurate results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="flex gap-3 p-4 rounded-lg bg-secondary/50">
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm mb-1">1. Syntax</h3>
                    <p className="text-xs text-muted-foreground">
                      Validates email format
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 p-4 rounded-lg bg-secondary/50">
                  <AlertCircle className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm mb-1">2. DNS/MX</h3>
                    <p className="text-xs text-muted-foreground">
                      Verifies mail exchange records
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 p-4 rounded-lg bg-secondary/50">
                  <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm mb-1">3. DMARC</h3>
                    <p className="text-xs text-muted-foreground">
                      Checks email authentication
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 p-4 rounded-lg bg-secondary/50">
                  <XCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm mb-1">4. SMTP</h3>
                    <p className="text-xs text-muted-foreground">
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
