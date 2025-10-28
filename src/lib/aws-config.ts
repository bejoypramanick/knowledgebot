export const AWS_CONFIG = {
  region: 'ap-south-1',
  endpoints: {
    // WebSocket API Gateway endpoint
    websocket: import.meta.env.VITE_WEBSOCKET_URL || 'wss://mu2mzsqwni.execute-api.ap-south-1.amazonaws.com/prod',
    // Fallback HTTP API Gateway endpoint for non-chat operations
    apiGateway: import.meta.env.VITE_API_GATEWAY_URL || 'https://a1kn0j91k8.execute-api.ap-south-1.amazonaws.com/prod',
    // Pharma RAG Backend API Gateway (for document upload and processing)
    pharmaApiGateway: import.meta.env.VITE_PHARMA_API_URL || 'https://ghpiq7asg3.execute-api.us-east-1.amazonaws.com/dev',
    // Pharma WebSocket endpoint for real-time document processing updates
    pharmaWebSocket: import.meta.env.VITE_PHARMA_WEBSOCKET_URL || 'wss://6dkgg5u5s7.execute-api.us-east-1.amazonaws.com/dev',
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



