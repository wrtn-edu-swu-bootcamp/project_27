import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)

/**
 * 이미지 일정표 분석
 * AI는 이미지를 구조화된 데이터로 변환만 수행
 */
export async function analyzeScheduleImage(imageFile) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    // 이미지를 base64로 변환
    const base64Image = await fileToBase64(imageFile)
    const imagePart = {
      inlineData: {
        data: base64Image.split(',')[1],
        mimeType: imageFile.type,
      },
    }

    const prompt = `
이 이미지는 근무 일정표입니다.
다음 정보를 JSON 형식으로 추출해주세요:

1. 각 근무 일정의 날짜 (YYYY-MM-DD 형식)
2. 근무 시작 시간 (HH:mm 형식)
3. 근무 종료 시간 (HH:mm 형식)
4. 기타 메모나 특이사항 (있는 경우)

**중요**: 
- 불확실한 값은 "uncertain" 필드를 true로 설정해주세요
- 읽을 수 없는 부분은 null로 표시해주세요
- 사용자가 반드시 확인해야 합니다

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

    const result = await model.generateContent([prompt, imagePart])
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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

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
- 주말(토요일, 일요일)이나 공휴일에 근무하면 받을 수 있습니다
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

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    return {
      success: true,
      message: text,
      settingType,
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
 * 월별 급여 요약 생성
 * AI는 데이터를 쉽게 설명하는 역할만 수행
 */
export async function generateMonthlySummary(salaryData) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

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

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    return {
      success: true,
      summary: text.trim(),
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
