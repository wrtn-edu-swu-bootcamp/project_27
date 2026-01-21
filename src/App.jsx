import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { useAuthStore } from './store/authStore'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import WorkplaceManager from './pages/WorkplaceManager'
import ScheduleManager from './pages/ScheduleManager'
import SalaryCalculator from './pages/SalaryCalculator'
import Layout from './components/Layout'
import './App.css'

function PrivateRoute({ children }) {
  const { user } = useAuthStore()
  return user ? children : <Navigate to="/login" replace />
}

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  if (!googleClientId) {
    console.error('Google Client ID가 설정되지 않았습니다.')
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId || ''}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/workplaces" element={<WorkplaceManager />} />
                    <Route path="/schedules" element={<ScheduleManager />} />
                    <Route path="/salary" element={<SalaryCalculator />} />
                  </Routes>
                </Layout>
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
    </GoogleOAuthProvider>
  )
}

export default App
