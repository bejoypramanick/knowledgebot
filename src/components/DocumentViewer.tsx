import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Eye, 
  EyeOff, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  MapPin,
  Calendar,
  User
} from 'lucide-react';

interface DocumentElement {
  chunk_id: string;
  content: string;
  hierarchy_level: number;
  page_number: number;
  element_type: string;
  parent_id?: string;
  metadata: {
    source: string;
    document_id: string;
    s3_key: string;
    original_filename: string;
    processed_at: string;
  };
}

interface DocumentSource {
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

interface DocumentViewerProps {
  sources: DocumentSource[];
  isOpen: boolean;
  onClose: () => void;
  highlightedChunkId?: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  sources,
  isOpen,
  onClose,
  highlightedChunkId
}) => {
  const [selectedDocument, setSelectedDocument] = useState<DocumentSource | null>(null);
  const [documentElements, setDocumentElements] = useState<DocumentElement[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showHierarchy, setShowHierarchy] = useState(true);

  // Group sources by document
  const documentsBySource = sources.reduce((acc, source) => {
    const key = source.document_id;
    if (!acc[key]) {
      acc[key] = {
        document: {
          document_id: source.document_id,
          source: source.source,
          s3_key: source.s3_key,
          original_filename: source.original_filename,
          metadata: source.metadata
        },
        chunks: []
      };
    }
    acc[key].chunks.push(source);
    return acc;
  }, {} as Record<string, { document: any; chunks: DocumentSource[] }>);

  // Load document elements when a document is selected
  useEffect(() => {
    if (selectedDocument) {
      loadDocumentElements(selectedDocument.document_id);
    }
  }, [selectedDocument]);

  const loadDocumentElements = async (documentId: string) => {
    try {
      // This would call your backend API to get full document content
      // For now, we'll simulate with the available chunks
      const documentChunks = Object.values(documentsBySource)
        .find(doc => doc.document.document_id === documentId)?.chunks || [];
      
      const elements: DocumentElement[] = documentChunks.map(chunk => ({
        chunk_id: chunk.chunk_id || Math.random().toString(),
        content: chunk.content,
        hierarchy_level: chunk.hierarchy_level,
        page_number: chunk.page_number,
        element_type: chunk.element_type,
        metadata: chunk.metadata
      }));

      setDocumentElements(elements);
    } catch (error) {
      console.error('Error loading document elements:', error);
    }
  };

  const toggleSection = (chunkId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(chunkId)) {
      newExpanded.delete(chunkId);
    } else {
      newExpanded.add(chunkId);
    }
    setExpandedSections(newExpanded);
  };

  const getElementIcon = (elementType: string, hierarchyLevel: number) => {
    if (hierarchyLevel === 1) return '📄';
    if (hierarchyLevel === 2) return '📋';
    if (elementType.toLowerCase().includes('table')) return '📊';
    if (elementType.toLowerCase().includes('figure')) return '🖼️';
    return '📝';
  };

  const getHierarchyColor = (level: number) => {
    const colors = [
      'text-blue-600', // Level 1 - Titles
      'text-green-600', // Level 2 - Subtitles
      'text-orange-600', // Level 3 - Content
      'text-purple-600', // Level 4 - Details
    ];
    return colors[Math.min(level - 1, colors.length - 1)] || 'text-gray-600';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Document Sources
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHierarchy(!showHierarchy)}
              >
                {showHierarchy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showHierarchy ? 'Hide' : 'Show'} Structure
              </Button>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2">{zoomLevel}%</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={onClose}>
                <EyeOff className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Document List Sidebar */}
          <div className="w-1/3 border-r p-4 overflow-y-auto">
            <h3 className="font-semibold mb-4">Available Documents</h3>
            <div className="space-y-2">
              {Object.values(documentsBySource).map(({ document, chunks }) => (
                <Card
                  key={document.document_id}
                  className={`cursor-pointer transition-colors ${
                    selectedDocument?.document_id === document.document_id
                      ? 'ring-2 ring-primary'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedDocument(chunks[0])}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">
                          {document.original_filename}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {chunks.length} relevant sections
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            Page {Math.min(...chunks.map(c => c.page_number))}
                            {Math.min(...chunks.map(c => c.page_number)) !== 
                             Math.max(...chunks.map(c => c.page_number)) && 
                             `-${Math.max(...chunks.map(c => c.page_number))}`}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {Math.round(chunks[0].similarity_score * 100)}% match
                          </Badge>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Document Content */}
          <div className="flex-1 p-4 overflow-y-auto">
            {selectedDocument ? (
              <div style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left' }}>
                <div className="mb-6">
                  <h2 className="text-xl font-bold mb-2">
                    {selectedDocument.original_filename}
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      Page {selectedDocument.page_number}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(selectedDocument.metadata?.processed_at || new Date().toISOString())}
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {selectedDocument.metadata?.author || 'Unknown'}
                    </div>
                  </div>
                </div>

                {showHierarchy ? (
                  <div className="space-y-2">
                    {documentElements
                      .sort((a, b) => a.page_number - b.page_number || a.hierarchy_level - b.hierarchy_level)
                      .map((element, index) => {
                        const isHighlighted = highlightedChunkId === element.chunk_id;
                        const isExpanded = expandedSections.has(element.chunk_id);
                        const hasChildren = documentElements.some(e => e.parent_id === element.chunk_id);

                        return (
                          <div
                            key={element.chunk_id}
                            className={`border rounded-lg transition-colors ${
                              isHighlighted
                                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div
                              className="p-3 cursor-pointer"
                              onClick={() => hasChildren && toggleSection(element.chunk_id)}
                            >
                              <div className="flex items-start gap-2">
                                {hasChildren && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-lg">
                                      {getElementIcon(element.element_type, element.hierarchy_level)}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${getHierarchyColor(element.hierarchy_level)}`}
                                    >
                                      Level {element.hierarchy_level}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                      {element.element_type}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      Page {element.page_number}
                                    </Badge>
                                  </div>
                                  <p className={`text-sm ${getHierarchyColor(element.hierarchy_level)} font-medium`}>
                                    {element.content.length > 200
                                      ? `${element.content.substring(0, 200)}...`
                                      : element.content}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {hasChildren && isExpanded && (
                              <div className="border-t bg-muted/30 p-3">
                                {documentElements
                                  .filter(e => e.parent_id === element.chunk_id)
                                  .map(child => (
                                    <div
                                      key={child.chunk_id}
                                      className="ml-6 p-2 border-l-2 border-muted-foreground/30"
                                    >
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm">
                                          {getElementIcon(child.element_type, child.hierarchy_level)}
                                        </span>
                                        <Badge
                                          variant="outline"
                                          className={`text-xs ${getHierarchyColor(child.hierarchy_level)}`}
                                        >
                                          Level {child.hierarchy_level}
                                        </Badge>
                                      </div>
                                      <p className="text-sm text-muted-foreground">
                                        {child.content}
                                      </p>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="prose max-w-none">
                    {documentElements
                      .sort((a, b) => a.page_number - b.page_number)
                      .map((element, index) => (
                        <div
                          key={element.chunk_id}
                          className={`mb-4 p-4 rounded-lg ${
                            highlightedChunkId === element.chunk_id
                              ? 'bg-primary/5 border border-primary'
                              : 'bg-muted/30'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              Page {element.page_number}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {element.element_type}
                            </Badge>
                          </div>
                          <p className="text-sm leading-relaxed">
                            {element.content}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a document to view its content</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DocumentViewer;
