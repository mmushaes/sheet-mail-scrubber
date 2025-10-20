import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, XCircle, Download, Search, Shield, AlertTriangle, Mail } from "lucide-react";
import { VerificationResult } from "@/pages/Index";

interface ResultsTableProps {
  results: VerificationResult[];
}

export const ResultsTable = ({ results }: ResultsTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "valid" | "invalid">("all");

  const filteredResults = results.filter((result) => {
    const matchesSearch = result.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "valid" && result.can_send === "yes") ||
      (filter === "invalid" && result.can_send === "no");
    return matchesSearch && matchesFilter;
  });

  const handleExport = () => {
    // Create CSV content
    const headers = [
      "Email",
      "Can Send",
      "Status",
      "SMTP Score",
      "Syntax Valid",
      "Domain Exists",
      "MX Found",
      "DMARC Valid",
      "Disposable",
      "Role Account",
      "Catch All",
      "Error Message"
    ];
    
    const rows = results.map(r => [
      r.email,
      r.can_send || "no",
      r.status,
      r.smtp_score,
      r.syntax_valid ? "Yes" : "No",
      r.domain_exists ? "Yes" : "No",
      r.mx_found ? "Yes" : "No",
      r.dmarc_valid ? "Yes" : "No",
      r.disposable ? "Yes" : "No",
      r.role_account ? "Yes" : "No",
      r.catch_all ? "Yes" : "No",
      r.error_message || ""
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");
    
    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `email-verification-results-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Verification Results</CardTitle>
            <CardDescription>
              {filteredResults.length} of {results.length} results shown
            </CardDescription>
          </div>
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Results
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search emails..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "valid" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("valid")}
            >
              Valid
            </Button>
            <Button
              variant={filter === "invalid" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("invalid")}
            >
              Invalid
            </Button>
          </div>
        </div>

        {/* Results Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email Address</TableHead>
                <TableHead className="text-center">Can Send</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">SMTP Score</TableHead>
                <TableHead className="text-center">Syntax</TableHead>
                <TableHead className="text-center">Domain</TableHead>
                <TableHead className="text-center">MX</TableHead>
                <TableHead className="text-center">DMARC</TableHead>
                <TableHead className="text-center">Disposable</TableHead>
                <TableHead className="text-center">Role</TableHead>
                <TableHead className="text-center">Catch-All</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResults.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    No results to display
                  </TableCell>
                </TableRow>
              ) : (
                filteredResults.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-sm">{result.email}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={result.can_send === "yes" ? "default" : "destructive"}
                        className={
                          result.can_send === "yes"
                            ? "bg-success text-success-foreground"
                            : ""
                        }
                      >
                        {result.can_send}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          result.status === "valid" ? "default" : 
                          result.status === "risky" ? "secondary" : 
                          result.status === "invalid" ? "destructive" : "outline"
                        }
                        className={
                          result.status === "valid" ? "bg-success text-success-foreground" :
                          result.status === "risky" ? "bg-warning text-warning-foreground" : ""
                        }
                      >
                        {result.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-semibold ${
                        result.smtp_score >= 90 ? "text-success" :
                        result.smtp_score >= 60 ? "text-warning" :
                        "text-destructive"
                      }`}>
                        {result.smtp_score}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {result.syntax_valid ? (
                        <CheckCircle className="w-4 h-4 text-success mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {result.domain_exists ? (
                        <CheckCircle className="w-4 h-4 text-success mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {result.mx_found ? (
                        <CheckCircle className="w-4 h-4 text-success mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {result.dmarc_valid ? (
                        <Shield className="w-4 h-4 text-success mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {result.disposable ? (
                        <AlertTriangle className="w-4 h-4 text-destructive mx-auto" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-success mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {result.role_account ? (
                        <Mail className="w-4 h-4 text-warning mx-auto" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {result.catch_all ? (
                        <AlertTriangle className="w-4 h-4 text-warning mx-auto" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
