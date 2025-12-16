import axios from 'axios';

export interface DocumentMetadata {
  title?: string;
  category?: string;
  tags?: string[];
  author?: string;
  sourceUrl?: string;
  description?: string;
}

export interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt' | 'video' | 'url' | 'html';
  status: 'uploaded' | 'processing' | 'processed' | 'failed';
  chunks?: unknown[];
  metadata: DocumentMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentUploadResponse {
  message: string;
  chunks_created: number;
  filename: string;
}

export interface ScrapeResponse {
  message: string;
  chunks_created: number;
  url: string;
}

export interface DocumentsListResponse {
  documents: unknown[];
  count: number;
}

export interface PresignedUrlResponse {
  success: boolean;
  presigned_url: string;
  bucket: string;
  key: string;
  operation: string;
  expiration: number;
}

export class KnowledgeBaseManager {
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async uploadDocument(file: File, metadata: Partial<DocumentMetadata> = {}): Promise<DocumentUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata.title) {
      formData.append('display_name', metadata.title);
    }

    // Explicitly add other metadata as needed by your backend, 
    // though the swagger showed only file and display_name.

    try {
      const response = await axios.post(`${this.apiBaseUrl}/api/v1/knowledgebase/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return {
        message: response.data.message || 'Upload successful',
        chunks_created: 0,
        filename: response.data.filename || file.name
      };
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }

  async scrapeWebsite(url: string, scrapeType: string = 'faq'): Promise<ScrapeResponse> {
    const payload = {
      url: url,
      max_depth: 2,
      max_pages: 10
    };
    try {
      const response = await axios.post(`${this.apiBaseUrl}/api/v1/scrape`, payload);
      return {
        message: response.data.message || 'Scraping started',
        chunks_created: response.data.total_files_uploaded || 0,
        url: url
      };
    } catch (error) {
      console.error('Scrape failed:', error);
      throw error;
    }
  }

  async getDocuments(): Promise<DocumentsListResponse> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/api/v1/knowledgebase/files`);
      // Response is { files: FileMetadata[] }
      return {
        documents: response.data.files || [],
        count: (response.data.files || []).length
      };
    } catch (error: any) {
      console.error('Error in getDocuments:', error);
      throw error;
    }
  }

  // Legacy/Unused methods kept for interface compatibility (or could be removed if we update all callers)
  async getPresignedUploadUrl(file: File, metadata: Partial<DocumentMetadata> = {}): Promise<PresignedUrlResponse> {
    throw new Error('Method not supported by this backend. Use uploadDocument instead.');
  }

  async uploadToS3(file: File, presignedUrl: string, metadata: Partial<DocumentMetadata> = {}, onProgress?: (progress: number) => void): Promise<void> {
    throw new Error('Method not supported by this backend. Use uploadDocument instead.');
  }

  async updateS3ObjectMetadata(s3Key: string, metadata: Record<string, unknown>): Promise<void> {
    // No-op
  }

  async triggerDocumentProcessing(
    bucket: string,
    key: string,
    connectionId?: string
  ): Promise<{ status: string, message: string }> {
    return { status: 'completed', message: 'Processing handled by upload endpoint' };
  }
}



