import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './components/Layout'
import { ConfirmPage, LoginPage, RegisterPage } from './pages/AuthPages'
import { DeveloperPage } from './pages/DeveloperPage'
import { DevelopersPage } from './pages/DevelopersPage'
import { FeedPage } from './pages/FeedPage'
import { ProfileEditPage } from './pages/ProfileEditPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ProjectFormPage } from './pages/ProjectFormPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { PullRequestDetailPage } from './pages/PullRequestDetailPage'
import { PullRequestFormPage } from './pages/PullRequestFormPage'
import { PullRequestsPage } from './pages/PullRequestsPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/confirm" element={<ConfirmPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<FeedPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/new" element={<ProjectFormPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/projects/:id/edit" element={<ProjectFormPage />} />
            <Route path="/projects/:id/pull-requests/new" element={<PullRequestFormPage />} />
            <Route path="/pull-requests" element={<PullRequestsPage />} />
            <Route path="/pull-requests/:id" element={<PullRequestDetailPage />} />
            <Route path="/developers" element={<DevelopersPage />} />
            <Route path="/developers/:id" element={<DeveloperPage />} />
            <Route path="/settings/profile" element={<ProfileEditPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
