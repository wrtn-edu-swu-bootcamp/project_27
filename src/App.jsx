import { useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { useAuthStore } from './store/authStore'
import { useScheduleStore } from './store/scheduleStore'
import { useWorkplaceStore } from './store/workplaceStore'
import {
  ensureSpreadsheetReady,
  syncSchedulesToSheet,
  syncWorkplacesToSheet,
} from './api/googleSheets'
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
  const { user, accessToken, spreadsheetId, setSpreadsheetId } = useAuthStore()
  const schedules = useScheduleStore((state) => state.schedules)
  const schedulesHydrated = useScheduleStore((state) => state.hydrated)
  const workplaces = useWorkplaceStore((state) => state.workplaces)
  const workplacesHydrated = useWorkplaceStore((state) => state.hydrated)
  const syncInProgressRef = useRef(false)
  const syncedRef = useRef(false)

  if (!googleClientId) {
    console.error('Google Client ID가 설정되지 않았습니다.')
  }

  useEffect(() => {
    if (!user || !accessToken) {
      syncedRef.current = false
      return
    }
    if (!schedulesHydrated || !workplacesHydrated) return
    if (syncedRef.current || syncInProgressRef.current) return

    syncInProgressRef.current = true
    ;(async () => {
      const ensureResult = await ensureSpreadsheetReady(
        accessToken,
        user.email,
        spreadsheetId
      )
      if (!ensureResult?.success) {
        console.error('스프레드시트 확인 실패:', ensureResult?.error)
        syncInProgressRef.current = false
        return
      }

      if (ensureResult.spreadsheetId && ensureResult.spreadsheetId !== spreadsheetId) {
        setSpreadsheetId(ensureResult.spreadsheetId)
      }

      await syncWorkplacesToSheet(accessToken, ensureResult.spreadsheetId, workplaces)
      await syncSchedulesToSheet(accessToken, ensureResult.spreadsheetId, schedules)
      syncedRef.current = true
      syncInProgressRef.current = false
    })()
  }, [
    user,
    accessToken,
    spreadsheetId,
    schedulesHydrated,
    workplacesHydrated,
    schedules,
    workplaces,
    setSpreadsheetId,
  ])

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
