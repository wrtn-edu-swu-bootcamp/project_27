/**
 * Google Sheets API 연동
 * 상태 저장소로 사용 (DB 대체)
 */

const SHEETS_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets'
const SCHEDULE_SHEET_NAME = '근무 기록'
const WORKPLACE_SHEET_NAME = '알바처'
const SCHEDULE_RANGE = `'${SCHEDULE_SHEET_NAME}'!A:H`
const WORKPLACE_RANGE = `'${WORKPLACE_SHEET_NAME}'!A:G`
const SCHEDULE_HEADER_RANGE = `'${SCHEDULE_SHEET_NAME}'!A1:H1`
const WORKPLACE_HEADER_RANGE = `'${WORKPLACE_SHEET_NAME}'!A1:G1`
const SCHEDULE_FULL_RANGE = `'${SCHEDULE_SHEET_NAME}'!A1:H`
const WORKPLACE_FULL_RANGE = `'${WORKPLACE_SHEET_NAME}'!A1:G`
const SCHEDULE_HEADERS = [
  'ID',
  '알바처ID',
  '날짜',
  '시작시간',
  '종료시간',
  '메모',
  '생성일시',
  '출처',
]
const WORKPLACE_HEADERS = [
  'ID',
  '이름',
  '시급',
  '급여주기',
  '급여형태',
  '색상',
  '설정',
]

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
            title: SCHEDULE_SHEET_NAME,
            gridProperties: {
              rowCount: 1000,
              columnCount: 10,
            },
          },
        },
        {
          properties: {
            title: WORKPLACE_SHEET_NAME,
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
      const errorText = await response.text()
      throw new Error(`스프레드시트 생성 실패 (${response.status}): ${errorText}`)
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
  await updateSheetValues(accessToken, spreadsheetId, SCHEDULE_HEADER_RANGE, [
    SCHEDULE_HEADERS,
  ])

  await updateSheetValues(accessToken, spreadsheetId, WORKPLACE_HEADER_RANGE, [
    WORKPLACE_HEADERS,
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

    const appendResult = await appendSheetValues(
      accessToken,
      spreadsheetId,
      SCHEDULE_RANGE,
      values
    )

    return {
      success: true,
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      updates: appendResult?.updates || null,
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

    const appendResult = await appendSheetValues(
      accessToken,
      spreadsheetId,
      WORKPLACE_RANGE,
      values
    )

    return {
      success: true,
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      updates: appendResult?.updates || null,
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
 * 스프레드시트 존재 확인 및 시트 초기화
 */
export async function ensureSpreadsheetReady(
  accessToken,
  userEmail,
  spreadsheetId
) {
  if (spreadsheetId) {
    const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId)
    if (meta.success) {
      await ensureSheetsExist(accessToken, spreadsheetId, meta.sheetTitles)
      await initializeSheetHeaders(accessToken, spreadsheetId)
      return { success: true, spreadsheetId, created: false }
    }

    if (meta.status !== 404) {
      return { success: false, error: meta.error }
    }
  }

  const result = await createSpreadsheet(accessToken, userEmail)
  if (!result.success) {
    return { success: false, error: result.error }
  }
  return { success: true, spreadsheetId: result.spreadsheetId, created: true }
}

/**
 * 스프레드시트 메타데이터 확인
 */
async function getSpreadsheetMetadata(accessToken, spreadsheetId) {
  const response = await fetch(
    `${SHEETS_API_URL}/${spreadsheetId}?fields=sheets(properties(title))`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    return {
      success: false,
      status: response.status,
      error: `스프레드시트 조회 실패 (${response.status}): ${errorText}`,
    }
  }

  const data = await response.json()
  const sheetTitles = (data?.sheets || [])
    .map((sheet) => sheet?.properties?.title)
    .filter(Boolean)
  return { success: true, sheetTitles }
}

async function ensureSheetsExist(accessToken, spreadsheetId, sheetTitles) {
  const missingTitles = []
  if (!sheetTitles.includes(SCHEDULE_SHEET_NAME)) {
    missingTitles.push(SCHEDULE_SHEET_NAME)
  }
  if (!sheetTitles.includes(WORKPLACE_SHEET_NAME)) {
    missingTitles.push(WORKPLACE_SHEET_NAME)
  }
  if (missingTitles.length === 0) return

  const response = await fetch(`${SHEETS_API_URL}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: missingTitles.map((title) => ({
        addSheet: { properties: { title } },
      })),
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`시트 추가 실패 (${response.status}): ${errorText}`)
  }
}

/**
 * 전체 일정 동기화
 */
export async function syncSchedulesToSheet(accessToken, spreadsheetId, schedules) {
  try {
    const rows = (schedules || []).map((schedule) => [
      schedule.id,
      schedule.workplaceId,
      schedule.date,
      schedule.startTime,
      schedule.endTime,
      schedule.memo || '',
      schedule.createdAt,
      schedule.source || 'manual',
    ])
    await updateSheetValues(accessToken, spreadsheetId, SCHEDULE_FULL_RANGE, [
      SCHEDULE_HEADERS,
      ...rows,
    ])

    return { success: true, rowCount: rows.length }
  } catch (error) {
    console.error('근무 기록 동기화 오류:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 전체 알바처 동기화
 */
export async function syncWorkplacesToSheet(
  accessToken,
  spreadsheetId,
  workplaces
) {
  try {
    const rows = (workplaces || []).map((workplace) => [
      workplace.id,
      workplace.name,
      workplace.hourlyWage,
      workplace.salaryType,
      workplace.incomeType,
      workplace.color,
      JSON.stringify(workplace.settings),
    ])
    await updateSheetValues(accessToken, spreadsheetId, WORKPLACE_FULL_RANGE, [
      WORKPLACE_HEADERS,
      ...rows,
    ])

    return { success: true, rowCount: rows.length }
  } catch (error) {
    console.error('알바처 동기화 오류:', error)
    return { success: false, error: error.message }
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
 * 근무 기록 삭제
 */
export async function deleteScheduleFromSheet(
  accessToken,
  spreadsheetId,
  scheduleId
) {
  try {
    const valuesResult = await getSheetValues(
      accessToken,
      spreadsheetId,
      SCHEDULE_RANGE
    )
    if (!valuesResult.success) {
      throw new Error(valuesResult.error || '시트 읽기 실패')
    }

    const rows = valuesResult.values || []
    const targetIndex = rows.findIndex((row) => row?.[0] === scheduleId)
    if (targetIndex === -1) {
      return { success: true, deleted: false, reason: 'not_found' }
    }

    const rowNumber = targetIndex + 1
    if (rowNumber === 1) {
      return { success: false, error: '헤더 행은 삭제할 수 없습니다.' }
    }

    const sheetId = await getSheetIdByTitle(
      accessToken,
      spreadsheetId,
      SCHEDULE_SHEET_NAME
    )
    if (sheetId == null) {
      throw new Error('시트 ID를 찾을 수 없습니다.')
    }

    await deleteSheetRow(accessToken, spreadsheetId, sheetId, rowNumber - 1)

    return { success: true, deleted: true }
  } catch (error) {
    console.error('근무 기록 삭제 오류:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 알바처 삭제
 */
export async function deleteWorkplaceFromSheet(
  accessToken,
  spreadsheetId,
  workplaceId
) {
  try {
    const valuesResult = await getSheetValues(
      accessToken,
      spreadsheetId,
      WORKPLACE_RANGE
    )
    if (!valuesResult.success) {
      throw new Error(valuesResult.error || '시트 읽기 실패')
    }

    const rows = valuesResult.values || []
    const targetIndex = rows.findIndex((row) => row?.[0] === workplaceId)
    if (targetIndex === -1) {
      return { success: true, deleted: false, reason: 'not_found' }
    }

    const rowNumber = targetIndex + 1
    if (rowNumber === 1) {
      return { success: false, error: '헤더 행은 삭제할 수 없습니다.' }
    }

    const sheetId = await getSheetIdByTitle(
      accessToken,
      spreadsheetId,
      WORKPLACE_SHEET_NAME
    )
    if (sheetId == null) {
      throw new Error('시트 ID를 찾을 수 없습니다.')
    }

    await deleteSheetRow(accessToken, spreadsheetId, sheetId, rowNumber - 1)

    return { success: true, deleted: true }
  } catch (error) {
    console.error('알바처 삭제 오류:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 근무 기록 수정
 */
export async function updateScheduleInSheet(
  accessToken,
  spreadsheetId,
  schedule
) {
  try {
    const valuesResult = await getSheetValues(
      accessToken,
      spreadsheetId,
      SCHEDULE_RANGE
    )
    if (!valuesResult.success) {
      throw new Error(valuesResult.error || '시트 읽기 실패')
    }

    const rows = valuesResult.values || []
    const targetIndex = rows.findIndex((row) => row?.[0] === schedule.id)
    if (targetIndex === -1) {
      return { success: false, error: '시트에서 해당 ID를 찾을 수 없습니다.' }
    }

    const rowNumber = targetIndex + 1
    if (rowNumber === 1) {
      return { success: false, error: '헤더 행은 수정할 수 없습니다.' }
    }

    const rowValues = [
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

    await updateSheetValues(
      accessToken,
      spreadsheetId,
      `'${SCHEDULE_SHEET_NAME}'!A${rowNumber}:H${rowNumber}`,
      rowValues
    )

    return { success: true }
  } catch (error) {
    console.error('근무 기록 수정 오류:', error)
    return { success: false, error: error.message }
  }
}

async function getSheetIdByTitle(accessToken, spreadsheetId, title) {
  const response = await fetch(
    `${SHEETS_API_URL}/${spreadsheetId}?fields=sheets(properties(sheetId,title))`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`시트 메타데이터 조회 실패 (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const sheet = data?.sheets?.find((s) => s?.properties?.title === title)
  return sheet?.properties?.sheetId ?? null
}

async function deleteSheetRow(accessToken, spreadsheetId, sheetId, rowIndex) {
  const response = await fetch(
    `${SHEETS_API_URL}/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`시트 행 삭제 실패 (${response.status}): ${errorText}`)
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
    const errorText = await response.text()
    throw new Error(`시트 업데이트 실패 (${response.status}): ${errorText}`)
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
    const errorText = await response.text()
    throw new Error(`시트 추가 실패 (${response.status}): ${errorText}`)
  }

  return await response.json()
}
