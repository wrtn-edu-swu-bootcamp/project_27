/**
 * Google Calendar API 연동
 */

import { useAuthStore } from '../store/authStore'

const CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3'

let lastAuthAlertAt = 0
let cachedHolidayCalendarIds = null
let cachedHolidayCalendarIdsAt = 0

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

function buildRfc3339Seoul(dateString, time) {
  // dateString: YYYY-MM-DD, time: HH:mm:ss
  return `${dateString}T${time}+09:00`
}

function isDateWithinAllDayEvent(dateKey, startDate, endDate) {
  // all-day 이벤트는 end.date가 "다음날" (exclusive)로 내려옴
  if (!dateKey || !startDate || !endDate) return false
  return String(dateKey) >= String(startDate) && String(dateKey) < String(endDate)
}

async function getHolidayCalendarIds(accessToken) {
  const now = Date.now()
  if (cachedHolidayCalendarIds && now - cachedHolidayCalendarIdsAt < 6 * 60 * 60 * 1000) {
    return cachedHolidayCalendarIds
  }

  // 잘 알려진 한국 공휴일 캘린더 ID (사용자가 구독하지 않으면 접근 불가할 수 있음)
  const known = [
    'ko.south_korea#holiday@group.v.calendar.google.com',
    'ko.south_korea.official#holiday@group.v.calendar.google.com',
  ]

  try {
    const response = await fetch(
      `${CALENDAR_API_URL}/users/me/calendarList?maxResults=250`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
    if (!response.ok) {
      handleUnauthorizedResponse(response)
      throw new Error('캘린더 목록 조회 실패')
    }
    const data = await response.json()
    const items = Array.isArray(data?.items) ? data.items : []
    const ids = new Set()

    known.forEach((id) => ids.add(id))

    items.forEach((cal) => {
      const id = cal?.id
      const summary = String(cal?.summary || '')
      const lower = summary.toLowerCase()
      if (!id) return

      if (String(id).includes('#holiday@group.v.calendar.google.com')) {
        ids.add(id)
        return
      }

      if (
        summary.includes('공휴일') ||
        summary.includes('휴일') ||
        lower.includes('holiday') ||
        lower.includes('holidays')
      ) {
        ids.add(id)
      }
    })

    cachedHolidayCalendarIds = Array.from(ids)
    cachedHolidayCalendarIdsAt = now
    return cachedHolidayCalendarIds
  } catch (error) {
    console.error('공휴일 캘린더 목록 조회 오류:', error)
    // 실패 시에도 known ID는 시도할 수 있게 반환
    cachedHolidayCalendarIds = known
    cachedHolidayCalendarIdsAt = now
    return cachedHolidayCalendarIds
  }
}

/**
 * 특정 날짜(YYYY-MM-DD)가 Google Calendar에서 "공휴일(휴일 캘린더)"로 등록되어 있는지 확인
 */
export async function isHolidayInGoogleCalendar(accessToken, dateKey) {
  if (!accessToken || !dateKey) return false

  const calendarIds = await getHolidayCalendarIds(accessToken)
  if (!calendarIds || calendarIds.length === 0) return false

  // 경계 포함 문제를 피하기 위해 전날~다음날 범위로 조회 후 overlap 체크
  const prevDate = addDays(dateKey, -1)
  const nextDate = addDays(dateKey, 1)

  const timeMin = buildRfc3339Seoul(prevDate, '00:00:00')
  const timeMax = buildRfc3339Seoul(nextDate, '23:59:59')

  for (const calendarId of calendarIds) {
    try {
      const url =
        `${CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events` +
        `?singleEvents=true&orderBy=startTime&maxResults=2500` +
        `&timeMin=${encodeURIComponent(timeMin)}` +
        `&timeMax=${encodeURIComponent(timeMax)}`
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!response.ok) {
        // 구독하지 않은 캘린더는 404/403일 수 있으니 무시하고 다음 캘린더로
        if (response.status === 404 || response.status === 403) continue
        handleUnauthorizedResponse(response)
        continue
      }

      const data = await response.json()
      const items = Array.isArray(data?.items) ? data.items : []
      for (const ev of items) {
        const startDate = ev?.start?.date
        const endDate = ev?.end?.date
        if (startDate && endDate && isDateWithinAllDayEvent(dateKey, startDate, endDate)) {
          return true
        }
      }
    } catch (error) {
      // 네트워크/권한 문제 등은 조용히 넘어가고 false로 처리
      console.error('공휴일 조회 오류:', error)
    }
  }

  return false
}
