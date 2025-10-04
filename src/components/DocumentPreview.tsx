import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Download, 
  ExternalLink,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Search,
  MapPin,
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface DocumentSource {
  chunk_id?: string;
  document_id: string;
  source: string;
  s3_key: string;
  original_filename: string;
  page_number: number;
  element_type: string;
  hierarchy_level: number;
  similarity_score: number;
  content: string;
  metadata: any;
}

interface DocumentPreviewProps {
  sources: DocumentSource[];
  selectedSource?: DocumentSource;
  onSourceSelect?: (source: DocumentSource) => void;
  isOpen: boolean;
  onClose: () => void;
}

const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  sources,
  selectedSource,
  onSourceSelect,
  isOpen,
  onClose
}) => {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedChunk, setHighlightedChunk] = useState<string | null>(null);
  const [documentContent, setDocumentContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Get unique pages from sources
  const pages = Array.from(new Set(sources.map(s => s.page_number))).sort((a, b) => a - b);
  const currentPageSources = sources.filter(s => s.page_number === currentPage);

  // Load document content (simulated - in real implementation, this would fetch from S3)
  useEffect(() => {
    if (selectedSource) {
      setIsLoading(true);
      // Simulate loading document content
      setTimeout(() => {
        setDocumentContent(`
          <div class="document-content">
            <h1>Sample Document: ${selectedSource.original_filename}</h1>
            <p>This is a preview of the document content. In a real implementation, this would be loaded from S3 or a document service.</p>
            <h2>Page ${currentPage}</h2>
            <p>Content for page ${currentPage} would be displayed here with proper formatting and layout.</p>
            ${currentPageSources.map(source => `
              <div class="source-highlight" data-chunk-id="${source.chunk_id}" style="background-color: rgba(59, 130, 246, 0.1); padding: 8px; margin: 4px 0; border-left: 3px solid #3b82f6;">
                <strong>${source.element_type}</strong> (Level ${source.hierarchy_level})
                <p>${source.content}</p>
              </div>
            `).join('')}
          </div>
        `);
        setIsLoading(false);
      }, 500);
    }
  }, [selectedSource, currentPage, currentPageSources]);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 25, 50));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= pages.length) {
      setCurrentPage(page);
    }
  };

  const handleSourceClick = (source: DocumentSource) => {
    setHighlightedChunk(source.chunk_id || null);
    onSourceSelect?.(source);
    // Scroll to the highlighted element
    setTimeout(() => {
      const element = document.querySelector(`[data-chunk-id="${source.chunk_id}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
  };

  const getElementTypeIcon = (elementType: string) => {
    const type = elementType.toLowerCase();
    if (type.includes('title') || type.includes('heading')) return '📄';
    if (type.includes('table')) return '📊';
    if (type.includes('figure') || type.includes('image')) return '🖼️';
    if (type.includes('list')) return '📋';
    return '📝';
  };

  const getSimilarityColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50';
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-50';
    return 'text-orange-600 bg-orange-50';
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 ${
      isFullscreen ? 'p-0' : ''
    }`}>
      <Card className={`w-full h-full flex flex-col ${
        isFullscreen ? 'max-w-none max-h-none' : 'max-w-6xl max-h-[90vh]'
      }`}>
        <CardHeader className="flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedSource?.original_filename || 'Document Preview'}
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search in document..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-48 pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={handleZoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2 min-w-[3rem] text-center">{zoomLevel}%</span>
                <Button variant="outline" size="sm" onClick={handleZoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleResetZoom}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>

              {/* Page Navigation */}
              {pages.length > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm px-2">
                    {currentPage} / {pages.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= pages.length}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* View Controls */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAnnotations(!showAnnotations)}
              >
                {showAnnotations ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Document Content */}
          <div className="flex-1 p-4 overflow-y-auto" ref={containerRef}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading document...</p>
                </div>
              </div>
            ) : (
              <div
                ref={contentRef}
                className="document-preview"
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: 'top left',
                  width: `${100 / (zoomLevel / 100)}%`
                }}
                dangerouslySetInnerHTML={{
                  __html: highlightText(documentContent, searchTerm)
                }}
              />
            )}
          </div>

          {/* Sidebar with Sources */}
          {showAnnotations && (
            <div className="w-80 border-l p-4 overflow-y-auto">
              <h3 className="font-semibold mb-4">Page {currentPage} Sources</h3>
              <div className="space-y-2">
                {currentPageSources.map((source, index) => (
                  <Card
                    key={source.chunk_id || index}
                    className={`cursor-pointer transition-colors ${
                      highlightedChunk === source.chunk_id
                        ? 'ring-2 ring-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleSourceClick(source)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">
                              {getElementTypeIcon(source.element_type)}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-xs ${getSimilarityColor(source.similarity_score)}`}
                            >
                              {Math.round(source.similarity_score * 100)}%
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Badge variant="outline" className="text-xs">
                              {source.element_type}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Level {source.hierarchy_level}
                            </Badge>
                          </div>

                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {source.content}
                          </p>
                        </div>
                        <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {currentPageSources.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No sources on this page</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default DocumentPreview;
