import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Upload,
  FileText,
  Trash2,
  Link as LinkIcon,
  Globe,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileImage,
  FileAudio,
  FileSpreadsheet,
  FileCode,
  File as FileIcon,
  Search,
  ExternalLink,
  Database,
  HardDrive,
  Cloud,
  AlertTriangle,
  X,
  MapPin,
  Download,
  Pencil,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Plus,
  Minus,
  Filter,
  RefreshCw,
  Maximize2,
  Minimize2,
  X as XIcon,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  KnowledgeBaseManager,
  Document,
  DocumentMetadata,
  validateFile,
  validateUrl,
  formatFileSize,
  getFileExtension,
  VALIDATION,
} from '@/lib/knowledge-base';
import { AWS_CONFIG } from '@/lib/aws-config';
import { useTheme } from '@/hooks/use-theme';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-media-query';

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'validating' | 'uploading' | 'processed' | 'failed';
  error?: string;
}

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  existingDoc?: Document;
  newFile?: File;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

const KnowledgeBaseManagement: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, UploadingFile>>(new Map());
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // URL Crawling State - Multi-URL Support
  interface CrawlUrlEntry {
    id: string;
    url: string;
    protocol: string;
    sitemap: string;
    isDetectingSitemap: boolean;
    error: string | null;
    status: 'pending' | 'scraping' | 'rescraping' | 'success' | 'failed';
  }
  
  const [crawlUrls, setCrawlUrls] = useState<CrawlUrlEntry[]>([
    { id: '1', url: '', protocol: 'https://', sitemap: '', isDetectingSitemap: false, error: null, status: 'pending' }
  ]);
  const [isScraping, setIsScraping] = useState(false);

  // Confirmation Dialog
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
    confirmText: 'Confirm',
    cancelText: 'Cancel',
  });

  // Update Dialog State
  const [updateDialog, setUpdateDialog] = useState<{
    isOpen: boolean;
    document: Document | null;
    newUrl: string;
    isUpdating: boolean;
  }>({
    isOpen: false,
    document: null,
    newUrl: '',
    isUpdating: false,
  });
  const updateFileInputRef = useRef<HTMLInputElement>(null);

  // Sorting State
  type SortField = 'name' | 'type' | 'source' | 'version' | 'size' | 'status' | 'updatedAt';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Track documents being updated (for async UI updates)
  const [updatingDocIds, setUpdatingDocIds] = useState<Set<string>>(new Set());

  // Multi-select for bulk operations
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Column Filters
  interface ColumnFilters {
    name: { text: string; mode: 'starts' | 'contains' };
    type: string[];
    source: string[];
    status: string[];
    size: { value: number; operator: 'less' | 'greater' } | null;
    version: number | null;
    updatedAt: { from: string; fromTime: string; to: string; toTime: string };
  }
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({
    name: { text: '', mode: 'contains' },
    type: [],
    source: [],
    status: [],
    size: null,
    version: null,
    updatedAt: { from: '', fromTime: '00:00', to: '', toTime: '23:59' },
  });

  // Table expansion state
  const [isTableExpanded, setIsTableExpanded] = useState(false);

  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const knowledgeBaseManager = new KnowledgeBaseManager(AWS_CONFIG.endpoints.pharmaApiGateway);

  // Quick date filter presets
  const applyDatePreset = (preset: string) => {
    const now = new Date();
    let fromDate = '';
    let fromTime = '00:00';
    let toDate = '';
    let toTime = '23:59';

    switch (preset) {
      case 'last1hour':
        fromDate = now.toISOString().split('T')[0];
        fromTime = new Date(now.getTime() - 60 * 60 * 1000).toTimeString().slice(0, 5);
        toDate = now.toISOString().split('T')[0];
        toTime = now.toTimeString().slice(0, 5);
        break;
      case 'last2hours':
        fromDate = now.toISOString().split('T')[0];
        fromTime = new Date(now.getTime() - 2 * 60 * 60 * 1000).toTimeString().slice(0, 5);
        toDate = now.toISOString().split('T')[0];
        toTime = now.toTimeString().slice(0, 5);
        break;
      case 'last3hours':
        fromDate = now.toISOString().split('T')[0];
        fromTime = new Date(now.getTime() - 3 * 60 * 60 * 1000).toTimeString().slice(0, 5);
        toDate = now.toISOString().split('T')[0];
        toTime = now.toTimeString().slice(0, 5);
        break;
      case 'last4hours':
        fromDate = now.toISOString().split('T')[0];
        fromTime = new Date(now.getTime() - 4 * 60 * 60 * 1000).toTimeString().slice(0, 5);
        toDate = now.toISOString().split('T')[0];
        toTime = now.toTimeString().slice(0, 5);
        break;
      case 'last5hours':
        fromDate = now.toISOString().split('T')[0];
        fromTime = new Date(now.getTime() - 5 * 60 * 60 * 1000).toTimeString().slice(0, 5);
        toDate = now.toISOString().split('T')[0];
        toTime = now.toTimeString().slice(0, 5);
        break;
      case 'lastWeek':
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        fromDate = lastWeek.toISOString().split('T')[0];
        fromTime = '00:00';
        toDate = now.toISOString().split('T')[0];
        toTime = '23:59';
        break;
      case 'lastMonth':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        fromDate = lastMonth.toISOString().split('T')[0];
        fromTime = '00:00';
        toDate = now.toISOString().split('T')[0];
        toTime = '23:59';
        break;
      case 'lastYear':
        const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        fromDate = lastYear.toISOString().split('T')[0];
        fromTime = '00:00';
        toDate = now.toISOString().split('T')[0];
        toTime = '23:59';
        break;
    }

    setColumnFilters(prev => ({
      ...prev,
      updatedAt: { from: fromDate, fromTime, to: toDate, toTime }
    }));
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('Loading documents from API...');
      const response = await knowledgeBaseManager.getDocuments();
      console.log('Loaded documents:', response.documents.length, 'total');
      console.log('Document list:', response.documents.map(d => ({ id: d.id, name: d.name })));
      setDocuments(response.documents);
    } catch (err: any) {
      console.error('Error loading documents:', err);
      setError(err.message || 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const getFileIcon = (type: string, source: 'upload' | 'website') => {
    if (source === 'website') {
      return <Globe className="h-4 w-4 text-blue-500" />;
    }
    
    const ext = type.toLowerCase();
    
    if (['pdf'].includes(ext)) {
      return <FileText className="h-4 w-4 text-red-500" />;
    }
    if (['doc', 'docx'].includes(ext)) {
      return <FileText className="h-4 w-4 text-blue-600" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
      return <FileImage className="h-4 w-4 text-green-500" />;
    }
    if (['mp3', 'wav', 'ogg'].includes(ext)) {
      return <FileAudio className="h-4 w-4 text-purple-500" />;
    }
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
    }
    if (['html', 'htm', 'json', 'xml', 'yaml', 'yml', 'md'].includes(ext)) {
      return <FileCode className="h-4 w-4 text-orange-500" />;
    }
    if (['ppt', 'pptx'].includes(ext)) {
      return <FileText className="h-4 w-4 text-orange-600" />;
    }
    
    return <FileIcon className="h-4 w-4 text-gray-500" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processed':
        return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 mr-1" /> Processed</Badge>;
      case 'processing':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700 border-red-200"><AlertCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200"><FileIcon className="h-3 w-3 mr-1" /> Uploaded</Badge>;
    }
  };

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const fileArray = Array.from(files);
    const totalFiles = fileArray.length;
    
    if (totalFiles > 1) {
      setSuccess(`Processing ${totalFiles} files...`);
    }
    
    // Process files sequentially
    for (let i = 0; i < fileArray.length; i++) {
      await processFile(fileArray[i]);
    }
    
    // Clear the input to allow re-selecting the same files
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const processFile = async (file: File) => {
    const fileId = `${file.name}-${Date.now()}`;
    
    // Client-side validation
    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

      // Check if file with same name already exists
      const existingDoc = await knowledgeBaseManager.checkDocumentExists(file.name, getFileExtension(file.name));
      
      if (existingDoc) {
        // Show confirmation dialog for duplicate file
        setConfirmDialog({
          isOpen: true,
          title: 'Duplicate File Detected',
          message: `A file "${existingDoc.name}" already exists (Version ${existingDoc.version || 1}). Do you want to upload it again? This will create a new version.`,
          existingDoc,
          newFile: file,
          onConfirm: () => uploadFile(file, fileId, true), // Pass replaceExisting=true
        });
        return;
      }

      await uploadFile(file, fileId, false);
  };

  const uploadFile = async (file: File, fileId: string, replaceExisting: boolean = false) => {
    setUploadingFiles(prev => new Map(prev).set(fileId, {
      id: fileId,
      file,
      progress: 0,
      status: 'uploading',
    }));

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadingFiles(prev => {
          const newMap = new Map(prev);
          const entry = newMap.get(fileId);
          if (entry && entry.status === 'uploading' && entry.progress < 90) {
            newMap.set(fileId, { ...entry, progress: entry.progress + 10 });
          }
          return newMap;
        });
      }, 200);

      const metadata: Partial<DocumentMetadata> = {
        title: file.name.replace(/\.[^/.]+$/, ""),
        category: 'uploaded',
        size: file.size,
        originalFilename: file.name,
        fileType: getFileExtension(file.name),
      };

      await knowledgeBaseManager.uploadDocument(file, metadata, replaceExisting);

      clearInterval(progressInterval);

      setUploadingFiles(prev => {
        const newMap = new Map(prev);
        newMap.set(fileId, { ...prev.get(fileId)!, progress: 100, status: 'processed' });
        return newMap;
      });

      setSuccess(`Document "${file.name}" uploaded successfully!`);
      
      // Clean up uploading state and reload documents
      setUploadingFiles(prev => {
        const newMap = new Map(prev);
        newMap.delete(fileId);
        return newMap;
      });
      loadDocuments();
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadingFiles(prev => {
        const newMap = new Map(prev);
        newMap.set(fileId, { ...prev.get(fileId)!, status: 'failed', error: err.message });
        return newMap;
      });
      setError(err.message || `Failed to upload ${file.name}`);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  const handleDeleteDocument = async (documentKey: string, documentName: string) => {
    console.log('handleDeleteDocument called with:', { documentKey, documentName, type: typeof documentKey });
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Document?',
      message: `Are you sure you want to delete "${documentName}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          setIsLoading(true);
          setError(null);
          console.log('Starting deletion of:', documentKey, documentName);

          const deleteResult = await knowledgeBaseManager.deleteDocument(documentKey);
          console.log('Delete result:', deleteResult);

          setSuccess(`Document "${documentName}" deleted successfully!`);

          // Force refresh documents after a delay to ensure backend changes are committed
          console.log('Scheduling document refresh in 2 seconds...');
          setTimeout(async () => {
            console.log('Refreshing documents after deletion...');
            await loadDocuments();
            console.log('Document refresh completed');

            // Double-check after another delay in case of caching issues
            setTimeout(async () => {
              console.log('Double-checking document list...');
              await loadDocuments();
            }, 500);
          }, 2000);
    } catch (err: any) {
      console.error('Error deleting document:', err);
      setError(err.message || 'Failed to delete document');
    } finally {
      setIsLoading(false);
    }
      },
    });
  };

  const handleOpenUpdateDialog = (doc: Document) => {
    setUpdateDialog({
      isOpen: true,
      document: doc,
      newUrl: doc.originalUrl || '',
      isUpdating: false,
    });
  };

  // Helper function to actually perform the website update
  const performWebsiteUpdate = async (doc: Document, url: string) => {
    try {
      setError(null);
      setUpdateDialog(prev => ({ ...prev, isOpen: false }));
      
      // Mark this document as updating (async UI update without full reload)
      setUpdatingDocIds(prev => new Set(prev).add(doc.id));

      // Delete the old document first
      await knowledgeBaseManager.deleteDocument(doc.id);

      // Re-scrape the URL
      await knowledgeBaseManager.scrapeWebsite(url);

      setSuccess(`Website "${url}" is being re-scraped. Content will be updated shortly.`);
      
      // Reload documents in background after a delay
      setTimeout(async () => {
        await loadDocuments();
        setUpdatingDocIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(doc.id);
          return newSet;
        });
      }, 3000);
    } catch (err: unknown) {
      console.error('Update error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update website';
      setError(errorMessage);
      setUpdatingDocIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(doc.id);
        return newSet;
      });
    }
  };

  const handleUpdateDocument = async () => {
    if (!updateDialog.document) return;

    const doc = updateDialog.document;

    if (doc.source === 'website') {
      // For websites, re-scrape with the new or existing URL
      const newUrl = updateDialog.newUrl.trim();
      if (!newUrl) {
        setError('Please enter a valid URL');
        return;
      }

      // Check if URL is different from original
      const originalUrl = doc.originalUrl || '';
      const isUrlDifferent = newUrl.toLowerCase() !== originalUrl.toLowerCase();

      if (isUrlDifferent && originalUrl) {
        // Show confirmation dialog for different URL
        setUpdateDialog(prev => ({ ...prev, isOpen: false }));
        setConfirmDialog({
          isOpen: true,
          title: 'Different URL Detected',
          message: `The updated URL "${newUrl}" is different than the previous one "${originalUrl}". Proceed?`,
          onConfirm: () => performWebsiteUpdate(doc, newUrl),
        });
      } else {
        // Same URL or no original URL, proceed directly
        await performWebsiteUpdate(doc, newUrl);
      }
    } else {
      // For uploaded files, trigger file input
      updateFileInputRef.current?.click();
    }
  };

  // Helper function to actually perform the file update
  const performFileUpdate = async (doc: Document, file: File) => {
    try {
      setError(null);
      
      // Mark this document as updating (async UI update without full reload)
      setUpdatingDocIds(prev => new Set(prev).add(doc.id));

      // Delete the old document first
      await knowledgeBaseManager.deleteDocument(doc.id);

      // Upload the new file with replaceExisting flag
      await knowledgeBaseManager.uploadDocument(file, {}, true);

      setSuccess(`Document "${doc.name}" has been replaced with "${file.name}"`);
      
      // Reload documents in background
      await loadDocuments();
      setUpdatingDocIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(doc.id);
        return newSet;
      });
    } catch (err: unknown) {
      console.error('Update error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update document';
      setError(errorMessage);
      setUpdatingDocIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(doc.id);
        return newSet;
      });
    } finally {
      // Reset file input
      if (updateFileInputRef.current) {
        updateFileInputRef.current.value = '';
      }
    }
  };

  const handleUpdateFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !updateDialog.document) return;

    const file = files[0];
    const doc = updateDialog.document;

    // Get file extension
    const getExtension = (filename: string) => filename.split('.').pop()?.toLowerCase() || '';
    const getBaseName = (filename: string) => filename.substring(0, filename.lastIndexOf('.')) || filename;

    const originalName = doc.name;
    const originalExtension = doc.type.toLowerCase();
    const newName = file.name;
    const newExtension = getExtension(file.name);
    const newBaseName = getBaseName(file.name);
    const originalBaseName = getBaseName(originalName);

    // Check if name or type is different
    const isNameDifferent = newBaseName.toLowerCase() !== originalBaseName.toLowerCase();
    const isTypeDifferent = newExtension !== originalExtension;

    if (isNameDifferent || isTypeDifferent) {
      // Build confirmation message
      let message = 'The updated file ';
      if (isNameDifferent && isTypeDifferent) {
        message += `name "${newBaseName}" and type ".${newExtension}" are different than the previous "${originalBaseName}" (.${originalExtension})`;
      } else if (isNameDifferent) {
        message += `name "${newBaseName}" is different than the previous "${originalBaseName}"`;
      } else {
        message += `type ".${newExtension}" is different than the previous ".${originalExtension}"`;
      }
      message += '. Proceed?';

      // Close update dialog and show confirmation
      setUpdateDialog(prev => ({ ...prev, isOpen: false }));
      setConfirmDialog({
        isOpen: true,
        title: 'Different File Detected',
        message: message,
        onConfirm: () => performFileUpdate(doc, file),
      });
    } else {
      // Same name and type, proceed directly
      setUpdateDialog(prev => ({ ...prev, isOpen: false }));
      await performFileUpdate(doc, file);
    }
  };

  // Handle URL change for a specific entry and auto-detect sitemap
  const handleCrawlUrlChange = (id: string, value: string) => {
    setCrawlUrls(prev => prev.map(entry => {
      if (entry.id !== id) return entry;

      const fullUrl = entry.protocol + value;
      const validation = validateUrl(fullUrl);

      let sitemap = '';
      let error = null;

      if (validation.valid) {
        try {
          const parsedUrl = new URL(fullUrl);
          const domain = parsedUrl.hostname;
          sitemap = `${entry.protocol}${domain}/sitemap.xml`;
        } catch {
          // Shouldn't happen if validation passed, but just in case
          sitemap = '';
        }
      } else {
        error = validation.error;
      }

      return { ...entry, url: value, sitemap, error };
    }));
  };

  // Handle protocol change for a specific entry
  const handleProtocolChange = (id: string, protocol: string) => {
    setCrawlUrls(prev => prev.map(entry => {
      if (entry.id !== id) return entry;
      
      // Update sitemap with new protocol
      let sitemap = entry.sitemap;
      if (sitemap) {
        sitemap = sitemap.replace(/^https?:\/\//, protocol);
      }
      
      return { ...entry, protocol, sitemap };
    }));
  };

  // Add new URL entry
  const addCrawlUrl = () => {
    setCrawlUrls(prev => [
      ...prev,
      { id: Date.now().toString(), url: '', protocol: 'https://', sitemap: '', isDetectingSitemap: false, error: null, status: 'pending' }
    ]);
  };

  // Remove URL entry
  const removeCrawlUrl = (id: string) => {
    setCrawlUrls(prev => prev.filter(entry => entry.id !== id));
  };

  // Scrape all websites in parallel
  const handleScrapeWebsites = async () => {
    const validUrls = crawlUrls.filter(entry => entry.url.trim() !== '' && !entry.error);

    if (validUrls.length === 0) {
      if (crawlUrls.some(entry => entry.url.trim() !== '' && entry.error)) {
        setError('Please fix the URL validation errors before scraping');
      } else {
        setError('Please enter at least one valid URL');
      }
      return;
    }

    // Validate all URLs first
    let hasError = false;
    setCrawlUrls(prev => prev.map(entry => {
      if (!entry.url.trim()) return entry;
      
      const fullUrl = entry.protocol + entry.url;
      const validation = validateUrl(fullUrl);
      if (!validation.valid) {
        hasError = true;
        return { ...entry, error: validation.error || 'Invalid URL' };
      }
      return { ...entry, error: null };
    }));

    if (hasError) return;

    setIsScraping(true);
    setError(null);
    setSuccess(null);

    // Process all URLs in parallel
    const scrapePromises = validUrls.map(async (entry) => {
      const fullUrl = entry.protocol + entry.url;

      // Update status to scraping
      setCrawlUrls(prev => prev.map(e =>
        e.id === entry.id ? { ...e, status: 'scraping' } : e
      ));

      try {
        // First try with automatic rescraping detection
        // First ensure documents are loaded
        if (documents.length === 0) {
          console.log('No documents loaded, fetching documents first...');
          await loadDocuments();
        }

        let existingWebsite = await knowledgeBaseManager.checkWebsiteExists(fullUrl);
        let replaceExisting = !!existingWebsite;

        console.log(`Rescraping check for ${fullUrl}:`, {
          existingWebsite: !!existingWebsite,
          replaceExisting,
          existingVersion: existingWebsite?.version,
          existingOriginalUrl: existingWebsite?.originalUrl
        });

        if (existingWebsite) {
          console.log(`Website ${fullUrl} already exists (version ${existingWebsite.version}), rescraping with replaceExisting=true`);
          // Update status to show it's rescraping
          setCrawlUrls(prev => prev.map(e =>
            e.id === entry.id ? { ...e, status: 'rescraping' } : e
          ));
        } else {
          console.log(`Website ${fullUrl} not found in existing documents, will create new entry`);
        }

        // Try to scrape with replaceExisting flag
        console.log(`Attempting to scrape ${fullUrl} with replaceExisting=${replaceExisting}`);
        try {
          await knowledgeBaseManager.scrapeWebsite(fullUrl, { replaceExisting });
          console.log('Scrape successful on first attempt');
        } catch (scrapeError: unknown) {
          const errorObj = scrapeError as any;
          const statusCode = errorObj?.response?.status;
          const errorMessage = errorObj?.message || errorObj?.response?.data?.detail?.message || (scrapeError instanceof Error ? scrapeError.message : 'Failed to scrape');

          console.log('Scrape error details:');
          console.log('- Full error object:', JSON.stringify(errorObj, null, 2));
          console.log('- Status code:', statusCode);
          console.log('- Error message:', errorMessage);
          console.log('- replaceExisting was:', replaceExisting);
          console.log('- Error instanceof Error:', scrapeError instanceof Error);

          // Check if this is a 409 Conflict (duplicate) error and we haven't already tried with replaceExisting=true
          const isDuplicateError = statusCode === 409 && errorMessage.includes("has already been scraped");

          console.log('Duplicate error check:', {
            statusCodeIs409: statusCode === 409,
            messageContainsDuplicate: errorMessage.includes("has already been scraped"),
            replaceExistingIsFalse: !replaceExisting,
            isDuplicateError
          });

          if (isDuplicateError && !replaceExisting) {
            console.log('✅ Detected 409 duplicate error, retrying with replaceExisting=true');
            setCrawlUrls(prev => prev.map(e =>
              e.id === entry.id ? { ...e, status: 'rescraping' } : e
            ));

            try {
              await knowledgeBaseManager.scrapeWebsite(fullUrl, { replaceExisting: true });
              console.log('✅ Rescraping successful on retry');
            } catch (retryError) {
              console.log('❌ Rescraping failed on retry:', retryError);
              throw retryError;
            }
          } else {
            console.log('❌ Not retrying - conditions not met');
            throw scrapeError; // Re-throw if it's not a duplicate error or we've already tried
          }
        }

        // Update status to success
        setCrawlUrls(prev => prev.map(e =>
          e.id === entry.id ? { ...e, status: 'success' } : e
        ));

        return { url: fullUrl, success: true };
      } catch (err: unknown) {
        const errorObj = err as any;
        const errorMessage = errorObj?.message || errorObj?.response?.data?.detail?.message || (err instanceof Error ? err.message : 'Failed to scrape');

        // Check if this is a "website already exists" error
        const isDuplicateError = errorMessage.includes("has already been scraped") ||
                                errorMessage.includes("Set replace_existing=true");

        if (isDuplicateError) {
          // Show confirmation dialog for rescraping
          return new Promise((resolve) => {
            setConfirmDialog({
              isOpen: true,
              title: 'Website Already Exists',
              message: `The website "${fullUrl}" has already been scraped. Would you like to re-scrape it and create a new version?`,
              onConfirm: async () => {
                try {
                  // Update status to show rescraping
                  setCrawlUrls(prev => prev.map(e =>
                    e.id === entry.id ? { ...e, status: 'rescraping' } : e
                  ));

                  // Retry with replaceExisting = true
                  console.log('Calling scrapeWebsite with replaceExisting=true for:', fullUrl);
                  console.log('Sending payload:', { url: fullUrl, replaceExisting: true });
                  const result = await knowledgeBaseManager.scrapeWebsite(fullUrl, { replaceExisting: true });
                  console.log('ScrapeWebsite call completed successfully, result:', result);

                  // Update status to success
                  setCrawlUrls(prev => prev.map(e =>
                    e.id === entry.id ? { ...e, status: 'success' } : e
                  ));

                  resolve({ url: fullUrl, success: true });
                } catch (retryErr: unknown) {
                  const retryErrorMessage = retryErr instanceof Error ? retryErr.message : 'Failed to rescrape';

                  // Update status to failed
                  setCrawlUrls(prev => prev.map(e =>
                    e.id === entry.id ? { ...e, status: 'failed', error: retryErrorMessage } : e
                  ));

                  resolve({ url: fullUrl, success: false, error: retryErrorMessage });
                }
              },
              onCancel: () => {
                // Update status to cancelled/failed
                setCrawlUrls(prev => prev.map(e =>
                  e.id === entry.id ? { ...e, status: 'failed', error: 'Cancelled by user' } : e
                ));
                resolve({ url: fullUrl, success: false, error: 'Cancelled by user' });
              },
              confirmText: 'Re-scrape',
              cancelText: 'Cancel'
            });
          });
        } else {
          // Regular error handling
          setCrawlUrls(prev => prev.map(e =>
            e.id === entry.id ? { ...e, status: 'failed', error: errorMessage } : e
          ));

          return { url: fullUrl, success: false, error: errorMessage };
        }
      }
    });

    const results = await Promise.all(scrapePromises);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    setIsScraping(false);

    if (successCount > 0) {
      setSuccess(`Successfully scraped ${successCount} website(s).${failCount > 0 ? ` ${failCount} failed.` : ''}`);
      // Reset successful entries
      setCrawlUrls(prev => {
        const remaining = prev.filter(e => e.status !== 'success');
        return remaining.length > 0 ? remaining : [
          { id: Date.now().toString(), url: '', protocol: 'https://', sitemap: '', isDetectingSitemap: false, error: null, status: 'pending' }
        ];
      });
      // Reload documents
      setTimeout(() => loadDocuments(), 2000);
    }

    if (failCount > 0 && successCount === 0) {
      setError(`Failed to scrape ${failCount} website(s). Please check the errors.`);
    }
  };

  // Get unique values for filter dropdowns
  const getUniqueValues = useCallback((field: 'type' | 'source' | 'status') => {
    const values = documents.map(doc => {
      if (field === 'type') {
        return doc.source === 'website' ? 'www' : (doc.type || 'unknown').toUpperCase();
      }
      return doc[field];
    });
    return [...new Set(values)].sort();
  }, [documents]);

  // Toggle column filter value (for array-based filters: type, source, status)
  const toggleColumnFilter = (column: 'type' | 'source' | 'status', value: string) => {
    setColumnFilters(prev => {
      const current = prev[column] as string[];
      const newValues = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [column]: newValues };
    });
  };

  // Clear all filters for a column
  const clearColumnFilter = (column: 'type' | 'source' | 'status') => {
    setColumnFilters(prev => ({ ...prev, [column]: [] }));
  };

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedDocIds.size === sortedDocuments.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(sortedDocuments.map(doc => doc.id)));
    }
  };

  const toggleSelectDoc = (docId: string) => {
    setSelectedDocIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedDocIds.size === 0) return;
    
    const count = selectedDocIds.size;
    if (!confirm(`Are you sure you want to delete ${count} document(s)? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    
    let successCount = 0;
    let failCount = 0;

    for (const docId of selectedDocIds) {
      try {
        await knowledgeBaseManager.deleteDocument(docId);
        successCount++;
      } catch (err) {
        console.error(`Failed to delete ${docId}:`, err);
        failCount++;
      }
    }

    setIsDeleting(false);
    setSelectedDocIds(new Set());

    if (successCount > 0) {
      setSuccess(`Deleted ${successCount} document(s).${failCount > 0 ? ` ${failCount} failed.` : ''}`);
      loadDocuments();
    } else {
      setError(`Failed to delete ${failCount} document(s).`);
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setColumnFilters({
      name: { text: '', mode: 'contains' },
      type: [],
      source: [],
      status: [],
      size: null,
      version: null,
      updatedAt: { from: '', fromTime: '00:00', to: '', toTime: '23:59' },
    });
    setSearchQuery('');
  };

  // Check if any filter is active
  const hasActiveFilters = () => {
    return (
      searchQuery.trim() !== '' ||
      columnFilters.name.text.trim() !== '' ||
      columnFilters.type.length > 0 ||
      columnFilters.source.length > 0 ||
      columnFilters.status.length > 0 ||
      columnFilters.size !== null ||
      columnFilters.version !== null ||
      columnFilters.updatedAt.from !== '' ||
      columnFilters.updatedAt.to !== '' ||
      columnFilters.updatedAt.fromTime !== '00:00' ||
      columnFilters.updatedAt.toTime !== '23:59'
    );
  };

  // Filter documents based on search and column filters
  const filteredDocuments = documents.filter(doc => {
    // Name filter (starts with or contains)
    if (columnFilters.name.text.trim() !== '') {
      const nameLower = doc.name.toLowerCase();
      const filterText = columnFilters.name.text.toLowerCase();
      if (columnFilters.name.mode === 'starts') {
        if (!nameLower.startsWith(filterText)) return false;
      } else {
        if (!nameLower.includes(filterText)) return false;
      }
    }

    // Search filter (general search)
    const matchesSearch = 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.metadata.sourceUrl?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch && searchQuery.trim() !== '') return false;

    // Type filter
    if (columnFilters.type.length > 0) {
      const docType = doc.source === 'website' ? 'www' : (doc.type || 'unknown').toUpperCase();
      if (!columnFilters.type.includes(docType)) return false;
    }

    // Source filter
    if (columnFilters.source.length > 0) {
      if (!columnFilters.source.includes(doc.source)) return false;
    }

    // Status filter
    if (columnFilters.status.length > 0) {
      if (!columnFilters.status.includes(doc.status)) return false;
    }

    // Size filter
    if (columnFilters.size !== null) {
      const docSize = doc.size || 0;
      if (columnFilters.size.operator === 'less') {
        if (docSize > columnFilters.size.value) return false;
      } else {
        if (docSize < columnFilters.size.value) return false;
      }
    }

    // Version filter
    if (columnFilters.version !== null) {
      const docVersion = doc.version || 1;
      if (docVersion !== columnFilters.version) return false;
    }

    // Date range filter
    if (columnFilters.updatedAt.from !== '' || columnFilters.updatedAt.to !== '' ||
        columnFilters.updatedAt.fromTime !== '00:00' || columnFilters.updatedAt.toTime !== '23:59') {
      const docDate = new Date(doc.updatedAt);

      if (columnFilters.updatedAt.from !== '') {
        const fromDateTime = new Date(`${columnFilters.updatedAt.from}T${columnFilters.updatedAt.fromTime || '00:00'}`);
        if (docDate < fromDateTime) return false;
      }

      if (columnFilters.updatedAt.to !== '') {
        const toDateTime = new Date(`${columnFilters.updatedAt.to}T${columnFilters.updatedAt.toTime || '23:59'}`);
        toDateTime.setSeconds(59, 999); // Include the end of the day
        if (docDate > toDateTime) return false;
      }
    }

    return true;
  });

  // Sort documents
  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'type': {
        // For websites, use 'www', otherwise use the file type
        const typeA = a.source === 'website' ? 'www' : (a.type || '').toUpperCase();
        const typeB = b.source === 'website' ? 'www' : (b.type || '').toUpperCase();
        comparison = typeA.localeCompare(typeB);
        break;
      }
      case 'source':
        comparison = a.source.localeCompare(b.source);
        break;
      case 'version':
        comparison = (a.version || 1) - (b.version || 1);
        break;
      case 'size':
        comparison = (a.size || 0) - (b.size || 0);
        break;
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
      case 'updatedAt':
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
      default:
        comparison = 0;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get sort icon for column header
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    if (diffMonths < 12) return `${diffMonths}mo ago`;
    return `${diffYears}y ago`;
  };

  // Calculate total size
  const totalSize = documents.reduce((acc, doc) => acc + (doc.size || 0), 0);
  const uploadedCount = documents.filter(d => d.source === 'upload').length;
  const websiteCount = documents.filter(d => d.source === 'website').length;

  // Render expanded table in portal to cover everything
  const tableContent = (
    <Card className={`${isTableExpanded ? 'fixed inset-0 z-[9999] m-0 rounded-none border-0' : ''} ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-700'}`}>
      <CardHeader className={`pb-3 ${isTableExpanded ? 'sticky top-0 z-10 border-b ' : ''} ${isTableExpanded ? (theme === 'light' ? 'bg-white' : 'bg-zinc-900') : ''}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <CardTitle className={`text-lg flex items-center gap-2 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
              <FileText className="h-5 w-5" />
              Documents ({filteredDocuments.length})
            </CardTitle>
            {selectedDocIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="h-8"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Delete ({selectedDocIds.size})
              </Button>
            )}
            {/* Active filters indicator and clear button */}
            {hasActiveFilters() && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="h-8 text-xs"
              >
                <XIcon className="h-3 w-3 mr-1" />
                Clear All Filters
              </Button>
            )}
            {/* Expand/Collapse button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsTableExpanded(!isTableExpanded)}
              className="h-8 w-8 p-0"
              title={isTableExpanded ? 'Collapse table' : 'Expand table'}
            >
              {isTableExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${
              theme === 'light' ? 'text-gray-400' : 'text-gray-500'
            }`} />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-9 ${
                theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-800 border-zinc-700'
              }`}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className={`p-0 overflow-hidden ${isTableExpanded ? 'h-[calc(100vh-80px)]' : ''}`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className={`h-8 w-8 animate-spin ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`} />
                </div>
        ) : filteredDocuments.length === 0 ? (
          <div className={`text-center py-12 ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
            <FileIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No documents found</p>
            <p className="text-xs mt-1">Upload files or add URLs to get started</p>
          </div>
        ) : isMobile && !isTableExpanded ? (
          // Mobile card view
          <div className="space-y-3 p-4 max-h-[400px] overflow-y-auto">
            {sortedDocuments.map((doc) => (
              <Card key={doc.id} className={`${theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-800 border-zinc-700'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <Checkbox
                      checked={selectedDocIds.has(doc.id)}
                      onCheckedChange={() => toggleSelectDoc(doc.id)}
                      className="mt-1"
                      aria-label={`Select ${doc.name}`}
                    />

                    {/* File icon */}
                    <div className="flex-shrink-0">
                      {getFileIcon(doc.type, doc.source)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Filename */}
                      <div className="flex items-center justify-between mb-2">
                        <p className={`text-sm font-medium truncate ${theme === 'light' ? 'text-gray-900' : 'text-white'}`} title={doc.source === 'website' && doc.originalUrl ? doc.originalUrl : doc.name}>
                          {doc.source === 'website' && doc.originalUrl ? doc.originalUrl : doc.name}
                        </p>
                      </div>

                      {/* Storage indicators */}
                      <div className="flex items-center gap-1 mb-2">
                        {doc.r2Key && (
                          <div className="flex items-center gap-1" title="Stored in Cloudflare R2">
                            <Cloud className={`h-3 w-3 ${theme === 'light' ? 'text-blue-500' : 'text-blue-400'}`} />
                            <span className={`text-[10px] ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>R2</span>
                          </div>
                        )}
                        {doc.geminiFileName && (
                          <div className="flex items-center gap-1" title="Indexed in Gemini File Search">
                            <HardDrive className={`h-3 w-3 ${theme === 'light' ? 'text-green-500' : 'text-green-400'}`} />
                            <span className={`text-[10px] ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>Gemini</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1" title="Metadata stored in PostgreSQL">
                          <Database className={`h-3 w-3 ${theme === 'light' ? 'text-purple-500' : 'text-purple-400'}`} />
                          <span className={`text-[10px] ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>DB</span>
                        </div>
                      </div>

                      {/* Badges and info */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {doc.source === 'website' ? 'www' : (doc.type || 'unknown').toUpperCase()}
                          </Badge>
                          <span className={`text-xs ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                            {formatFileSize(doc.size || 0)}
                          </span>
                        </div>

                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {getStatusBadge(doc.status)}
                        </Badge>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-gray-200 dark:border-zinc-700">
                        {/* Download button for uploaded files */}
                        {doc.source === 'upload' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={async () => {
                              try {
                                setSuccess('Preparing download...');
                                const downloadUrl = `${knowledgeBaseManager.apiBaseUrl}/api/v1/knowledgebase/files/${encodeURIComponent(doc.id)}/download`;

                                const response = await fetch(downloadUrl);
                                if (!response.ok) {
                                  throw new Error(`Download failed: ${response.status} ${response.statusText}`);
                                }

                                const contentDisposition = response.headers.get('Content-Disposition');
                                let filename = doc.name || 'downloaded-file';

                                if (contentDisposition) {
                                  const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                                  if (filenameMatch && filenameMatch[1]) {
                                    filename = filenameMatch[1].replace(/['"]/g, '');
                                  }
                                }

                                const blob = await response.blob();
                                const blobUrl = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = blobUrl;
                                link.download = filename;
                                link.style.display = 'none';

                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(blobUrl);

                                setSuccess(null);
                                setSuccess('Download completed successfully!');
                                setTimeout(() => setSuccess(null), 3000);
                              } catch (err: unknown) {
                                console.error('Download error:', err);
                                const errorMessage = err instanceof Error ? err.message : 'Failed to download file';
                                setError(errorMessage);
                              }
                            }}
                            title="Download file"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}

                        {/* External link for websites */}
                        {doc.source === 'website' && doc.originalUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => window.open(doc.originalUrl, '_blank')}
                            title="Open source URL"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Update button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleOpenUpdateDialog(doc)}
                          title={doc.source === 'website' ? 'Re-scrape website' : 'Replace file'}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        {/* Delete button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleDeleteDocument(doc.id, doc.name)}
                          title="Delete document"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          // Desktop table view
          <div className={`overflow-x-auto ${isTableExpanded ? 'h-full' : 'max-h-[140px]'} overflow-y-auto`}>
          <Table>
            <TableHeader>
                <TableRow className={theme === 'light' ? 'border-gray-200' : 'border-zinc-700'}>
                  {/* Checkbox column */}
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedDocIds.size === sortedDocuments.length && sortedDocuments.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className={`${isMobile ? 'w-[30%]' : 'w-[20%]'} ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                    <div className="flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <Filter className={`h-3 w-3 ${columnFilters.name.text.trim() !== '' ? 'text-blue-500' : ''}`} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className={`${theme === 'light' ? 'bg-white' : 'bg-zinc-800 border-zinc-700'} ${isTableExpanded ? 'z-[10000]' : ''}`}>
                          <DropdownMenuLabel>Filter by Name</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <div className="p-2 space-y-2">
                            <div className="flex gap-2">
                              <Button
                                variant={columnFilters.name.mode === 'starts' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setColumnFilters(prev => ({ ...prev, name: { ...prev.name, mode: 'starts' } }))}
                                className="h-7 text-xs"
                              >
                                Starts with
                              </Button>
                              <Button
                                variant={columnFilters.name.mode === 'contains' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setColumnFilters(prev => ({ ...prev, name: { ...prev.name, mode: 'contains' } }))}
                                className="h-7 text-xs"
                              >
                                Contains
                              </Button>
                </div>
                <Input
                              placeholder={columnFilters.name.mode === 'starts' ? 'Starts with...' : 'Contains...'}
                              value={columnFilters.name.text}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, name: { ...prev.name, text: e.target.value } }))}
                              className="h-8"
                            />
                            {columnFilters.name.text.trim() !== '' && (
              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setColumnFilters(prev => ({ ...prev, name: { text: '', mode: 'contains' } }))}
                                className="h-7 w-full text-xs"
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <span className="cursor-pointer" onClick={() => handleSort('name')}>
                        Name {getSortIcon('name')}
                      </span>
                    </div>
                  </TableHead>
                  <TableHead className={`w-[70px] ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                    <div className="flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <Filter className={`h-3 w-3 ${columnFilters.type.length > 0 ? 'text-blue-500' : ''}`} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className={`${theme === 'light' ? 'bg-white' : 'bg-zinc-800 border-zinc-700'} ${isTableExpanded ? 'z-[10000]' : ''}`}>
                          <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {getUniqueValues('type').map(value => (
                            <DropdownMenuCheckboxItem
                              key={value}
                              checked={columnFilters.type.includes(value)}
                              onCheckedChange={() => toggleColumnFilter('type', value)}
                            >
                              {value}
                            </DropdownMenuCheckboxItem>
                          ))}
                          {columnFilters.type.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuCheckboxItem onCheckedChange={() => clearColumnFilter('type')}>
                                Clear filter
                              </DropdownMenuCheckboxItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <span className="cursor-pointer" onClick={() => handleSort('type')}>
                        Type {getSortIcon('type')}
                      </span>
                    </div>
                  </TableHead>
                  {!isMobile && (
                    <TableHead className={`${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                      <div className="flex items-center gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <Filter className={`h-3 w-3 ${columnFilters.source.length > 0 ? 'text-blue-500' : ''}`} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className={`${theme === 'light' ? 'bg-white' : 'bg-zinc-800 border-zinc-700'} ${isTableExpanded ? 'z-[10000]' : ''}`}>
                            <DropdownMenuLabel>Filter by Source</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {getUniqueValues('source').map(value => (
                              <DropdownMenuCheckboxItem
                                key={value}
                                checked={columnFilters.source.includes(value)}
                                onCheckedChange={() => toggleColumnFilter('source', value)}
                              >
                                {value === 'website' ? 'Website' : 'Upload'}
                              </DropdownMenuCheckboxItem>
                            ))}
                            {columnFilters.source.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem onCheckedChange={() => clearColumnFilter('source')}>
                                  Clear filter
                                </DropdownMenuCheckboxItem>
                  </>
                )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <span className="cursor-pointer" onClick={() => handleSort('source')}>
                          Source {getSortIcon('source')}
                        </span>
            </div>
                    </TableHead>
                  )}
                  {!isMobile && (
                    <TableHead className={`${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                      <div className="flex items-center gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <Filter className={`h-3 w-3 ${columnFilters.version !== null ? 'text-blue-500' : ''}`} />
              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className={`${theme === 'light' ? 'bg-white' : 'bg-zinc-800 border-zinc-700'} ${isTableExpanded ? 'z-[10000]' : ''}`}>
                            <DropdownMenuLabel>Filter by Version</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <div className="p-2">
                              <Input
                                type="number"
                                placeholder="Version number"
                                value={columnFilters.version || ''}
                                onChange={(e) => setColumnFilters(prev => ({ ...prev, version: e.target.value ? parseInt(e.target.value) : null }))}
                                className="h-8"
                              />
                              {columnFilters.version !== null && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setColumnFilters(prev => ({ ...prev, version: null }))}
                                  className="h-7 w-full mt-2 text-xs"
                                >
                                  Clear
                                </Button>
                              )}
            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <span className="cursor-pointer" onClick={() => handleSort('version')}>
                          Version {getSortIcon('version')}
                        </span>
                      </div>
                    </TableHead>
                  )}
                  <TableHead className={`${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                    <div className="flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <Filter className={`h-3 w-3 ${columnFilters.size !== null ? 'text-blue-500' : ''}`} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className={`${theme === 'light' ? 'bg-white' : 'bg-zinc-800 border-zinc-700'} ${isTableExpanded ? 'z-[10000]' : ''}`}>
                          <DropdownMenuLabel>Filter by Size</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <div className="p-2 space-y-2">
                            <div className="flex gap-2">
                              <Button
                                variant={columnFilters.size?.operator === 'less' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setColumnFilters(prev => ({ ...prev, size: prev.size ? { ...prev.size, operator: 'less' } : { value: 0, operator: 'less' } }))}
                                className="h-7 text-xs"
                              >
                                ≤ Less
                              </Button>
                              <Button
                                variant={columnFilters.size?.operator === 'greater' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setColumnFilters(prev => ({ ...prev, size: prev.size ? { ...prev.size, operator: 'greater' } : { value: 0, operator: 'greater' } }))}
                                className="h-7 text-xs"
                              >
                                ≥ Greater
                              </Button>
                            </div>
                <Input
                              type="number"
                              placeholder="Size in bytes"
                              value={columnFilters.size?.value || ''}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, size: e.target.value ? { value: parseInt(e.target.value), operator: prev.size?.operator || 'less' } : null }))}
                              className="h-8"
                            />
                            {columnFilters.size !== null && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setColumnFilters(prev => ({ ...prev, size: null }))}
                                className="h-7 w-full text-xs"
                              >
                                Clear
                              </Button>
                            )}
              </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <span className="cursor-pointer" onClick={() => handleSort('size')}>
                        Size {getSortIcon('size')}
                      </span>
                    </div>
                  </TableHead>
                  <TableHead className={`${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                    <div className="flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <Filter className={`h-3 w-3 ${columnFilters.status.length > 0 ? 'text-blue-500' : ''}`} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className={`${theme === 'light' ? 'bg-white' : 'bg-zinc-800 border-zinc-700'} ${isTableExpanded ? 'z-[10000]' : ''}`}>
                          <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {getUniqueValues('status').map(value => (
                            <DropdownMenuCheckboxItem
                              key={value}
                              checked={columnFilters.status.includes(value)}
                              onCheckedChange={() => toggleColumnFilter('status', value)}
                            >
                              {value}
                            </DropdownMenuCheckboxItem>
                          ))}
                          {columnFilters.status.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuCheckboxItem onCheckedChange={() => clearColumnFilter('status')}>
                                Clear filter
                              </DropdownMenuCheckboxItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <span className="cursor-pointer" onClick={() => handleSort('status')}>
                        Status {getSortIcon('status')}
                      </span>
                    </div>
                  </TableHead>
                  {!isMobile && (
                    <TableHead className={`${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                      <div className="flex items-center gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <Filter className={`h-3 w-3 ${(columnFilters.updatedAt.from !== '' || columnFilters.updatedAt.to !== '' || columnFilters.updatedAt.fromTime !== '00:00' || columnFilters.updatedAt.toTime !== '23:59') ? 'text-blue-500' : ''}`} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className={`${theme === 'light' ? 'bg-white' : 'bg-zinc-800 border-zinc-700'} ${isTableExpanded ? 'z-[10000]' : ''}`}>
                            <DropdownMenuLabel>Filter by Date & Time Range</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <div className="p-2 space-y-3">
                              {/* Quick preset filters */}
                              <div className="space-y-2">
                                <div className="text-xs text-gray-500 font-medium">Quick Filters:</div>
                                <div className="grid grid-cols-2 gap-1">
              <Button
                variant="outline"
                size="sm"
                                    onClick={() => applyDatePreset('last1hour')}
                                    className="h-7 text-xs"
                                  >
                                    Last 1h
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => applyDatePreset('last2hours')}
                                    className="h-7 text-xs"
                                  >
                                    Last 2h
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => applyDatePreset('last3hours')}
                                    className="h-7 text-xs"
                                  >
                                    Last 3h
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => applyDatePreset('last4hours')}
                                    className="h-7 text-xs"
                                  >
                                    Last 4h
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => applyDatePreset('last5hours')}
                                    className="h-7 text-xs"
                                  >
                                    Last 5h
              </Button>
            </div>
                                <div className="grid grid-cols-3 gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => applyDatePreset('lastWeek')}
                                    className="h-7 text-xs"
                                  >
                                    Last Week
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => applyDatePreset('lastMonth')}
                                    className="h-7 text-xs"
                                  >
                                    Last Month
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => applyDatePreset('lastYear')}
                                    className="h-7 text-xs"
                                  >
                                    Last Year
                                  </Button>
                                </div>
                              </div>
                              <DropdownMenuSeparator />
                              {/* Manual date/time inputs */}
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs text-gray-500 mb-1 block">From Date</label>
                <Input
                                    type="date"
                                    value={columnFilters.updatedAt.from}
                                    onChange={(e) => setColumnFilters(prev => ({ ...prev, updatedAt: { ...prev.updatedAt, from: e.target.value } }))}
                                    className="h-8"
                />
              </div>
                                <div>
                                  <label className="text-xs text-gray-500 mb-1 block">From Time</label>
                                  <Input
                                    type="time"
                                    value={columnFilters.updatedAt.fromTime}
                                    onChange={(e) => setColumnFilters(prev => ({ ...prev, updatedAt: { ...prev.updatedAt, fromTime: e.target.value } }))}
                                    className="h-8"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs text-gray-500 mb-1 block">To Date</label>
                                  <Input
                                    type="date"
                                    value={columnFilters.updatedAt.to}
                                    onChange={(e) => setColumnFilters(prev => ({ ...prev, updatedAt: { ...prev.updatedAt, to: e.target.value } }))}
                                    className="h-8"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500 mb-1 block">To Time</label>
                                  <Input
                                    type="time"
                                    value={columnFilters.updatedAt.toTime}
                                    onChange={(e) => setColumnFilters(prev => ({ ...prev, updatedAt: { ...prev.updatedAt, toTime: e.target.value } }))}
                                    className="h-8"
                                  />
                                </div>
                              </div>
                              {(columnFilters.updatedAt.from !== '' || columnFilters.updatedAt.to !== '' ||
                                columnFilters.updatedAt.fromTime !== '00:00' || columnFilters.updatedAt.toTime !== '23:59') && (
              <Button
                                  variant="ghost"
                size="sm"
                                  onClick={() => setColumnFilters(prev => ({ ...prev, updatedAt: { from: '', fromTime: '00:00', to: '', toTime: '23:59' } }))}
                                  className="h-7 w-full text-xs"
                                >
                                  Clear
              </Button>
                              )}
            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <span className="cursor-pointer" onClick={() => handleSort('updatedAt')}>
                          Last Updated {getSortIcon('updatedAt')}
                        </span>
                      </div>
                    </TableHead>
                  )}
                  <TableHead className={`text-right ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                    Actions
                  </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDocuments.map((doc) => (
                    <TableRow 
                      key={doc.id}
                      className={`${theme === 'light' ? 'border-gray-100 hover:bg-gray-50' : 'border-zinc-800 hover:bg-zinc-800'} ${selectedDocIds.has(doc.id) ? (theme === 'light' ? 'bg-blue-50' : 'bg-blue-950') : ''}`}
                    >
                      {/* Checkbox cell */}
                      <TableCell className="w-[40px]">
                        <Checkbox
                          checked={selectedDocIds.has(doc.id)}
                          onCheckedChange={() => toggleSelectDoc(doc.id)}
                          aria-label={`Select ${doc.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-2 min-w-0 ${isMobile && !isTableExpanded ? 'gap-1' : 'gap-2'}`}>
                          <div className={isMobile && !isTableExpanded ? 'scale-75' : ''}>
                            {getFileIcon(doc.type, doc.source)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`${isMobile && !isTableExpanded ? 'text-xs' : 'text-sm'} font-medium truncate ${
                              theme === 'light' ? 'text-gray-900' : 'text-white'
                            }`} title={doc.source === 'website' && doc.originalUrl ? doc.originalUrl : doc.name}>
                              {/* For websites, show original URL as the name */}
                              {doc.source === 'website' && doc.originalUrl ? doc.originalUrl : doc.name}
                            </p>
                            {/* Storage location indicators */}
                            <div className={`flex items-center gap-1 mt-0.5 ${isMobile && !isTableExpanded ? 'gap-0.5' : 'gap-1'}`}>
                              {doc.r2Key && (
                                <div className="flex items-center gap-1" title="Stored in Cloudflare R2">
                                  <Cloud className={`${isMobile && !isTableExpanded ? 'h-2 w-2' : 'h-3 w-3'} ${theme === 'light' ? 'text-blue-500' : 'text-blue-400'}`} />
                                  <span className={`${isMobile && !isTableExpanded ? 'text-[8px]' : 'text-[10px]'} ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>R2</span>
                                </div>
                              )}
                              {doc.geminiFileName && (
                                <div className="flex items-center gap-1" title="Indexed in Gemini File Search">
                                  <HardDrive className={`${isMobile && !isTableExpanded ? 'h-2 w-2' : 'h-3 w-3'} ${theme === 'light' ? 'text-green-500' : 'text-green-400'}`} />
                                  <span className={`${isMobile && !isTableExpanded ? 'text-[8px]' : 'text-[10px]'} ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>Gemini</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1" title="Metadata stored in PostgreSQL">
                                <Database className={`${isMobile && !isTableExpanded ? 'h-2 w-2' : 'h-3 w-3'} ${theme === 'light' ? 'text-purple-500' : 'text-purple-400'}`} />
                                <span className={`${isMobile && !isTableExpanded ? 'text-[8px]' : 'text-[10px]'} ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>DB</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${isMobile && !isTableExpanded ? 'text-[10px] px-1 py-0' : 'text-xs px-1.5 py-0.5'} ${
                            doc.source === 'website'
                              ? 'bg-purple-50 text-purple-600 border-purple-200'
                              : 'bg-gray-50 text-gray-600 border-gray-200'
                          }`}
                        >
                          {doc.source === 'website' ? 'www' : (doc.type || 'unknown').toUpperCase()}
                        </Badge>
                        </TableCell>
                      {!isMobile && (
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${isTableExpanded ? 'text-xs px-2 py-1' : 'text-xs px-2 py-1'} ${
                              doc.source === 'website'
                                ? 'bg-purple-50 text-purple-600 border-purple-200'
                                : 'bg-blue-50 text-blue-600 border-blue-200'
                            }`}
                          >
                            {doc.source === 'website' ? (
                              <><Globe className={`${isTableExpanded ? 'h-3 w-3' : 'h-3 w-3'} mr-1`} /> Website</>
                            ) : (
                              <><Upload className={`${isTableExpanded ? 'h-3 w-3' : 'h-3 w-3'} mr-1`} /> Upload</>
                            )}
                          </Badge>
                        </TableCell>
                      )}
                      {!isMobile && (
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${isTableExpanded ? 'text-xs px-1.5 py-0.5' : 'text-xs px-1.5 py-0.5'} ${
                              theme === 'light' ? 'bg-gray-50 text-gray-600 border-gray-200' : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                            }`}
                          >
                            {doc.version || 1}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell>
                        <span className={`${isMobile && !isTableExpanded ? 'text-xs' : 'text-sm'} ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                          {formatFileSize(doc.size || 0)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {isMobile ? (
                          <Badge variant="outline" className={`${isTableExpanded ? 'text-xs px-1.5 py-0.5' : 'text-[10px] px-1 py-0'}`}>
                            {getStatusBadge(doc.status)}
                          </Badge>
                        ) : (
                          getStatusBadge(doc.status)
                        )}
                      </TableCell>
                      {!isMobile && (
                        <TableCell>
                          <div className="flex flex-col">
                            <span className={`${isTableExpanded ? 'text-sm' : 'text-sm'} flex items-center gap-1 ${theme === 'light' ? 'text-gray-600' : 'text-gray-300'}`}>
                              <Calendar className={`${isTableExpanded ? 'h-3 w-3' : 'h-3 w-3'}`} />
                              {formatDate(doc.updatedAt)}
                            </span>
                            <span className={`${isTableExpanded ? 'text-[10px]' : 'text-[10px]'} ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}>
                              {new Date(doc.updatedAt).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                              })}
                            </span>
                          </div>
                        </TableCell>
                      )}
                        <TableCell className="text-right">
                        <div className={`flex items-center justify-end ${isMobile && !isTableExpanded ? 'gap-0.5' : 'gap-1'}`}>
                          {/* Download button for uploaded files */}
                          {doc.source === 'upload' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`${isMobile && !isTableExpanded ? 'h-6 w-6 p-0' : 'h-8 w-8 p-0'} ${
                                theme === 'light' ? 'hover:bg-blue-50' : 'hover:bg-blue-950'
                              }`}
                              onClick={async () => {
                                try {
                                  if (doc.r2Url) {
                                    // Public bucket - direct download
                                    const link = document.createElement('a');
                                    link.href = doc.r2Url;
                                    link.download = doc.name;
                                    link.target = '_blank';
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  } else {
                                    // Private bucket - download directly from backend
                                    setSuccess('Preparing download...');

                                    try {
                                      // Fetch the file content from the download endpoint
                                      const downloadUrl = `${knowledgeBaseManager.apiBaseUrl}/api/v1/knowledgebase/files/${encodeURIComponent(doc.id)}/download`;

                                      const response = await fetch(downloadUrl);
                                      if (!response.ok) {
                                        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
                                      }

                                      // Get the filename from the Content-Disposition header or fallback to doc.name
                                      const contentDisposition = response.headers.get('Content-Disposition');
                                      let filename = doc.name || 'downloaded-file';

                                      if (contentDisposition) {
                                        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                                        if (filenameMatch && filenameMatch[1]) {
                                          filename = filenameMatch[1].replace(/['"]/g, '');
                                        }
                                      }

                                      // Convert response to blob
                                      const blob = await response.blob();

                                      // Create blob URL and trigger download
                                      const blobUrl = URL.createObjectURL(blob);
                                      const link = document.createElement('a');
                                      link.href = blobUrl;
                                      link.download = filename;
                                      link.style.display = 'none';

                                      // Add to DOM, click, and remove
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);

                                      // Clean up blob URL
                                      URL.revokeObjectURL(blobUrl);

                                      setSuccess(null); // Clear the "Preparing download..." message
                                      setSuccess('Download completed successfully!');
                                      setTimeout(() => setSuccess(null), 3000);
                                    } catch (downloadError) {
                                      console.error('Direct download failed, trying signed URL fallback:', downloadError);
                                      // Fallback to signed URL method
                                      const signedUrl = await knowledgeBaseManager.getSignedDownloadUrl(doc.id);
                                      window.open(signedUrl, '_blank');
                                    }

                                    setSuccess('Download started successfully!');
                                    // Clear success message after 3 seconds
                                    setTimeout(() => setSuccess(null), 3000);
                                  }
                                } catch (err: unknown) {
                                  console.error('Download error:', err);
                                  const errorMessage = err instanceof Error ? err.message : 'Failed to download file';
                                  setError(errorMessage);
                                }
                              }}
                              title="Download file"
                            >
                              <Download className={`${isMobile && !isTableExpanded ? 'h-3 w-3' : 'h-4 w-4'} ${
                                theme === 'light' ? 'text-blue-500' : 'text-blue-400'
                              }`} />
                            </Button>
                          )}
                          {/* External link for websites */}
                          {doc.source === 'website' && doc.originalUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`${isMobile && !isTableExpanded ? 'h-6 w-6 p-0' : 'h-8 w-8 p-0'} ${
                                theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-zinc-700'
                              }`}
                              onClick={() => window.open(doc.originalUrl, '_blank')}
                              title="Open source URL"
                            >
                              <ExternalLink className={`${isMobile && !isTableExpanded ? 'h-3 w-3' : 'h-4 w-4'} ${
                                theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                              }`} />
                            </Button>
                          )}
                          {/* Update button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`${isMobile && !isTableExpanded ? 'h-6 w-6 p-0' : 'h-8 w-8 p-0'} ${
                              theme === 'light' ? 'hover:bg-orange-50' : 'hover:bg-orange-950'
                            }`}
                            onClick={() => handleOpenUpdateDialog(doc)}
                            title={doc.source === 'website' ? 'Re-scrape website' : 'Replace file'}
                          >
                            <Pencil className={`${isMobile && !isTableExpanded ? 'h-3 w-3' : 'h-4 w-4'} ${
                              theme === 'light' ? 'text-orange-500' : 'text-orange-400'
                            }`} />
                          </Button>
                          {/* Delete button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`${isMobile && !isTableExpanded ? 'h-6 w-6 p-0' : 'h-8 w-8 p-0'} hover:bg-red-50 hover:text-red-600 ${
                              theme === 'light' ? '' : 'hover:bg-red-950'
                            }`}
                            onClick={() => handleDeleteDocument(doc.id, doc.name)}
                              title="Delete document"
                            >
                              <Trash2 className={`${isMobile && !isTableExpanded ? 'h-3 w-3' : 'h-4 w-4'}`} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          </CardContent>
        </Card>
  );

  return (
    <div className={`h-full overflow-y-auto ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
      {isTableExpanded && createPortal(
        tableContent,
        document.body
      )}
      {!isTableExpanded && (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        {/* Header with inline stats */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className={`h-6 w-6 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`} />
            <h1 className={`text-xl sm:text-2xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
              Knowledge Base
            </h1>
                </div>
          
          {/* Inline Stats */}
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className={`text-sm font-medium ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{documents.length}</span>
              <span className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>Docs</span>
              </div>
            <div className={`w-px h-4 ${theme === 'light' ? 'bg-gray-300' : 'bg-zinc-700'}`} />
            <div className="flex items-center gap-1.5">
              <Upload className="h-4 w-4 text-green-500" />
              <span className={`text-sm font-medium ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{uploadedCount}</span>
              <span className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>Uploaded</span>
            </div>
            <div className={`w-px h-4 ${theme === 'light' ? 'bg-gray-300' : 'bg-zinc-700'}`} />
            <div className="flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-purple-500" />
              <span className={`text-sm font-medium ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{websiteCount}</span>
              <span className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>Websites</span>
            </div>
            <div className={`w-px h-4 ${theme === 'light' ? 'bg-gray-300' : 'bg-zinc-700'}`} />
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-4 w-4 text-orange-500" />
              <span className={`text-sm font-medium ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{formatFileSize(totalSize)}</span>
            </div>
          </div>
        </div>

        {/* Error/Success Messages */}
        {!isTableExpanded && (
          <>
            {error && (
              <div className={`flex items-center gap-3 p-4 rounded-lg border ${
                theme === 'light' ? 'bg-red-50 border-red-200' : 'bg-red-950 border-red-800'
              }`}>
                <AlertCircle className={`h-5 w-5 flex-shrink-0 ${theme === 'light' ? 'text-red-600' : 'text-red-400'}`} />
                <p className={`text-sm flex-1 ${theme === 'light' ? 'text-red-700' : 'text-red-300'}`}>{error}</p>
                <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
                </div>
            )}
            
            {success && (
              <div className={`flex items-center gap-3 p-4 rounded-lg border ${
                theme === 'light' ? 'bg-green-50 border-green-200' : 'bg-green-950 border-green-800'
              }`}>
                <CheckCircle className={`h-5 w-5 flex-shrink-0 ${theme === 'light' ? 'text-green-600' : 'text-green-400'}`} />
                <p className={`text-sm flex-1 ${theme === 'light' ? 'text-green-700' : 'text-green-300'}`}>{success}</p>
                <Button variant="ghost" size="sm" onClick={() => setSuccess(null)} className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Upload and Crawl Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Upload File Card */}
          <Card className={`${theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-700'}`}>
            <CardHeader className="pb-3">
              <CardTitle className={`text-lg flex items-center gap-2 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                <Upload className="h-5 w-5" />
                Upload Files
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drag & Drop Area */}
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : theme === 'light'
                      ? 'border-gray-300 hover:border-gray-400 bg-gray-50'
                      : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={onButtonClick}
              >
                <input
                  type="file"
                  ref={inputRef}
                  className="hidden"
                  multiple
                  onChange={(e) => handleFileChange(e.target.files)}
                  accept={VALIDATION.ALLOWED_FILE_TYPES.map(t => `.${t}`).join(',')}
                />
                <Upload className={`h-10 w-10 mx-auto mb-3 ${
                  theme === 'light' ? 'text-gray-400' : 'text-gray-500'
                }`} />
                <p className={`text-sm font-medium ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                  Drag & drop files here
                </p>
                <p className={`text-xs mt-1 ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
                  or click to browse
                </p>
              </div>

              {/* File Type Info */}
              <div className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                <p className="font-medium mb-1">Supported formats:</p>
                <div className="flex flex-wrap gap-1">
                  {['PDF', 'DOCX', 'TXT', 'PPT', 'XLSX', 'CSV', 'HTML', 'JSON', 'XML', 'PNG', 'JPG'].map((type) => (
                    <Badge key={type} variant="outline" className="text-xs px-1.5 py-0.5">
                      {type}
                    </Badge>
                  ))}
                </div>
                <p className="mt-2">Max size: {formatFileSize(VALIDATION.MAX_FILE_SIZE)}</p>
              </div>

              {/* Uploading Files Progress */}
              {uploadingFiles.size > 0 && (
                <div className="space-y-2">
                  {Array.from(uploadingFiles.values()).map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg ${
                        theme === 'light' ? 'bg-gray-100' : 'bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {getFileIcon(getFileExtension(item.file.name), 'upload')}
                        <span className={`text-sm truncate flex-1 ${
                          theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                        }`}>
                          {item.file.name}
                        </span>
                        <span className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                          {formatFileSize(item.file.size)}
                        </span>
                      </div>
                      <Progress value={item.progress} className="h-1.5" />
                      <div className="flex justify-between items-center mt-1">
                        <span className={`text-xs ${
                          item.status === 'failed' ? 'text-red-500' : 
                          item.status === 'processed' ? 'text-green-500' : 
                          theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          {item.status === 'uploading' && 'Uploading...'}
                          {item.status === 'processed' && 'Complete!'}
                          {item.status === 'failed' && (item.error || 'Failed')}
                        </span>
                        <span className={`text-xs ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}>
                          {item.progress}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Crawl Links Card */}
          <Card className={`${theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-700'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className={`text-lg flex items-center gap-2 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                    <Globe className="h-5 w-5" />
                    Scrape Websites
                  </CardTitle>
                  <p className={`text-sm mt-1 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                    Add website URLs to scrape. Existing websites will be automatically re-scraped.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addCrawlUrl}
                  disabled={isScraping}
                  className={`h-8 ${theme === 'light' ? 'border-gray-200 hover:bg-gray-50' : 'border-zinc-700 hover:bg-zinc-800'}`}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add URL
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* URL List with Scrollbar */}
              <div className={`${crawlUrls.length >= 2 ? 'max-h-[300px] overflow-y-auto pr-1' : ''} space-y-3`}>
                {crawlUrls.map((entry, index) => (
                  <div key={entry.id} className={`p-3 rounded-lg space-y-2 ${
                    theme === 'light' ? 'bg-gray-50 border border-gray-200' : 'bg-zinc-800 border border-zinc-700'
                  } ${entry.status === 'success' ? 'border-green-500' : entry.status === 'failed' ? 'border-red-500' : ''}`}>
                    {/* URL Input */}
                    <div className="flex items-center gap-2">
                      <Select 
                        value={entry.protocol} 
                        onValueChange={(val) => handleProtocolChange(entry.id, val)}
                        disabled={isScraping}
                      >
                        <SelectTrigger className={`w-20 flex-shrink-0 h-9 text-xs ${
                          theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-700 border-zinc-600'
                        }`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="https://">https://</SelectItem>
                          <SelectItem value="http://">http://</SelectItem>
                        </SelectContent>
                      </Select>
                <Input
                        value={entry.url}
                        onChange={(e) => handleCrawlUrlChange(entry.id, e.target.value)}
                        placeholder="example.com"
                  disabled={isScraping}
                        className={`flex-1 h-9 ${
                          theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-700 border-zinc-600'
                        } ${entry.error ? 'border-red-500' : ''}`}
                />
                {entry.error && (
                  <p className="text-xs text-red-500 mt-1">{entry.error}</p>
                )}
                      {crawlUrls.length > 1 && (
              <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCrawlUrl(entry.id)}
                          disabled={isScraping}
                          className={`h-9 w-9 flex-shrink-0 ${
                            theme === 'light' ? 'hover:bg-red-50 text-red-500' : 'hover:bg-red-950 text-red-400'
                          }`}
                        >
                          <Minus className="h-4 w-4" />
              </Button>
                      )}
              </div>
                    
                    {/* Sitemap (readonly, auto-detected) */}
                    {entry.sitemap && (
                      <div className="flex items-center gap-2">
                        <MapPin className={`h-3 w-3 flex-shrink-0 ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`} />
                        <span className={`text-xs truncate ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                          {entry.sitemap}
                        </span>
              </div>
                    )}
                    
                    {/* Status indicators */}
                    {entry.status === 'scraping' && (
                      <div className="flex items-center gap-2 text-blue-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-xs">Scraping...</span>
                      </div>
                    )}
                    {entry.status === 'rescraping' && (
                      <div className="flex items-center gap-2 text-orange-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-xs">Re-scraping...</span>
                      </div>
                    )}
                    {entry.status === 'success' && (
                      <div className="flex items-center gap-2 text-green-500">
                        <CheckCircle className="h-3 w-3" />
                        <span className="text-xs">Success!</span>
                      </div>
                    )}
                    {entry.error && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {entry.error}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Scrape Button */}
              <Button
                onClick={handleScrapeWebsites}
                disabled={isScraping || crawlUrls.every(e => !e.url.trim()) || crawlUrls.some(e => e.error)}
                className={`w-full ${
                  theme === 'light'
                    ? 'bg-black hover:bg-gray-800 text-white'
                    : 'bg-white hover:bg-gray-200 text-black'
                }`}
              >
                {isScraping ? (
                  <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scraping {crawlUrls.filter(e => e.status === 'scraping' || e.status === 'rescraping').length} website(s)...
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4 mr-2" />
                    Scrape Website{crawlUrls.filter(e => e.url.trim()).length > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
          </>
        )}

        {/* Documents Table - render normally when not expanded */}
        {!isTableExpanded && tableContent}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>
        <DialogContent className={theme === 'light' ? 'bg-white' : 'bg-zinc-900 border-zinc-700'}>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              {confirmDialog.title}
            </DialogTitle>
            <DialogDescription className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>
              {confirmDialog.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                confirmDialog.onCancel?.();
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
              }}
              className={theme === 'light' ? '' : 'border-zinc-700'}
            >
              {confirmDialog.cancelText || 'Cancel'}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                confirmDialog.onConfirm();
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
              }}
            >
              {confirmDialog.confirmText || 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden file input for updating uploaded documents */}
      <input
        type="file"
        ref={updateFileInputRef}
        className="hidden"
        onChange={handleUpdateFileSelected}
        accept=".pdf,.doc,.docx,.txt,.rtf,.odt,.ppt,.pptx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.mp3,.wav,.html,.json,.xml,.yaml,.yml,.md"
      />
      </div>
      )}
    </div>
  );
};
export default KnowledgeBaseManagement;
