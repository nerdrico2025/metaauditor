import { nanoid } from 'nanoid';
import fetch from 'node-fetch';
import { objectStorageService } from './ObjectStorageService.js';

export class ImageStorageService {
  /**
   * Downloads an image from a URL and saves it to Object Storage
   * @param imageUrl - The external URL of the image
   * @param companyId - The company ID for the storage path
   * @param adSetId - The ad set ID for organizing creatives
   * @returns The Object Storage path to the saved image
   */
  async downloadAndSaveImage(imageUrl: string, companyId: string, adSetId: string): Promise<string | null> {
    try {
      // Skip if already an Object Storage URL
      if (imageUrl.startsWith('/objects/')) {
        return imageUrl;
      }

      // Skip if already a local URL (legacy)
      if (imageUrl.startsWith('/uploads/')) {
        return imageUrl;
      }

      // Skip placeholder images
      if (imageUrl.includes('placeholder.com') || imageUrl.includes('via.placeholder')) {
        return null;
      }

      // Skip non-http URLs
      if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        return imageUrl;
      }

      console.log(`📥 Downloading image from: ${imageUrl}`);

      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        console.error(`Failed to download image: ${response.status} ${response.statusText}`);
        return null;
      }

      // Get file extension from Content-Type header
      const contentType = response.headers.get('content-type');
      let extension = 'jpg';
      
      if (contentType) {
        if (contentType.includes('png')) extension = 'png';
        else if (contentType.includes('gif')) extension = 'gif';
        else if (contentType.includes('webp')) extension = 'webp';
        else if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg';
        else if (contentType.includes('svg')) extension = 'svg';
      }

      // Download image as buffer
      const buffer = await response.buffer();
      
      // Upload to Object Storage
      const result = await objectStorageService.uploadCreative(companyId, adSetId, buffer, extension);
      
      console.log(`✅ Image saved to Object Storage: ${result.objectPath}`);
      return result.objectPath;
    } catch (error) {
      console.error('Error downloading image:', error);
      return null;
    }
  }

  /**
   * Downloads multiple images in parallel
   * @param imageUrls - Array of image URLs to download
   * @param companyId - The company ID for the storage path
   * @param adSetId - The ad set ID for organizing creatives
   * @returns Array of Object Storage paths (nulls for failed downloads)
   */
  async downloadAndSaveMultiple(imageUrls: string[], companyId: string, adSetId: string): Promise<(string | null)[]> {
    const promises = imageUrls.map(url => this.downloadAndSaveImage(url, companyId, adSetId));
    return Promise.all(promises);
  }
}

export const imageStorageService = new ImageStorageService();
