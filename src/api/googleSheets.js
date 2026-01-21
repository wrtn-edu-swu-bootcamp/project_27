/**
 * Google Sheets API 연동
 * 상태 저장소로 사용 (DB 대체)
 */

const SHEETS_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets'

/**
 * 스프레드시트 생성 (최초 1회)
 */
export async function createSpreadsheet(accessToken, userEmail) {
  try {
    const spreadsheet = {
      properties: {
        title: `N잡 매니저 - ${userEmail}`,
      },
      sheets: [
        {
          properties: {
            title: '근무 기록',
            gridProperties: {
              rowCount: 1000,
              columnCount: 10,
            },
          },
        },
        {
          properties: {
            title: '알바처',
            gridProperties: {
              rowCount: 100,
              columnCount: 10,
            },
          },
        },
      ],
    }

    const response = await fetch(SHEETS_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(spreadsheet),
    })

    if (!response.ok) {
      throw new Error('스프레드시트 생성 실패')
    }

    const data = await response.json()

    // 헤더 행 추가
    await initializeSheetHeaders(accessToken, data.spreadsheetId)

    return {
      success: true,
      spreadsheetId: data.spreadsheetId,
    }
  } catch (error) {
    console.error('스프레드시트 생성 오류:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 시트 헤더 초기화
 */
async function initializeSheetHeaders(accessToken, spreadsheetId) {
  const scheduleHeaders = [
    'ID',
    '알바처ID',
    '날짜',
    '시작시간',
    '종료시간',
    '메모',
    '생성일시',
    '출처',
  ]

  const workplaceHeaders = [
    'ID',
    '이름',
    '시급',
    '급여주기',
    '급여형태',
    '색상',
    '설정',
  ]

  await updateSheetValues(accessToken, spreadsheetId, '근무 기록!A1:H1', [
    scheduleHeaders,
  ])

  await updateSheetValues(accessToken, spreadsheetId, '알바처!A1:G1', [
    workplaceHeaders,
  ])
}

/**
 * 근무 기록 저장
 */
export async function saveScheduleToSheet(
  accessToken,
  spreadsheetId,
  schedule
) {
  try {
    const values = [
      [
        schedule.id,
        schedule.workplaceId,
        schedule.date,
        schedule.startTime,
        schedule.endTime,
        schedule.memo || '',
        schedule.createdAt,
        schedule.source || 'manual',
      ],
    ]

    await appendSheetValues(accessToken, spreadsheetId, '근무 기록!A:H', values)

    return {
      success: true,
    }
  } catch (error) {
    console.error('근무 기록 저장 오류:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 알바처 정보 저장
 */
export async function saveWorkplaceToSheet(
  accessToken,
  spreadsheetId,
  workplace
) {
  try {
    const values = [
      [
        workplace.id,
        workplace.name,
        workplace.hourlyWage,
        workplace.salaryType,
        workplace.incomeType,
        workplace.color,
        JSON.stringify(workplace.settings),
      ],
    ]

    await appendSheetValues(accessToken, spreadsheetId, '알바처!A:G', values)

    return {
      success: true,
    }
  } catch (error) {
    console.error('알바처 저장 오류:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 시트 데이터 읽기
 */
export async function getSheetValues(accessToken, spreadsheetId, range) {
  try {
    const response = await fetch(
      `${SHEETS_API_URL}/${spreadsheetId}/values/${range}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('시트 읽기 실패')
    }

    const data = await response.json()
    return {
      success: true,
      values: data.values || [],
    }
  } catch (error) {
    console.error('시트 읽기 오류:', error)
    return {
      success: false,
      error: error.message,
      values: [],
    }
  }
}

/**
 * 시트 데이터 업데이트
 */
async function updateSheetValues(accessToken, spreadsheetId, range, values) {
  const response = await fetch(
    `${SHEETS_API_URL}/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  )

  if (!response.ok) {
    throw new Error('시트 업데이트 실패')
  }

  return await response.json()
}

/**
 * 시트에 데이터 추가
 */
async function appendSheetValues(accessToken, spreadsheetId, range, values) {
  const response = await fetch(
    `${SHEETS_API_URL}/${spreadsheetId}/values/${range}:append?valueInputOption=RAW`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  )

  if (!response.ok) {
    throw new Error('시트 추가 실패')
  }

  return await response.json()
}
