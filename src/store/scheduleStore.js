import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 근무 일정 데이터 구조:
 * {
 *   id: string,
 *   workplaceId: string,
 *   date: string (YYYY-MM-DD),
 *   startTime: string (HH:mm),
 *   endTime: string (HH:mm),
 *   memo: string,
 *   createdAt: timestamp,
 *   source: 'manual' | 'image' | 'calendar'
 * }
 */

/**
 * 이벤트 데이터 구조:
 * {
 *   id: string,
 *   title: string,
 *   date: string (YYYY-MM-DD),
 *   type: 'event' | 'deadline',
 *   memo: string
 * }
 */

export const useScheduleStore = create(
  persist(
    (set, get) => ({
      schedules: [],
      events: [],
      
      // 근무 일정 관리
      addSchedule: (schedule) =>
        set((state) => ({
          schedules: [
            ...state.schedules,
            { ...schedule, id: Date.now().toString(), createdAt: Date.now() },
          ],
        })),
      
      updateSchedule: (id, updates) =>
        set((state) => ({
          schedules: state.schedules.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),
      
      deleteSchedule: (id) =>
        set((state) => ({
          schedules: state.schedules.filter((s) => s.id !== id),
        })),
      
      getSchedulesByWorkplace: (workplaceId) => {
        return get().schedules.filter((s) => s.workplaceId === workplaceId)
      },
      
      getSchedulesByDateRange: (startDate, endDate) => {
        return get().schedules.filter((s) => {
          const date = new Date(s.date)
          return date >= new Date(startDate) && date <= new Date(endDate)
        })
      },
      
      // 이벤트 관리
      addEvent: (event) =>
        set((state) => ({
          events: [...state.events, { ...event, id: Date.now().toString() }],
        })),
      
      updateEvent: (id, updates) =>
        set((state) => ({
          events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),
      
      deleteEvent: (id) =>
        set((state) => ({
          events: state.events.filter((e) => e.id !== id),
        })),
    }),
    {
      name: 'schedule-storage',
    }
  )
)
