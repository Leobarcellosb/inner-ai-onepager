import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { I18nProvider } from "@/lib/i18n";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";

// Eager: login (first paint)
import LoginPage from "./pages/LoginPage";

// Lazy: everything else
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ContentsPage = lazy(() => import("./pages/ContentsPage"));
const NewContentPage = lazy(() => import("./pages/NewContentPage"));
const ContentDetailPage = lazy(() => import("./pages/ContentDetailPage"));
const PipelinePage = lazy(() => import("./pages/PipelinePage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const ProductionPage = lazy(() => import("./pages/ProductionPage"));
const ApprovalPage = lazy(() => import("./pages/ApprovalPage"));
const BriefsPage = lazy(() => import("./pages/BriefsPage"));
const BriefDetailPage = lazy(() => import("./pages/BriefDetailPage"));
const IntelligenceDashboardPage = lazy(() => import("./pages/IntelligenceDashboardPage"));
const EditorialPage = lazy(() => import("./pages/EditorialPage"));
const ReferencesPage = lazy(() => import("./pages/ReferencesPage"));
const ReferenceDetailPage = lazy(() => import("./pages/ReferenceDetailPage"));
const PlaybooksPage = lazy(() => import("./pages/PlaybooksPage"));
const AIAnalysisPage = lazy(() => import("./pages/AIAnalysisPage"));
const BrandBrainPage = lazy(() => import("./pages/BrandBrainPage"));
const KnowledgePage = lazy(() => import("./pages/KnowledgePage"));
const AutopilotPage = lazy(() => import("./pages/AutopilotPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const CompanyConfigPage = lazy(() => import("./pages/CompanyConfigPage"));
const IdeasPage = lazy(() => import("./pages/IdeasPage"));
const StoriesPage = lazy(() => import("./pages/StoriesPage"));
const ImportPage = lazy(() => import("./pages/ImportPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <I18nProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/contents" element={<ProtectedRoute><ContentsPage /></ProtectedRoute>} />
              <Route path="/contents/new" element={<ProtectedRoute><NewContentPage /></ProtectedRoute>} />
              <Route path="/contents/:id" element={<ProtectedRoute><ContentDetailPage /></ProtectedRoute>} />
              <Route path="/pipeline" element={<ProtectedRoute><PipelinePage /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
              <Route path="/production" element={<ProtectedRoute><ProductionPage /></ProtectedRoute>} />
              <Route path="/approval" element={<ProtectedRoute><ApprovalPage /></ProtectedRoute>} />
              <Route path="/briefs" element={<ProtectedRoute><BriefsPage /></ProtectedRoute>} />
              <Route path="/briefs/:id" element={<ProtectedRoute><BriefDetailPage /></ProtectedRoute>} />
              <Route path="/brain" element={<ProtectedRoute><BrandBrainPage /></ProtectedRoute>} />
              <Route path="/knowledge" element={<ProtectedRoute><KnowledgePage /></ProtectedRoute>} />
              <Route path="/autopilot" element={<ProtectedRoute><AdminRoute><AutopilotPage /></AdminRoute></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><AdminRoute><UsersPage /></AdminRoute></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/config" element={<ProtectedRoute><AdminRoute><CompanyConfigPage /></AdminRoute></ProtectedRoute>} />
              <Route path="/ideas" element={<ProtectedRoute><IdeasPage /></ProtectedRoute>} />
              <Route path="/stories" element={<ProtectedRoute><StoriesPage /></ProtectedRoute>} />
              <Route path="/import" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />
              <Route path="/intelligence" element={<ProtectedRoute><IntelligenceDashboardPage /></ProtectedRoute>} />
              <Route path="/intelligence/editorial" element={<ProtectedRoute><EditorialPage /></ProtectedRoute>} />
              <Route path="/intelligence/references" element={<ProtectedRoute><ReferencesPage /></ProtectedRoute>} />
              <Route path="/intelligence/references/:id" element={<ProtectedRoute><ReferenceDetailPage /></ProtectedRoute>} />
              <Route path="/intelligence/ai-analysis" element={<ProtectedRoute><AIAnalysisPage /></ProtectedRoute>} />
              <Route path="/intelligence/playbooks" element={<ProtectedRoute><PlaybooksPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </I18nProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
