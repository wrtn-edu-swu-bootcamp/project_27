/**
 * Google Calendar API 연동
 */

import { useAuthStore } from '../store/authStore'

const CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3'

let lastAuthAlertAt = 0

function handleUnauthorizedResponse(response) {
  if (response.status !== 401) return
  const now = Date.now()
  if (now - lastAuthAlertAt < 5000) return
  lastAuthAlertAt = now

  console.error('인증 토큰 만료됨. 다시 로그인 필요.')
  try {
    useAuthStore.getState().logout()
  } catch (error) {
    console.error('로그아웃 처리 실패:', error)
  }
  alert('세션이 만료되었습니다. 다시 로그인해주세요.')
}

/**
 * 근무 일정을 Google Calendar에 추가
 */
export async function addEventToCalendar(accessToken, schedule, workplace) {
  try {
    const event = buildCalendarEvent(schedule, workplace)

    const response = await fetch(`${CALENDAR_API_URL}/calendars/primary/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    })

    if (!response.ok) {
      handleUnauthorizedResponse(response)
      throw new Error('캘린더 이벤트 추가 실패')
    }

    const data = await response.json()
    return {
      success: true,
      eventId: data.id,
    }
  } catch (error) {
    console.error('캘린더 추가 오류:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Google Calendar에서 이벤트 삭제
 */
export async function deleteEventFromCalendar(accessToken, eventId) {
  try {
    const response = await fetch(
      `${CALENDAR_API_URL}/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok && response.status !== 404) {
      handleUnauthorizedResponse(response)
      throw new Error('캘린더 이벤트 삭제 실패')
    }

    return {
      success: true,
    }
  } catch (error) {
    console.error('캘린더 삭제 오류:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Google Calendar에서 이벤트 수정
 */
export async function updateEventInCalendar(
  accessToken,
  eventId,
  schedule,
  workplace
) {
  try {
    const event = buildCalendarEvent(schedule, workplace)

    const response = await fetch(
      `${CALENDAR_API_URL}/calendars/primary/events/${eventId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    )

    if (!response.ok) {
      handleUnauthorizedResponse(response)
      throw new Error('캘린더 이벤트 수정 실패')
    }

    const data = await response.json()
    return {
      success: true,
      eventId: data.id,
    }
  } catch (error) {
    console.error('캘린더 수정 오류:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 색상 코드를 Google Calendar 색상 ID로 매핑
 */
function getColorId(colorHex) {
  const colorMap = {
    '#4285f4': '9', // 파란색
    '#ea4335': '11', // 빨간색
    '#fbbc04': '5', // 노란색
    '#34a853': '10', // 초록색
    '#ff6d00': '4', // 주황색
    '#46bdc6': '7', // 청록색
    '#7c4dff': '3', // 보라색
    '#f50057': '11', // 분홍색
  }

  return colorMap[colorHex] || '9'
}

function buildCalendarEvent(schedule, workplace) {
  const normalized = normalizeScheduleDateTimes(
    schedule?.date,
    schedule?.startTime,
    schedule?.endTime
  )

  if (!normalized) {
    throw new Error('시간 형식이 올바르지 않습니다. (HH:mm)')
  }

  return {
    summary: `${workplace.name} 근무`,
    description: schedule.memo || '',
    start: {
      dateTime: `${normalized.startDate}T${normalized.startTime}:00`,
      timeZone: 'Asia/Seoul',
    },
    end: {
      dateTime: `${normalized.endDate}T${normalized.endTime}:00`,
      timeZone: 'Asia/Seoul',
    },
    colorId: getColorId(workplace.color),
  }
}

function normalizeScheduleDateTimes(date, startTime, endTime) {
  if (!date || !startTime || !endTime) return null

  const startNormalized = normalizeTime(startTime)
  const endNormalized = normalizeTime(endTime)
  if (!startNormalized || !endNormalized) return null

  let startDate = addDays(date, startNormalized.dayOffset)
  let endDate = addDays(date, endNormalized.dayOffset)

  const startMinutes = startNormalized.hours * 60 + startNormalized.minutes
  const endMinutes = endNormalized.hours * 60 + endNormalized.minutes
  const endIsMidnight =
    endNormalized.hours === 0 && endNormalized.minutes === 0

  if (endNormalized.dayOffset === 0) {
    if (endIsMidnight && startMinutes > 0) {
      // 24:00까지는 같은 날로 간주하되, 캘린더에는 익일 00:00으로 기록
      endDate = addDays(endDate, 1)
    } else if (endMinutes <= startMinutes && endMinutes >= 1) {
      // 00:01부터는 익일 처리
      endDate = addDays(endDate, 1)
    }
  }

  return {
    startDate,
    endDate,
    startTime: startNormalized.time,
    endTime: endNormalized.time,
  }
}

function normalizeTime(value) {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  if (minutes < 0 || minutes > 59) return null

  if (hours === 24 && minutes === 0) {
    return {
      time: '00:00',
      hours: 0,
      minutes: 0,
      dayOffset: 1,
    }
  }

  if (hours < 0 || hours > 23) return null

  return {
    time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    hours,
    minutes,
    dayOffset: 0,
  }
}

function addDays(dateString, daysToAdd) {
  const [year, month, day] = dateString.split('-').map(Number)
  if (!year || !month || !day) return dateString

  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + (daysToAdd || 0))

  const nextYear = date.getFullYear()
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0')
  const nextDay = String(date.getDate()).padStart(2, '0')
  return `${nextYear}-${nextMonth}-${nextDay}`
}
