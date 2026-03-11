import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import LoadingSpinner from '../shared/LoadingSpinner'

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050E10] flex items-center justify-center">
        <LoadingSpinner size="lg" text="Authenticating…" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (role && user.role !== role) {
    const dest = user.role === 'hr' ? '/hr' : user.role === 'it_admin' ? '/it' : '/onboarding'
    return <Navigate to={dest} replace />
  }

  return children
}