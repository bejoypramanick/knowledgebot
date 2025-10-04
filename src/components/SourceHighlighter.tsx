import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, 
  MapPin, 
  Eye, 
  EyeOff, 
  ChevronUp, 
  ChevronDown,
  RotateCcw,
  Filter,
  SortAsc,
  SortDesc
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

interface SourceHighlighterProps {
  sources: DocumentSource[];
  onSourceSelect?: (source: DocumentSource) => void;
  selectedSourceId?: string;
  className?: string;
}

const SourceHighlighter: React.FC<SourceHighlighterProps> = ({
  sources,
  onSourceSelect,
  selectedSourceId,
  className = ""
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'page' | 'type' | 'level'>('relevance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterBy, setFilterBy] = useState<'all' | 'titles' | 'content' | 'tables' | 'figures'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [highlightedText, setHighlightedText] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter and sort sources
  const filteredSources = sources
    .filter(source => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          source.content.toLowerCase().includes(searchLower) ||
          source.original_filename.toLowerCase().includes(searchLower) ||
          source.element_type.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .filter(source => {
      if (filterBy === 'all') return true;
      if (filterBy === 'titles') return source.hierarchy_level <= 2;
      if (filterBy === 'content') return source.hierarchy_level === 3;
      if (filterBy === 'tables') return source.element_type.toLowerCase().includes('table');
      if (filterBy === 'figures') return source.element_type.toLowerCase().includes('figure');
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'relevance':
          comparison = b.similarity_score - a.similarity_score;
          break;
        case 'page':
          comparison = a.page_number - b.page_number;
          break;
        case 'type':
          comparison = a.element_type.localeCompare(b.element_type);
          break;
        case 'level':
          comparison = a.hierarchy_level - b.hierarchy_level;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Highlight text in content
  const highlightText = (text: string, highlight: string) => {
    if (!highlight) return text;
    
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
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

  const getHierarchyColor = (level: number) => {
    const colors = [
      'text-blue-600 border-blue-200', // Level 1
      'text-green-600 border-green-200', // Level 2
      'text-orange-600 border-orange-200', // Level 3
      'text-purple-600 border-purple-200', // Level 4
    ];
    return colors[Math.min(level - 1, colors.length - 1)] || 'text-gray-600 border-gray-200';
  };

  const scrollToSource = (sourceId: string) => {
    const element = document.getElementById(`source-${sourceId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  useEffect(() => {
    if (selectedSourceId) {
      scrollToSource(selectedSourceId);
    }
  }, [selectedSourceId]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Search Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search sources..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-1" />
                Filters
              </Button>
            </div>

            {/* Filter Options */}
            {showFilters && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">Sort by</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full p-2 border rounded-md text-sm"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="page">Page Number</option>
                    <option value="type">Element Type</option>
                    <option value="level">Hierarchy Level</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Order</label>
                  <div className="flex gap-1">
                    <Button
                      variant={sortOrder === 'asc' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSortOrder('asc')}
                      className="flex-1"
                    >
                      <SortAsc className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={sortOrder === 'desc' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSortOrder('desc')}
                      className="flex-1"
                    >
                      <SortDesc className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium mb-1 block">Filter by type</label>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { key: 'all', label: 'All' },
                      { key: 'titles', label: 'Titles' },
                      { key: 'content', label: 'Content' },
                      { key: 'tables', label: 'Tables' },
                      { key: 'figures', label: 'Figures' }
                    ].map(filter => (
                      <Button
                        key={filter.key}
                        variant={filterBy === filter.key ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilterBy(filter.key as any)}
                        className="text-xs"
                      >
                        {filter.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sources List */}
      <div ref={containerRef} className="space-y-2">
        {filteredSources.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No sources found matching your criteria</p>
            </CardContent>
          </Card>
        ) : (
          filteredSources.map((source, index) => (
            <Card
              key={source.chunk_id || index}
              id={`source-${source.chunk_id || index}`}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                selectedSourceId === source.chunk_id
                  ? 'ring-2 ring-primary bg-primary/5'
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => onSourceSelect?.(source)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">
                        {getElementTypeIcon(source.element_type)}
                      </span>
                      <span className="font-medium text-sm truncate">
                        {source.original_filename}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${getSimilarityColor(source.similarity_score)}`}
                      >
                        {Math.round(source.similarity_score * 100)}%
                      </Badge>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Page {source.page_number}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs ${getHierarchyColor(source.hierarchy_level)}`}
                      >
                        Level {source.hierarchy_level}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {source.element_type}
                      </Badge>
                    </div>

                    {/* Content Preview */}
                    <div className="text-sm text-muted-foreground">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: highlightText(
                            source.content.length > 150
                              ? `${source.content.substring(0, 150)}...`
                              : source.content,
                            searchTerm
                          )
                        }}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSourceSelect?.(source);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Results Summary */}
      {filteredSources.length > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          Showing {filteredSources.length} of {sources.length} sources
        </div>
      )}
    </div>
  );
};

export default SourceHighlighter;
