/**
 * Vercel Serverless Function
 * 이미지 일정표 분석
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { Readable } from 'stream'

const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY)

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // 이미지 데이터 파싱
    const contentType = req.headers['content-type'] || ''
    
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Invalid content type' })
    }

    // 요청 본문을 버퍼로 변환
    const chunks = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    // 간단한 multipart 파싱 (실제로는 formidable 등의 라이브러리 사용 권장)
    const boundary = contentType.split('boundary=')[1]
    const parts = buffer.toString('binary').split(`--${boundary}`)
    
    let imageData = null
    let mimeType = 'image/jpeg'

    for (const part of parts) {
      if (part.includes('Content-Type: image/')) {
        const typeMatch = part.match(/Content-Type: (image\/\w+)/)
        if (typeMatch) {
          mimeType = typeMatch[1]
        }
        
        const dataStart = part.indexOf('\r\n\r\n') + 4
        const dataEnd = part.lastIndexOf('\r\n')
        imageData = part.substring(dataStart, dataEnd)
        break
      }
    }

    if (!imageData) {
      return res.status(400).json({ error: '이미지를 찾을 수 없습니다' })
    }

    // Base64로 변환
    const base64Image = Buffer.from(imageData, 'binary').toString('base64')

    // Gemini API 호출
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

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

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType,
      },
    }

    const result = await model.generateContent([prompt, imagePart])
    const response = await result.response
    const text = response.text()

    // JSON 추출
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return res.status(500).json({ error: '유효한 JSON 응답을 받지 못했습니다' })
    }

    const data = JSON.parse(jsonMatch[0])

    return res.status(200).json({
      success: true,
      ...data,
      requiresUserConfirmation: true,
    })
  } catch (error) {
    console.error('일정표 분석 오류:', error)
    return res.status(500).json({
      error: '일정표 분석 중 오류가 발생했습니다',
      details: error.message,
    })
  }
}
