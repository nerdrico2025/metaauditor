
import { eq, sql } from 'drizzle-orm';
import Papa from 'papaparse';
import { campaignMetrics, InsertCampaignMetrics } from '../../shared/schema.js';
import { db } from '../database/connection.js';
import { nanoid } from 'nanoid';

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

const SHEET_ID = '1mOPjhRhBUP60GzZm0NAuUSYGzlE1bDbi414iYtlwZkA';
const TAB_GID = '0';
const BATCH_SIZE = 1000;
const MAX_RETRIES = 3;
const TIMEOUT_MS = 120000;
const BACKOFF_BASE = 1000;

export class SheetsSyncService {
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private parseBrazilianCurrency(value: string): string {
    if (!value || value.trim() === '') return '0';
    
    const cleanValue = value
      .replace(/R\$\s*/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();
      
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? '0' : parsed.toString();
  }

  private parseInteger(value: string): number {
    if (!value || value.trim() === '') return 0;
    const parsed = parseInt(value.replace(/\D/g, ''), 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  private parseDate(dateStr: string): Date {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date() : date;
  }

  private validateRecord(raw: RawMetricsData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!raw.data || raw.data.trim() === '') {
      errors.push('Date is required');
    }
    
    if (!raw.nome_conta || raw.nome_conta.trim() === '') {
      errors.push('Account name is required');
    }
    
    if (!raw.campanha || raw.campanha.trim() === '') {
      errors.push('Campaign name is required');
    }
    
    return { valid: errors.length === 0, errors };
  }

  private transformRecord(raw: RawMetricsData, syncBatch: string, userId?: string): InsertCampaignMetrics | null {
    const validation = this.validateRecord(raw);
    if (!validation.valid) {
      console.log(`⚠️ Validation failed for record:`, validation.errors);
      return null;
    }
    
    try {
      return {
        userId,
        data: this.parseDate(raw.data),
        nomeAconta: raw.nome_conta.trim(),
        adUrl: raw.ad_url?.trim() || null,
        campanha: raw.campanha.trim(),
        grupoAnuncios: raw.grupo_anuncios?.trim() || 'Não especificado',
        anuncios: raw.anuncios?.trim() || 'Anúncio não especificado',
        impressoes: this.parseInteger(raw.impressoes),
        cliques: this.parseInteger(raw.cliques),
        cpm: this.parseBrazilianCurrency(raw.cpm),
        cpc: this.parseBrazilianCurrency(raw.cpc),
        conversasIniciadas: this.parseInteger(raw.conversas_iniciadas),
        custoConversa: this.parseBrazilianCurrency(raw.custo_conversa),
        investimento: this.parseBrazilianCurrency(raw.investimento),
        source: 'google_sheets',
        status: 'imported',
        syncBatch,
      };
    } catch (error) {
      console.log(`❌ Error transforming record:`, error);
      return null;
    }
  }

  async fetchSingleTabData(): Promise<{ data: RawMetricsData[]; success: boolean; error?: string }> {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${TAB_GID}`;
    
    console.log(`📋 Fetching data from Google Sheets: ${SHEET_ID}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      const response = await fetch(csvUrl, {
        headers: { 'User-Agent': 'Click Auditor Sync Service' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const csvText = await response.text();
      
      if (csvText.includes('<html>') || csvText.includes('<!DOCTYPE')) {
        throw new Error('Received HTML response instead of CSV - check sheet permissions');
      }
      
      console.log(`📥 Downloaded CSV data: ${csvText.length} characters`);
      
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
      
      return { data: parseResult.data || [], success: true };
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`❌ Failed to fetch Google Sheets data: ${errorMsg}`);
      
      return { data: [], success: false, error: errorMsg };
    }
  }

  private async processBatchWithRetry(
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
      
      if (retryCount < MAX_RETRIES) {
        const backoffTime = BACKOFF_BASE * Math.pow(2, retryCount);
        console.log(`⏳ Retrying batch ${batchNumber} in ${backoffTime}ms...`);
        
        await this.sleep(backoffTime);
        return this.processBatchWithRetry(batch, batchNumber, retryCount + 1);
      } else {
        console.log(`💥 Batch ${batchNumber} failed after ${MAX_RETRIES} retries`);
      }
    }
    
    return result;
  }

  async syncSingleTab(userId?: string): Promise<SyncResult> {
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
      const downloadResult = await this.fetchSingleTabData();
      
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
      
      const transformedRecords: InsertCampaignMetrics[] = [];
      
      for (const rawRecord of downloadResult.data) {
        const transformed = this.transformRecord(rawRecord, syncBatch, userId);
        if (transformed) {
          transformedRecords.push(transformed);
        }
      }
      
      result.totalProcessed = transformedRecords.length;
      console.log(`✅ Successfully transformed ${result.totalProcessed} records`);
      
      console.log(`🗑️ Clearing existing data from previous syncs`);
      await db.delete(campaignMetrics).where(eq(campaignMetrics.source, 'google_sheets'));
      console.log(`✅ Cleared existing Google Sheets data`);
      
      console.log(`💾 Inserting data in batches of ${BATCH_SIZE}`);
      const totalBatches = Math.ceil(transformedRecords.length / BATCH_SIZE);
      
      for (let i = 0; i < totalBatches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, transformedRecords.length);
        const batch = transformedRecords.slice(start, end);
        
        const batchResult = await this.processBatchWithRetry(batch, i + 1);
        result.batchResults.push(batchResult);
        result.totalInserted += batchResult.recordsInserted;
        
        if (!batchResult.success) {
          result.errors.push(...batchResult.errors);
        }
      }
      
      const insertedCount = await db
        .select({ count: sql`count(*)`.mapWith(Number) })
        .from(campaignMetrics)
        .where(eq(campaignMetrics.syncBatch, syncBatch));
      
      const actualInserted = insertedCount[0]?.count || 0;
      result.completionPercentage = result.totalDownloaded > 0 
        ? Math.round((actualInserted / result.totalDownloaded) * 100) 
        : 100;
      
      result.success = result.batchResults.some(b => b.success);
      
      console.log(`🏁 Sync process completed - Batch ID: ${syncBatch}`);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Critical sync error: ${errorMsg}`);
      console.log(`💥 Critical sync error: ${errorMsg}`);
    }
    
    return result;
  }

  async getSyncStatus(): Promise<{
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
}
