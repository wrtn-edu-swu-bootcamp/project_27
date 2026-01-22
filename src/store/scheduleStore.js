import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addEventToCalendar, deleteEventFromCalendar, updateEventInCalendar } from '../api/googleCalendar'
import { deleteScheduleFromSheet, saveScheduleToSheet, updateScheduleInSheet } from '../api/googleSheets'
import { useAuthStore } from './authStore'
import { useWorkplaceStore } from './workplaceStore'

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
 *   source: 'manual' | 'image' | 'calendar',
 *   calendarEventId?: string
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
      hydrated: false,

      setHydrated: (value) => set({ hydrated: value }),

      // 근무 일정 관리
      addSchedule: async (schedule) => {
        const newSchedule = {
          ...schedule,
          id: Date.now().toString(),
          createdAt: Date.now(),
        }
        const { accessToken } = useAuthStore.getState()
        const result = {
          sheetSaved: false,
          calendarSaved: false,
          error: null,
        }
        let calendarAttempted = false

        if (accessToken) {
          const authState = useAuthStore.getState()
          const spreadsheetId = await authState.ensureSpreadsheetId()
          if (spreadsheetId) {
            const sheetResult = await saveScheduleToSheet(
              accessToken,
              spreadsheetId,
              newSchedule
            )
            result.sheetSaved = sheetResult?.success === true
            if (!result.sheetSaved) {
              result.error = sheetResult?.error || '시트 저장 실패'
              console.error('시트 저장 실패:', result.error)
            } else {
              result.spreadsheetId = sheetResult?.spreadsheetId || spreadsheetId
              result.spreadsheetUrl = sheetResult?.spreadsheetUrl || null
              result.sheetUpdates = sheetResult?.updates || null
            }
          } else {
            const detail =
              authState.spreadsheetError ||
              '스프레드시트 권한을 확인하고 다시 로그인해주세요.'
            result.error = `스프레드시트 ID를 가져오지 못했습니다.\n${detail}`
            console.error(result.error)
          }
        } else {
          result.error = '로그인이 필요합니다.'
        }

        if (accessToken) {
          const { getWorkplaceById } = useWorkplaceStore.getState()
          const workplace = getWorkplaceById(newSchedule.workplaceId)
          if (workplace) {
            calendarAttempted = true
            const calendarResult = await addEventToCalendar(
              accessToken,
              newSchedule,
              workplace
            )
            if (calendarResult.success) {
              newSchedule.calendarEventId = calendarResult.eventId
              result.calendarSaved = true
            } else {
              if (!result.error) {
                result.error = calendarResult.error || '캘린더 추가 실패'
              }
              console.error('캘린더 추가 실패:', result.error)
            }
          }
        }

        set((state) => ({
          schedules: [...state.schedules, newSchedule],
        }))

        if (accessToken && !calendarAttempted) {
          result.error = result.error || '알바처 정보를 찾지 못해 캘린더에 추가하지 못했습니다.'
        }
        return result
      },
      
      updateSchedule: async (id, updates) => {
        let updatedSchedule = null
        const result = {
          sheetUpdated: false,
          calendarUpdated: false,
          calendarCreated: false,
          error: null,
        }
        set((state) => ({
          schedules: state.schedules.map((s) => {
            if (s.id !== id) return s
            updatedSchedule = { ...s, ...updates }
            return updatedSchedule
          }),
        }))

        if (updatedSchedule) {
          const { accessToken } = useAuthStore.getState()
          if (accessToken) {
            const spreadsheetId = await useAuthStore.getState().ensureSpreadsheetId()
            if (spreadsheetId) {
              const sheetResult = await updateScheduleInSheet(
                accessToken,
                spreadsheetId,
                updatedSchedule
              )
              result.sheetUpdated = sheetResult?.success === true
              if (!result.sheetUpdated) {
                result.error = sheetResult?.error || '시트 수정 실패'
                console.error('시트 수정 실패:', result.error)
              }
            }
          }
        }

        if (updatedSchedule) {
          const { accessToken } = useAuthStore.getState()
          const { getWorkplaceById } = useWorkplaceStore.getState()
          const workplace = getWorkplaceById(updatedSchedule.workplaceId)
          if (accessToken && workplace) {
            if (updatedSchedule.calendarEventId) {
              const calendarResult = await updateEventInCalendar(
                accessToken,
                updatedSchedule.calendarEventId,
                updatedSchedule,
                workplace
              )
              result.calendarUpdated = calendarResult?.success === true
              if (!result.calendarUpdated) {
                if (!result.error) {
                  result.error = calendarResult.error || '캘린더 수정 실패'
                }
                console.error('캘린더 수정 실패:', result.error)
              }
            } else {
              const calendarResult = await addEventToCalendar(
                accessToken,
                updatedSchedule,
                workplace
              )
              result.calendarCreated = calendarResult?.success === true
              if (result.calendarCreated) {
                const eventId = calendarResult.eventId
                updatedSchedule.calendarEventId = eventId
                set((state) => ({
                  schedules: state.schedules.map((s) =>
                    s.id === updatedSchedule.id ? { ...s, calendarEventId: eventId } : s
                  ),
                }))
              } else {
                if (!result.error) {
                  result.error = calendarResult.error || '캘린더 추가 실패'
                }
                console.error('캘린더 추가 실패:', result.error)
              }
            }
          }
        }
        return result
      },
      
      deleteSchedule: async (id) => {
        const schedule = get().schedules.find((s) => s.id === id)
        const { accessToken } = useAuthStore.getState()

        if (accessToken && schedule?.id) {
          const spreadsheetId = await useAuthStore.getState().ensureSpreadsheetId()
          if (spreadsheetId) {
            const sheetResult = await deleteScheduleFromSheet(
              accessToken,
              spreadsheetId,
              schedule.id
            )
            if (!sheetResult.success) {
              console.error('시트 삭제 실패:', sheetResult.error)
            }
          }
        }

        if (accessToken && schedule?.calendarEventId) {
          const calendarResult = await deleteEventFromCalendar(
            accessToken,
            schedule.calendarEventId
          )
          if (!calendarResult.success) {
            console.error('캘린더 삭제 실패:', calendarResult.error)
          }
        }

        set((state) => ({
          schedules: state.schedules.filter((s) => s.id !== id),
        }))
      },
      
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
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    }
  )
)
