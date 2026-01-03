import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Trash2, 
  Upload, 
  Loader2, 
  FolderOpen,
  Globe,
  FileText,
  ChevronDown
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KnowledgeBaseManager, Document } from "@/lib/knowledge-base";
import { AWS_CONFIG } from "@/lib/aws-config";
import { useTheme } from "@/hooks/use-theme";

const KnowledgeBaseManagement = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // URL crawl state
  const [urlProtocol, setUrlProtocol] = useState('https://');
  const [urlPath, setUrlPath] = useState('');
  const [sitemapProtocol, setSitemapProtocol] = useState('https://');
  const [sitemapPath, setSitemapPath] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  
  const { theme } = useTheme();
  const knowledgeBaseManager = new KnowledgeBaseManager(AWS_CONFIG.endpoints.pharmaApiGateway);

  // Supported file formats
  const supportedFormats = ['docx', 'pdf', 'txt', 'ppt', 'xlsx', 'png', 'jpg', 'mp3', 'wav', 'html', 'yaml', 'json', 'xml'];

  // Load documents on component mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await knowledgeBaseManager.getDocuments();
      
      const transformedDocuments = (response.documents || []).map((doc: any) => {
        const originalName = doc.original_name || doc.filename || 'Unknown Document';
        const extension = originalName.split('.').pop()?.toUpperCase() || 'TXT';
        
        return {
          id: doc.key || doc.chunk_id || doc.document_id || Math.random().toString(),
          name: originalName,
          type: extension.toLowerCase(),
          status: doc.status || 'processed',
          chunks: doc.chunks_count ? [doc] : [],
          metadata: {
            title: originalName,
            category: doc.metadata?.category || 'general',
            tags: doc.metadata?.tags || [],
            author: doc.metadata?.author || 'unknown',
            sourceUrl: doc.metadata?.sourceUrl,
            key: doc.key
          },
          createdAt: doc.last_modified || doc.created_at || doc.processed_at || new Date().toISOString(),
          updatedAt: doc.last_modified || doc.created_at || doc.processed_at || new Date().toISOString()
        };
      });

      setDocuments(transformedDocuments);
    } catch (err) {
      console.error('Error loading documents:', err);
      setError('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);
      setSuccess(null);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      await knowledgeBaseManager.uploadDocument(file, { title: file.name });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setSuccess(`Document "${file.name}" uploaded successfully!`);
      
      // Reload documents
      setTimeout(() => {
        loadDocuments();
        setSuccess(null);
      }, 2000);

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleFetchData = async () => {
    const fullUrl = urlPath ? `${urlProtocol}${urlPath}` : '';
    const fullSitemap = sitemapPath ? `${sitemapProtocol}${sitemapPath}` : '';
    
    if (!fullUrl && !fullSitemap) {
      setError('Please enter a URL or sitemap');
      return;
    }

    try {
      setIsFetching(true);
      setError(null);
      setSuccess(null);

      // Scrape the URL
      if (fullUrl) {
        await knowledgeBaseManager.scrapeWebsite(fullUrl);
        
        // Auto-populate sitemap if not already set
        if (!sitemapPath) {
          try {
            const url = new URL(fullUrl);
            setSitemapPath(`${url.hostname}/sitemap.xml`);
          } catch (e) {
            // Ignore URL parsing errors
          }
        }
      }

      // If sitemap is provided, also crawl it
      if (fullSitemap && fullSitemap !== fullUrl) {
        await knowledgeBaseManager.scrapeWebsite(fullSitemap);
      }

      setSuccess('Data fetching started! Content will appear in the list once processed.');
      setUrlPath('');
      
      // Reload documents after delay
      setTimeout(() => {
        loadDocuments();
      }, 3000);

    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setIsFetching(false);
    }
  };

  const handleDeleteDocument = async (documentKey: string, documentName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${documentName}"?`)) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${AWS_CONFIG.endpoints.pharmaApiGateway}/delete-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_key: documentKey })
      });

      if (!response.ok) {
        throw new Error(`Failed to delete document: ${response.statusText}`);
      }

      setSuccess(`Document "${documentName}" deleted successfully!`);
      await loadDocuments();

      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      console.error('Error deleting document:', err);
      setError(err.message || 'Failed to delete document');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    if (!doc) return false;
    return (doc.name || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getFileTypeDisplay = (type: string): string => {
    const typeMap: Record<string, string> = {
      'pdf': 'PDF',
      'docx': 'Doc.x',
      'doc': 'Doc',
      'txt': 'TXT',
      'png': 'PNG',
      'jpg': 'JPG',
      'jpeg': 'JPEG',
      'html': 'HTML',
      'url': 'URL',
      'xml': 'XML',
      'json': 'JSON',
    };
    return typeMap[type.toLowerCase()] || type.toUpperCase();
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className={`h-full overflow-y-auto ${
      theme === 'light' ? 'bg-white' : 'bg-black'
    }`}>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className={`text-2xl sm:text-3xl font-semibold ${
            theme === 'light' ? 'text-black' : 'text-white'
          }`}>
            Knowledge-base management
          </h1>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Main Content - Upload and Crawl sections side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          {/* UPLOAD FILE Section */}
          <Card className={`${
            theme === 'light' 
              ? 'bg-white border-gray-200' 
              : 'bg-zinc-900 border-zinc-800'
          }`}>
            <CardContent className="p-6">
              <h3 className={`text-sm font-semibold mb-4 uppercase tracking-wide ${
                theme === 'light' ? 'text-black' : 'text-white'
              }`}>
                UPLOAD FILE
              </h3>
              
              {/* Drag and Drop Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragging 
                    ? 'border-blue-500 bg-blue-50' 
                    : theme === 'light'
                      ? 'border-gray-300 hover:border-gray-400'
                      : 'border-zinc-600 hover:border-zinc-500'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  accept={supportedFormats.map(f => `.${f}`).join(',')}
                />
                <p className={`mb-4 ${
                  theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  Drag and drop a file here or click
                </p>
                <Button
                  className={`${
                    theme === 'light'
                      ? 'bg-black text-white hover:bg-gray-800'
                      : 'bg-white text-black hover:bg-gray-200'
                  }`}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Upload'
                  )}
                </Button>
              </div>

              {/* Supported Formats */}
              <div className={`flex items-center gap-2 mt-4 text-sm ${
                theme === 'light' ? 'text-gray-600' : 'text-gray-400'
              }`}>
                <FolderOpen className="h-4 w-4" />
                <span>Formats: {supportedFormats.join(', ')}</span>
              </div>

              {/* Upload Progress */}
              {isUploading && uploadProgress > 0 && (
                <div className="mt-4">
                  <div className={`flex items-center gap-2 text-sm mb-2 ${
                    theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    <FolderOpen className="h-4 w-4" />
                    <span>Uploading</span>
                    <div className="flex-1 mx-2">
                      <div className={`h-2 rounded-full ${
                        theme === 'light' ? 'bg-gray-200' : 'bg-zinc-700'
                      }`}>
                        <div
                          className="h-2 bg-blue-500 rounded-full transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                    <span>{uploadProgress}%</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add crawl links Section */}
          <Card className={`${
            theme === 'light' 
              ? 'bg-white border-gray-200' 
              : 'bg-zinc-900 border-zinc-800'
          }`}>
            <CardContent className="p-6">
              <h3 className={`text-sm font-semibold mb-4 ${
                theme === 'light' ? 'text-black' : 'text-white'
              }`}>
                Add crawl links
              </h3>
              
              <div className="space-y-4">
                {/* URL Input */}
                <div className="flex items-center gap-2">
                  <div className={`flex items-center border rounded-full px-4 py-2 ${
                    theme === 'light' ? 'border-gray-300 bg-white' : 'border-zinc-600 bg-zinc-800'
                  }`}>
                    <span className={`text-sm mr-1 ${
                      theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                    }`}>URL:</span>
                    <Select value={urlProtocol} onValueChange={setUrlProtocol}>
                      <SelectTrigger className={`border-0 p-0 h-auto w-auto text-sm shadow-none focus:ring-0 ${
                        theme === 'light' ? 'text-black' : 'text-white'
                      }`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="https://">https://</SelectItem>
                        <SelectItem value="http://">http://</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={urlPath}
                      onChange={(e) => setUrlPath(e.target.value)}
                      placeholder="example.com/page"
                      className={`border-0 shadow-none focus-visible:ring-0 flex-1 min-w-[200px] ${
                        theme === 'light' ? 'bg-white text-black' : 'bg-zinc-800 text-white'
                      }`}
                    />
                  </div>
                </div>

                {/* Sitemap Input */}
                <div className="flex items-center gap-2">
                  <div className={`flex items-center border rounded-full px-4 py-2 ${
                    theme === 'light' ? 'border-gray-300 bg-white' : 'border-zinc-600 bg-zinc-800'
                  }`}>
                    <span className={`text-sm mr-1 ${
                      theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                    }`}>Sitemap:</span>
                    <Select value={sitemapProtocol} onValueChange={setSitemapProtocol}>
                      <SelectTrigger className={`border-0 p-0 h-auto w-auto text-sm shadow-none focus:ring-0 ${
                        theme === 'light' ? 'text-black' : 'text-white'
                      }`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="https://">https://</SelectItem>
                        <SelectItem value="http://">http://</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={sitemapPath}
                      onChange={(e) => setSitemapPath(e.target.value)}
                      placeholder="example.com/sitemap.xml"
                      className={`border-0 shadow-none focus-visible:ring-0 flex-1 min-w-[200px] ${
                        theme === 'light' ? 'bg-white text-black' : 'bg-zinc-800 text-white'
                      }`}
                    />
                  </div>
                  
                  <Button
                    onClick={handleFetchData}
                    disabled={isFetching || (!urlPath && !sitemapPath)}
                    className={`rounded-lg ${
                      theme === 'light'
                        ? 'bg-black text-white hover:bg-gray-800'
                        : 'bg-white text-black hover:bg-gray-200'
                    }`}
                  >
                    {isFetching ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      'Fetch data'
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Knowledge Base Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className={`text-xl font-semibold ${
              theme === 'light' ? 'text-black' : 'text-white'
            }`}>
              Knowledge Base
            </h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Input
                  placeholder="Search documents"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-4 pr-10 w-64 ${
                    theme === 'light' 
                      ? 'bg-white border-gray-300 text-black' 
                      : 'bg-zinc-800 border-zinc-600 text-white'
                  }`}
                />
              </div>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className={`${
                  theme === 'light'
                    ? 'bg-black text-white hover:bg-gray-800'
                    : 'bg-white text-black hover:bg-gray-200'
                }`}
              >
                Add Document
              </Button>
            </div>
          </div>

          {/* Documents Table */}
          <Card className={`${
            theme === 'light' 
              ? 'bg-white border-gray-200' 
              : 'bg-zinc-900 border-zinc-800'
          }`}>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className={`${
                    theme === 'light' ? 'border-gray-200' : 'border-zinc-700'
                  }`}>
                    <TableHead className={`font-semibold ${
                      theme === 'light' ? 'text-black' : 'text-white'
                    }`}>Name</TableHead>
                    <TableHead className={`font-semibold ${
                      theme === 'light' ? 'text-black' : 'text-white'
                    }`}>Type</TableHead>
                    <TableHead className={`font-semibold ${
                      theme === 'light' ? 'text-black' : 'text-white'
                    }`}>Last Updated</TableHead>
                    <TableHead className={`font-semibold text-center ${
                      theme === 'light' ? 'text-black' : 'text-white'
                    }`}>Delete</TableHead>
                    <TableHead className={`font-semibold text-center ${
                      theme === 'light' ? 'text-black' : 'text-white'
                    }`}>Update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>
                            Loading documents...
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredDocuments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <FileText className={`h-8 w-8 ${
                            theme === 'light' ? 'text-gray-400' : 'text-gray-500'
                          }`} />
                          <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>
                            {searchTerm ? 'No documents found' : 'No documents yet'}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDocuments.map((doc, index) => (
                      <TableRow 
                        key={doc.id || `doc-${index}`}
                        className={`${
                          theme === 'light' 
                            ? 'border-gray-200 hover:bg-gray-50' 
                            : 'border-zinc-700 hover:bg-zinc-800'
                        }`}
                      >
                        <TableCell className={`font-medium ${
                          doc.metadata?.sourceUrl ? 'text-blue-600 underline cursor-pointer' : ''
                        } ${theme === 'light' ? 'text-black' : 'text-white'}`}>
                          {doc.name}
                        </TableCell>
                        <TableCell className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>
                          {getFileTypeDisplay(doc.type)}
                        </TableCell>
                        <TableCell className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>
                          {formatDate(doc.updatedAt)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDocument(doc.metadata?.key, doc.name)}
                            disabled={isLoading}
                            className={`hover:bg-red-50 hover:text-red-600 ${
                              theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                            }`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseManagement;
