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

import axios from 'axios';

export interface WebSocketMessage {
  type: 'typing' | 'response' | 'error';
  message: string;
  conversation_id?: string;
  metadata?: any;
  timestamp: string;
}

export class ChatbotAPI {
  private websocketUrl: string;
  private apiBaseUrl: string;
  private websocket: WebSocket | null = null;
  private isConnected: boolean = false;
  private messageHandlers: Map<string, (response: ChatResponse) => void> = new Map();
  private connectionHandlers: ((connected: boolean) => void)[] = [];
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(websocketUrl: string, apiBaseUrl?: string) {
    this.websocketUrl = websocketUrl;
    this.apiBaseUrl = apiBaseUrl || 'https://a1kn0j91k8.execute-api.ap-south-1.amazonaws.com/prod';
  }

  async createChatSession(): Promise<ChatSession> {
    // Generate a session ID on the frontend
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      id: sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Attempting to connect to WebSocket: ${this.websocketUrl}`);
        this.websocket = new WebSocket(this.websocketUrl);
        
        this.websocket.onopen = () => {
          console.log('WebSocket connected successfully');
          this.isConnected = true;
          this.reconnectAttempts = 0; // Reset reconnection attempts on successful connection
          this.connectionHandlers.forEach(handler => handler(true));
          resolve();
        };
        
        this.websocket.onmessage = (event) => {
          try {
            const data: WebSocketMessage = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        this.websocket.onclose = (event) => {
          console.log('WebSocket disconnected', event.code, event.reason);
          this.isConnected = false;
          this.connectionHandlers.forEach(handler => handler(false));
          
          // Only attempt to reconnect if we haven't exceeded max attempts
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            this.reconnectTimeout = setTimeout(() => {
              if (!this.isConnected) {
                this.connect().catch((error) => {
                  console.error('Reconnection failed:', error);
                });
              }
            }, 3000);
          } else {
            console.error('Max reconnection attempts reached. WebSocket connection failed permanently.');
          }
        };
        
        this.websocket.onerror = (error) => {
          console.error('WebSocket error:', error);
          console.log(`WebSocket connection failed (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
          
          // If this is the first connection attempt and it fails, reject the promise
          if (this.reconnectAttempts === 0) {
            reject(new Error('WebSocket connection failed'));
          }
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleWebSocketMessage(data: WebSocketMessage) {
    switch (data.type) {
      case 'response':
        // Find the handler for this message
        const messageId = data.conversation_id || 'default';
        const handler = this.messageHandlers.get(messageId);
        
        if (handler) {
          const chatResponse: ChatResponse = {
            response: data.message,
            session_id: data.conversation_id || '',
            timestamp: data.timestamp,
            sources: data.metadata?.sources || []
          };
          handler(chatResponse);
          this.messageHandlers.delete(messageId);
        }
        break;
        
      case 'error':
        console.error('WebSocket error message:', data.message);
        break;
        
      case 'typing':
        // Handle typing indicator if needed
        break;
    }
  }

  async sendMessage(message: string, sessionId: string): Promise<ChatResponse> {
    if (!this.isConnected || !this.websocket) {
      // Return a fallback response when websocket is not connected
      return {
        response: "I'm currently unable to connect to the server. Please check your internet connection and try again later.",
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        sources: []
      };
    }

    return new Promise((resolve, reject) => {
      const messageId = sessionId;
      
      // Set up handler for this specific message
      this.messageHandlers.set(messageId, resolve);
      
      // Send message via WebSocket
      const payload = {
        action: 'message',
        query: message,
        conversation_history: [] // You might want to pass conversation history here
      };
      
      try {
        this.websocket!.send(JSON.stringify(payload));
        
        // Set timeout for response
        setTimeout(() => {
          if (this.messageHandlers.has(messageId)) {
            this.messageHandlers.delete(messageId);
            reject(new Error('Message timeout - no response received'));
          }
        }, 30000); // 30 second timeout
        
      } catch (error) {
        this.messageHandlers.delete(messageId);
        reject(error);
      }
    });
  }

  onConnectionChange(handler: (connected: boolean) => void) {
    this.connectionHandlers.push(handler);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
      this.isConnected = false;
    }
    
    this.reconnectAttempts = 0;
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



