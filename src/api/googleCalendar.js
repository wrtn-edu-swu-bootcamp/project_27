/**
 * Google Calendar API 연동
 */

const CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3'

/**
 * 근무 일정을 Google Calendar에 추가
 */
export async function addEventToCalendar(accessToken, schedule, workplace) {
  try {
    const event = {
      summary: `${workplace.name} 근무`,
      description: schedule.memo || '',
      start: {
        dateTime: `${schedule.date}T${schedule.startTime}:00`,
        timeZone: 'Asia/Seoul',
      },
      end: {
        dateTime: `${schedule.date}T${schedule.endTime}:00`,
        timeZone: 'Asia/Seoul',
      },
      colorId: getColorId(workplace.color),
    }

    const response = await fetch(`${CALENDAR_API_URL}/calendars/primary/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    })

    if (!response.ok) {
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
    const event = {
      summary: `${workplace.name} 근무`,
      description: schedule.memo || '',
      start: {
        dateTime: `${schedule.date}T${schedule.startTime}:00`,
        timeZone: 'Asia/Seoul',
      },
      end: {
        dateTime: `${schedule.date}T${schedule.endTime}:00`,
        timeZone: 'Asia/Seoul',
      },
      colorId: getColorId(workplace.color),
    }

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
