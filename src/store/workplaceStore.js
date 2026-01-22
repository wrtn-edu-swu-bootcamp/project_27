import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
      },
      
      deleteWorkplace: async (id) => {
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
