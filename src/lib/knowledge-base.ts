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
  chunks?: any[];
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
  documents: any[];
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
      action: 'get-upload-url',
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

    // Use the knowledge-base endpoint for presigned URL generation
    const response = await axios.post(`${this.apiBaseUrl}/knowledge-base`, payload);
    console.log('Presigned URL response:', response.data);
    return response.data;
  }

  async uploadToS3(file: File, presignedUrl: string, metadata: Partial<DocumentMetadata> = {}): Promise<void> {
    // The presigned URL only includes content-type and host in its signature
    // We should not send any metadata headers as they're not in the signed headers
    let headers: Record<string, string> = {
      'Content-Type': file.type || 'application/octet-stream'
    };

    console.log('Upload headers:', headers);
    console.log('Presigned URL:', presignedUrl);

    const response = await axios.put(presignedUrl, file, { headers });

    if (response.status !== 200) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
  }

  async updateS3ObjectMetadata(s3Key: string, metadata: any): Promise<void> {
    // This would typically be handled by the backend after upload
    // For now, we'll just log the metadata
    console.log('S3 object metadata to be updated:', {
      s3Key,
      metadata
    });
  }
}



