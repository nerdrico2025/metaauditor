import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { pipeline } from 'stream/promises';
import { nanoid } from 'nanoid';
import fetch from 'node-fetch';

export class ImageStorageService {
  private uploadDir = join(process.cwd(), 'public', 'uploads', 'creatives');

  async ensureUploadDir() {
    try {
      await mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      console.error('Error creating upload directory:', error);
    }
  }

  /**
   * Downloads an image from a URL and saves it locally
   * @param imageUrl - The external URL of the image
   * @returns The local path to the saved image
   */
  async downloadAndSaveImage(imageUrl: string): Promise<string | null> {
    try {
      // Skip if already a local URL
      if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('http://localhost') || imageUrl.startsWith('https://') === false) {
        return imageUrl;
      }

      // Skip placeholder images
      if (imageUrl.includes('placeholder.com') || imageUrl.includes('via.placeholder')) {
        return null;
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
      }

      // Generate unique filename
      const filename = `${nanoid(16)}.${extension}`;
      const filepath = join(this.uploadDir, filename);

      // Ensure directory exists
      await this.ensureUploadDir();

      // Download and save the image
      if (response.body) {
        const fileStream = createWriteStream(filepath);
        await pipeline(response.body, fileStream);
        
        // Return the public URL path
        const publicUrl = `/uploads/creatives/${filename}`;
        console.log(`✅ Image saved successfully: ${publicUrl}`);
        return publicUrl;
      }

      return null;
    } catch (error) {
      console.error('Error downloading image:', error);
      return null;
    }
  }

  /**
   * Downloads multiple images in parallel
   * @param imageUrls - Array of image URLs to download
   * @returns Array of local paths (nulls for failed downloads)
   */
  async downloadAndSaveMultiple(imageUrls: string[]): Promise<(string | null)[]> {
    const promises = imageUrls.map(url => this.downloadAndSaveImage(url));
    return Promise.all(promises);
  }
}

export const imageStorageService = new ImageStorageService();
