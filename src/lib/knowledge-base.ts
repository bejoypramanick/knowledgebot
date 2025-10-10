import axios from 'axios';

export interface DocumentMetadata {
  title?: string;
  category?: string;
  tags?: string[];
  author?: string;
  sourceUrl?: string;
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
  presigned_url: string;
  document_id: string;
  s3_key: string;
  bucket: string;
}

export class KnowledgeBaseManager {
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
        const base64Content = base64.split(',')[1];
        resolve(base64Content);
      };
      reader.onerror = error => reject(error);
    });
  }

  async uploadDocument(file: File, metadata: Partial<DocumentMetadata> = {}): Promise<DocumentUploadResponse> {
    // Convert file to base64 as expected by backend
    const base64Content = await this.fileToBase64(file);
    
    const payload = {
      action: 'upload',
      filename: file.name,
      content: base64Content,
      document_type: file.type.split('/')[1] || 'txt',
      metadata: {
        title: metadata.title || file.name,
        category: metadata.category || 'general',
        tags: metadata.tags || [],
        author: metadata.author || 'unknown',
        sourceUrl: metadata.sourceUrl
      }
    };

    const response = await axios.post(`${this.apiBaseUrl}/knowledge-base`, payload);
    return response.data;
  }

  async scrapeWebsite(url: string, scrapeType: string = 'faq'): Promise<ScrapeResponse> {
    const payload = { 
      action: 'scrape',
      url, 
      scrape_type: scrapeType,
      metadata: {}
    };
    const response = await axios.post(`${this.apiBaseUrl}/knowledge-base`, payload);
    return response.data;
  }

  async getDocuments(): Promise<DocumentsListResponse> {
    try {
      const response = await axios.post(`${this.apiBaseUrl}/knowledge-base`, { action: 'list' });
      return response.data;
    } catch (error) {
      console.error('Error in getDocuments:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
      }
      throw error;
    }
  }

  async getPresignedUploadUrl(file: File, metadata: Partial<DocumentMetadata> = {}): Promise<PresignedUrlResponse> {
    const payload = {
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
      metadata: {
        title: metadata.title || file.name,
        category: metadata.category || 'general',
        tags: metadata.tags || [],
        author: metadata.author || 'unknown',
        sourceUrl: metadata.sourceUrl
      }
    };

    console.log('Requesting presigned URL with payload:', payload);

    // Use the dedicated upload-url endpoint
    const response = await axios.post(`${this.apiBaseUrl}/upload-url`, payload);
    console.log('Presigned URL response:', response.data);
    return response.data;
  }

  async uploadToS3(file: File, presignedUrl: string, metadata: Partial<DocumentMetadata> = {}, onProgress?: (progress: number) => void): Promise<void> {
    console.log('Starting S3 upload with presigned URL');
    console.log('File:', file.name, 'Size:', file.size, 'Type:', file.type);
    console.log('Presigned URL:', presignedUrl.substring(0, 100) + '...');

    // The presigned URL only includes content-type and host in its signature
    // We should not send any metadata headers as they're not in the signed headers
    const headers: Record<string, string> = {
      'Content-Type': file.type || 'application/octet-stream'
    };

    console.log('Upload headers:', headers);

    try {
      const response = await axios.put(presignedUrl, file, { 
        headers,
        timeout: 300000, // 5 minute timeout for large files
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log(`Upload progress: ${percentCompleted}%`);
            // Call progress callback if provided
            if (onProgress) {
              // Map S3 upload progress (30-90%) to overall progress
              const mappedProgress = 30 + Math.round((percentCompleted * 60) / 100);
              onProgress(mappedProgress);
            }
          }
        }
      });

      if (response.status !== 200) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      console.log('S3 upload completed successfully');
      
      // Update progress to 90% after S3 upload
      if (onProgress) {
        onProgress(90);
      }
      
    } catch (error) {
      console.error('S3 upload failed:', error);
      throw error;
    }
  }

  async updateS3ObjectMetadata(s3Key: string, metadata: Record<string, unknown>): Promise<void> {
    // This would typically be handled by the backend after upload
    // For now, we'll just log the metadata
    console.log('S3 object metadata to be updated:', {
      s3Key,
      metadata
    });
  }
}



