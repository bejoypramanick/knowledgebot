import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Search, Plus, Edit, Trash2, Filter, FileText, Database as DatabaseIcon, Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
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

const KnowledgeBaseManagement = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMetadata, setUploadMetadata] = useState<Partial<DocumentMetadata>>({
    title: '',
    category: 'general',
    tags: [],
    author: ''
  });
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const knowledgeBaseManager = new KnowledgeBaseManager(AWS_CONFIG.endpoints.apiGateway);

  // Load documents on component mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await knowledgeBaseManager.getDocuments();
      // Transform the response data to match our Document interface
      const transformedDocuments = (response.documents || []).map((doc: any) => ({
        id: doc.chunk_id || doc.document_id || Math.random().toString(),
        name: doc.title || doc.metadata?.source || 'Unknown Document',
        type: doc.metadata?.document_type || 'txt',
        status: doc.status || 'processed',
        chunks: doc.chunks_count ? [doc] : [],
        metadata: {
          title: doc.title || doc.metadata?.source,
          category: doc.metadata?.category || 'general',
          tags: doc.metadata?.tags || [],
          author: doc.metadata?.author || 'unknown',
          sourceUrl: doc.metadata?.sourceUrl
        },
        createdAt: doc.created_at || new Date().toISOString(),
        updatedAt: doc.created_at || new Date().toISOString()
      }));
      setDocuments(transformedDocuments);
    } catch (err) {
      console.error('Error loading documents:', err);
      setError('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadMetadata(prev => ({
        ...prev,
        title: file.name.split('.')[0] // Use filename without extension as default title
      }));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);
      setSuccess(null);

      // Step 1: Get presigned URL
      setUploadProgress(10);
      const presignedResponse = await knowledgeBaseManager.getPresignedUploadUrl(selectedFile, uploadMetadata);
      
      // Step 2: Upload to S3
      setUploadProgress(30);
      await knowledgeBaseManager.uploadToS3(selectedFile, presignedResponse.presigned_url, uploadMetadata);
      
      // Step 2.5: Update S3 object metadata (if needed)
      if (presignedResponse.metadata) {
        await knowledgeBaseManager.updateS3ObjectMetadata(presignedResponse.s3_key, presignedResponse.metadata);
      }
      
      // Step 3: Wait for processing (simulate progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setSuccess(`Document uploaded successfully! Processing will begin shortly.`);
      
      // Reset form
      setSelectedFile(null);
      setUploadMetadata({
        title: '',
        category: 'general',
        tags: [],
        author: ''
      });
      
      // Reload documents
      await loadDocuments();
      
      // Close dialog after a delay
      setTimeout(() => {
        setIsUploadDialogOpen(false);
        setSuccess(null);
        setUploadProgress(0);
      }, 2000);

    } catch (err) {
      console.error('Error uploading document:', err);
      setError('Failed to upload document. Please try again.');
    } finally {
      setIsUploading(false);
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
    <div className="min-h-screen bg-gradient-secondary">
      <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Knowledge-base Management</h1>
            <p className="text-muted-foreground">Manage your AI assistant's knowledge and training data</p>
          </div>
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary border-0 shadow-glow">
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Upload Document to Knowledge Base</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Upload documents to enhance your chatbot's knowledge base
                </p>
              </DialogHeader>
              <div className="space-y-4">
                {/* File Selection */}
                <div className="space-y-2">
                  <Label htmlFor="file">Select Document</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    onChange={handleFileSelect}
                    className="cursor-pointer"
                  />
                  {selectedFile && (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>{selectedFile.name}</span>
                      <span className="text-xs">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                  )}
                </div>

                {/* Metadata Fields */}
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={uploadMetadata.title || ''}
                    onChange={(e) => setUploadMetadata(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Document title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={uploadMetadata.category || ''}
                    onChange={(e) => setUploadMetadata(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="e.g., Documentation, FAQ, Policy"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="author">Author</Label>
                  <Input
                    id="author"
                    value={uploadMetadata.author || ''}
                    onChange={(e) => setUploadMetadata(prev => ({ ...prev, author: e.target.value }))}
                    placeholder="Author name"
                  />
                </div>

                {/* Progress Bar */}
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {uploadProgress < 30 ? 'Getting upload URL...' :
                         uploadProgress < 90 ? 'Uploading to S3...' :
                         'Processing document...'}
                      </span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="w-full" />
                  </div>
                )}

                {/* Success/Error Messages */}
                {success && (
                  <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-3 rounded-lg">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">{success}</span>
                  </div>
                )}

                {error && (
                  <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsUploadDialogOpen(false)}
                    disabled={isUploading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || isUploading}
                    className="bg-gradient-primary"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

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
                            <Button variant="ghost" size="sm" className="hover:bg-primary/10">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="hover:bg-destructive/10 hover:text-destructive">
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