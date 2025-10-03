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

export interface ChatResponse {
  response: string;
  session_id: string;
  timestamp: string;
  sources: any[];
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
      message, 
      session_id: sessionId,
      user_id: 'anonymous' // Default user ID
    };
    const response = await axios.post(`${this.apiBaseUrl}/chat`, payload);
    return response.data;
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
}



