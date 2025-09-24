import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navigation from "./components/Navigation";
import ChatbotConfiguration from "./pages/ChatbotConfiguration";
import ChatbotPerformance from "./pages/ChatbotPerformance";
import KnowledgeBaseManagement from "./pages/KnowledgeBaseManagement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Navigation />
        <main className="min-h-screen bg-background">
          <Routes>
            <Route path="/" element={<ChatbotConfiguration />} />
            <Route path="/performance" element={<ChatbotPerformance />} />
            <Route path="/knowledge-base" element={<KnowledgeBaseManagement />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
