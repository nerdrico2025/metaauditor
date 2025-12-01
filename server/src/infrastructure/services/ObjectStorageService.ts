import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./ObjectAcl.js";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export interface UploadContext {
  companyId: string;
  type: 'creatives' | 'logos' | 'documents';
  subPath?: string;
}

export class ObjectStorageService {
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.OBJECT_STORAGE_BUCKET || '';
  }

  getBucketName(): string {
    if (!this.bucketName) {
      throw new Error(
        "OBJECT_STORAGE_BUCKET not set. Create a bucket in 'Object Storage' " +
          "tool and set OBJECT_STORAGE_BUCKET env var."
      );
    }
    return this.bucketName;
  }

  buildObjectPath(context: UploadContext, filename?: string): string {
    const parts = ['companies', context.companyId, context.type];
    
    if (context.subPath) {
      parts.push(context.subPath);
    }
    
    if (filename) {
      parts.push(filename);
    }
    
    return parts.join('/');
  }

  async getUploadURL(context: UploadContext, extension: string = 'jpg'): Promise<{ uploadURL: string; objectPath: string }> {
    const bucketName = this.getBucketName();
    const objectId = randomUUID();
    const filename = `${objectId}.${extension}`;
    const objectPath = this.buildObjectPath(context, filename);

    const signedUrl = await this.signObjectURL({
      bucketName,
      objectName: objectPath,
      method: "PUT",
      ttlSec: 900,
    });

    return {
      uploadURL: signedUrl,
      objectPath: `/objects/${objectPath}`,
    };
  }

  async getCreativeUploadURL(companyId: string, adSetId: string, extension: string = 'jpg'): Promise<{ uploadURL: string; objectPath: string }> {
    return this.getUploadURL({
      companyId,
      type: 'creatives',
      subPath: adSetId,
    }, extension);
  }

  async getLogoUploadURL(companyId: string, extension: string = 'png'): Promise<{ uploadURL: string; objectPath: string }> {
    return this.getUploadURL({
      companyId,
      type: 'logos',
    }, extension);
  }

  async getObjectFile(objectPath: string): Promise<File> {
    let cleanPath = objectPath;
    if (cleanPath.startsWith("/objects/")) {
      cleanPath = cleanPath.slice("/objects/".length);
    }

    const bucketName = this.getBucketName();
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(cleanPath);
    
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      const [metadata] = await file.getMetadata();
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";
      
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
      });

      const stream = file.createReadStream();

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  async setObjectAcl(objectPath: string, aclPolicy: ObjectAclPolicy): Promise<string> {
    try {
      const objectFile = await this.getObjectFile(objectPath);
      await setObjectAclPolicy(objectFile, aclPolicy);
      return objectPath;
    } catch (error) {
      console.error("Error setting object ACL:", error);
      throw error;
    }
  }

  async canAccessObject({
    userId,
    objectPath,
    requestedPermission,
  }: {
    userId?: string;
    objectPath: string;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    try {
      const objectFile = await this.getObjectFile(objectPath);
      return canAccessObject({
        userId,
        objectFile,
        requestedPermission: requestedPermission ?? ObjectPermission.READ,
      });
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return false;
      }
      throw error;
    }
  }

  async deleteObject(objectPath: string): Promise<void> {
    try {
      const objectFile = await this.getObjectFile(objectPath);
      await objectFile.delete();
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return;
      }
      throw error;
    }
  }

  async listObjects(context: UploadContext): Promise<string[]> {
    const bucketName = this.getBucketName();
    const prefix = this.buildObjectPath(context);
    
    const bucket = objectStorageClient.bucket(bucketName);
    const [files] = await bucket.getFiles({ prefix });
    
    return files.map(file => `/objects/${file.name}`);
  }

  normalizeObjectPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    if (pathParts.length >= 2) {
      const objectPath = pathParts.slice(1).join('/');
      return `/objects/${objectPath}`;
    }
    
    return rawPath;
  }

  private async signObjectURL({
    bucketName,
    objectName,
    method,
    ttlSec,
  }: {
    bucketName: string;
    objectName: string;
    method: "GET" | "PUT" | "DELETE" | "HEAD";
    ttlSec: number;
  }): Promise<string> {
    const request = {
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
    };
    
    const response = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      }
    );
    
    if (!response.ok) {
      throw new Error(
        `Failed to sign object URL, errorcode: ${response.status}, ` +
          `make sure you're running on Replit`
      );
    }

    const data = await response.json() as { signed_url: string };
    return data.signed_url;
  }
}

export const objectStorageService = new ObjectStorageService();
