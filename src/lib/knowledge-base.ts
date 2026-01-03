import axios from 'axios';

export interface DocumentMetadata {
  title?: string;
  category?: string;
  tags?: string[];
  author?: string;
  sourceUrl?: string;
  description?: string;
  key?: string;
  size?: number;
  originalFilename?: string;
  fileType?: string;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  status: 'uploaded' | 'processing' | 'processed' | 'failed';
  size: number;
  chunks?: unknown[];
  metadata: DocumentMetadata;
  createdAt: string;
  updatedAt: string;
  source: 'upload' | 'scrape';
}

export interface DocumentUploadResponse {
  message: string;
  chunks_created: number;
  filename: string;
  size?: number;
}

export interface ScrapeResponse {
  message: string;
  chunks_created: number;
  url: string;
  sitemap?: string;
}

export interface DocumentsListResponse {
  documents: Document[];
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

// Validation constants
export const VALIDATION = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_FILE_TYPES: [
    'pdf', 'docx', 'doc', 'txt', 'ppt', 'pptx', 'xlsx', 'xls',
    'png', 'jpg', 'jpeg', 'gif', 'webp',
    'mp3', 'wav', 'ogg',
    'html', 'htm', 'yaml', 'yml', 'json', 'xml', 'csv', 'md'
  ],
  URL_PATTERN: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i,
  MAX_URL_LENGTH: 2048,
};

// Validation functions
export const validateFile = (file: File): { valid: boolean; error?: string } => {
  // Check file size
  if (file.size > VALIDATION.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum limit of ${formatFileSize(VALIDATION.MAX_FILE_SIZE)}`
    };
  }

  // Check file type
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!VALIDATION.ALLOWED_FILE_TYPES.includes(extension)) {
    return {
      valid: false,
      error: `File type ".${extension}" is not supported. Allowed types: ${VALIDATION.ALLOWED_FILE_TYPES.join(', ')}`
    };
  }

  // Check for empty file
  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty'
    };
  }

  return { valid: true };
};

export const validateUrl = (url: string): { valid: boolean; error?: string } => {
  if (!url || url.trim().length === 0) {
    return { valid: false, error: 'URL is required' };
  }

  if (url.length > VALIDATION.MAX_URL_LENGTH) {
    return { valid: false, error: 'URL is too long' };
  }

  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Please enter a valid URL' };
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toLowerCase() || '';
};

export class KnowledgeBaseManager {
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async uploadDocument(
    file: File, 
    metadata: Partial<DocumentMetadata> = {},
    replaceExisting: boolean = false
  ): Promise<DocumentUploadResponse> {
    // Client-side validation
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const formData = new FormData();
    formData.append('file', file);
    if (metadata.title) {
      formData.append('display_name', metadata.title);
    }
    // Pass replace_existing flag to backend
    formData.append('replace_existing', replaceExisting.toString());

    try {
      const response = await axios.post(`${this.apiBaseUrl}/api/v1/knowledgebase/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return {
        message: response.data.message || 'Upload successful',
        chunks_created: response.data.chunks_created || 0,
        filename: response.data.file?.original_filename || response.data.filename || file.name,
        size: response.data.file?.size_bytes ? parseInt(response.data.file.size_bytes) : file.size
      };
    } catch (error: unknown) {
      console.error('Upload failed:', error);
      const axiosError = error as { response?: { data?: { message?: string; errors?: Array<{field: string; message: string}> } } };
      
      // Handle validation errors from backend
      if (axiosError.response?.data?.errors) {
        const errorMessages = axiosError.response.data.errors.map(e => e.message).join('; ');
        throw new Error(errorMessages);
      }
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
      throw error;
    }
  }

  async scrapeWebsite(url: string, options: { maxDepth?: number; maxPages?: number } = {}): Promise<ScrapeResponse> {
    // Client-side validation
    const validation = validateUrl(url);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const payload = {
      url: url,
      max_depth: options.maxDepth || 2,
      max_pages: options.maxPages || 10
    };

    try {
      const response = await axios.post(`${this.apiBaseUrl}/api/v1/scrape`, payload);
      
      // Try to auto-detect sitemap from response
      let detectedSitemap: string | undefined;
      if (response.data.sitemap) {
        detectedSitemap = response.data.sitemap;
      } else {
        try {
          const urlObj = new URL(url);
          detectedSitemap = `${urlObj.origin}/sitemap.xml`;
        } catch {
          // Ignore URL parsing errors
        }
      }

      return {
        message: response.data.message || 'Scraping started',
        chunks_created: response.data.total_files_uploaded || 0,
        url: url,
        sitemap: detectedSitemap
      };
    } catch (error: unknown) {
      console.error('Scrape failed:', error);
      const axiosError = error as { response?: { data?: { message?: string } } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
      throw error;
    }
  }

  async getDocuments(): Promise<DocumentsListResponse> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/api/v1/knowledgebase/files`);
      
      // Define response document type (matches new backend format)
      interface ResponseDocument {
        key?: string;
        id?: string;
        name?: string;
        original_name?: string;
        display_name?: string;
        file_type?: string;
        type?: string;
        mime_type?: string;
        size?: number;
        size_bytes?: number;
        source?: 'upload' | 'scrape' | 'gemini';
        source_url?: string;
        url?: string;
        domain?: string;
        pages_scraped?: number;
        status?: string;
        gemini_file_name?: string;
        r2_url?: string;
        r2_key?: string;
        created_at?: string;
        last_modified?: string;
      }
      
      // Transform response to include proper document information
      const documents: Document[] = (response.data.files || []).map((doc: ResponseDocument) => {
        // Use source field from backend (now properly set)
        const source = doc.source || (doc.source_url || doc.url || doc.domain ? 'scrape' : 'upload');
        
        // Get name from appropriate field
        const name = doc.original_name || doc.display_name || doc.name || 'Unknown';
        
        // Get file extension/type
        const extension = doc.file_type || doc.type || getFileExtension(name);
        
        // Get size (backend now provides size_bytes)
        const size = doc.size_bytes || doc.size || 0;

        return {
          id: doc.key || doc.id || Math.random().toString(),
          name: name,
          type: extension,
          status: (doc.status || 'processed') as 'uploaded' | 'processing' | 'processed' | 'failed',
          size: size,
          chunks: [],
          metadata: {
            title: name,
            sourceUrl: doc.source_url || doc.url,
            key: doc.key,
            size: size,
            originalFilename: name,
            fileType: extension
          },
          createdAt: doc.created_at || new Date().toISOString(),
          updatedAt: doc.last_modified || doc.created_at || new Date().toISOString(),
          source: source as 'upload' | 'scrape'
        };
      });

      return {
        documents,
        count: response.data.count || documents.length
      };
    } catch (error: unknown) {
      console.error('Error in getDocuments:', error);
      throw error;
    }
  }

  async deleteDocument(documentKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axios.post(`${this.apiBaseUrl}/delete-document`, {
        document_key: documentKey
      });
      
      return {
        success: true,
        message: response.data.message || 'Document deleted successfully'
      };
    } catch (error: unknown) {
      console.error('Delete failed:', error);
      const axiosError = error as { response?: { data?: { message?: string } } };
      throw new Error(axiosError.response?.data?.message || 'Failed to delete document');
    }
  }

  async checkDocumentExists(filename: string, fileType: string): Promise<Document | null> {
    try {
      const response = await this.getDocuments();
      const existingDoc = response.documents.find(
        doc => doc.name.toLowerCase() === filename.toLowerCase() ||
               (doc.metadata.originalFilename?.toLowerCase() === filename.toLowerCase())
      );
      return existingDoc || null;
    } catch {
      return null;
    }
  }
}
