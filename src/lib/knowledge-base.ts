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
    const response = await axios.post(`${this.apiBaseUrl}/knowledge-base`, { action: 'list' });
    return response.data;
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

    // Use the chat endpoint for presigned URL generation
    const response = await axios.post(`${this.apiBaseUrl}/chat`, payload);
    console.log('Presigned URL response:', response.data);
    return response.data;
  }

  async uploadToS3(file: File, presignedUrl: string, metadata: Partial<DocumentMetadata> = {}): Promise<void> {
    // Extract metadata from the presigned URL response
    const url = new URL(presignedUrl);
    const signedHeaders = url.searchParams.get('X-Amz-SignedHeaders');
    
    let headers: Record<string, string> = {
      'Content-Type': file.type || 'application/octet-stream'
    };

    // If the presigned URL expects metadata headers, include them
    if (signedHeaders && signedHeaders.includes('x-amz-meta-')) {
      const documentId = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      
      console.log('Expected signed headers:', signedHeaders);
      
      // Check which specific metadata headers are expected
      if (signedHeaders.includes('x-amz-meta-author')) {
        headers['x-amz-meta-author'] = metadata.author || 'unknown';
      }
      if (signedHeaders.includes('x-amz-meta-category')) {
        headers['x-amz-meta-category'] = metadata.category || 'general';
      }
      if (signedHeaders.includes('x-amz-meta-tags')) {
        headers['x-amz-meta-tags'] = JSON.stringify(metadata.tags || []);
      }
      if (signedHeaders.includes('x-amz-meta-document_id')) {
        headers['x-amz-meta-document_id'] = documentId;
      }
      if (signedHeaders.includes('x-amz-meta-original_filename')) {
        headers['x-amz-meta-original_filename'] = file.name;
      }
      if (signedHeaders.includes('x-amz-meta-title')) {
        headers['x-amz-meta-title'] = metadata.title || file.name;
      }
      if (signedHeaders.includes('x-amz-meta-upload_timestamp')) {
        headers['x-amz-meta-upload_timestamp'] = timestamp;
      }
      
      console.log('Including metadata headers:', Object.keys(headers).filter(k => k.startsWith('x-amz-meta-')));
    }

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



