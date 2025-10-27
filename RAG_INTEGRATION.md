# RAG Query Integration

## Overview

The knowledgebot frontend has been integrated with the pharma RAG backend to provide direct querying of documents stored in the knowledge base.

## How It Works

### Dual Mode Support

The chatbot now supports two query modes:

1. **RAG Query Mode** (Default) - Direct HTTP calls to RAG backend
   - Fast and reliable
   - No WebSocket required
   - Connects to pharma backend ALB

2. **WebSocket Mode** - Original chat via WebSocket
   - Real-time updates
   - Connection status indicator
   - Used for other chat operations

### UI Toggle

A toggle button in the header switches between modes:
- **✓ RAG** (green) - Using RAG query endpoint
- **○ WS** (white) - Using WebSocket

## Configuration

### Environment Variables

Add to `.env` or `vite.config.ts`:

```env
# RAG backend endpoint (default provided if not set)
VITE_RAG_API_URL=http://pharma-rag-alb-dev-2054947644.us-east-1.elb.amazonaws.com

# Or for API Gateway (if needed)
# VITE_RAG_API_URL=https://h51u75mco5.execute-api.us-east-1.amazonaws.com/dev
```

### Code Integration

**In `src/lib/chatbot-api.ts`:**

```typescript
async queryRAG(query: string, mode: 'hybrid' | 'naive' | 'local' = 'hybrid'): Promise<ChatResponse> {
  const ragEndpoint = import.meta.env.VITE_RAG_API_URL || 'http://pharma-rag-alb-dev-2054947644.us-east-1.elb.amazonaws.com';
  
  const response = await axios.post(`${ragEndpoint}/query`, {
    query,
    mode
  });

  return {
    response: response.data.answer,
    session_id: '',
    timestamp: new Date().toISOString(),
    sources: response.data.sources || []
  };
}
```

**In `src/pages/Chatbot.tsx`:**

```typescript
const [useRAGQuery, setUseRAGQuery] = useState(true); // Toggle state

// In handleSendMessage():
if (useRAGQuery) {
  response = await apiClient.queryRAG(newMessage, 'hybrid');
} else {
  response = await apiClient.sendMessage(newMessage, sessionId);
}
```

## API Endpoint

### RAG Query Endpoint

**URL**: `http://pharma-rag-alb-dev-2054947644.us-east-1.elb.amazonaws.com/query`

**Method**: POST

**Request Body:**
```json
{
  "query": "What color is vermilion a shade of?",
  "mode": "hybrid"
}
```

**Response:**
```json
{
  "query": "What color is vermilion a shade of?",
  "answer": "Vermilion is a shade of red...",
  "sources": [...],
  "confidence": 0.95,
  "mode": "hybrid",
  "status": "completed",
  "timing": {
    "query_duration": 1.193,
    "parse_duration": 0.0,
    "total_duration": 1.194
  }
}
```

## Query Modes

- **`hybrid`** (default) - Full RAG with embeddings + knowledge graph
- **`naive`** - Embedding-based search only
- **`local`** - Knowledge graph only

## Features

✅ Direct HTTP queries (no WebSocket needed)  
✅ Automatic VLM fallback if hybrid mode fails  
✅ Sources and confidence scores  
✅ Document visualization support  
✅ Toggle between modes via UI  
✅ Error handling and retry logic  

## Testing

1. Toggle to RAG mode (✓ RAG button)
2. Type a query like "What color is vermilion?"
3. Get response with sources
4. View sources in document viewer

## Troubleshooting

**No response:**
- Check RAG API URL is accessible
- Verify backend is running
- Check browser console for errors

**Wrong endpoint:**
- Update `VITE_RAG_API_URL` in environment
- Or update default URL in `chatbot-api.ts`

**CORS errors:**
- ALB should have CORS configured
- Or use API Gateway endpoint with CORS

