/**
 * KnowledgeBot - AI-Powered Knowledge Assistant
 * Copyright (c) 2025 Bejoy Pramanick. All rights reserved.
 * 
 * PROPRIETARY SOFTWARE - See LICENSE file for terms and conditions.
 * Commercial use prohibited without explicit written permission.
 */

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navigation from "./components/Navigation";
import Chatbot from "./pages/Chatbot";
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
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <div className="h-screen flex flex-col overflow-hidden bg-white">
          <Navigation />
          <main className="flex-1 overflow-hidden bg-white">
            <Routes>
              <Route path="/" element={<Chatbot />} />
              <Route path="/configuration" element={<ChatbotConfiguration />} />
              <Route path="/performance" element={<ChatbotPerformance />} />
              <Route path="/knowledge-base" element={<KnowledgeBaseManagement />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
