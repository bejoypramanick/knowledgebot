export const AWS_CONFIG = {
  region: 'us-east-1',
  endpoints: {
    // WebSocket API Gateway endpoint (legacy - for chatbot)
    websocket: import.meta.env.VITE_WEBSOCKET_URL || 'wss://api-gateway-production-c4c3.up.railway.app/ws',
    // Fallback HTTP API Gateway endpoint (legacy - for chatbot)
    apiGateway: import.meta.env.VITE_API_GATEWAY_URL || 'https://api-gateway-production-c4c3.up.railway.app',
    // Pharma RAG Backend API Gateway (for document upload and processing)
    pharmaApiGateway: import.meta.env.VITE_PHARMA_API_URL || 'https://api-gateway-production-c4c3.up.railway.app',
    // Pharma WebSocket endpoint for real-time document processing updates
    pharmaWebSocket: import.meta.env.VITE_PHARMA_WEBSOCKET_URL || 'wss://api-gateway-production-c4c3.up.railway.app/ws',
  },
  s3: {
    mainBucket: 'chatbot-storage-ap-south-1',
  },
  dynamodb: {
    conversationsTable: 'chatbot-conversations',
    knowledgeBaseTable: 'chatbot-knowledge-base',
    ordersTable: 'chatbot-orders',
  }
};



