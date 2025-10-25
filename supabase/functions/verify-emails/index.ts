import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailVerificationResult {
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
}

// Configuration - optimized for edge function CPU limits
const CONFIG = {
  DNS_TIMEOUT_MS: 3000, // Reduced timeout
  BATCH_SIZE: 25, // Smaller batches to avoid CPU timeout
  MAX_EMAILS: 1000, // Reduced to prevent CPU timeout
  MAX_CONCURRENT: 10, // Reduced concurrent requests
};

// Known mail exchanger patterns
const KNOWN_MX_PATTERNS = {
  valid: [
    /google(mail)?\.com$/i,
    /outlook\.com$/i,
    /hotmail\.com$/i,
    /yahoo\.com$/i,
    /mail\.protection\.outlook\.com$/i,
    /aspmx\.l\.google\.com$/i,
    /mx\.zoho\.com$/i,
    /mail\.protonmail\.ch$/i,
  ],
  suspicious: [
    /localhost/i,
    /example\.com/i,
    /test\.com/i,
  ],
};

// Validate email syntax
function validateEmailSyntax(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
}

// Extract domain from email
function extractDomain(email: string): string {
  return email.split('@')[1];
}

// Get MX records with timeout
async function getMXRecords(domain: string): Promise<Array<{ priority: number; exchange: string }>> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.DNS_TIMEOUT_MS);
    
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    const data = await response.json();
    
    if (data.Status !== 0 || !data.Answer || data.Answer.length === 0) {
      return [];
    }
    
    const mxRecords = data.Answer.map((record: any) => {
      const parts = record.data.split(' ');
      return {
        priority: parseInt(parts[0]),
        exchange: parts[1].replace(/\.$/, ''),
      };
    }).sort((a: any, b: any) => a.priority - b.priority);
    
    return mxRecords;
  } catch (error) {
    console.error(`MX lookup failed for ${domain}:`, error);
    return [];
  }
}

// Check if domain has A record
async function checkDomainExists(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.DNS_TIMEOUT_MS);
    
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=A`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    const data = await response.json();
    return data.Status === 0 && data.Answer && data.Answer.length > 0;
  } catch (error) {
    console.error(`A record check failed for ${domain}:`, error);
    return false;
  }
}

// Check SPF record
async function checkSPF(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.DNS_TIMEOUT_MS);
    
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=TXT`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    const data = await response.json();
    
    if (data.Status !== 0 || !data.Answer) {
      return false;
    }
    
    return data.Answer.some((record: any) => 
      record.data && record.data.toLowerCase().includes('v=spf1')
    );
  } catch (error) {
    console.error(`SPF check failed for ${domain}:`, error);
    return false;
  }
}

// Check DMARC with timeout
async function checkDMARC(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.DNS_TIMEOUT_MS);
    
    const dmarcDomain = `_dmarc.${domain}`;
    const response = await fetch(`https://dns.google/resolve?name=${dmarcDomain}&type=TXT`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    const data = await response.json();
    
    if (data.Status !== 0 || !data.Answer) {
      return false;
    }
    
    return data.Answer.some((record: any) => 
      record.data && record.data.toLowerCase().includes('v=dmarc1')
    );
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

// Check if email is a known spam trap
function isSpamTrap(email: string): boolean {
  const domain = extractDomain(email);
  const localPart = email.split('@')[0].toLowerCase();
  
  // Known spam trap domains
  const spamTrapDomains = [
    'spamtrap.com', 'honeypot.com', 'blackhole.com', 'sink.com',
    'spamcop.net', 'deadletter.com'
  ];
  
  // Common spam trap patterns
  const spamTrapPatterns = [
    'spam', 'trap', 'honeypot', 'blackhole', 'sink', 'abuse-',
    'spamtrap', 'deadletter', 'devnull'
  ];
  
  return spamTrapDomains.includes(domain.toLowerCase()) ||
    spamTrapPatterns.some(pattern => localPart.includes(pattern));
}

// Check if email is known for abuse/high complaints
function isAbuseEmail(email: string): boolean {
  const domain = extractDomain(email);
  const localPart = email.split('@')[0].toLowerCase();
  
  // Known high-complaint domains (examples)
  const abuseDomains = [
    'complainbot.com', 'abuseme.com', 'spamreport.net'
  ];
  
  // Abuse-related patterns
  const abusePatterns = [
    'complaint', 'report-spam', 'abuse-report', 'spam-report'
  ];
  
  return abuseDomains.includes(domain.toLowerCase()) ||
    abusePatterns.some(pattern => localPart.includes(pattern));
}

// Check if email is on toxic/suppression list
function isToxicEmail(email: string): boolean {
  const domain = extractDomain(email);
  const localPart = email.split('@')[0].toLowerCase();
  
  // Toxic/suppression patterns
  const toxicPatterns = [
    'bounce', 'unsubscribe', 'optout', 'opt-out', 'remove',
    'donotmail', 'do-not-mail', 'suppress', 'block', 'blacklist'
  ];
  
  // Known suppression domains
  const suppressionDomains = [
    'donotmail.com', 'suppression.net', 'blacklist.com'
  ];
  
  return suppressionDomains.includes(domain.toLowerCase()) ||
    toxicPatterns.some(pattern => localPart.includes(pattern));
}

// Detect catch-all by testing random addresses
async function isCatchAllDomain(domain: string, mxRecords: Array<{ priority: number; exchange: string }>): Promise<boolean> {
  try {
    // Heuristic: if single MX with low priority, likely catch-all
    if (mxRecords.length === 1 && mxRecords[0].priority <= 10) {
      return true;
    }
    
    // Additional heuristic: domains with very generic MX patterns
    const mx = mxRecords[0]?.exchange.toLowerCase() || '';
    if (mx.includes('mail.') || mx.includes('mx.')) {
      return false; // Likely legitimate
    }
    
    return false;
  } catch (error) {
    console.error(`Catch-all check failed for ${domain}:`, error);
    return false;
  }
}

// Heuristic SMTP scoring (0-100)
async function calculateSMTPScore(
  domain: string,
  mxRecords: Array<{ priority: number; exchange: string }>,
  hasSPF: boolean,
  hasDMARC: boolean,
  domainExists: boolean,
  isDisposable: boolean,
  isRole: boolean,
  isCatchAll: boolean
): Promise<number> {
  let score = 0;

  // Base score for domain existence
  if (domainExists) score += 20;

  // MX records (+30)
  if (mxRecords.length > 0) {
    score += 30;
    
    // Check MX patterns
    const primaryMX = mxRecords[0].exchange.toLowerCase();
    const isKnownValid = KNOWN_MX_PATTERNS.valid.some(pattern => pattern.test(primaryMX));
    const isSuspicious = KNOWN_MX_PATTERNS.suspicious.some(pattern => pattern.test(primaryMX));
    
    if (isKnownValid) score += 15;
    if (isSuspicious) score -= 30;
    
    // Multiple MX records indicate professional setup
    if (mxRecords.length > 1) score += 5;
  }

  // SPF record (+10)
  if (hasSPF) score += 10;

  // DMARC record (+10)
  if (hasDMARC) score += 10;

  // Penalties
  if (isDisposable) score -= 40;
  if (isRole) score -= 10;
  if (isCatchAll) score -= 15;

  // Ensure score is in range 0-100
  return Math.max(0, Math.min(100, score));
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
    for (let i = 1; i < lines.length && i < CONFIG.MAX_EMAILS + 1; i++) {
      const line = lines[i].trim();
      if (line) {
        const email = line.split(',')[0].replace(/"/g, '').trim();
        if (email && email.includes('@')) {
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

// Process in controlled batches with concurrency limit
async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  
  return results;
}

// Verify a single email (simplified, no caching)
async function verifyEmail(email: string): Promise<EmailVerificationResult> {
  const result: EmailVerificationResult = {
    email,
    syntax_valid: false,
    domain_exists: false,
    mx_found: false,
    dmarc_valid: false,
    disposable: false,
    role_account: false,
    catch_all: false,
    smtp_score: 0,
    status: "unknown",
  };
  
  try {
    // Syntax check
    result.syntax_valid = validateEmailSyntax(email);
    if (!result.syntax_valid) {
      result.error_message = "Invalid email syntax";
      result.status = "invalid";
      return result;
    }
    
    const domain = extractDomain(email);
    
    // Instant checks
    result.disposable = isDisposableEmail(domain);
    result.role_account = isRoleBasedEmail(email);
    const isSpamTrapEmail = isSpamTrap(email);
    const isAbuseAddr = isAbuseEmail(email);
    const isToxicAddr = isToxicEmail(email);
    
    // Auto-fail for known bad addresses
    if (isSpamTrapEmail || isAbuseAddr || isToxicAddr) {
      result.status = "invalid";
      result.error_message = "Known bad address";
      return result;
    }
    
    // Parallel DNS checks
    const [domainExists, mxRecords, hasSPF, hasDMARC] = await Promise.all([
      checkDomainExists(domain),
      getMXRecords(domain),
      checkSPF(domain),
      checkDMARC(domain),
    ]);
    
    result.domain_exists = domainExists;
    result.mx_found = mxRecords.length > 0;
    result.dmarc_valid = hasDMARC;
    
    // Catch-all detection
    result.catch_all = await isCatchAllDomain(domain, mxRecords);
    
    // Calculate SMTP score
    result.smtp_score = await calculateSMTPScore(
      domain,
      mxRecords,
      hasSPF,
      hasDMARC,
      domainExists,
      result.disposable,
      result.role_account,
      result.catch_all
    );
    
    // Determine status based on score
    if (result.smtp_score >= 90) {
      result.status = "valid";
    } else if (result.smtp_score >= 60) {
      result.status = "risky";
    } else if (result.smtp_score >= 30) {
      result.status = "unknown";
    } else {
      result.status = "invalid";
    }
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.error_message = `Verification error: ${errorMessage}`;
    result.status = "unknown";
    return result;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { sheetsUrl, emails: providedEmails } = await req.json();
    
    let emails: string[];
    
    // Support both sheetsUrl (fetch emails) and direct email array
    if (providedEmails && Array.isArray(providedEmails)) {
      emails = providedEmails;
      console.log(`Processing ${emails.length} emails from provided array`);
    } else if (sheetsUrl) {
      console.log(`Starting verification for: ${sheetsUrl}`);
      
      // Fetch emails from Google Sheet
      emails = await fetchGoogleSheetAsCSV(sheetsUrl);
      
      if (emails.length === 0) {
        throw new Error('No emails found in the sheet');
      }
      
      // Only limit when fetching from sheet (frontend handles chunking for direct arrays)
      if (emails.length > CONFIG.MAX_EMAILS) {
        console.log(`Limited to ${CONFIG.MAX_EMAILS} emails to prevent timeout`);
        emails = emails.slice(0, CONFIG.MAX_EMAILS);
      }
    } else {
      throw new Error('Either sheetsUrl or emails array is required');
    }
    
    console.log(`Processing ${emails.length} emails in batches of ${CONFIG.BATCH_SIZE}`);
    
    // Process emails in smaller batches with controlled concurrency
    const results: EmailVerificationResult[] = [];
    
    for (let i = 0; i < emails.length; i += CONFIG.BATCH_SIZE) {
      const batchStartTime = Date.now();
      const batch = emails.slice(i, i + CONFIG.BATCH_SIZE);
      
      // Process with controlled concurrency
      const batchResults = await processBatch(
        batch,
        verifyEmail,
        CONFIG.MAX_CONCURRENT
      );
      
      results.push(...batchResults);
      
      const batchTime = Date.now() - batchStartTime;
      const batchNum = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
      console.log(`Batch ${batchNum}: Processed ${results.length}/${emails.length} emails in ${batchTime}ms`);
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
