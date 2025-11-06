import { eq, sql } from 'drizzle-orm';
import Papa from 'papaparse';
import { campaignMetrics, InsertCampaignMetrics } from '@shared/schema';
import { db } from '../db';
import { nanoid } from 'nanoid';

// Sheet configuration
const SHEET_ID = '1mOPjhRhBUP60GzZm0NAuUSYGzlE1bDbi414iYtlwZkA';
const TAB_GID = '0'; // Default GID for first sheet, can be updated if needed
const BATCH_SIZE = 1000;
const MAX_RETRIES = 3;
const TIMEOUT_MS = 120000; // 2 minutes
const BACKOFF_BASE = 1000; // Base backoff time in ms

// Interface for raw data from Google Sheets
interface RawMetricsData {
  'data': string;
  'nome_conta': string;
  'ad_url': string;
  'campanha': string;
  'grupo_anuncios': string;
  'anuncios': string;
  'impressoes': string;
  'cliques': string;
  'cpm': string;
  'cpc': string;
  'conversas_iniciadas': string;
  'custo_conversa': string;
  'investimento': string;
}

// Result interfaces
interface SyncResult {
  success: boolean;
  totalDownloaded: number;
  totalProcessed: number;
  totalInserted: number;
  batchResults: BatchResult[];
  errors: string[];
  syncBatch: string;
  completionPercentage: number;
}

interface BatchResult {
  batchNumber: number;
  recordsProcessed: number;
  recordsInserted: number;
  recordsFailed: number;
  retryCount: number;
  success: boolean;
  errors: string[];
}

// Utility functions
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseBrazilianCurrency(value: string): string {
  if (!value || value.trim() === '') return '0';
  
  // Remove "R$" and spaces, replace comma with dot
  const cleanValue = value
    .replace(/R\$\s*/g, '')
    .replace(/\./g, '') // Remove thousands separator
    .replace(',', '.') // Replace decimal comma with dot
    .trim();
    
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? '0' : parsed.toString();
}

function parseInteger(value: string): number {
  if (!value || value.trim() === '') return 0;
  const parsed = parseInt(value.replace(/\D/g, ''), 10);
  return isNaN(parsed) ? 0 : parsed;
}

function parseDate(dateStr: string): Date {
  // Expecting format: YYYY-MM-DD
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? new Date() : date;
}

// Validation function - More lenient to handle partial data
function validateRecord(raw: RawMetricsData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Only require essential fields for data integrity
  if (!raw.data || raw.data.trim() === '') {
    errors.push('Date is required');
  }
  
  if (!raw.nome_conta || raw.nome_conta.trim() === '') {
    errors.push('Account name is required');
  }
  
  if (!raw.campanha || raw.campanha.trim() === '') {
    errors.push('Campaign name is required');
  }
  
  // Ad group and ad name are now optional - allow partial data
  // This prevents rejection of entire records for missing non-critical fields
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Transform raw data to database format
function transformRecord(raw: RawMetricsData, syncBatch: string, userId?: string): InsertCampaignMetrics | null {
  const validation = validateRecord(raw);
  if (!validation.valid) {
    console.log(`⚠️ Validation failed for record:`, validation.errors);
    return null;
  }
  
  try {
    return {
      userId,
      data: parseDate(raw.data),
      nomeAconta: raw.nome_conta.trim(),
      adUrl: raw.ad_url?.trim() || null,
      campanha: raw.campanha.trim(),
      grupoAnuncios: raw.grupo_anuncios?.trim() || 'Não especificado',
      anuncios: raw.anuncios?.trim() || 'Anúncio não especificado',
      impressoes: parseInteger(raw.impressoes),
      cliques: parseInteger(raw.cliques),
      cpm: parseBrazilianCurrency(raw.cpm),
      cpc: parseBrazilianCurrency(raw.cpc),
      conversasIniciadas: parseInteger(raw.conversas_iniciadas),
      custoConversa: parseBrazilianCurrency(raw.custo_conversa),
      investimento: parseBrazilianCurrency(raw.investimento),
      source: 'google_sheets',
      status: 'imported',
      syncBatch,
    };
  } catch (error) {
    console.log(`❌ Error transforming record:`, error);
    return null;
  }
}

// Fetch data from Google Sheets
export async function fetchSingleTabData(): Promise<{ data: RawMetricsData[]; success: boolean; error?: string }> {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${TAB_GID}`;
  
  console.log(`📋 Fetching data from Google Sheets: ${SHEET_ID}`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    const response = await fetch(csvUrl, {
      headers: {
        'User-Agent': 'Click Auditor Sync Service'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    
    // Check if response is HTML (access error)
    if (csvText.includes('<html>') || csvText.includes('<!DOCTYPE')) {
      throw new Error('Received HTML response instead of CSV - check sheet permissions');
    }
    
    console.log(`📥 Downloaded CSV data: ${csvText.length} characters`);
    
    // Parse CSV with PapaParse
    const parseResult = Papa.parse<RawMetricsData>(csvText, {
      header: true,
      skipEmptyLines: true,
      delimiter: ','
    });
    
    if (parseResult.errors && parseResult.errors.length > 0) {
      console.log(`⚠️ CSV parsing warnings:`, parseResult.errors);
    }
    
    const totalRows = parseResult.data ? parseResult.data.length : 0;
    console.log(`✅ Successfully parsed ${totalRows} rows from Google Sheets`);
    
    return {
      data: parseResult.data || [],
      success: true
    };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`❌ Failed to fetch Google Sheets data: ${errorMsg}`);
    
    return {
      data: [],
      success: false,
      error: errorMsg
    };
  }
}

// Process batch with retry logic
async function processBatchWithRetry(
  batch: InsertCampaignMetrics[],
  batchNumber: number,
  retryCount = 0
): Promise<BatchResult> {
  const result: BatchResult = {
    batchNumber,
    recordsProcessed: batch.length,
    recordsInserted: 0,
    recordsFailed: 0,
    retryCount,
    success: false,
    errors: []
  };
  
  try {
    console.log(`🔄 Processing batch ${batchNumber} (${batch.length} records) - Attempt ${retryCount + 1}`);
    
    // Use transaction for atomicity
    await db.transaction(async (tx) => {
      const insertResult = await tx.insert(campaignMetrics).values(batch).returning({ id: campaignMetrics.id });
      result.recordsInserted = insertResult.length;
    });
    
    result.success = true;
    console.log(`✅ Batch ${batchNumber} inserted successfully: ${result.recordsInserted} records`);
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Batch ${batchNumber} failed: ${errorMsg}`);
    result.recordsFailed = batch.length;
    
    console.log(`❌ Batch ${batchNumber} failed (attempt ${retryCount + 1}): ${errorMsg}`);
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      const backoffTime = BACKOFF_BASE * Math.pow(2, retryCount);
      console.log(`⏳ Retrying batch ${batchNumber} in ${backoffTime}ms...`);
      
      await sleep(backoffTime);
      return processBatchWithRetry(batch, batchNumber, retryCount + 1);
    } else {
      console.log(`💥 Batch ${batchNumber} failed after ${MAX_RETRIES} retries`);
    }
  }
  
  return result;
}

// Main synchronization function
export async function syncSingleTabWithLogging(userId?: string): Promise<SyncResult> {
  const syncBatch = nanoid();
  console.log(`🚀 Starting Google Sheets sync - Batch ID: ${syncBatch}`);
  
  const result: SyncResult = {
    success: false,
    totalDownloaded: 0,
    totalProcessed: 0,
    totalInserted: 0,
    batchResults: [],
    errors: [],
    syncBatch,
    completionPercentage: 0
  };
  
  try {
    // Step 1: Download data
    console.log(`📋 Step 1: Downloading data from Google Sheets`);
    const downloadResult = await fetchSingleTabData();
    
    if (!downloadResult.success) {
      result.errors.push(downloadResult.error || 'Failed to download data');
      return result;
    }
    
    result.totalDownloaded = downloadResult.data.length;
    console.log(`📊 Total records downloaded: ${result.totalDownloaded}`);
    
    if (result.totalDownloaded === 0) {
      result.success = true;
      result.completionPercentage = 100;
      console.log(`ℹ️ No data to process`);
      return result;
    }
    
    // Step 2: Transform and validate data
    console.log(`🔄 Step 2: Transforming and validating data`);
    const transformedRecords: InsertCampaignMetrics[] = [];
    const failedRecords: RawMetricsData[] = [];
    
    for (const rawRecord of downloadResult.data) {
      const transformed = transformRecord(rawRecord, syncBatch, userId);
      if (transformed) {
        transformedRecords.push(transformed);
      } else {
        failedRecords.push(rawRecord);
      }
    }
    
    result.totalProcessed = transformedRecords.length;
    console.log(`✅ Successfully transformed ${result.totalProcessed} records`);
    
    if (failedRecords.length > 0) {
      console.log(`⚠️ Failed to transform ${failedRecords.length} records`);
      result.errors.push(`${failedRecords.length} records failed validation`);
    }
    
    // Step 3: Clear existing data for this sync
    console.log(`🗑️ Step 3: Clearing existing data from previous syncs`);
    await db.delete(campaignMetrics).where(eq(campaignMetrics.source, 'google_sheets'));
    console.log(`✅ Cleared existing Google Sheets data`);
    
    // Step 4: Insert data in batches
    console.log(`💾 Step 4: Inserting data in batches of ${BATCH_SIZE}`);
    const totalBatches = Math.ceil(transformedRecords.length / BATCH_SIZE);
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, transformedRecords.length);
      const batch = transformedRecords.slice(start, end);
      
      const batchResult = await processBatchWithRetry(batch, i + 1);
      result.batchResults.push(batchResult);
      result.totalInserted += batchResult.recordsInserted;
      
      if (!batchResult.success) {
        result.errors.push(...batchResult.errors);
      }
      
      // Progress update
      const progress = Math.round(((i + 1) / totalBatches) * 100);
      console.log(`📈 Progress: ${progress}% (${i + 1}/${totalBatches} batches)`);
    }
    
    // Step 5: Verify data integrity
    console.log(`🔍 Step 5: Verifying data integrity`);
    const insertedCount = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(campaignMetrics)
      .where(eq(campaignMetrics.syncBatch, syncBatch));
    
    const actualInserted = insertedCount[0]?.count || 0;
    result.completionPercentage = result.totalDownloaded > 0 
      ? Math.round((actualInserted / result.totalDownloaded) * 100) 
      : 100;
    
    console.log(`📊 Data integrity check:`);
    console.log(`   Downloaded: ${result.totalDownloaded}`);
    console.log(`   Processed: ${result.totalProcessed}`);
    console.log(`   Expected inserted: ${result.totalInserted}`);
    console.log(`   Actually inserted: ${actualInserted}`);
    console.log(`   Completion: ${result.completionPercentage}%`);
    
    // Check for discrepancies
    if (actualInserted !== result.totalInserted) {
      const discrepancy = `Data integrity issue: Expected ${result.totalInserted} but found ${actualInserted} records`;
      result.errors.push(discrepancy);
      console.log(`❌ ${discrepancy}`);
    }
    
    // Determine overall success
    const hasSuccessfulBatches = result.batchResults.some(b => b.success);
    const isCompleteSuccess = result.batchResults.every(b => b.success) && actualInserted === result.totalProcessed;
    
    result.success = hasSuccessfulBatches;
    
    if (isCompleteSuccess) {
      console.log(`🎉 Sync completed successfully! Imported ${actualInserted} records`);
    } else if (hasSuccessfulBatches) {
      console.log(`⚠️ Sync completed with warnings. Imported ${actualInserted}/${result.totalDownloaded} records`);
    } else {
      console.log(`💥 Sync failed. Unable to import any records`);
    }
    
    // Reprocess failed records if needed
    if (failedRecords.length > 0 && hasSuccessfulBatches) {
      console.log(`🔄 Attempting to reprocess ${failedRecords.length} failed records...`);
      // This could be implemented as a separate retry mechanism
    }
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Critical sync error: ${errorMsg}`);
    console.log(`💥 Critical sync error: ${errorMsg}`);
  }
  
  console.log(`🏁 Sync process completed - Batch ID: ${syncBatch}`);
  return result;
}

// Health check function
export async function getSyncStatus(): Promise<{
  lastSyncBatch?: string;
  recordCount: number;
  latestRecord?: Date;
}> {
  try {
    const stats = await db
      .select({
        count: sql`count(*)`.mapWith(Number),
        latestBatch: sql<string>`max(${campaignMetrics.syncBatch})`,
        latestDate: sql<Date>`max(${campaignMetrics.createdAt})`
      })
      .from(campaignMetrics)
      .where(eq(campaignMetrics.source, 'google_sheets'));
    
    const firstRow = stats[0];
    
    return {
      lastSyncBatch: firstRow?.latestBatch || undefined,
      recordCount: firstRow?.count || 0,
      latestRecord: firstRow?.latestDate || undefined
    };
  } catch (error) {
    console.log(`❌ Error getting sync status:`, error);
    return { recordCount: 0 };
  }
}