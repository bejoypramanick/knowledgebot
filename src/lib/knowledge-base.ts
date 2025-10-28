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
    console.log('Requesting presigned URL from API Gateway:', this.apiBaseUrl);
    
    try {
      const response = await axios.get(`${this.apiBaseUrl}/presigned-url`);
      console.log('Presigned URL response:', response.data);
      
      // Transform response to match our interface
      return {
        success: true,
        presigned_url: response.data.presigned_url,
        bucket: response.data.bucket,
        key: response.data.key,
        operation: 'PUT',
        expiration: response.data.expires_in || 300
      };
    } catch (error) {
      console.error('Error getting presigned URL:', error);
      throw new Error('Failed to generate presigned URL');
    }
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
      
    } catch (error: any) {
      console.error('S3 upload failed:', error);
      
      // Check if it's a CORS error (403 on OPTIONS request)
      if (error.response?.status === 403 || error.code === 'ERR_NETWORK') {
        throw new Error(
          'Upload failed due to CORS configuration. ' +
          'The S3 bucket needs CORS configuration to allow browser uploads. ' +
          'Please see S3_CORS_CONFIGURATION.md for setup instructions.'
        );
      }
      
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

  async triggerDocumentProcessing(bucket: string, key: string): Promise<{status: string, message: string}> {
    // S3 upload triggers Lambda automatically, but we manually trigger processing to ensure it runs
    const albUrl = import.meta.env.VITE_PHARMA_ALB_URL || 'http://pharma-rag-alb-dev-2054947644.us-east-1.elb.amazonaws.com';
    
    try {
      // Trigger processing on ECS
      const response = await axios.post(`${albUrl}/process`, {
        bucket,
        key: key,
        s3_key: key,
        use_llm_chunking: false  // Use fast native chunking
      });
      return {
        status: response.data.status || 'accepted',
        message: response.data.message || 'Document processing started'
      };
    } catch (error) {
      console.error('Error triggering document processing:', error);
      throw new Error('Failed to trigger document processing');
    }
  }
}



