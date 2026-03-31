import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ContentsPage from "./pages/ContentsPage";
import NewContentPage from "./pages/NewContentPage";
import ContentDetailPage from "./pages/ContentDetailPage";
import CalendarPage from "./pages/CalendarPage";
import BriefsPage from "./pages/BriefsPage";
import BriefDetailPage from "./pages/BriefDetailPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/contents" element={<ProtectedRoute><ContentsPage /></ProtectedRoute>} />
            <Route path="/contents/new" element={<ProtectedRoute><NewContentPage /></ProtectedRoute>} />
            <Route path="/contents/:id" element={<ProtectedRoute><ContentDetailPage /></ProtectedRoute>} />
            <Route path="/briefs" element={<ProtectedRoute><BriefsPage /></ProtectedRoute>} />
            <Route path="/briefs/:id" element={<ProtectedRoute><BriefDetailPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
