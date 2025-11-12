import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { storage } from '../../shared/services/storage.service.js';
import { MetaAdsService } from '../../infrastructure/services/MetaAdsService.js';

const router = Router();
const metaAdsService = new MetaAdsService();

/**
 * Verify Meta webhook (GET request during setup)
 * Meta sends a GET request with verify_token to validate the endpoint
 */
router.get('/meta', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Verify token (you'll set this in Meta Business Manager)
  const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'click_auditor_webhook_2025';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Meta webhook verified successfully!');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Meta webhook verification failed');
    res.sendStatus(403);
  }
});

/**
 * Receive Meta webhook notifications (POST request)
 * Meta sends real-time updates about campaigns, ads, etc.
 */
router.post('/meta', async (req: Request, res: Response) => {
  try {
    // Verify webhook signature to ensure it's from Meta
    const signature = req.headers['x-hub-signature-256'] as string;
    const APP_SECRET = process.env.META_APP_SECRET;

    if (APP_SECRET && signature) {
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', APP_SECRET)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== expectedSignature) {
        console.log('❌ Invalid Meta webhook signature');
        return res.sendStatus(403);
      }
    }

    // Respond quickly to Meta (they expect 200 within 20 seconds)
    res.sendStatus(200);

    // Process webhook payload asynchronously
    const payload = req.body;
    console.log('📨 Received Meta webhook:', JSON.stringify(payload, null, 2));

    // Meta sends an array of entries
    if (payload.entry) {
      for (const entry of payload.entry) {
        // Each entry has changes array
        if (entry.changes) {
          for (const change of entry.changes) {
            await processWebhookChange(change, payload);
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Error processing Meta webhook:', error);
    // Still return 200 to Meta to avoid retries
    res.sendStatus(200);
  }
});

/**
 * Process individual webhook change notification
 */
async function processWebhookChange(change: any, fullPayload: any) {
  try {
    const field = change.field; // 'campaigns', 'adsets', 'ads', etc
    const value = change.value;

    console.log(`🔔 Processing webhook change: ${field}`, value);

    // Store the webhook event
    const webhookEvent = await storage.createWebhookEvent({
      platform: 'meta',
      eventType: field,
      externalId: value.id || null,
      objectType: field.replace(/s$/, ''), // Remove plural: 'campaigns' -> 'campaign'
      action: value.event || value.status || 'update',
      payload: fullPayload,
      processed: false,
    });

    // Process based on object type
    switch (field) {
      case 'campaigns':
        await processCampaignUpdate(value, webhookEvent.id);
        break;
      case 'adsets':
        await processAdSetUpdate(value, webhookEvent.id);
        break;
      case 'ads':
        await processAdUpdate(value, webhookEvent.id);
        break;
      default:
        console.log(`⚠️  Unhandled webhook field: ${field}`);
    }

    // Mark as processed
    await storage.updateWebhookEvent(webhookEvent.id, {
      processed: true,
      processedAt: new Date(),
    });

  } catch (error: any) {
    console.error('❌ Error processing webhook change:', error);
    // Store error but don't throw to allow other changes to process
  }
}

/**
 * Process campaign update from webhook
 */
async function processCampaignUpdate(value: any, webhookEventId: string) {
  try {
    const campaignExternalId = value.id;
    console.log(`📊 Processing campaign update: ${campaignExternalId}`);

    // Find existing campaign in our database
    const existingCampaigns = await storage.getCampaigns();
    const campaign = existingCampaigns.find(c => c.externalId === campaignExternalId);

    if (!campaign) {
      console.log(`⚠️  Campaign ${campaignExternalId} not found in database, skipping update`);
      return;
    }

    // Get integration to fetch fresh data
    const integration = await storage.getIntegrationById(campaign.integrationId);
    if (!integration) {
      console.log(`⚠️  Integration not found for campaign ${campaignExternalId}`);
      return;
    }

    // Fetch fresh campaign data from Meta
    const user = await storage.getUserById(campaign.userId);
    const campaigns = await metaAdsService.syncCampaigns(
      integration,
      campaign.userId,
      user?.companyId || null
    );

    const updatedCampaign = campaigns.find(c => c.externalId === campaignExternalId);
    if (updatedCampaign) {
      await storage.updateCampaign(campaign.id, updatedCampaign);
      console.log(`✅ Campaign ${campaign.name} updated successfully via webhook`);
    }

  } catch (error: any) {
    console.error('Error processing campaign update:', error);
    await storage.updateWebhookEvent(webhookEventId, {
      errorMessage: error.message,
    });
  }
}

/**
 * Process ad set update from webhook
 */
async function processAdSetUpdate(value: any, webhookEventId: string) {
  try {
    const adSetExternalId = value.id;
    console.log(`📋 Processing ad set update: ${adSetExternalId}`);

    // Find existing ad set in our database
    const existingAdSets = await storage.getAdSets();
    const adSet = existingAdSets.find(a => a.externalId === adSetExternalId);

    if (!adSet) {
      console.log(`⚠️  Ad set ${adSetExternalId} not found in database, skipping update`);
      return;
    }

    // You could fetch fresh ad set data here
    console.log(`✅ Ad set ${adSet.name} webhook received (detailed sync not implemented yet)`);

  } catch (error: any) {
    console.error('Error processing ad set update:', error);
    await storage.updateWebhookEvent(webhookEventId, {
      errorMessage: error.message,
    });
  }
}

/**
 * Process ad (creative) update from webhook
 */
async function processAdUpdate(value: any, webhookEventId: string) {
  try {
    const adExternalId = value.id;
    console.log(`🎨 Processing ad update: ${adExternalId}`);

    // Find existing creative in our database
    const existingCreatives = await storage.getCreatives();
    const creative = existingCreatives.find(c => c.externalId === adExternalId);

    if (!creative) {
      console.log(`⚠️  Ad ${adExternalId} not found in database, skipping update`);
      return;
    }

    // You could fetch fresh ad data here
    console.log(`✅ Ad ${creative.name} webhook received (detailed sync not implemented yet)`);

  } catch (error: any) {
    console.error('Error processing ad update:', error);
    await storage.updateWebhookEvent(webhookEventId, {
      errorMessage: error.message,
    });
  }
}

export default router;
