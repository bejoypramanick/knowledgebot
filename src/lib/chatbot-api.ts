import axios from 'axios';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string;
  metadata?: {
    sources?: any[];
    orderStatus?: any;
  };
}

export interface ChatSession {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSource {
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
  // Enhanced Docling fields
  docling_features?: {
    element_type: string;
    is_structural: boolean;
    is_visual: boolean;
    is_tabular: boolean;
    hierarchy_info: {
      level: number;
      parent_id?: string;
      has_children: boolean;
    };
    visual_indicators: {
      has_position: boolean;
      has_color: boolean;
      position?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    };
  };
  // Enhanced metadata with Docling features
  docling_element_type?: string;
  visual_position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  document_structure?: {
    hierarchy_level: number;
    parent_id?: string;
    is_heading: boolean;
    is_table: boolean;
    is_figure: boolean;
  };
  processing_info?: {
    processed_at: string;
    source: string;
    page_number: number;
    s3_key: string;
    s3_bucket: string;
  };
}

export interface ChatResponse {
  response: string;
  session_id: string;
  timestamp: string;
  sources: DocumentSource[];
}

export interface OrderStatus {
  order_id: string;
  status: string;
  customer_name: string;
  customer_email: string;
  order_date: string;
  total_amount: number;
  items: any[];
  tracking_number?: string;
  estimated_delivery?: string;
  last_updated: string;
}

export class ChatbotAPI {
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async createChatSession(): Promise<ChatSession> {
    // Generate a session ID on the frontend since backend doesn't have a session creation endpoint
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      id: sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  async sendMessage(message: string, sessionId: string): Promise<ChatResponse> {
    const payload = { 
      action: 'chat',
      message, 
      conversation_id: sessionId,
      use_rag: true
    };
    const response = await axios.post(`${this.apiBaseUrl}/chat`, payload);
    
    // Map Lambda response to frontend expected format
    const data = response.data;
    return {
      response: data.response,
      session_id: data.conversation_id,
      timestamp: data.timestamp,
      sources: data.sources || []
    };
  }

  async getOrderStatus(orderId: string, customerEmail?: string): Promise<OrderStatus> {
    const payload = { 
      order_id: orderId,
      customer_email: customerEmail 
    };
    const response = await axios.post(`${this.apiBaseUrl}/orders`, payload);
    return response.data;
  }

  async initializeSampleOrders(): Promise<any> {
    const response = await axios.post(`${this.apiBaseUrl}/orders`, { action: 'init' });
    return response.data;
  }

  // Enhanced Docling search methods
  async searchWithDocling(query: string, limit: number = 5): Promise<{
    results: DocumentSource[];
    query: string;
    count: number;
    search_method: string;
    features: string[];
  }> {
    const payload = {
      action: 'search',
      query,
      limit
    };
    const response = await axios.post(`${this.apiBaseUrl}/rag-search`, payload);
    return response.data;
  }

  async searchByStructure(
    query: string, 
    structureType: 'headings' | 'tables' | 'figures' | 'all' = 'all',
    limit: number = 5
  ): Promise<{
    results: DocumentSource[];
    query: string;
    structure_type: string;
    count: number;
    search_method: string;
  }> {
    const payload = {
      action: 'search_by_structure',
      query,
      structure_type: structureType,
      limit
    };
    const response = await axios.post(`${this.apiBaseUrl}/rag-search`, payload);
    return response.data;
  }

  async getDocumentVisualization(documentId: string): Promise<{
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
  }> {
    const payload = {
      action: 'get_document_visualization',
      document_id: documentId
    };
    const response = await axios.post(`${this.apiBaseUrl}/rag-search`, payload);
    return response.data;
  }

  async generateEmbeddings(text: string): Promise<{
    embedding: number[];
    text: string;
    dimension: number;
    model: string;
  }> {
    const payload = {
      action: 'generate_embeddings',
      text
    };
    const response = await axios.post(`${this.apiBaseUrl}/rag-search`, payload);
    return response.data;
  }
}



