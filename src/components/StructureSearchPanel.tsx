import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  FileText, 
  Table, 
  Image, 
  Heading, 
  Filter,
  X,
  ChevronRight,
  Clock,
  BarChart3
} from 'lucide-react';
import { DocumentSource } from '@/lib/chatbot-api';

interface StructureSearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSourceSelect: (source: DocumentSource) => void;
  apiBaseUrl: string;
}

type StructureType = 'all' | 'headings' | 'tables' | 'figures';

const StructureSearchPanel: React.FC<StructureSearchPanelProps> = ({
  isOpen,
  onClose,
  onSourceSelect,
  apiBaseUrl
}) => {
  const [query, setQuery] = useState('');
  const [structureType, setStructureType] = useState<StructureType>('all');
  const [results, setResults] = useState<DocumentSource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const structureTypes = [
    { id: 'all', label: 'All Content', icon: FileText, color: 'bg-blue-100 text-blue-800' },
    { id: 'headings', label: 'Headings', icon: Heading, color: 'bg-green-100 text-green-800' },
    { id: 'tables', label: 'Tables', icon: Table, color: 'bg-orange-100 text-orange-800' },
    { id: 'figures', label: 'Figures', icon: Image, color: 'bg-purple-100 text-purple-800' }
  ];

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/rag-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'search_by_structure',
          query: query.trim(),
          structure_type: structureType,
          limit: 10
        })
      });

      const data = await response.json();
      setResults(data.results || []);
      
      // Add to search history
      if (!searchHistory.includes(query.trim())) {
        setSearchHistory(prev => [query.trim(), ...prev.slice(0, 4)]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
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

  const formatContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <Search className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Structure-Based Search</h2>
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

        <div className="flex h-[calc(90vh-80px)]">
          {/* Search Panel */}
          <div className="w-1/3 border-r border-border p-4 space-y-4">
            {/* Search Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search Query</label>
              <div className="flex space-x-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter search terms..."
                  className="flex-1"
                />
                <Button
                  onClick={handleSearch}
                  disabled={isLoading || !query.trim()}
                  size="sm"
                >
                  {isLoading ? (
                    <Clock className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Structure Type Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search In</label>
              <div className="grid grid-cols-2 gap-2">
                {structureTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <Button
                      key={type.id}
                      variant={structureType === type.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStructureType(type.id as StructureType)}
                      className="justify-start h-auto p-2"
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      <span className="text-xs">{type.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Search History */}
            {searchHistory.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Recent Searches</label>
                <div className="space-y-1">
                  {searchHistory.map((term, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuery(term)}
                      className="w-full justify-start text-left h-auto p-2 text-xs"
                    >
                      <Search className="h-3 w-3 mr-2" />
                      {term}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Results Panel */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Search Results ({results.length})
                </h3>
                {results.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {structureType === 'all' ? 'All Content' : structureTypes.find(t => t.id === structureType)?.label}
                  </Badge>
                )}
              </div>

              {results.length === 0 && !isLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No results found. Try a different search term or structure type.</p>
                </div>
              )}

              {results.map((result, index) => (
                <Card
                  key={result.chunk_id || index}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onSourceSelect(result)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        {getElementIcon(result.element_type)}
                        <CardTitle className="text-sm font-medium">
                          {result.source}
                        </CardTitle>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant="outline"
                          className={`text-xs ${getElementColor(result.element_type)}`}
                        >
                          {result.element_type}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(result.similarity_score * 100)}% match
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground mb-2">
                      {formatContent(result.content)}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center space-x-4">
                        <span>Page {result.page_number}</span>
                        <span>Level {result.hierarchy_level}</span>
                        {result.docling_features?.visual_indicators?.has_position && (
                          <span className="flex items-center">
                            <BarChart3 className="h-3 w-3 mr-1" />
                            Positioned
                          </span>
                        )}
                      </div>
                      <div className="flex items-center">
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StructureSearchPanel;
