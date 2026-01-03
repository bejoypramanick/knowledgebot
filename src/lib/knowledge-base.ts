import axios from 'axios';

export interface DocumentMetadata {
  title?: string;
  category?: string;
  tags?: string[];
  author?: string;
  sourceUrl?: string;
  description?: string;
  key?: string;
  geminiFileName?: string;
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
  source: 'upload' | 'website';
  originalUrl?: string; // For scraped websites
  r2Url?: string; // For downloadable files from R2
  r2Key?: string; // R2 storage key
  version?: number; // Document version number
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

export const formatFileSize = (bytes: number | undefined | null): string => {
  // Handle undefined, null, NaN, or negative values
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes < 0) {
    return '—';
  }
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  // Ensure index is within bounds
  const safeIndex = Math.min(i, sizes.length - 1);
  
  return parseFloat((bytes / Math.pow(k, safeIndex)).toFixed(2)) + ' ' + sizes[safeIndex];
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
      const axiosError = error as { 
        response?: { 
          status?: number;
          data?: { 
            message?: string; 
            detail?: string | { message?: string };
            errors?: Array<{field: string; message: string}> 
          } 
        };
        message?: string;
      };
      
      // Handle validation errors from backend
      if (axiosError.response?.data?.errors && Array.isArray(axiosError.response.data.errors)) {
        const errorMessages = axiosError.response.data.errors.map(e => e.message).join('; ');
        throw new Error(`Upload failed: ${errorMessages}`);
      }
      
      // Handle detail field (FastAPI style)
      if (axiosError.response?.data?.detail) {
        const detail = axiosError.response.data.detail;
        const message = typeof detail === 'string' ? detail : detail.message || JSON.stringify(detail);
        throw new Error(`Upload failed: ${message}`);
      }
      
      // Handle message field
      if (axiosError.response?.data?.message) {
        throw new Error(`Upload failed: ${axiosError.response.data.message}`);
      }
      
      // Handle HTTP status codes
      if (axiosError.response?.status) {
        const status = axiosError.response.status;
        if (status === 413) throw new Error('Upload failed: File too large');
        if (status === 415) throw new Error('Upload failed: Unsupported file type');
        if (status === 409) throw new Error('Upload failed: File already exists');
        if (status === 503) throw new Error('Upload failed: Service temporarily unavailable');
        if (status >= 500) throw new Error(`Upload failed: Server error (${status})`);
        if (status >= 400) throw new Error(`Upload failed: Request error (${status})`);
      }
      
      // Fallback
      throw new Error(axiosError.message || 'Upload failed: Unknown error');
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
      const axiosError = error as { 
        response?: { 
          status?: number;
          data?: { 
            message?: string; 
            detail?: string | { message?: string };
            errors?: Array<{field: string; message: string}> 
          } 
        };
        message?: string;
      };
      
      // Handle validation errors from backend
      if (axiosError.response?.data?.errors && Array.isArray(axiosError.response.data.errors)) {
        const errorMessages = axiosError.response.data.errors.map(e => e.message).join('; ');
        throw new Error(`Scraping failed: ${errorMessages}`);
      }
      
      // Handle detail field (FastAPI style)
      if (axiosError.response?.data?.detail) {
        const detail = axiosError.response.data.detail;
        const message = typeof detail === 'string' ? detail : detail.message || JSON.stringify(detail);
        throw new Error(`Scraping failed: ${message}`);
      }
      
      // Handle message field
      if (axiosError.response?.data?.message) {
        throw new Error(`Scraping failed: ${axiosError.response.data.message}`);
      }
      
      // Handle HTTP status codes
      if (axiosError.response?.status) {
        const status = axiosError.response.status;
        if (status === 400) throw new Error('Scraping failed: Invalid URL format');
        if (status === 403) throw new Error('Scraping failed: Access denied to this website');
        if (status === 404) throw new Error('Scraping failed: Website not found');
        if (status === 408) throw new Error('Scraping failed: Request timeout');
        if (status === 503) throw new Error('Scraping failed: Service temporarily unavailable');
        if (status >= 500) throw new Error(`Scraping failed: Server error (${status})`);
        if (status >= 400) throw new Error(`Scraping failed: Request error (${status})`);
      }
      
      // Fallback
      throw new Error(axiosError.message || 'Scraping failed: Unknown error');
    }
  }

  async getDocuments(): Promise<DocumentsListResponse> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/api/v1/knowledgebase/files`);
      
      // Define response document type (matches new backend format)
      interface ResponseDocument {
        key?: string;
        id?: string | number;
        name?: string;
        original_name?: string;
        display_name?: string;
        file_type?: string;
        type?: string;
        mime_type?: string;
        size?: number | string;
        size_bytes?: number | string;
        source?: 'upload' | 'scrape' | 'gemini';
        source_url?: string;
        url?: string;
        domain?: string;
        pages_scraped?: number;
        status?: string;
        gemini_file_name?: string;
        r2_url?: string;
        r2_key?: string;
        cloudflare_r2_url?: string;
        cloudflare_r2_key?: string;
        created_at?: string;
        updated_at?: string;
        last_modified?: string;
        version?: number;
      }

      // Helper to parse size - handles string or number
      const parseSize = (value: number | string | undefined | null): number => {
        if (value === undefined || value === null) return 0;
        if (typeof value === 'number') return isNaN(value) ? 0 : value;
        if (typeof value === 'string') {
          const parsed = parseInt(value, 10);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };
      
      // Helper to extract domain from scraped filename pattern: scraped_{domain}_{tmpfile}.md
      const extractDomainFromScrapedFilename = (filename: string): string | null => {
        const match = filename.match(/^scraped_([^_]+\.[^_]+)_/i);
        if (match) {
          return match[1]; // e.g., "globistaan.com"
        }
        return null;
      };

      // Transform response to include proper document information
      const documents: Document[] = (response.data.files || []).map((doc: ResponseDocument) => {
        // Get name from appropriate field
        const name = doc.original_name || doc.display_name || doc.name || 'Unknown';
        
        // Check if filename indicates scraped content (starts with "scraped_")
        const scrapedDomain = extractDomainFromScrapedFilename(name);
        const isFilenameScraped = scrapedDomain !== null;
        
        // Determine source - 'website' for scraped, 'upload' for uploaded files
        const isScraped = doc.source === 'scrape' || doc.source_url || doc.url || doc.domain || isFilenameScraped;
        const source: 'upload' | 'website' = isScraped ? 'website' : 'upload';
        
        // Get file extension/type - for websites, show 'url'
        const extension = isScraped ? 'url' : (doc.file_type || doc.type || getFileExtension(name));
        
        // Get size (backend provides size_bytes) - parse string or number
        const size = parseSize(doc.size_bytes) || parseSize(doc.size);

        // Get original URL for scraped websites - try to reconstruct from filename if not provided
        let originalUrl = doc.source_url || doc.url;
        if (!originalUrl && scrapedDomain) {
          // Reconstruct URL from domain extracted from filename
          originalUrl = `https://${scrapedDomain}`;
        }

        // Use gemini_file_name (doc.name) as the primary identifier for deletion
        // doc.name is the Gemini file name like 'files/xyz123'
        const documentId = doc.key || doc.gemini_file_name || doc.name || String(doc.id) || Math.random().toString();
        
        return {
          id: documentId,
          name: name,
          type: extension,
          status: (doc.status || 'processed') as 'uploaded' | 'processing' | 'processed' | 'failed',
          size: size,
          chunks: [],
          metadata: {
            title: name,
            sourceUrl: originalUrl,
            key: doc.key,
            geminiFileName: doc.gemini_file_name || doc.name,
            size: size,
            originalFilename: name,
            fileType: extension
          },
          createdAt: doc.created_at || new Date().toISOString(),
          updatedAt: doc.updated_at || doc.last_modified || doc.created_at || new Date().toISOString(),
          source: source,
          originalUrl: originalUrl,
          r2Url: doc.r2_url || doc.cloudflare_r2_url,
          r2Key: doc.r2_key || doc.cloudflare_r2_key,
          version: doc.version || 1
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
      // Extract just the file ID if the key is in 'files/xyz123' format
      // The backend will normalize it to the proper Gemini format
      const fileId = documentKey.startsWith('files/') 
        ? documentKey.substring(6)  // Remove 'files/' prefix
        : documentKey;
      
      // Use DELETE method with the file ID as path parameter
      const response = await axios.delete(`${this.apiBaseUrl}/api/v1/knowledgebase/files/${encodeURIComponent(fileId)}`);
      
      return {
        success: true,
        message: response.data.message || 'Document deleted successfully'
      };
    } catch (error: unknown) {
      console.error('Delete failed:', error);
      const axiosError = error as { 
        response?: { 
          status?: number;
          data?: { 
            message?: string; 
            detail?: string | { message?: string };
          } 
        };
        message?: string;
      };
      
      // Handle detail field (FastAPI style)
      if (axiosError.response?.data?.detail) {
        const detail = axiosError.response.data.detail;
        const message = typeof detail === 'string' ? detail : detail.message || JSON.stringify(detail);
        throw new Error(`Delete failed: ${message}`);
      }
      
      // Handle message field
      if (axiosError.response?.data?.message) {
        throw new Error(`Delete failed: ${axiosError.response.data.message}`);
      }
      
      // Handle HTTP status codes
      if (axiosError.response?.status) {
        const status = axiosError.response.status;
        if (status === 404) throw new Error('Delete failed: Document not found');
        if (status === 503) throw new Error('Delete failed: Service temporarily unavailable');
        if (status >= 500) throw new Error(`Delete failed: Server error (${status})`);
      }
      
      throw new Error(axiosError.message || 'Delete failed: Unknown error');
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

  async checkWebsiteExists(url: string): Promise<Document | null> {
    try {
      const response = await this.getDocuments();
      // Normalize URL for comparison (remove trailing slashes, protocol variations)
      const normalizeUrl = (u: string) => {
        return u.toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/\/$/, '')
          .replace(/^www\./, '');
      };
      
      const normalizedInput = normalizeUrl(url);
      
      const existingDoc = response.documents.find(doc => {
        if (doc.source !== 'website') return false;
        const docUrl = doc.originalUrl || doc.metadata.sourceUrl;
        if (!docUrl) return false;
        return normalizeUrl(docUrl) === normalizedInput;
      });
      
      return existingDoc || null;
    } catch {
      return null;
    }
  }

  async getSignedDownloadUrl(fileId: string, expirationSeconds: number = 3600): Promise<string> {
    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/api/v1/knowledgebase/files/${encodeURIComponent(fileId)}/download`,
        { params: { expiration: expirationSeconds } }
      );
      
      // The endpoint returns the signed URL in download_url field
      if (response.data.download_url) {
        return response.data.download_url;
      }
      
      throw new Error('No download URL returned');
    } catch (error: unknown) {
      console.error('Failed to get download URL:', error);
      const axiosError = error as { 
        response?: { 
          status?: number;
          data?: { 
            message?: string; 
            detail?: string | { message?: string };
          } 
        };
        message?: string;
      };
      
      // Handle detail field (FastAPI style)
      if (axiosError.response?.data?.detail) {
        const detail = axiosError.response.data.detail;
        const message = typeof detail === 'string' ? detail : detail.message || JSON.stringify(detail);
        throw new Error(`Download failed: ${message}`);
      }
      
      // Handle message field
      if (axiosError.response?.data?.message) {
        throw new Error(`Download failed: ${axiosError.response.data.message}`);
      }
      
      // Handle HTTP status codes
      if (axiosError.response?.status) {
        const status = axiosError.response.status;
        if (status === 404) throw new Error('Download failed: File not found');
        if (status === 503) throw new Error('Download failed: Service temporarily unavailable');
        if (status >= 500) throw new Error(`Download failed: Server error (${status})`);
      }
      
      throw new Error(axiosError.message || 'Download failed: Unknown error');
    }
  }
}
