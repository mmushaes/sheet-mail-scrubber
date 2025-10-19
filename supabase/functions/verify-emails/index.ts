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
  smtp_details?: {
    mx: string;
    code: number;
    message: string;
    tls: boolean;
    latency_ms: number;
    status: "valid" | "invalid" | "temp_error" | "unknown" | "catch_all";
  };
  dmarc_valid: boolean;
  is_disposable: boolean;
  is_role_based: boolean;
  is_free_provider: boolean;
  is_catch_all: boolean;
  is_spam_trap: boolean;
  is_abuse: boolean;
  is_toxic: boolean;
  error_message?: string;
}

// SMTP configuration
const SMTP_CONFIG = {
  TIMEOUT_MS: 5000,
  MAX_RETRIES: 1,
  BATCH_SIZE: 50,
  MAX_WORKERS: 200,
  MAX_CONCURRENT_PER_DOMAIN: 5,
  VERIFY_EMAIL: "verify@emailverifier.dev",
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

// Get MX records with priority sorting
async function getMXRecords(domain: string): Promise<Array<{ priority: number; exchange: string }>> {
  try {
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
    const data = await response.json();
    
    if (data.Status !== 0 || !data.Answer || data.Answer.length === 0) {
      return [];
    }
    
    // Parse MX records and sort by priority
    const mxRecords = data.Answer.map((record: any) => {
      const parts = record.data.split(' ');
      return {
        priority: parseInt(parts[0]),
        exchange: parts[1].replace(/\.$/, ''), // Remove trailing dot
      };
    }).sort((a: any, b: any) => a.priority - b.priority);
    
    return mxRecords;
  } catch (error) {
    console.error(`MX lookup failed for ${domain}:`, error);
    return [];
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

// Helper to read SMTP response with timeout
async function readSMTPResponse(reader: ReadableStreamDefaultReader<Uint8Array>, timeout: number): Promise<string> {
  const decoder = new TextDecoder();
  let response = '';
  
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('SMTP read timeout')), timeout)
  );
  
  const readPromise = (async () => {
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      response = decoder.decode(new Uint8Array(chunks.flatMap(c => Array.from(c))));
      // Check if we have a complete response (ends with \r\n)
      if (response.includes('\r\n')) break;
    }
    return response;
  })();
  
  return await Promise.race([readPromise, timeoutPromise]);
}

// Helper to write SMTP command
async function writeSMTPCommand(writer: WritableStreamDefaultWriter<Uint8Array>, command: string): Promise<void> {
  const encoder = new TextEncoder();
  await writer.write(encoder.encode(command + '\r\n'));
}

// Perform actual SMTP mailbox check
async function performSMTPCheck(
  email: string, 
  mx: string, 
  retryCount = 0
): Promise<EmailVerificationResult['smtp_details']> {
  const startTime = Date.now();
  let conn: Deno.TcpConn | null = null;
  
  try {
    // Connect to MX server on port 25
    conn = await Promise.race([
      Deno.connect({ hostname: mx, port: 25 }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), SMTP_CONFIG.TIMEOUT_MS)
      )
    ]);
    
    const reader = conn.readable.getReader();
    const writer = conn.writable.getWriter();
    let tlsEnabled = false;
    
    // Read greeting
    const greeting = await readSMTPResponse(reader, SMTP_CONFIG.TIMEOUT_MS);
    const greetingCode = parseInt(greeting.substring(0, 3));
    
    if (greetingCode !== 220) {
      return {
        mx,
        code: greetingCode,
        message: greeting.trim(),
        tls: false,
        latency_ms: Date.now() - startTime,
        status: 'unknown',
      };
    }
    
    // Send EHLO
    await writeSMTPCommand(writer, `EHLO ${SMTP_CONFIG.VERIFY_EMAIL.split('@')[1]}`);
    const ehloResponse = await readSMTPResponse(reader, SMTP_CONFIG.TIMEOUT_MS);
    
    // Check if STARTTLS is supported
    if (ehloResponse.includes('STARTTLS')) {
      tlsEnabled = true;
      // Note: Actual STARTTLS implementation would require TLS handshake
      // For now we just note that it's available
    }
    
    // Send MAIL FROM
    await writeSMTPCommand(writer, `MAIL FROM:<${SMTP_CONFIG.VERIFY_EMAIL}>`);
    const mailFromResponse = await readSMTPResponse(reader, SMTP_CONFIG.TIMEOUT_MS);
    const mailFromCode = parseInt(mailFromResponse.substring(0, 3));
    
    if (mailFromCode !== 250) {
      return {
        mx,
        code: mailFromCode,
        message: mailFromResponse.trim(),
        tls: tlsEnabled,
        latency_ms: Date.now() - startTime,
        status: 'unknown',
      };
    }
    
    // Send RCPT TO - this is the actual mailbox check
    await writeSMTPCommand(writer, `RCPT TO:<${email}>`);
    const rcptResponse = await readSMTPResponse(reader, SMTP_CONFIG.TIMEOUT_MS);
    const rcptCode = parseInt(rcptResponse.substring(0, 3));
    
    // Send QUIT
    await writeSMTPCommand(writer, 'QUIT');
    await readSMTPResponse(reader, 1000).catch(() => {}); // Don't wait long for quit response
    
    // Determine status based on response code
    let status: "valid" | "invalid" | "temp_error" | "unknown" | "catch_all" = 'unknown';
    if (rcptCode === 250 || rcptCode === 251) {
      status = 'valid';
    } else if (rcptCode >= 500 && rcptCode < 600) {
      status = 'invalid';
    } else if (rcptCode >= 400 && rcptCode < 500) {
      status = 'temp_error';
      // Retry on 4xx errors
      if (retryCount < SMTP_CONFIG.MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return performSMTPCheck(email, mx, retryCount + 1);
      }
    } else if (rcptResponse.toLowerCase().includes('catch') || rcptResponse.toLowerCase().includes('accept all')) {
      status = 'catch_all';
    }
    
    return {
      mx,
      code: rcptCode,
      message: rcptResponse.trim(),
      tls: tlsEnabled,
      latency_ms: Date.now() - startTime,
      status,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Retry on connection errors
    if (retryCount < SMTP_CONFIG.MAX_RETRIES && !errorMessage.includes('timeout')) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      return performSMTPCheck(email, mx, retryCount + 1);
    }
    
    return {
      mx,
      code: 0,
      message: errorMessage,
      tls: false,
      latency_ms: Date.now() - startTime,
      status: 'unknown',
    };
  } finally {
    if (conn) {
      try {
        conn.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  }
}

// Domain-based concurrency limiter
class DomainConcurrencyLimiter {
  private domainQueues: Map<string, number> = new Map();
  private globalActive = 0;
  
  async acquire(domain: string): Promise<void> {
    while (
      this.globalActive >= SMTP_CONFIG.MAX_WORKERS ||
      (this.domainQueues.get(domain) || 0) >= SMTP_CONFIG.MAX_CONCURRENT_PER_DOMAIN
    ) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.domainQueues.set(domain, (this.domainQueues.get(domain) || 0) + 1);
    this.globalActive++;
  }
  
  release(domain: string): void {
    const current = this.domainQueues.get(domain) || 0;
    if (current > 0) {
      this.domainQueues.set(domain, current - 1);
    }
    if (this.globalActive > 0) {
      this.globalActive--;
    }
  }
}

// Verify a single email
async function verifyEmail(email: string, limiter?: DomainConcurrencyLimiter): Promise<EmailVerificationResult> {
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
    is_spam_trap: false,
    is_abuse: false,
    is_toxic: false,
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
    result.is_spam_trap = isSpamTrap(email);
    result.is_abuse = isAbuseEmail(email);
    result.is_toxic = isToxicEmail(email);
    
    // Step 2: Get MX records and check DMARC in parallel
    const [mxRecords, dmarcValid] = await Promise.all([
      getMXRecords(domain),
      checkDMARC(domain)
    ]);
    
    result.dns_valid = mxRecords.length > 0;
    result.dmarc_valid = dmarcValid;
    
    if (!result.dns_valid) {
      result.error_message = "No valid MX records found";
      return result;
    }
    
    // Step 3: Perform actual SMTP check with the primary MX
    const primaryMX = mxRecords[0].exchange;
    
    if (limiter) {
      await limiter.acquire(domain);
    }
    
    try {
      result.smtp_details = await performSMTPCheck(email, primaryMX);
      result.smtp_valid = (result.smtp_details?.status === 'valid' || result.smtp_details?.status === 'catch_all') ?? false;
      
      // Update catch-all flag based on SMTP response
      if (result.smtp_details?.status === 'catch_all') {
        result.is_catch_all = true;
      }
    } finally {
      if (limiter) {
        limiter.release(domain);
      }
    }
    
    if (!result.smtp_valid && result.smtp_details?.status !== 'temp_error') {
      result.error_message = result.smtp_details?.message || "SMTP verification failed";
      return result;
    }
    
    // Determine if we can send based on all checks
    // Fail if disposable, spam trap, abuse, toxic, or has critical issues
    if (result.is_disposable) {
      result.can_send = "no";
      result.error_message = "Disposable/temporary email address";
    } else if (result.is_spam_trap) {
      result.can_send = "no";
      result.error_message = "Known spam trap address";
    } else if (result.is_abuse) {
      result.can_send = "no";
      result.error_message = "High-complaint/abuse address";
    } else if (result.is_toxic) {
      result.can_send = "no";
      result.error_message = "Toxic/suppression list address";
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
    
    // Process emails in batches with concurrency control
    const results: EmailVerificationResult[] = [];
    const limiter = new DomainConcurrencyLimiter();
    
    for (let i = 0; i < emails.length; i += SMTP_CONFIG.BATCH_SIZE) {
      const batch = emails.slice(i, i + SMTP_CONFIG.BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(email => verifyEmail(email, limiter))
      );
      results.push(...batchResults);
      console.log(`Processed ${results.length}/${emails.length} emails`);
      
      // Small delay between batches to avoid overwhelming
      if (i + SMTP_CONFIG.BATCH_SIZE < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
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
