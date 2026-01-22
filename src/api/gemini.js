import { GoogleGenerativeAI } from '@google/generative-ai'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(API_KEY)
const MODEL_CANDIDATES = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro']

async function fetchAvailableModels() {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
    )
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`모델 목록 조회 실패 (${response.status}): ${errorText}`)
    }
    const data = await response.json()
    return data.models || []
  } catch (error) {
    return { error }
  }
}

function selectModelFromList(models) {
  const usable = (models || []).filter((model) =>
    model?.supportedGenerationMethods?.includes('generateContent')
  )
  if (usable.length === 0) return null

  const preferred = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro']
  for (const name of preferred) {
    const match = usable.find((model) => model.name?.endsWith(name))
    if (match) return match.name
  }

  return usable[0]?.name || null
}

async function generateWithFallback(parts) {
  let lastError = null

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent(parts)
    return { result, modelName }
    } catch (error) {
      lastError = error
    }
  }

  const modelListResult = await fetchAvailableModels()
  if (Array.isArray(modelListResult)) {
    const selected = selectModelFromList(modelListResult)
    if (selected) {
      try {
        const model = genAI.getGenerativeModel({ model: selected })
        const result = await model.generateContent(parts)
        return { result, modelName: selected }
      } catch (error) {
        lastError = error
      }
    }

    const availableNames = modelListResult
      .map((model) => model?.name)
      .filter(Boolean)
      .join(', ')
    const message = `사용 가능한 모델 조회 결과: ${availableNames || '없음'}`
    const error = new Error(
      lastError?.message ? `${lastError.message}\n${message}` : message
    )
    error.cause = lastError
    throw error
  }

  const message =
    modelListResult?.error?.message ||
    lastError?.message ||
    '사용 가능한 Gemini 모델을 찾지 못했습니다. API 키/권한을 확인해주세요.'
  const error = new Error(message)
  error.cause = lastError || modelListResult?.error
  throw error
}

/**
 * 이미지 일정표 분석
 * AI는 이미지를 구조화된 데이터로 변환만 수행
 */
export async function analyzeScheduleImage(imageFile, targetName) {
  try {
    // 이미지를 base64로 변환
    const base64Image = await fileToBase64(imageFile)
    const imagePart = {
      inlineData: {
        data: base64Image.split(',')[1],
        mimeType: imageFile.type,
      },
    }

    const prompt = `
이 이미지는 여러 명이 함께 있는 근무 일정표일 수 있습니다.
반드시 이름이 "${targetName}"인 사람의 일정만 추출해주세요.
해당 이름이 보이지 않으면 schedules를 빈 배열로 반환해주세요.

다음 정보를 JSON 형식으로 추출해주세요:

1. 각 근무 일정의 날짜 (YYYY-MM-DD 형식)
2. 근무 시작 시간 (HH:mm 형식)
3. 근무 종료 시간 (HH:mm 형식)
4. 기타 메모나 특이사항 (있는 경우)

**중요**: 
- 불확실한 값은 "uncertain" 필드를 true로 설정해주세요
- 읽을 수 없는 부분은 null로 표시해주세요
- 사용자가 반드시 확인해야 합니다
 - 이름 매칭이 애매하면 제외하고 notes에 이유를 적어주세요

응답 형식:
{
  "schedules": [
    {
      "date": "YYYY-MM-DD",
      "startTime": "HH:mm",
      "endTime": "HH:mm",
      "memo": "메모",
      "uncertain": boolean
    }
  ],
  "notes": "전체적인 주의사항이나 확인이 필요한 내용"
}
`

    const { result, modelName } = await generateWithFallback([prompt, imagePart])
    const response = await result.response
    const text = response.text()

    // JSON 추출
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('유효한 JSON 응답을 받지 못했습니다.')
    }

    const data = JSON.parse(jsonMatch[0])
    return {
      success: true,
      data,
      modelName,
      requiresUserConfirmation: true, // 항상 사용자 확인 필요
    }
  } catch (error) {
    console.error('일정표 분석 오류:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 알바처 설정 도우미
 * AI는 설명과 질문만 수행, 계산 결정은 하지 않음
 */
export async function getWorkplaceSettingsAdvice(settingType, workplaceName) {
  try {
    const prompts = {
      weeklyHolidayPay: `
"${workplaceName}"에서 근무하시는군요.

**주휴수당이란?**
- 일주일에 15시간 이상 근무하면 받을 수 있는 유급휴일 수당입니다
- 1주일 근무에 대해 하루치 급여(보통 8시간)를 추가로 받습니다
- 근로기준법에 명시된 근로자의 권리입니다

**질문:**
"${workplaceName}"에서 주휴수당을 지급하나요?

선택지:
1. ✅ 지급함 (확실함)
2. ❌ 지급하지 않음
3. ❓ 잘 모르겠음 (나중에 확인)

*잘 모르겠다면 고용주나 매니저에게 문의해보세요.
`,
      nightPay: `
"${workplaceName}"에서 근무하시는군요.

**야간수당이란?**
- 밤 10시(22:00)부터 아침 6시(06:00)까지 근무하면 받을 수 있습니다
- 해당 시간 근무에 대해 기본 시급의 50%를 추가로 받습니다
- 근로기준법에 명시된 근로자의 권리입니다

**질문:**
"${workplaceName}"에서 야간수당을 지급하나요?

선택지:
1. ✅ 지급함 (확실함)
2. ❌ 지급하지 않음
3. ❓ 잘 모르겠음 (나중에 확인)

*야간 근무가 있다면 꼭 확인해보세요.
`,
      holidayPay: `
"${workplaceName}"에서 근무하시는군요.

**휴일수당이란?**
- 법정공휴일에 근무하면 받을 수 있습니다
- 해당 날짜 근무에 대해 기본 시급의 50%를 추가로 받습니다
- 근로기준법에 명시된 근로자의 권리입니다

**질문:**
"${workplaceName}"에서 휴일수당을 지급하나요?

선택지:
1. ✅ 지급함 (확실함)
2. ❌ 지급하지 않음
3. ❓ 잘 모르겠음 (나중에 확인)

*주말 근무가 있다면 꼭 확인해보세요.
`,
    }

    const prompt = prompts[settingType]
    if (!prompt) {
      throw new Error('알 수 없는 설정 유형입니다.')
    }

    const { result, modelName } = await generateWithFallback(prompt)
    const response = await result.response
    const text = response.text()

    return {
      success: true,
      message: text,
      settingType,
      modelName,
    }
  } catch (error) {
    console.error('설정 도우미 오류:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 수당 질문 응답
 * 사용자의 질문에 따라 받을 수 있는 수당을 설명
 */
export async function getAllowanceQnA(question, workplaceName) {
  try {
    const prompt = `
사용자는 알바 수당과 세금/공제에 대해 잘 모르고 질문합니다.
질문에 대해 쉽고 간단하게 답변하고, 받을 수 있는 수당(주휴/야간/휴일)과 공제(3.3% 공제, 4대보험)를 구분해서 알려주세요.
불확실한 내용은 "확인 필요"로 표시하고, 필요한 추가 질문이 있으면 1-2개만 제안하세요.
법률 판단을 단정하지 말고, 최종 확인은 고용주/매니저에게 안내하세요.

세금/공제 참고:
- 3.3% 공제 = 소득세 3% + 지방소득세 0.3% (단기/일용직에서 흔함)
- 4대보험 공제는 주 15시간 이상 (또는 월 60시간 이상), 1개월 이상 근무 등 조건 충족 시 적용될 수 있음
- 4대보험(근로자 부담) 구성: 국민연금 4.5%, 건강보험 3.545%, 장기요양보험(건강보험료의 12.81%), 고용보험 0.9%
- 산재보험은 사업주 전액 부담으로 월급에서 공제되지 않음

알바처: ${workplaceName || '알바처 정보 없음'}
질문: ${question}

응답 형식(예시):
- 가능한 수당: ...
- 확인 필요: ...
- 추가 질문: ...
`

    const { result, modelName } = await generateWithFallback(prompt)
    const response = await result.response
    const text = response.text()

    return {
      success: true,
      answer: text.trim(),
      modelName,
    }
  } catch (error) {
    console.error('수당 질문 응답 오류:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 월별 급여 요약 생성
 * AI는 데이터를 쉽게 설명하는 역할만 수행
 */
export async function generateMonthlySummary(salaryData) {
  try {
    const prompt = `
다음은 이번 달 근무 및 급여 데이터입니다:

${JSON.stringify(salaryData, null, 2)}

이 데이터를 바탕으로 사용자에게 친근하고 이해하기 쉬운 요약 문장을 1-2줄로 작성해주세요.

예시:
- "이번 달은 주말 근무가 많아 휴일수당이 추가되어 예상보다 급여가 증가했습니다."
- "주 15시간 이상 근무를 유지해서 주휴수당을 받으셨네요. 잘하셨습니다!"
- "야간 근무 비중이 높아 야간수당이 많이 추가되었습니다."

**중요**: 
- 계산 결과를 변경하거나 판단하지 마세요
- 단순히 데이터를 설명만 해주세요
- 격려나 조언을 추가해도 좋습니다
`

    const { result, modelName } = await generateWithFallback(prompt)
    const response = await result.response
    const text = response.text()

    return {
      success: true,
      summary: text.trim(),
      modelName,
    }
  } catch (error) {
    console.error('요약 생성 오류:', error)
    return {
      success: false,
      error: error.message,
      summary: '이번 달 근무를 완료하셨습니다.',
    }
  }
}

/**
 * 파일을 Base64로 변환
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result)
    reader.onerror = (error) => reject(error)
  })
}
