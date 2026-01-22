import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ensureSpreadsheetReady } from '../api/googleSheets'

let spreadsheetInitPromise = null
const SPREADSHEET_MAP_KEY = 'spreadsheet-id-by-email'

function loadSpreadsheetIdByEmail(email) {
  if (!email) return null
  try {
    const raw = localStorage.getItem(SPREADSHEET_MAP_KEY)
    if (!raw) return null
    const map = JSON.parse(raw)
    return map?.[email] || null
  } catch (error) {
    console.error('스프레드시트 ID 로드 실패:', error)
    return null
  }
}

function saveSpreadsheetIdByEmail(email, spreadsheetId) {
  if (!email || !spreadsheetId) return
  try {
    const raw = localStorage.getItem(SPREADSHEET_MAP_KEY)
    const map = raw ? JSON.parse(raw) : {}
    map[email] = spreadsheetId
    localStorage.setItem(SPREADSHEET_MAP_KEY, JSON.stringify(map))
  } catch (error) {
    console.error('스프레드시트 ID 저장 실패:', error)
  }
}

function removeSpreadsheetIdByEmail(email) {
  if (!email) return
  try {
    const raw = localStorage.getItem(SPREADSHEET_MAP_KEY)
    if (!raw) return
    const map = JSON.parse(raw)
    if (!map || !map[email]) return
    delete map[email]
    localStorage.setItem(SPREADSHEET_MAP_KEY, JSON.stringify(map))
  } catch (error) {
    console.error('스프레드시트 ID 삭제 실패:', error)
  }
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      spreadsheetId: null,
      spreadsheetError: null,
      
      setUser: (user) => set({ user }),
      
      setAccessToken: (token) => set({ accessToken: token }),

      setSpreadsheetId: (spreadsheetId) => {
        const email = get().user?.email
        saveSpreadsheetIdByEmail(email, spreadsheetId)
        set({ spreadsheetId, spreadsheetError: null })
      },
      
      setSpreadsheetError: (error) => set({ spreadsheetError: error }),

      ensureSpreadsheetId: async () => {
        const { accessToken, user, spreadsheetId } = get()
        if (!accessToken || !user?.email) return null
        if (spreadsheetId) {
          const ensureResult = await ensureSpreadsheetReady(
            accessToken,
            user.email,
            spreadsheetId
          )
          if (ensureResult?.success && ensureResult.spreadsheetId) {
            saveSpreadsheetIdByEmail(user.email, ensureResult.spreadsheetId)
            set({ spreadsheetId: ensureResult.spreadsheetId, spreadsheetError: null })
            return ensureResult.spreadsheetId
          }
          removeSpreadsheetIdByEmail(user.email)
          set({ spreadsheetId: null, spreadsheetError: ensureResult?.error || null })
        }

        const cachedId = loadSpreadsheetIdByEmail(user.email)
        if (cachedId) {
          const ensureResult = await ensureSpreadsheetReady(
            accessToken,
            user.email,
            cachedId
          )
          if (ensureResult?.success && ensureResult.spreadsheetId) {
            saveSpreadsheetIdByEmail(user.email, ensureResult.spreadsheetId)
            set({ spreadsheetId: ensureResult.spreadsheetId, spreadsheetError: null })
            return ensureResult.spreadsheetId
          }
          removeSpreadsheetIdByEmail(user.email)
          set({ spreadsheetError: ensureResult?.error || null })
        }
        if (spreadsheetInitPromise) return spreadsheetInitPromise

        spreadsheetInitPromise = (async () => {
          const ensureResult = await ensureSpreadsheetReady(
            accessToken,
            user.email,
            null
          )
          if (ensureResult?.success && ensureResult.spreadsheetId) {
            saveSpreadsheetIdByEmail(user.email, ensureResult.spreadsheetId)
            set({ spreadsheetId: ensureResult.spreadsheetId, spreadsheetError: null })
            return ensureResult.spreadsheetId
          }
          console.error('스프레드시트 생성 실패:', ensureResult?.error)
          set({ spreadsheetError: ensureResult?.error || null })
          return null
        })()

        const createdId = await spreadsheetInitPromise
        spreadsheetInitPromise = null
        return createdId
      },
      
      login: (user, token) =>
        set((state) => {
          const sameUser =
            state.user?.email && user?.email && state.user.email === user.email
          const cachedId = user?.email ? loadSpreadsheetIdByEmail(user.email) : null
          return {
            user,
            accessToken: token,
            spreadsheetId: sameUser ? state.spreadsheetId : cachedId,
            spreadsheetError: null,
          }
        }),
      
      logout: () =>
        set({
          user: null,
          accessToken: null,
          spreadsheetId: null,
          spreadsheetError: null,
        }),
    }),
    {
      name: 'auth-storage',
    }
  )
)
