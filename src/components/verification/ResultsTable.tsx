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
import { CheckCircle, XCircle, Download, Search, Shield, AlertTriangle, Mail, Server, Bug, Ban, Skull } from "lucide-react";
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
    // TODO: Implement CSV export or Google Sheets creation
    console.log("Exporting results:", results);
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
                <TableHead className="text-center">Syntax</TableHead>
                <TableHead className="text-center">DNS/MX</TableHead>
                <TableHead className="text-center">DMARC</TableHead>
                <TableHead className="text-center">SMTP</TableHead>
                <TableHead className="text-center">Disposable</TableHead>
                <TableHead className="text-center">Role-Based</TableHead>
                <TableHead className="text-center">Free Provider</TableHead>
                <TableHead className="text-center">Catch-All</TableHead>
                <TableHead className="text-center">Spam Trap</TableHead>
                <TableHead className="text-center">Abuse</TableHead>
                <TableHead className="text-center">Toxic</TableHead>
                <TableHead className="text-center">Can Send</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResults.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                    No results to display
                  </TableCell>
                </TableRow>
              ) : (
                filteredResults.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-sm">{result.email}</TableCell>
                    <TableCell className="text-center">
                      {result.syntax_valid ? (
                        <CheckCircle className="w-4 h-4 text-success mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {result.dns_valid ? (
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
                      {result.smtp_valid ? (
                        <CheckCircle className="w-4 h-4 text-success mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {result.is_disposable ? (
                        <AlertTriangle className="w-4 h-4 text-destructive mx-auto" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-success mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {result.is_role_based ? (
                        <Mail className="w-4 h-4 text-warning mx-auto" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {result.is_free_provider ? (
                        <Server className="w-4 h-4 text-info mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {result.is_catch_all ? (
                        <AlertTriangle className="w-4 h-4 text-warning mx-auto" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {result.is_spam_trap ? (
                        <Bug className="w-4 h-4 text-destructive mx-auto" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-success mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {result.is_abuse ? (
                        <Ban className="w-4 h-4 text-destructive mx-auto" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-success mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {result.is_toxic ? (
                        <Skull className="w-4 h-4 text-destructive mx-auto" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-success mx-auto" />
                      )}
                    </TableCell>
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
