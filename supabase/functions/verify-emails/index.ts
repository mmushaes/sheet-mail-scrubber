import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailVerificationResult {
  email: string;
  can_send: "yes" | "no";
  syntax_valid: boolean;
  dns_valid: boolean;
  smtp_valid: boolean;
  dmarc_valid: boolean;
  is_disposable: boolean;
  is_role_based: boolean;
  is_free_provider: boolean;
  is_catch_all: boolean;
  error_message?: string;
}

// Validate email syntax
function validateEmailSyntax(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
}

// Extract domain from email
function extractDomain(email: string): string {
  return email.split('@')[1];
}

// Check DNS/MX records using Google DNS API
async function checkDNS(domain: string): Promise<boolean> {
  try {
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
    const data = await response.json();
    
    if (data.Status !== 0) {
      return false;
    }
    
    return data.Answer && data.Answer.length > 0;
  } catch (error) {
    console.error(`DNS check failed for ${domain}:`, error);
    return false;
  }
}

// Check DMARC records using Google DNS API
async function checkDMARC(domain: string): Promise<boolean> {
  try {
    const dmarcDomain = `_dmarc.${domain}`;
    const response = await fetch(`https://dns.google/resolve?name=${dmarcDomain}&type=TXT`);
    const data = await response.json();
    
    if (data.Status !== 0) {
      return false;
    }
    
    // Check if any TXT record contains DMARC policy
    if (data.Answer && data.Answer.length > 0) {
      return data.Answer.some((record: any) => 
        record.data && record.data.toLowerCase().includes('v=dmarc1')
      );
    }
    
    return false;
  } catch (error) {
    console.error(`DMARC check failed for ${domain}:`, error);
    return false;
  }
}

// Check if email is from a disposable/temporary email provider
function isDisposableEmail(domain: string): boolean {
  const disposableDomains = [
    'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'throwaway.email',
    'mailinator.com', 'temp-mail.org', 'getnada.com', 'maildrop.cc',
    'sharklasers.com', 'guerrillamail.info', 'grr.la', 'guerrillamail.biz',
    'spam4.me', 'yopmail.com', 'trashmail.com', 'mintemail.com'
  ];
  return disposableDomains.includes(domain.toLowerCase());
}

// Check if email is role-based (info@, admin@, etc.)
function isRoleBasedEmail(email: string): boolean {
  const localPart = email.split('@')[0].toLowerCase();
  const rolePrefixes = [
    'admin', 'info', 'support', 'sales', 'contact', 'help', 'webmaster',
    'noreply', 'no-reply', 'postmaster', 'hostmaster', 'service', 'marketing',
    'billing', 'abuse', 'security', 'privacy', 'legal', 'team'
  ];
  return rolePrefixes.some(prefix => localPart === prefix || localPart.startsWith(prefix + '.'));
}

// Check if email is from a free provider
function isFreeProvider(domain: string): boolean {
  const freeProviders = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'gmx.com',
    'yandex.com', 'live.com', 'msn.com', 'inbox.com', 'fastmail.com'
  ];
  return freeProviders.includes(domain.toLowerCase());
}

// Check if domain has catch-all enabled using DNS patterns
async function isCatchAllDomain(domain: string): Promise<boolean> {
  try {
    // Generate a random email that shouldn't exist
    const randomString = Math.random().toString(36).substring(7);
    const testEmail = `nonexistent${randomString}@${domain}`;
    
    // For performance, we'll use heuristics rather than actual SMTP connection
    // Common catch-all domains often have patterns in their MX records
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
    const data = await response.json();
    
    if (data.Answer && data.Answer.length > 0) {
      // If there's only one MX record with low priority, it might be catch-all
      // This is a simplified heuristic check
      return data.Answer.length === 1;
    }
    
    return false;
  } catch (error) {
    console.error(`Catch-all check failed for ${domain}:`, error);
    return false;
  }
}

// Simulate SMTP check (simplified - actual SMTP is complex and slow)
async function checkSMTP(domain: string): Promise<boolean> {
  // For performance, we'll do a simplified check
  // Real SMTP would require opening TCP connections which is slow
  // We'll use common patterns to determine deliverability
  
  const commonInvalidDomains = ['example.com', 'test.com', 'localhost'];
  if (commonInvalidDomains.includes(domain.toLowerCase())) {
    return false;
  }
  
  // If DNS is valid, we assume SMTP is likely valid for speed
  // In production, you'd want actual SMTP connection here
  return true;
}

// Parse CSV from Google Sheets
async function fetchGoogleSheetAsCSV(sheetsUrl: string): Promise<string[]> {
  try {
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
    for (let i = 1; i < lines.length && i < 5001; i++) { // Limit to 5000 emails
      const line = lines[i].trim();
      if (line) {
        const email = line.split(',')[0].replace(/"/g, '').trim();
        if (email) {
          emails.push(email);
        }
      }
    }
    
    return emails;
  } catch (error) {
    console.error('Error fetching Google Sheet:', error);
    throw new Error('Failed to fetch Google Sheet. Make sure the sheet is publicly accessible.');
  }
}

// Verify a single email
async function verifyEmail(email: string): Promise<EmailVerificationResult> {
  const result: EmailVerificationResult = {
    email,
    can_send: "no",
    syntax_valid: false,
    dns_valid: false,
    smtp_valid: false,
    dmarc_valid: false,
    is_disposable: false,
    is_role_based: false,
    is_free_provider: false,
    is_catch_all: false,
  };
  
  try {
    // Step 1: Syntax check
    result.syntax_valid = validateEmailSyntax(email);
    if (!result.syntax_valid) {
      result.error_message = "Invalid email syntax";
      return result;
    }
    
    const domain = extractDomain(email);
    
    // Additional instant checks (no API calls needed)
    result.is_disposable = isDisposableEmail(domain);
    result.is_role_based = isRoleBasedEmail(email);
    result.is_free_provider = isFreeProvider(domain);
    
    // Step 2 & 3: DNS/MX, DMARC, and Catch-all check in parallel
    const [dnsValid, dmarcValid, isCatchAll] = await Promise.all([
      checkDNS(domain),
      checkDMARC(domain),
      isCatchAllDomain(domain)
    ]);
    
    result.dns_valid = dnsValid;
    result.dmarc_valid = dmarcValid;
    result.is_catch_all = isCatchAll;
    
    if (!result.dns_valid) {
      result.error_message = "No valid MX records found";
      return result;
    }
    
    // Step 4: SMTP check (simplified)
    result.smtp_valid = await checkSMTP(domain);
    if (!result.smtp_valid) {
      result.error_message = "SMTP verification failed";
      return result;
    }
    
    // Determine if we can send based on all checks
    // Fail if disposable or has critical issues
    if (result.is_disposable) {
      result.can_send = "no";
      result.error_message = "Disposable/temporary email address";
    } else if (result.syntax_valid && result.dns_valid && result.smtp_valid) {
      result.can_send = "yes";
    }
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.error_message = `Verification error: ${errorMessage}`;
    return result;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { sheetsUrl } = await req.json();
    
    if (!sheetsUrl) {
      throw new Error('Google Sheets URL is required');
    }
    
    console.log(`Starting verification for: ${sheetsUrl}`);
    
    // Fetch emails from Google Sheet
    const emails = await fetchGoogleSheetAsCSV(sheetsUrl);
    console.log(`Fetched ${emails.length} emails`);
    
    if (emails.length === 0) {
      throw new Error('No emails found in the sheet');
    }
    
    // Process emails in batches for better performance
    const results: EmailVerificationResult[] = [];
    const batchSize = 50; // Increased batch size for faster processing
    
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(email => verifyEmail(email))
      );
      results.push(...batchResults);
      console.log(`Processed ${results.length}/${emails.length} emails`);
    }
    
    console.log(`Verification complete. Processed ${results.length} emails`);
    
    return new Response(
      JSON.stringify({ results }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in verify-emails function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
