import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import LoginPage      from './pages/auth/LoginPage'
import ProtectedRoute from './components/layout/ProtectedRoute'

// HR routes
import HRLayout       from './pages/hr/HRLayout'
import Dashboard      from './pages/hr/Dashboard'
import Employees      from './pages/hr/Employees'
import EmployeeDetail from './pages/hr/EmployeeDetail'
import Alerts         from './pages/hr/Alerts'
import Candidates from './pages/hr/Candidates'

// Employee / candidate onboarding routes
import EmployeeLayout from './pages/candidate/EmployeeLayout'
import Welcome        from './pages/candidate/Welcome'
import ProfileCompletion from './pages/candidate/ProfileCompletion'
import TermsAndConditions from './pages/candidate/TermsAndConditions'
import Documents      from './pages/candidate/Documents'
import Checklist      from './pages/candidate/Checklist'
import PolicyBot      from './pages/candidate/PolicyBot'

// IT Admin routes
import ITLayout       from './pages/it/ITLayout'
import Provisioning   from './pages/it/Provisioning'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0C1120',
            color: '#E2E8F0',
            border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#22D3EE', secondary: '#0C1120' } },
          error:   { iconTheme: { primary: '#EF4444', secondary: '#0C1120' } },
        }}
      />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />

        {/* ── HR Admin ────────────────────────────────── */}
        <Route path="/hr" element={
          <ProtectedRoute role="hr"><HRLayout /></ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="employees" element={<Employees />} />
          <Route path="candidates" element={<Candidates />} />
          <Route path="employees/:id" element={<EmployeeDetail />} />
          <Route path="candidates/:id" element={<EmployeeDetail />} />
          <Route path="alerts" element={<Alerts />} />
        </Route>

        {/* ── Candidate Onboarding Portal ──────────────── */}
        <Route path="/onboarding" element={
          <ProtectedRoute role="employee"><EmployeeLayout /></ProtectedRoute>
        }>
          <Route index element={<Welcome />} />
          <Route path="profile" element={<ProfileCompletion />} />
          <Route path="terms" element={<TermsAndConditions />} />
          <Route path="documents" element={<Documents />} />
          <Route path="checklist" element={<Checklist />} />
          <Route path="policy" element={<PolicyBot />} />
        </Route>

        {/* ── IT Admin Portal ──────────────────────────── */}
        <Route path="/it" element={
          <ProtectedRoute role="it_admin"><ITLayout /></ProtectedRoute>
        }>
          {/* Pending + In-Progress provisioning requests */}
          <Route index element={<Provisioning showCompleted={false} />} />
          {/* Completed provisioning history */}
          <Route path="completed" element={<Provisioning showCompleted={true} />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}