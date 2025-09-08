import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import { ProtectedRoute } from '@/components/protected-route'
import { LoginPage } from '@/pages/login'
import { DashboardPage } from '@/pages/dashboard'
import { PodsPage } from '@/pages/pods'
import { DeploymentsPage } from '@/pages/deployments'
import { ServicesPage } from '@/pages/services'
import { AdvancedTerminalsPage } from '@/pages/advanced-terminals'
import { ManifestViewerPage } from '@/pages/manifest-viewer'
import TopologyPage from '@/pages/advanced/topology'
import DaemonSetTopologyPage from '@/pages/advanced/daemonset-topology'
import JobTopologyPage from '@/pages/advanced/job-topology'
import CronJobTopologyPage from '@/pages/advanced/topology/CronJobTopology'
import APIDocsPage from '@/pages/advanced/api-docs'
import LogsPage from '@/pages/advanced/logs'
import EventsPage from '@/pages/advanced/events'
import ConnectionHealthDemo from '@/pages/connection-health-demo'
import { MultiClusterNamespaces } from '@/pages/namespaces'
import { useAuthStore } from '@/stores/auth.store'

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return (
    <ThemeProvider defaultTheme="dark" storageKey="kaptivan-theme">
      <BrowserRouter>
        <Routes>
          <Route 
            path="/login" 
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
            } 
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pods"
            element={
              <ProtectedRoute>
                <PodsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/deployments"
            element={
              <ProtectedRoute>
                <DeploymentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/services"
            element={
              <ProtectedRoute>
                <ServicesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/namespaces"
            element={
              <ProtectedRoute>
                <MultiClusterNamespaces />
              </ProtectedRoute>
            }
          />
          <Route
            path="/advanced/terminals"
            element={
              <ProtectedRoute>
                <AdvancedTerminalsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/advanced/manifests"
            element={
              <ProtectedRoute>
                <ManifestViewerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/advanced/topology"
            element={
              <ProtectedRoute>
                <TopologyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/advanced/daemonset-topology"
            element={
              <ProtectedRoute>
                <DaemonSetTopologyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/advanced/job-topology"
            element={
              <ProtectedRoute>
                <JobTopologyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/advanced/cronjob-topology"
            element={
              <ProtectedRoute>
                <CronJobTopologyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/advanced/api-docs"
            element={
              <ProtectedRoute>
                <APIDocsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/advanced/logs"
            element={
              <ProtectedRoute>
                <LogsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/advanced/events"
            element={
              <ProtectedRoute>
                <EventsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/demo/connection-health"
            element={
              <ProtectedRoute>
                <ConnectionHealthDemo />
              </ProtectedRoute>
            }
          />
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
