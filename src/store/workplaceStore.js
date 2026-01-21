import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 알바처 데이터 구조:
 * {
 *   id: string,
 *   name: string,
 *   hourlyWage: number,
 *   salaryType: 'weekly' | 'monthly',
 *   incomeType: 'employment' | 'business',
 *   settings: {
 *     weeklyHolidayPay: {
 *       supported: boolean,
 *       userConfirmed: boolean,
 *       condition: string,
 *       status: 'confirmed' | 'conditional' | 'unknown'
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
      
      addWorkplace: (workplace) =>
        set((state) => ({
          workplaces: [...state.workplaces, { ...workplace, id: Date.now().toString() }],
        })),
      
      updateWorkplace: (id, updates) =>
        set((state) => ({
          workplaces: state.workplaces.map((wp) =>
            wp.id === id ? { ...wp, ...updates } : wp
          ),
        })),
      
      deleteWorkplace: (id) =>
        set((state) => ({
          workplaces: state.workplaces.filter((wp) => wp.id !== id),
        })),
      
      getWorkplaceById: (id) => {
        return get().workplaces.find((wp) => wp.id === id)
      },
    }),
    {
      name: 'workplace-storage',
    }
  )
)
