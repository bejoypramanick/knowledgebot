import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Edit, Trash2, Filter, FileText, Database as DatabaseIcon, Loader2, Upload } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KnowledgeBaseManager, Document, DocumentMetadata } from "@/lib/knowledge-base";
import { AWS_CONFIG } from "@/lib/aws-config";
import UploadDocumentButton from "@/components/UploadDocumentButton";

const KnowledgeBaseManagement = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);

  const handleScrape = async () => {
    if (!scrapeUrl) return;

    // Basic URL validation
    try {
      new URL(scrapeUrl);
    } catch (_) {
      setError('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    try {
      setIsScraping(true);
      setError(null);
      setSuccess(null);

      console.log(`Starting scrape for ${scrapeUrl}`);
      const response = await knowledgeBaseManager.scrapeWebsite(scrapeUrl);
      console.log('Scrape started:', response);

      setSuccess(`Scraping started for ${scrapeUrl}. Content will appear in the list once processed.`);
      setScrapeUrl('');

      // Reload documents list after 2 seconds
      setTimeout(() => {
        loadDocuments();
      }, 2000);

    } catch (err: any) {
      console.error('Scrape error:', err);
      setError(err.message || 'Failed to start scraping');
    } finally {
      setIsScraping(false);
    }
  };

  const knowledgeBaseManager = new KnowledgeBaseManager(AWS_CONFIG.endpoints.pharmaApiGateway);

  // Load documents on component mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      console.log('Loading documents...');
      const response = await knowledgeBaseManager.getDocuments();
      console.log('Raw API response:', response);

      // Transform the response data to match our Document interface
      const transformedDocuments = (response.documents || []).map((doc: any) => {
        console.log('Processing document:', doc);

        // Use original_name from Pharma backend API response
        const originalName = doc.original_name || doc.filename || 'Unknown Document';

        return {
          id: doc.key || doc.chunk_id || doc.document_id || Math.random().toString(),
          name: originalName, // Use the original filename
          type: doc.metadata?.document_type || 'txt',
          status: doc.status || 'processed',
          chunks: doc.chunks_count ? [doc] : [],
          metadata: {
            title: originalName,
            category: doc.metadata?.category || 'general',
            tags: doc.metadata?.tags || [],
            author: doc.metadata?.author || 'unknown',
            sourceUrl: doc.metadata?.sourceUrl,
            key: doc.key // Store S3 key for deletion
          },
          createdAt: doc.last_modified || doc.created_at || doc.processed_at || new Date().toISOString(),
          updatedAt: doc.last_modified || doc.created_at || doc.processed_at || new Date().toISOString()
        };
      });

      console.log('Transformed documents:', transformedDocuments);
      setDocuments(transformedDocuments);
    } catch (err) {
      console.error('Error loading documents:', err);
      setError('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDocument = async (documentKey: string, documentName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${documentName}"?`)) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Call delete-document API
      const response = await fetch(`${AWS_CONFIG.endpoints.pharmaApiGateway}/delete-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ document_key: documentKey })
      });

      if (!response.ok) {
        throw new Error(`Failed to delete document: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Delete result:', result);

      setSuccess(`Document "${documentName}" deleted successfully!`);

      // Reload documents
      await loadDocuments();

      setTimeout(() => {
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error('Error deleting document:', err);
      setError(err.message || 'Failed to delete document');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);
      setSuccess(null);

      console.log(`Starting upload for ${file.name}`);

      // Step 1: Get presigned URL (10% progress)
      setUploadProgress(10);
      const presignedUrlData = await knowledgeBaseManager.getPresignedUploadUrl(file);
      console.log('Got presigned URL:', presignedUrlData);

      // Step 2: Upload to S3 (10-90% progress)
      setUploadProgress(20);
      await knowledgeBaseManager.uploadToS3(file, presignedUrlData.presigned_url, {}, (progress) => {
        setUploadProgress(progress);
      });

      // Note: Processing should be triggered via WebSocket from the UploadDocumentButton component
      // This simple upload handler just uploads to S3
      setUploadProgress(100);
      setSuccess(`Document "${file.name}" uploaded successfully! Please use the Upload Document button for full processing.`);

      // Reload documents list after 2 seconds
      setTimeout(() => {
        loadDocuments();
      }, 2000);

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset file input
      event.target.value = '';
    }
  };


  const filteredDocuments = documents.filter(doc => {
    if (!doc) return false;
    return (
      (doc.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.metadata?.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.metadata?.author || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });
  return (
    <div className="h-full bg-gradient-secondary overflow-y-auto">
      <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Knowledge-base Management</h1>
            <p className="text-muted-foreground">Manage your AI assistant's knowledge and training data</p>
          </div>
          <div className="flex items-center space-x-2">
            <UploadDocumentButton
              onUploadSuccess={loadDocuments}
            />
          </div>
        </div>

        {/* Upload Progress Bar */}
        {isUploading && uploadProgress > 0 && (
          <Card className="backdrop-blur-sm bg-card/80 border-border/20">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Uploading document...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Web Scraping Input */}
        <Card className="backdrop-blur-sm bg-card/80 border-border/20">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="mr-2">🌐</span> Add Knowledge from Website
            </h3>
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="Enter website URL (e.g., https://docs.example.com)"
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                  className="bg-white border-border/20 text-black border-gray-300"
                  disabled={isScraping}
                />
              </div>
              <Button
                onClick={handleScrape}
                disabled={!scrapeUrl || isScraping}
                className="bg-gradient-primary border-0 shadow-glow"
              >
                {isScraping ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Scrape Website
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              The crawler will extract text content from the URL and add it to the knowledge base. Max depth: 2, Max pages: 10.
            </p>
          </CardContent>
        </Card>

        {/* Success Message */}
        {success && (
          <Card className="backdrop-blur-sm bg-green-500/10 border-green-500/20">
            <CardContent className="p-4">
              <p className="text-green-500">{success}</p>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {error && (
          <Card className="backdrop-blur-sm bg-red-500/10 border-red-500/20">
            <CardContent className="p-4">
              <p className="text-red-500">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Search and Filters */}
        <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search knowledge base articles..."
                  className="pl-10 bg-muted/30 border-border/20 focus:border-primary/50"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="backdrop-blur-sm border-border/20"
                onClick={loadDocuments}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Filter className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Knowledge Base Table */}
        <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-card hover:shadow-glow transition-all duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-foreground flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-glow"></div>
              <span>Knowledge Base Articles</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border/20 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/50">
                    <TableHead className="text-foreground font-semibold">Name</TableHead>
                    <TableHead className="text-foreground font-semibold">Category</TableHead>
                    <TableHead className="text-foreground font-semibold">Last Updated</TableHead>
                    <TableHead className="text-foreground font-semibold">Author</TableHead>
                    <TableHead className="text-foreground font-semibold">Status</TableHead>
                    <TableHead className="text-right text-foreground font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <div className="flex items-center justify-center space-x-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Loading documents...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredDocuments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <div className="flex flex-col items-center space-y-2">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                          <span className="text-muted-foreground">No documents found</span>
                          <span className="text-sm text-muted-foreground">
                            {searchTerm ? 'Try adjusting your search terms' : 'Upload your first document to get started'}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDocuments.map((doc, index) => (
                      <TableRow key={doc.id || `doc-${index}`} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="font-medium flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span>{doc.name}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-primary/20 text-primary bg-primary/10">
                            {doc.metadata?.category || 'general'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {doc.metadata?.author || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={doc.status === "processed" ? "default" : "secondary"}
                            className={doc.status === "processed"
                              ? "bg-green-500/20 text-green-500 border-green-500/20"
                              : doc.status === "processing"
                                ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/20"
                                : "bg-red-500/20 text-red-500 border-red-500/20"
                            }
                          >
                            {doc.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="hover:bg-primary/10"
                              title="Edit document"
                              disabled={isLoading}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="hover:bg-destructive/10 hover:text-destructive"
                              title="Delete document"
                              onClick={() => handleDeleteDocument(doc.metadata?.key, doc.name)}
                              disabled={isLoading}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-card hover:shadow-glow transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-primary opacity-10 rounded-full -mr-8 -mt-8"></div>
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center mb-3">
                <div className="p-3 bg-primary/20 rounded-xl">
                  <DatabaseIcon className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground mb-1">{documents.length}</div>
              <div className="text-sm text-muted-foreground">Total Documents</div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-card hover:shadow-glow transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-accent opacity-10 rounded-full -mr-8 -mt-8"></div>
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center mb-3">
                <div className="p-3 bg-green-500/20 rounded-xl">
                  <FileText className="h-6 w-6 text-green-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground mb-1">
                {documents.filter(doc => doc.status === 'processed').length}
              </div>
              <div className="text-sm text-muted-foreground">Processed Documents</div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-card hover:shadow-glow transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-primary opacity-10 rounded-full -mr-8 -mt-8"></div>
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center mb-3">
                <div className="p-3 bg-yellow-500/20 rounded-xl">
                  <Edit className="h-6 w-6 text-yellow-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground mb-1">
                {documents.filter(doc => doc.status === 'processing' || doc.status === 'uploaded').length}
              </div>
              <div className="text-sm text-muted-foreground">Processing/Pending</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseManagement;