import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  addEventToCalendar,
  deleteEventFromCalendar,
  isHolidayInGoogleCalendar,
  updateEventInCalendar,
} from '../api/googleCalendar'
import { useAuthStore } from './authStore'
import { useWorkplaceStore } from './workplaceStore'

const holidayCheckCache = new Map()

async function getHolidayFlag(accessToken, dateKey) {
  if (!accessToken || !dateKey) return false
  const key = String(dateKey)
  const cached = holidayCheckCache.get(key)
  if (cached) return cached
  const promise = isHolidayInGoogleCalendar(accessToken, key).catch(() => false)
  holidayCheckCache.set(key, promise)
  return promise
}

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
 *   calendarEventId?: string,
 *   isHoliday?: boolean
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

      backfillHolidayFlags: async () => {
        const { accessToken } = useAuthStore.getState()
        if (!accessToken) return

        const current = get().schedules || []
        const targets = current.filter(
          (s) => typeof s?.date === 'string' && s?.isHoliday !== true && s?.isHoliday !== false
        )
        if (targets.length === 0) return

        const uniqueDates = Array.from(new Set(targets.map((s) => s.date)))
        const results = new Map()
        for (const dateKey of uniqueDates) {
          results.set(dateKey, await getHolidayFlag(accessToken, dateKey))
        }

        set((state) => ({
          schedules: state.schedules.map((s) => {
            if (typeof s?.date !== 'string') return s
            if (s?.isHoliday === true || s?.isHoliday === false) return s
            if (!results.has(s.date)) return s
            return { ...s, isHoliday: results.get(s.date) === true }
          }),
        }))
      },

      // 근무 일정 관리
      addSchedule: async (schedule) => {
        const newSchedule = {
          ...schedule,
          id: Date.now().toString(),
          createdAt: Date.now(),
        }
        const { accessToken } = useAuthStore.getState()
        const result = {
          calendarSaved: false,
          error: null,
        }
        let calendarAttempted = false

        if (accessToken) {
          // 휴일 플래그는 "구글 캘린더 공휴일 등록 여부" 기준으로 설정
          if (typeof newSchedule.date === 'string') {
            newSchedule.isHoliday = await getHolidayFlag(accessToken, newSchedule.date)
          }
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
        } else {
          result.error = '로그인이 필요합니다.'
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
          const { getWorkplaceById } = useWorkplaceStore.getState()
          const workplace = getWorkplaceById(updatedSchedule.workplaceId)
          if (accessToken && workplace) {
            // 날짜가 바뀌었거나 기존에 휴일 정보가 없으면 다시 계산
            if (typeof updatedSchedule.date === 'string') {
              const shouldRecalc =
                !('isHoliday' in updatedSchedule) ||
                updates?.date ||
                updatedSchedule.isHoliday === null ||
                updatedSchedule.isHoliday === undefined
              if (shouldRecalc) {
                updatedSchedule.isHoliday = await getHolidayFlag(accessToken, updatedSchedule.date)
                set((state) => ({
                  schedules: state.schedules.map((s) =>
                    s.id === updatedSchedule.id ? { ...s, isHoliday: updatedSchedule.isHoliday } : s
                  ),
                }))
              }
            }
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

      deleteSchedulesByWorkplaceId: async (workplaceId) => {
        const schedulesToDelete = get().schedules.filter(
          (s) => s.workplaceId === workplaceId
        )
        if (schedulesToDelete.length === 0) return

        const { accessToken } = useAuthStore.getState()
        if (accessToken) {
          for (const schedule of schedulesToDelete) {
            if (!schedule?.calendarEventId) continue
            const calendarResult = await deleteEventFromCalendar(
              accessToken,
              schedule.calendarEventId
            )
            if (!calendarResult.success) {
              console.error('캘린더 삭제 실패:', calendarResult.error)
            }
          }
        }

        set((state) => ({
          schedules: state.schedules.filter((s) => s.workplaceId !== workplaceId),
        }))
      },
      
      getSchedulesByWorkplace: (workplaceId) => {
        return get().schedules.filter((s) => s.workplaceId === workplaceId)
      },
      
      getSchedulesByDateRange: (startDate, endDate) => {
        // date는 'YYYY-MM-DD' 형식이므로 문자열 범위 비교가 가장 안전합니다(타임존 영향 없음).
        const startKey = String(startDate || '')
        const endKey = String(endDate || '')
        return get().schedules.filter((s) => {
          const dateKey = String(s.date || '')
          return dateKey >= startKey && dateKey <= endKey
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
        // 로그인 토큰이 이미 있는 경우, 기존 일정의 휴일 플래그를 백필합니다.
        setTimeout(() => {
          try {
            state?.backfillHolidayFlags?.()
          } catch (e) {
            console.error('휴일 플래그 백필 실패:', e)
          }
        }, 0)
      },
    }
  )
)
