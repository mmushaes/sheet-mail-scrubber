import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileSpreadsheet, ArrowRight, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VerificationFormProps {
  onSubmit: (sheetsUrl: string) => void;
  isProcessing: boolean;
}

export const VerificationForm = ({ onSubmit, isProcessing }: VerificationFormProps) => {
  const [sheetsUrl, setSheetsUrl] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sheetsUrl.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a valid Google Sheets URL",
        variant: "destructive",
      });
      return;
    }

    // Basic URL validation
    if (!sheetsUrl.includes("docs.google.com/spreadsheets")) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid Google Sheets URL",
        variant: "destructive",
      });
      return;
    }

    onSubmit(sheetsUrl);
  };

  return (
    <Card className="border-emerald-200/60 shadow-xl shadow-emerald-900/5 bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-emerald-900">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          Upload Email List
        </CardTitle>
        <CardDescription className="text-slate-600">
          Provide a Google Sheets URL containing email addresses (processes in 1,000 email chunks)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sheets-url">Google Sheets URL</Label>
            <Input
              id="sheets-url"
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
              disabled={isProcessing}
              className="font-mono text-sm"
            />
          </div>

          <Alert className="border-emerald-200 bg-emerald-50/50">
            <Info className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-sm">
              <strong>Format requirements:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                <li>Emails should be in Column A</li>
                <li>First row should contain headers</li>
                <li>Sheet must be publicly accessible or shared with the tool</li>
                <li>Processes up to 10,000 emails in automated 1,000-email chunks</li>
              </ul>
            </AlertDescription>
          </Alert>

          <Button
            type="submit"
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-emerald-900 to-emerald-700 hover:from-emerald-800 hover:to-emerald-600 shadow-lg shadow-emerald-900/25 transition-all duration-300"
            size="lg"
          >
            {isProcessing ? (
              <>Processing...</>
            ) : (
              <>
                Start Verification
                <ArrowRight className="ml-2 w-4 h-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
