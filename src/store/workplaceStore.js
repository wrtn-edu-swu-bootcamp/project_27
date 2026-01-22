import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  deleteWorkplaceFromSheet,
  saveWorkplaceToSheet,
  updateWorkplaceInSheet,
} from '../api/googleSheets'
import { useAuthStore } from './authStore'

/**
 * 알바처 데이터 구조:
 * {
 *   id: string,
 *   name: string,
 *   hourlyWage: number,
 *   breakType: 'none' | 'standard' | 'custom',
 *   breakEveryHours?: number,
 *   breakMinutesPerBlock?: number,
 *   salaryType: 'weekly' | 'monthly',
 *   incomeType: 'employment' | 'business',
 *   taxType?: 'withholding3_3' | 'four_insurance' | 'unknown',
 *   insuranceSettings?: {
 *     pension?: { enabled: boolean, rate: number },
 *     health?: { enabled: boolean, rate: number },
 *     longTermCare?: { enabled: boolean, rate: number },
 *     employment?: { enabled: boolean, rate: number },
 *     accident?: { enabled: boolean, rate: number }
 *   },
 *   settings: {
 *     weeklyHolidayPay: {
 *       supported: boolean,
 *       userConfirmed: boolean,
 *       condition: string,
 *       status: 'confirmed' | 'conditional' | 'unknown',
 *       selection: 'yes' | 'no' | 'unknown'
 *     },
 *     nightPay: { ... },
 *     holidayPay: { ... }
 *   },
 *   color: string (캘린더 표시용)
 * }
 */

export const useWorkplaceStore = create(
  persist(
    (set, get) => ({
      workplaces: [],
      hydrated: false,

      setHydrated: (value) => set({ hydrated: value }),

      addWorkplace: async (workplace) => {
        const newWorkplace = { ...workplace, id: Date.now().toString() }
        const authState = useAuthStore.getState()
        const { accessToken } = authState

        if (accessToken) {
          const spreadsheetId = await authState.ensureSpreadsheetId()
          if (spreadsheetId) {
            const sheetResult = await saveWorkplaceToSheet(
              accessToken,
              spreadsheetId,
              newWorkplace
            )
            if (!sheetResult.success) {
              console.error('알바처 시트 저장 실패:', sheetResult.error)
            }
          }
        }

        set((state) => ({
          workplaces: [...state.workplaces, newWorkplace],
        }))
      },
      
      updateWorkplace: async (id, updates) => {
        let updatedWorkplace = null
        set((state) => ({
          workplaces: state.workplaces.map((wp) => {
            if (wp.id !== id) return wp
            updatedWorkplace = { ...wp, ...updates }
            return updatedWorkplace
          }),
        }))

        if (!updatedWorkplace) return

        const authState = useAuthStore.getState()
        const { accessToken } = authState

        if (accessToken) {
          const spreadsheetId = await authState.ensureSpreadsheetId()
          if (spreadsheetId) {
            const sheetResult = await updateWorkplaceInSheet(
              accessToken,
              spreadsheetId,
              updatedWorkplace
            )
            if (!sheetResult.success) {
              console.error('알바처 시트 수정 실패:', sheetResult.error)
            }
          }
        }
      },
      
      deleteWorkplace: async (id) => {
        const authState = useAuthStore.getState()
        const { accessToken } = authState

        if (accessToken && id) {
          const spreadsheetId = await authState.ensureSpreadsheetId()
          if (spreadsheetId) {
            const sheetResult = await deleteWorkplaceFromSheet(
              accessToken,
              spreadsheetId,
              id
            )
            if (!sheetResult.success) {
              console.error('알바처 시트 삭제 실패:', sheetResult.error)
            }
          }
        }

        set((state) => ({
          workplaces: state.workplaces.filter((wp) => wp.id !== id),
        }))
      },
      
      getWorkplaceById: (id) => {
        return get().workplaces.find((wp) => wp.id === id)
      },
    }),
    {
      name: 'workplace-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    }
  )
)
