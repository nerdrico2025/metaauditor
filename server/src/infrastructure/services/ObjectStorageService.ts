import { Client } from "@replit/object-storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import { Readable } from "stream";

const objectStorageClient = new Client();

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export interface UploadContext {
  companyId: string;
  type: 'creatives' | 'logos' | 'documents' | 'policies' | 'campaigns';
  subPath?: string;
}

export class ObjectStorageService {
  constructor() {}

  buildCompanyPath(companyId: string, type: string, subPath?: string): string {
    const parts = ['companies', companyId, type];
    if (subPath) {
      parts.push(subPath);
    }
    return parts.join('/');
  }

  generateObjectPath(context: UploadContext, extension: string = 'jpg'): string {
    const objectId = randomUUID();
    const filename = `${objectId}.${extension}`;
    return `${this.buildCompanyPath(context.companyId, context.type, context.subPath)}/${filename}`;
  }

  async uploadFromBuffer(objectPath: string, buffer: Buffer): Promise<{ objectPath: string }> {
    let cleanPath = objectPath;
    if (cleanPath.startsWith("/objects/")) {
      cleanPath = cleanPath.slice("/objects/".length);
    }

    const result = await objectStorageClient.uploadFromBytes(cleanPath, buffer);
    
    if (!result.ok) {
      throw new Error(`Failed to upload: ${result.error?.message || 'Unknown error'}`);
    }

    return { objectPath: `/objects/${cleanPath}` };
  }

  async uploadCreative(companyId: string, adSetId: string, buffer: Buffer, extension: string = 'jpg'): Promise<{ objectPath: string }> {
    const path = this.generateObjectPath({
      companyId,
      type: 'campaigns',
      subPath: adSetId,
    }, extension);
    
    return this.uploadFromBuffer(path, buffer);
  }

  async uploadLogo(companyId: string, buffer: Buffer, extension: string = 'png'): Promise<{ objectPath: string }> {
    const path = this.generateObjectPath({
      companyId,
      type: 'policies',
      subPath: 'logos',
    }, extension);
    
    return this.uploadFromBuffer(path, buffer);
  }

  async downloadAsBuffer(objectPath: string): Promise<Buffer | null> {
    let cleanPath = objectPath;
    if (cleanPath.startsWith("/objects/")) {
      cleanPath = cleanPath.slice("/objects/".length);
    }

    try {
      const result = await objectStorageClient.downloadAsBytes(cleanPath);
      
      if (!result.ok || !result.value) {
        return null;
      }

      return result.value[0];
    } catch (error) {
      console.error("Error downloading file as buffer:", error);
      return null;
    }
  }

  async downloadObject(objectPath: string, res: Response) {
    let cleanPath = objectPath;
    if (cleanPath.startsWith("/objects/")) {
      cleanPath = cleanPath.slice("/objects/".length);
    }

    try {
      const result = await objectStorageClient.downloadAsBytes(cleanPath);
      
      if (!result.ok || !result.value) {
        throw new ObjectNotFoundError();
      }

      const buffer = result.value[0];
      const ext = cleanPath.split('.').pop()?.toLowerCase() || '';
      const contentTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'webp': 'image/webp',
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'pdf': 'application/pdf',
      };

      res.set({
        "Content-Type": contentTypes[ext] || "application/octet-stream",
        "Content-Length": buffer.length,
        "Cache-Control": "public, max-age=3600",
      });

      res.send(buffer);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (error instanceof ObjectNotFoundError) {
        throw error;
      }
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  async deleteObject(objectPath: string): Promise<void> {
    let cleanPath = objectPath;
    if (cleanPath.startsWith("/objects/")) {
      cleanPath = cleanPath.slice("/objects/".length);
    }

    try {
      await objectStorageClient.delete(cleanPath, { ignoreNotFound: true });
    } catch (error) {
      console.error("Error deleting object:", error);
    }
  }

  async objectExists(objectPath: string): Promise<boolean> {
    let cleanPath = objectPath;
    if (cleanPath.startsWith("/objects/")) {
      cleanPath = cleanPath.slice("/objects/".length);
    }

    const result = await objectStorageClient.exists(cleanPath);
    return result.ok && result.value === true;
  }

  async listObjects(prefix: string): Promise<string[]> {
    const result = await objectStorageClient.list({ prefix });
    
    if (!result.ok || !result.value) {
      return [];
    }

    return result.value.map(obj => `/objects/${obj.name}`);
  }
}

export const objectStorageService = new ObjectStorageService();
