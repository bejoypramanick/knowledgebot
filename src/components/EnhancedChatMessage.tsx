import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  FileText, 
  ExternalLink, 
  MapPin, 
  Eye, 
  ChevronDown, 
  ChevronRight,
  Copy,
  Check,
  Clock
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import DocumentViewer from './DocumentViewer';

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

interface EnhancedChatMessageProps {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string;
  sources?: DocumentSource[];
  onSourceClick?: (source: DocumentSource) => void;
}

const EnhancedChatMessage: React.FC<EnhancedChatMessageProps> = ({
  id,
  text,
  sender,
  timestamp,
  sources = [],
  onSourceClick
}) => {
  const [showSources, setShowSources] = useState(false);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [selectedSource, setSelectedSource] = useState<DocumentSource | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const handleSourceClick = (source: DocumentSource) => {
    setSelectedSource(source);
    setShowDocumentViewer(true);
    onSourceClick?.(source);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    
    // Format as DDD dd/MM/yyyy HH:mm:SS
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${dayOfWeek} ${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
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
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getSimilarityBadgeVariant = (score: number) => {
    if (score >= 0.8) return 'default';
    if (score >= 0.6) return 'secondary';
    return 'outline';
  };


  return (
    <>
      <div className={`flex ${sender === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`flex items-start space-x-2 ${isMobile ? 'max-w-xs' : 'max-w-xs lg:max-w-md'} ${sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
          {sender === 'bot' && (
            <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
              <FileText className="h-3 w-3 text-primary" />
            </div>
          )}
          
          <div className={`px-3 sm:px-4 py-3 rounded-2xl ${
            sender === 'user' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-card/80 backdrop-blur-sm border border-border/20 text-foreground'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm flex-1">{text}</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => copyToClipboard(text)}
              >
                {copiedText === text ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>

            {/* Enhanced Sources Display */}
            {sources && sources.length > 0 && sender === 'bot' && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 ${isMobile ? 'flex-wrap' : ''}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setShowSources(!showSources)}
                    >
                      {showSources ? (
                        <ChevronDown className="h-3 w-3 mr-1" />
                      ) : (
                        <ChevronRight className="h-3 w-3 mr-1" />
                      )}
                      {sources.length} source{sources.length !== 1 ? 's' : ''}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setShowDocumentViewer(true)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      {!isMobile && "View Documents"}
                    </Button>
                  </div>
                </div>

                {showSources && (
                  <div className="space-y-2">
                    {sources.map((source, index) => (
                      <Card
                        key={source.chunk_id || index}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleSourceClick(source)}
                      >
                        <CardContent className="p-2 sm:p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className={`flex items-center gap-2 mb-1 ${isMobile ? 'flex-wrap' : ''}`}>
                                <span className="text-sm">
                                  {getElementTypeIcon(source.element_type)}
                                </span>
                                <span className="text-xs font-medium truncate">
                                  {source.original_filename}
                                </span>
                                <Badge
                                  variant={getSimilarityBadgeVariant(source.similarity_score)}
                                  className={`text-xs ${getSimilarityColor(source.similarity_score)}`}
                                >
                                  {Math.round(source.similarity_score * 100)}%
                                </Badge>
                              </div>
                              
                              <div className={`flex items-center gap-2 text-xs text-muted-foreground ${isMobile ? 'flex-wrap' : ''}`}>
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  Page {source.page_number}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {source.element_type}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  Level {source.hierarchy_level}
                                </Badge>
                              </div>

                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {source.content.length > (isMobile ? 80 : 100)
                                  ? `${source.content.substring(0, isMobile ? 80 : 100)}...`
                                  : source.content}
                              </p>
                            </div>
                            <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className={`flex items-center gap-1 mt-2 ${
              sender === 'user' 
                ? 'text-primary-foreground/70' 
                : 'text-muted-foreground'
            }`}>
              <Clock className="h-3 w-3" />
              <span 
                className="text-xs cursor-help" 
                title={`Full timestamp: ${formatTimestamp(timestamp)}`}
              >
                {formatTimestamp(timestamp)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Document Viewer Modal */}
      {showDocumentViewer && (
        <DocumentViewer
          sources={sources}
          isOpen={showDocumentViewer}
          onClose={() => setShowDocumentViewer(false)}
          highlightedChunkId={selectedSource?.chunk_id}
        />
      )}
    </>
  );
};

export default EnhancedChatMessage;
