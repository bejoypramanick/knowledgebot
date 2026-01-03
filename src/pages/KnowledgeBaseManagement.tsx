import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  RefreshCw,
  Search,
  ExternalLink,
  Database,
  HardDrive,
  AlertTriangle,
  X,
  MapPin,
  Download,
  Eye,
  Pencil,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
} from 'lucide-react';
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

  // URL Crawling State
  const [crawlUrl, setCrawlUrl] = useState('');
  const [crawlUrlProtocol, setCrawlUrlProtocol] = useState('https://');
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [sitemapUrlProtocol, setSitemapUrlProtocol] = useState('https://');
  const [isScraping, setIsScraping] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Confirmation Dialog
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
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
  type SortField = 'name' | 'source' | 'size' | 'status' | 'updatedAt';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Track documents being updated (for async UI updates)
  const [updatingDocIds, setUpdatingDocIds] = useState<Set<string>>(new Set());

  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const knowledgeBaseManager = new KnowledgeBaseManager(AWS_CONFIG.endpoints.pharmaApiGateway);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await knowledgeBaseManager.getDocuments();
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
    
    for (const file of Array.from(files)) {
      await processFile(file);
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
        // Check if name or type differs
        const existingExt = existingDoc.type?.toLowerCase() || '';
        const newExt = getFileExtension(file.name);
        const namesDiffer = existingDoc.name.toLowerCase() !== file.name.toLowerCase();
        const typesDiffer = existingExt !== newExt;

        if (namesDiffer || typesDiffer) {
          setConfirmDialog({
            isOpen: true,
            title: 'Replace Existing Document?',
            message: `A document "${existingDoc.name}" already exists. The file name or type is different than previously uploaded. This will replace the old content with new. Proceed?`,
            existingDoc,
            newFile: file,
            onConfirm: () => uploadFile(file, fileId, true), // Pass replaceExisting=true
          });
          return;
        }
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
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Document?',
      message: `Are you sure you want to delete "${documentName}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          setIsLoading(true);
          setError(null);
          await knowledgeBaseManager.deleteDocument(documentKey);
          setSuccess(`Document "${documentName}" deleted successfully!`);
          await loadDocuments();
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

  const handleUpdateDocument = async () => {
    if (!updateDialog.document) return;

    const doc = updateDialog.document;

    if (doc.source === 'website') {
      // For websites, re-scrape with the new or existing URL
      const url = updateDialog.newUrl.trim();
      if (!url) {
        setError('Please enter a valid URL');
        return;
      }

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
      } catch (err: any) {
        console.error('Update error:', err);
        setError(err.message || 'Failed to update website');
        setUpdatingDocIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(doc.id);
          return newSet;
        });
      }
    } else {
      // For uploaded files, trigger file input
      updateFileInputRef.current?.click();
    }
  };

  const handleUpdateFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !updateDialog.document) return;

    const file = files[0];
    const doc = updateDialog.document;

    try {
      setError(null);
      setUpdateDialog(prev => ({ ...prev, isOpen: false }));
      
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
    } catch (err: any) {
      console.error('Update error:', err);
      setError(err.message || 'Failed to update document');
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

  const handleCrawlUrlChange = (value: string) => {
    setCrawlUrl(value);
    setUrlError(null);
    
    // Auto-populate sitemap
    try {
      const fullUrl = crawlUrlProtocol + value;
      const parsedUrl = new URL(fullUrl);
      const domain = parsedUrl.hostname;
      setSitemapUrl(`${domain}/sitemap.xml`);
    } catch {
      setSitemapUrl('');
    }
  };

  const handleFetchData = async () => {
    const fullUrl = crawlUrl ? crawlUrlProtocol + crawlUrl : '';
    const fullSitemapUrl = sitemapUrl ? sitemapUrlProtocol + sitemapUrl : '';

    if (!fullUrl && !fullSitemapUrl) {
      setUrlError('Please enter a URL or Sitemap URL');
      return;
    }

    // Validate URL
    const urlToValidate = fullUrl || fullSitemapUrl;
    const validation = validateUrl(urlToValidate);
    if (!validation.valid) {
      setUrlError(validation.error || 'Invalid URL');
      return;
    }

    try {
      setIsScraping(true);
      setError(null);
      setSuccess(null);
      setUrlError(null);

      const response = await knowledgeBaseManager.scrapeWebsite(urlToValidate);
      
      setSuccess(`Scraping started for ${urlToValidate}. Content will appear in the list once processed.`);
      setCrawlUrl('');
      setSitemapUrl('');

      // Reload documents after a delay to allow processing
      setTimeout(() => {
        loadDocuments();
      }, 3000);
    } catch (err: any) {
      console.error('Scrape error:', err);
      setError(err.message || 'Failed to start scraping');
    } finally {
      setIsScraping(false);
    }
  };

  // Filter documents based on search
  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.metadata.sourceUrl?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort documents
  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'source':
        comparison = a.source.localeCompare(b.source);
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
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  // Calculate total size
  const totalSize = documents.reduce((acc, doc) => acc + (doc.size || 0), 0);
  const uploadedCount = documents.filter(d => d.source === 'upload').length;
  const websiteCount = documents.filter(d => d.source === 'website').length;

  return (
    <div className={`h-full overflow-y-auto ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className={`text-2xl sm:text-3xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
              <Database className="inline h-7 w-7 mr-2" />
              Knowledge Base
            </h1>
            <p className={`text-sm mt-1 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
              Manage your AI assistant's knowledge and training data
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadDocuments}
            disabled={isLoading}
            className={`self-start sm:self-auto ${
              theme === 'light' ? 'bg-white border-gray-200 hover:bg-gray-50' : 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800'
            }`}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card className={`${theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-700'}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-blue-50' : 'bg-blue-950'}`}>
                  <FileText className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{documents.length}</p>
                  <p className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>Total Docs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={`${theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-700'}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-green-50' : 'bg-green-950'}`}>
                  <Upload className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{uploadedCount}</p>
                  <p className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>Uploaded</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={`${theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-700'}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-purple-50' : 'bg-purple-950'}`}>
                  <Globe className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{websiteCount}</p>
                  <p className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>Websites</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={`${theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-700'}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-orange-50' : 'bg-orange-950'}`}>
                  <HardDrive className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{formatFileSize(totalSize)}</p>
                  <p className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>Total Size</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error/Success Messages */}
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
                  onChange={(e) => handleFileChange(e.target.files)}
                  accept={VALIDATION.ALLOWED_FILE_TYPES.map(t => `.${t}`).join(',')}
                  multiple
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
                  {['PDF', 'DOCX', 'TXT', 'PPT', 'XLSX', 'CSV', 'HTML', 'JSON', 'XML'].map((type) => (
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
              <CardTitle className={`text-lg flex items-center gap-2 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                <Globe className="h-5 w-5" />
                Add Crawl Links
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* URL Input */}
              <div>
                <label className={`text-xs font-medium block mb-1.5 ${
                  theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  <LinkIcon className="h-3 w-3 inline mr-1" />
                  Website URL
                </label>
                <div className="flex gap-2">
                  <Select value={crawlUrlProtocol} onValueChange={setCrawlUrlProtocol}>
                    <SelectTrigger className={`w-24 flex-shrink-0 ${
                      theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-800 border-zinc-700'
                    }`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="https://">https://</SelectItem>
                      <SelectItem value="http://">http://</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={crawlUrl}
                    onChange={(e) => handleCrawlUrlChange(e.target.value)}
                    placeholder="example.com"
                    className={`flex-1 ${
                      theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-800 border-zinc-700'
                    } ${urlError ? 'border-red-500' : ''}`}
                  />
                </div>
              </div>

              {/* Sitemap Input */}
              <div>
                <label className={`text-xs font-medium block mb-1.5 ${
                  theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  <MapPin className="h-3 w-3 inline mr-1" />
                  Sitemap URL (auto-detected)
                </label>
                <div className="flex gap-2">
                  <Select value={sitemapUrlProtocol} onValueChange={setSitemapUrlProtocol}>
                    <SelectTrigger className={`w-24 flex-shrink-0 ${
                      theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-800 border-zinc-700'
                    }`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="https://">https://</SelectItem>
                      <SelectItem value="http://">http://</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={sitemapUrl}
                    onChange={(e) => setSitemapUrl(e.target.value)}
                    placeholder="example.com/sitemap.xml"
                    className={`flex-1 ${
                      theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-800 border-zinc-700'
                    }`}
                  />
                </div>
              </div>

              {/* URL Error */}
              {urlError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {urlError}
                </p>
              )}

              {/* Fetch Button */}
              <Button
                onClick={handleFetchData}
                disabled={isScraping || (!crawlUrl && !sitemapUrl)}
                className={`w-full ${
                  theme === 'light'
                    ? 'bg-black hover:bg-gray-800 text-white'
                    : 'bg-white hover:bg-gray-200 text-black'
                }`}
              >
                {isScraping ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Fetch Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Documents Table */}
        <Card className={`${theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-900 border-zinc-700'}`}>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className={`text-lg flex items-center gap-2 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                <FileText className="h-5 w-5" />
                Documents ({filteredDocuments.length})
              </CardTitle>
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
          <CardContent className="p-0 overflow-hidden">
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
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className={theme === 'light' ? 'border-gray-200' : 'border-zinc-700'}>
                      <TableHead 
                        className={`${isMobile ? 'w-[35%]' : 'w-[30%]'} ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'} cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800`}
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center">
                          Name {getSortIcon('name')}
                        </div>
                      </TableHead>
                      {!isMobile && (
                        <TableHead 
                          className={`${theme === 'light' ? 'text-gray-600' : 'text-gray-400'} cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800`}
                          onClick={() => handleSort('source')}
                        >
                          <div className="flex items-center">
                            Source {getSortIcon('source')}
                          </div>
                        </TableHead>
                      )}
                      <TableHead 
                        className={`${theme === 'light' ? 'text-gray-600' : 'text-gray-400'} cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800`}
                        onClick={() => handleSort('size')}
                      >
                        <div className="flex items-center">
                          Size {getSortIcon('size')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className={`${theme === 'light' ? 'text-gray-600' : 'text-gray-400'} cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800`}
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center">
                          Status {getSortIcon('status')}
                        </div>
                      </TableHead>
                      {!isMobile && (
                        <TableHead 
                          className={`${theme === 'light' ? 'text-gray-600' : 'text-gray-400'} cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800`}
                          onClick={() => handleSort('updatedAt')}
                        >
                          <div className="flex items-center">
                            Last Updated {getSortIcon('updatedAt')}
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
                        className={`${theme === 'light' ? 'border-gray-100 hover:bg-gray-50' : 'border-zinc-800 hover:bg-zinc-800'}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-0">
                            {getFileIcon(doc.type, doc.source)}
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-medium truncate ${
                                theme === 'light' ? 'text-gray-900' : 'text-white'
                              }`} title={doc.source === 'website' && doc.originalUrl ? doc.originalUrl : doc.name}>
                                {/* For websites, show original URL as the name */}
                                {doc.source === 'website' && doc.originalUrl ? doc.originalUrl : doc.name}
                              </p>
                              <p className={`text-xs truncate ${
                                theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                              }`}>
                                {doc.source === 'website' ? (
                                  <span className="flex items-center gap-1">
                                    <Globe className="h-3 w-3 inline" />
                                    <span>Scraped website</span>
                                  </span>
                                ) : (
                                  <>.{doc.type}</>
                                )}
                                {isMobile && doc.source === 'website' && (
                                  <span className="ml-1">• <Globe className="h-3 w-3 inline" /></span>
                                )}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        {!isMobile && (
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                doc.source === 'website' 
                                  ? 'bg-purple-50 text-purple-600 border-purple-200' 
                                  : 'bg-blue-50 text-blue-600 border-blue-200'
                              }`}
                            >
                              {doc.source === 'website' ? (
                                <><Globe className="h-3 w-3 mr-1" /> Website</>
                              ) : (
                                <><Upload className="h-3 w-3 mr-1" /> Upload</>
                              )}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell>
                          <span className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-300'}`}>
                            {doc.size > 0 ? formatFileSize(doc.size) : '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {updatingDocIds.has(doc.id) ? (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Updating
                            </Badge>
                          ) : (
                            getStatusBadge(doc.status)
                          )}
                        </TableCell>
                        {!isMobile && (
                          <TableCell>
                            <span className={`text-sm flex items-center gap-1 ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`} title={new Date(doc.updatedAt).toLocaleString()}>
                              <Calendar className="h-3 w-3" />
                              {formatDate(doc.updatedAt)}
                            </span>
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Download button for uploaded files with R2 URL or R2 Key */}
                            {doc.source === 'upload' && (doc.r2Url || doc.r2Key) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-8 w-8 p-0 ${
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
                                    } else if (doc.r2Key) {
                                      // Private bucket - get signed URL first
                                      setSuccess('Generating download link...');
                                      const downloadUrl = await knowledgeBaseManager.getSignedDownloadUrl(doc.id);
                                      setSuccess(null);
                                      window.open(downloadUrl, '_blank');
                                    }
                                  } catch (err: any) {
                                    console.error('Download error:', err);
                                    setError(err.message || 'Failed to download file');
                                  }
                                }}
                                title="Download file"
                              >
                                <Download className={`h-4 w-4 ${
                                  theme === 'light' ? 'text-blue-500' : 'text-blue-400'
                                }`} />
                              </Button>
                            )}
                            {/* External link for websites */}
                            {doc.source === 'website' && doc.originalUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-8 w-8 p-0 ${
                                  theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-zinc-700'
                                }`}
                                onClick={() => window.open(doc.originalUrl, '_blank')}
                                title="Open source URL"
                              >
                                <ExternalLink className={`h-4 w-4 ${
                                  theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                                }`} />
                              </Button>
                            )}
                            {/* Update button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-8 w-8 p-0 ${
                                theme === 'light' ? 'hover:bg-orange-50' : 'hover:bg-orange-950'
                              }`}
                              onClick={() => handleOpenUpdateDialog(doc)}
                              title={doc.source === 'website' ? 'Re-scrape website' : 'Replace file'}
                            >
                              <Pencil className={`h-4 w-4 ${
                                theme === 'light' ? 'text-orange-500' : 'text-orange-400'
                              }`} />
                            </Button>
                            {/* Delete button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 ${
                                theme === 'light' ? '' : 'hover:bg-red-950'
                              }`}
                              onClick={() => handleDeleteDocument(doc.id, doc.name)}
                              title="Delete document"
                            >
                              <Trash2 className="h-4 w-4" />
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
      </div>

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
              onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
              className={theme === 'light' ? 'border-gray-200' : 'border-zinc-700'}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                confirmDialog.onConfirm();
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
              }}
              className={
                confirmDialog.title.includes('Delete')
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : theme === 'light'
                    ? 'bg-black hover:bg-gray-800 text-white'
                    : 'bg-white hover:bg-gray-200 text-black'
              }
            >
              {confirmDialog.title.includes('Delete') ? (
                <><Trash2 className="h-4 w-4 mr-2" /> Delete</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-2" /> Proceed</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Dialog */}
      <Dialog open={updateDialog.isOpen} onOpenChange={(open) => !open && setUpdateDialog(prev => ({ ...prev, isOpen: false }))}>
        <DialogContent className={theme === 'light' ? 'bg-white' : 'bg-zinc-900 border-zinc-700'}>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
              <Pencil className="h-5 w-5 text-orange-500" />
              {updateDialog.document?.source === 'website' ? 'Update Website' : 'Replace Document'}
            </DialogTitle>
            <DialogDescription className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>
              {updateDialog.document?.source === 'website'
                ? 'Re-scrape the website with the same or a new URL. The old content will be replaced.'
                : `Replace "${updateDialog.document?.name}" with a new file. The old file will be deleted.`
              }
            </DialogDescription>
          </DialogHeader>

          {updateDialog.document?.source === 'website' && (
            <div className="py-4">
              <label className={`text-sm font-medium ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                Website URL
              </label>
              <Input
                type="url"
                value={updateDialog.newUrl}
                onChange={(e) => setUpdateDialog(prev => ({ ...prev, newUrl: e.target.value }))}
                placeholder="https://example.com"
                className={`mt-1 ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-zinc-800 border-zinc-700 text-white'}`}
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setUpdateDialog(prev => ({ ...prev, isOpen: false }))}
              className={theme === 'light' ? 'border-gray-200' : 'border-zinc-700'}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateDocument}
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...</>
              ) : updateDialog.document?.source === 'website' ? (
                <><RefreshCw className="h-4 w-4 mr-2" /> Re-scrape</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Choose New File</>
              )}
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
  );
};

export default KnowledgeBaseManagement;
