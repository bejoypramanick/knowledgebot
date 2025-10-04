import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Heading, 
  Table, 
  Image, 
  ChevronRight, 
  ChevronDown,
  X,
  BarChart3,
  Layers,
  Eye,
  Navigation
} from 'lucide-react';
import { DocumentSource } from '@/lib/chatbot-api';

interface DocumentStructureViewerProps {
  isOpen: boolean;
  onClose: () => void;
  onSourceSelect: (source: DocumentSource) => void;
  documentId: string;
  apiBaseUrl: string;
}

interface DocumentStructure {
  document_id: string;
  total_chunks: number;
  structure: {
    headings: any[];
    tables: any[];
    figures: any[];
    text_blocks: any[];
  };
  visual_elements: any[];
  hierarchy_tree: Record<number, any[]>;
}

const DocumentStructureViewer: React.FC<DocumentStructureViewerProps> = ({
  isOpen,
  onClose,
  onSourceSelect,
  documentId,
  apiBaseUrl
}) => {
  const [structure, setStructure] = useState<DocumentStructure | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    if (isOpen && documentId) {
      loadDocumentStructure();
    }
  }, [isOpen, documentId]);

  const loadDocumentStructure = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/rag-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get_document_visualization',
          document_id: documentId
        })
      });

      const data = await response.json();
      setStructure(data);
    } catch (error) {
      console.error('Error loading document structure:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const getElementIcon = (elementType: string) => {
    if (elementType.toLowerCase().includes('heading') || elementType.toLowerCase().includes('title')) {
      return <Heading className="h-4 w-4" />;
    } else if (elementType.toLowerCase().includes('table')) {
      return <Table className="h-4 w-4" />;
    } else if (elementType.toLowerCase().includes('figure') || elementType.toLowerCase().includes('image')) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const getElementColor = (elementType: string) => {
    if (elementType.toLowerCase().includes('heading') || elementType.toLowerCase().includes('title')) {
      return 'bg-green-100 text-green-800 border-green-200';
    } else if (elementType.toLowerCase().includes('table')) {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    } else if (elementType.toLowerCase().includes('figure') || elementType.toLowerCase().includes('image')) {
      return 'bg-purple-100 text-purple-800 border-purple-200';
    }
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const renderHierarchyTree = () => {
    if (!structure?.hierarchy_tree) return null;

    const levels = Object.keys(structure.hierarchy_tree)
      .map(Number)
      .sort((a, b) => a - b);

    return (
      <div className="space-y-2">
        {levels.map(level => (
          <div key={level} className="space-y-1">
            <div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground">
              <Layers className="h-4 w-4" />
              Level {level} ({structure.hierarchy_tree[level].length} items)
            </div>
            <div className="ml-4 space-y-1">
              {structure.hierarchy_tree[level].map((item, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-2 p-2 rounded border border-border/50 hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    // Convert hierarchy item to DocumentSource format for selection
                    const source: DocumentSource = {
                      chunk_id: item.chunk_id,
                      document_id: structure.document_id,
                      source: 'Document Structure',
                      s3_key: '',
                      original_filename: 'Document',
                      page_number: 0,
                      element_type: item.element_type,
                      hierarchy_level: level,
                      similarity_score: 1.0,
                      content: item.content,
                      metadata: {}
                    };
                    onSourceSelect(source);
                  }}
                >
                  {getElementIcon(item.element_type)}
                  <span className="text-sm flex-1">{item.content}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderStructureSection = (title: string, items: any[], icon: React.ReactNode, color: string) => {
    const sectionId = title.toLowerCase().replace(' ', '-');
    const isExpanded = expandedSections.has(sectionId);

    return (
      <Card className="mb-4">
        <CardHeader
          className="pb-2 cursor-pointer"
          onClick={() => toggleSection(sectionId)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {icon}
              <CardTitle className="text-sm">{title}</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {items.length}
              </Badge>
            </div>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent className="pt-0">
            <div className="space-y-2">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-2 p-2 rounded border border-border/50 hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    const source: DocumentSource = {
                      chunk_id: item.chunk_id,
                      document_id: structure?.document_id || '',
                      source: 'Document Structure',
                      s3_key: '',
                      original_filename: 'Document',
                      page_number: item.page_number || 0,
                      element_type: item.element_type || title.slice(0, -1),
                      hierarchy_level: item.hierarchy_level || 0,
                      similarity_score: 1.0,
                      content: item.content,
                      metadata: {}
                    };
                    onSourceSelect(source);
                  }}
                >
                  <div className={`p-1 rounded ${color}`}>
                    {getElementIcon(item.element_type || title.slice(0, -1))}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.content}</p>
                    <p className="text-xs text-muted-foreground">
                      Page {item.page_number || 'N/A'} • Level {item.hierarchy_level || 'N/A'}
                    </p>
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <Navigation className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Document Structure</h2>
            {structure && (
              <Badge variant="outline" className="text-xs">
                {structure.document_id}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading document structure...</p>
            </div>
          ) : structure ? (
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="structure">Structure</TabsTrigger>
                <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Document Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{structure.total_chunks}</div>
                        <div className="text-sm text-muted-foreground">Total Chunks</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{structure.structure.headings.length}</div>
                        <div className="text-sm text-muted-foreground">Headings</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{structure.structure.tables.length}</div>
                        <div className="text-sm text-muted-foreground">Tables</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{structure.structure.figures.length}</div>
                        <div className="text-sm text-muted-foreground">Figures</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderStructureSection(
                    'Headings',
                    structure.structure.headings,
                    <Heading className="h-4 w-4" />,
                    'bg-green-100 text-green-800'
                  )}
                  {renderStructureSection(
                    'Tables',
                    structure.structure.tables,
                    <Table className="h-4 w-4" />,
                    'bg-orange-100 text-orange-800'
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderStructureSection(
                    'Figures',
                    structure.structure.figures,
                    <Image className="h-4 w-4" />,
                    'bg-purple-100 text-purple-800'
                  )}
                  {renderStructureSection(
                    'Text Blocks',
                    structure.structure.text_blocks,
                    <FileText className="h-4 w-4" />,
                    'bg-blue-100 text-blue-800'
                  )}
                </div>
              </TabsContent>

              <TabsContent value="structure" className="space-y-4">
                <div className="space-y-4">
                  {renderStructureSection(
                    'Headings',
                    structure.structure.headings,
                    <Heading className="h-4 w-4" />,
                    'bg-green-100 text-green-800'
                  )}
                  {renderStructureSection(
                    'Tables',
                    structure.structure.tables,
                    <Table className="h-4 w-4" />,
                    'bg-orange-100 text-orange-800'
                  )}
                  {renderStructureSection(
                    'Figures',
                    structure.structure.figures,
                    <Image className="h-4 w-4" />,
                    'bg-purple-100 text-purple-800'
                  )}
                  {renderStructureSection(
                    'Text Blocks',
                    structure.structure.text_blocks,
                    <FileText className="h-4 w-4" />,
                    'bg-blue-100 text-blue-800'
                  )}
                </div>
              </TabsContent>

              <TabsContent value="hierarchy" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Document Hierarchy</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Navigate through the document structure by hierarchy levels
                    </p>
                  </CardHeader>
                  <CardContent>
                    {renderHierarchyTree()}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No document structure available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentStructureViewer;
