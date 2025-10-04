import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  MapPin, 
  Eye, 
  ExternalLink,
  BookOpen,
  Layers,
  Search,
  Filter
} from 'lucide-react';

interface DocumentElement {
  chunk_id: string;
  content: string;
  hierarchy_level: number;
  page_number: number;
  element_type: string;
  parent_id?: string;
  children?: DocumentElement[];
  metadata: any;
}

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

interface DocumentContextPanelProps {
  sources: DocumentSource[];
  selectedSource?: DocumentSource;
  onSourceSelect?: (source: DocumentSource) => void;
  onElementSelect?: (element: DocumentElement) => void;
  isOpen: boolean;
  onClose: () => void;
}

const DocumentContextPanel: React.FC<DocumentContextPanelProps> = ({
  sources,
  selectedSource,
  onSourceSelect,
  onElementSelect,
  isOpen,
  onClose
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [documentStructure, setDocumentStructure] = useState<DocumentElement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyRelevant, setShowOnlyRelevant] = useState(false);

  // Build hierarchical document structure from sources
  useEffect(() => {
    if (sources.length === 0) {
      setDocumentStructure([]);
      return;
    }

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
          elements: []
        };
      }
      acc[key].elements.push(source);
      return acc;
    }, {} as Record<string, { document: any; elements: DocumentSource[] }>);

    // Convert to hierarchical structure
    const structure: DocumentElement[] = Object.values(documentsBySource).map(({ document, elements }) => {
      // Sort elements by page and hierarchy level
      const sortedElements = elements.sort((a, b) => {
        if (a.page_number !== b.page_number) {
          return a.page_number - b.page_number;
        }
        return a.hierarchy_level - b.hierarchy_level;
      });

      // Build hierarchy
      const buildHierarchy = (elements: DocumentSource[]): DocumentElement[] => {
        const result: DocumentElement[] = [];
        const elementMap = new Map<string, DocumentElement>();

        // Create elements
        elements.forEach(source => {
          const element: DocumentElement = {
            chunk_id: source.chunk_id || Math.random().toString(),
            content: source.content,
            hierarchy_level: source.hierarchy_level,
            page_number: source.page_number,
            element_type: source.element_type,
            metadata: source.metadata,
            children: []
          };
          elementMap.set(element.chunk_id, element);
        });

        // Build parent-child relationships
        elements.forEach(source => {
          const element = elementMap.get(source.chunk_id || '');
          if (element) {
            // Find parent (most recent element with lower hierarchy level)
            const parent = Array.from(elementMap.values())
              .filter(e => e.hierarchy_level < element.hierarchy_level && e.page_number <= element.page_number)
              .sort((a, b) => b.page_number - a.page_number || b.hierarchy_level - a.hierarchy_level)[0];

            if (parent) {
              if (!parent.children) parent.children = [];
              parent.children.push(element);
              element.parent_id = parent.chunk_id;
            } else {
              result.push(element);
            }
          }
        });

        return result;
      };

      return {
        chunk_id: document.document_id,
        content: document.original_filename,
        hierarchy_level: 0, // Document level
        page_number: 0,
        element_type: 'document',
        metadata: document.metadata,
        children: buildHierarchy(sortedElements)
      };
    });

    setDocumentStructure(structure);
  }, [sources]);

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
    if (hierarchyLevel === 0) return <FileText className="h-4 w-4" />;
    if (hierarchyLevel === 1) return <BookOpen className="h-4 w-4" />;
    if (hierarchyLevel === 2) return <Layers className="h-4 w-4" />;
    if (elementType.toLowerCase().includes('table')) return '📊';
    if (elementType.toLowerCase().includes('figure')) return '🖼️';
    return '📝';
  };

  const getHierarchyColor = (level: number) => {
    const colors = [
      'text-blue-600', // Document
      'text-green-600', // Level 1
      'text-orange-600', // Level 2
      'text-purple-600', // Level 3
      'text-gray-600', // Level 4+
    ];
    return colors[Math.min(level, colors.length - 1)];
  };

  const getIndentClass = (level: number) => {
    return `ml-${Math.min(level * 4, 16)}`;
  };

  const isRelevant = (element: DocumentElement): boolean => {
    if (!showOnlyRelevant) return true;
    return sources.some(source => source.chunk_id === element.chunk_id);
  };

  const matchesSearch = (element: DocumentElement): boolean => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      element.content.toLowerCase().includes(searchLower) ||
      element.element_type.toLowerCase().includes(searchLower)
    );
  };

  const renderElement = (element: DocumentElement, level: number = 0) => {
    const isExpanded = expandedSections.has(element.chunk_id);
    const hasChildren = element.children && element.children.length > 0;
    const isRelevantElement = isRelevant(element);
    const matchesSearchTerm = matchesSearch(element);

    if (!isRelevantElement || !matchesSearchTerm) return null;

    return (
      <div key={element.chunk_id} className="space-y-1">
        <div
          className={`flex items-start gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${
            selectedSource?.chunk_id === element.chunk_id ? 'bg-primary/10 ring-1 ring-primary' : ''
          }`}
          onClick={() => {
            if (element.hierarchy_level > 0) {
              // Find the corresponding source
              const source = sources.find(s => s.chunk_id === element.chunk_id);
              if (source) {
                onSourceSelect?.(source);
                onElementSelect?.(element);
              }
            }
          }}
        >
          <div className="flex items-center gap-1 flex-shrink-0">
            {hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSection(element.chunk_id);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
            )}
            <span className={getHierarchyColor(element.hierarchy_level)}>
              {getElementIcon(element.element_type, element.hierarchy_level)}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-sm font-medium ${getHierarchyColor(element.hierarchy_level)}`}>
                {element.content.length > 50
                  ? `${element.content.substring(0, 50)}...`
                  : element.content}
              </span>
              {element.hierarchy_level > 0 && (
                <Badge variant="outline" className="text-xs">
                  Page {element.page_number}
                </Badge>
              )}
            </div>
            
            {element.hierarchy_level > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-xs">
                  {element.element_type}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Level {element.hierarchy_level}
                </Badge>
                {sources.find(s => s.chunk_id === element.chunk_id) && (
                  <Badge variant="default" className="text-xs">
                    Relevant
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="ml-4 space-y-1">
            {element.children!.map(child => renderElement(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <Card className="w-80 h-full flex flex-col">
      <CardHeader className="flex-shrink-0 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Document Structure
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-4 space-y-4">
        {/* Search and Filter Controls */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search structure..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={showOnlyRelevant ? "default" : "outline"}
              size="sm"
              onClick={() => setShowOnlyRelevant(!showOnlyRelevant)}
              className="flex-1"
            >
              <Filter className="h-4 w-4 mr-1" />
              Relevant Only
            </Button>
          </div>
        </div>

        <Separator />

        {/* Document Structure */}
        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {documentStructure.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No document structure available</p>
              </div>
            ) : (
              documentStructure.map(document => renderElement(document))
            )}
          </div>
        </ScrollArea>

        {/* Summary */}
        {documentStructure.length > 0 && (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            {sources.length} relevant sections across {documentStructure.length} document{documentStructure.length !== 1 ? 's' : ''}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentContextPanel;
