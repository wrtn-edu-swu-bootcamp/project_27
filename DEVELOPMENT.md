# N잡 매니저 - 개발 가이드

## 프로젝트 구조

```
project/
├── src/
│   ├── api/                 # API 연동 로직
│   │   ├── gemini.js       # Gemini AI 연동
│   │   ├── googleCalendar.js  # Google Calendar 연동
│   │   └── googleSheets.js    # Google Sheets 연동
│   ├── components/         # 재사용 컴포넌트
│   │   ├── Layout.jsx     # 레이아웃 컴포넌트
│   │   └── Layout.css
│   ├── pages/             # 페이지 컴포넌트
│   │   ├── Login.jsx      # 로그인 페이지
│   │   ├── Dashboard.jsx  # 대시보드
│   │   ├── WorkplaceManager.jsx  # 알바처 관리
│   │   ├── ScheduleManager.jsx   # 일정 관리
│   │   └── SalaryCalculator.jsx  # 급여 계산
│   ├── store/             # Zustand 상태 관리
│   │   ├── authStore.js   # 인증 상태
│   │   ├── workplaceStore.js  # 알바처 상태
│   │   └── scheduleStore.js   # 일정 상태
│   ├── utils/             # 유틸리티 함수
│   │   └── salaryCalculator.js  # 급여 계산 로직
│   ├── App.jsx            # 메인 앱
│   ├── App.css
│   ├── main.jsx           # 엔트리 포인트
│   └── index.css
├── api/                   # Vercel Serverless Functions
│   └── analyze-schedule.js  # 이미지 분석 API
├── public/                # 정적 파일
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
├── README.md
├── ENV_SETUP.md          # 환경 변수 설정 가이드
├── DEPLOYMENT.md         # 배포 가이드
└── DEVELOPMENT.md        # 이 파일
```

## 개발 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 필요한 API 키를 설정하세요.
자세한 내용은 `ENV_SETUP.md`를 참고하세요.

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

### 4. 빌드 테스트

```bash
npm run build
npm run preview
```

## 주요 기능 개발 가이드

### 알바처 관리

**파일**: `src/pages/WorkplaceManager.jsx`

알바처 데이터 구조:
```javascript
{
  id: string,
  name: string,
  hourlyWage: number,
  salaryType: 'weekly' | 'monthly',
  incomeType: 'employment' | 'business',
  color: string,
  settings: {
    weeklyHolidayPay: {
      supported: boolean,
      userConfirmed: boolean,
      condition: string,
      status: 'confirmed' | 'conditional' | 'unknown'
    },
    // nightPay, holidayPay도 동일한 구조
  }
}
```

### 근무 일정 관리

**파일**: `src/pages/ScheduleManager.jsx`

일정 데이터 구조:
```javascript
{
  id: string,
  workplaceId: string,
  date: string, // YYYY-MM-DD
  startTime: string, // HH:mm
  endTime: string, // HH:mm
  memo: string,
  createdAt: timestamp,
  source: 'manual' | 'image' | 'calendar'
}
```

### 급여 계산

**파일**: `src/utils/salaryCalculator.js`

**중요**: 급여 계산은 AI를 사용하지 않고 순수 함수로 구현되어 있습니다.

주요 함수:
- `calculateWorkMinutes(startTime, endTime)` - 근무 시간 계산
- `calculateBasicPay(minutes, hourlyWage)` - 기본급 계산
- `calculateNightMinutes(startTime, endTime)` - 야간 근무 시간 계산
- `calculateNightPay(...)` - 야간 수당 계산
- `calculateWeeklyHolidayPay(...)` - 주휴수당 계산
- `calculateHolidayPay(...)` - 휴일수당 계산
- `calculateSalaryDetail(schedules, workplace)` - 전체 급여 상세 계산

### Gemini AI 연동

**파일**: `src/api/gemini.js`

#### 1. 이미지 일정표 분석

```javascript
import { analyzeScheduleImage } from './api/gemini'

const result = await analyzeScheduleImage(imageFile)
// result.data.schedules - 추출된 일정 배열
// result.requiresUserConfirmation - 항상 true
```

**중요**: AI는 이미지를 구조화된 데이터로만 변환하며, 사용자가 반드시 확인해야 합니다.

#### 2. 알바처 설정 도우미

```javascript
import { getWorkplaceSettingsAdvice } from './api/gemini'

const result = await getWorkplaceSettingsAdvice('weeklyHolidayPay', '카페 A')
// result.message - 설명 및 질문 텍스트
```

AI의 역할:
- ✅ 제도 설명
- ✅ 질문 생성
- ❌ 설정 값 결정 (사용자가 직접 선택)

#### 3. 월별 요약 생성

```javascript
import { generateMonthlySummary } from './api/gemini'

const result = await generateMonthlySummary(salaryData)
// result.summary - 사용자 친화적인 요약 문장
```

AI의 역할:
- ✅ 데이터를 쉽게 설명
- ❌ 계산 결과 변경 또는 판단

### Google APIs 연동

#### Google Calendar

**파일**: `src/api/googleCalendar.js`

```javascript
import { addEventToCalendar, deleteEventFromCalendar, updateEventInCalendar } from './api/googleCalendar'

// 일정 추가
const result = await addEventToCalendar(accessToken, schedule, workplace)

// 일정 삭제
await deleteEventFromCalendar(accessToken, eventId)

// 일정 수정
await updateEventInCalendar(accessToken, eventId, schedule, workplace)
```

#### Google Sheets

**파일**: `src/api/googleSheets.js`

```javascript
import { createSpreadsheet, saveScheduleToSheet, saveWorkplaceToSheet } from './api/googleSheets'

// 스프레드시트 생성 (최초 1회)
const result = await createSpreadsheet(accessToken, userEmail)
const spreadsheetId = result.spreadsheetId

// 근무 기록 저장
await saveScheduleToSheet(accessToken, spreadsheetId, schedule)

// 알바처 저장
await saveWorkplaceToSheet(accessToken, spreadsheetId, workplace)
```

**주의**: Sheets는 사용자에게 직접 노출하지 않고 백그라운드 데이터 저장용으로만 사용됩니다.

## 상태 관리 (Zustand)

### 인증 상태

```javascript
import { useAuthStore } from './store/authStore'

const { user, accessToken, login, logout } = useAuthStore()
```

### 알바처 상태

```javascript
import { useWorkplaceStore } from './store/workplaceStore'

const { workplaces, addWorkplace, updateWorkplace, deleteWorkplace } = useWorkplaceStore()
```

### 일정 상태

```javascript
import { useScheduleStore } from './store/scheduleStore'

const { schedules, events, addSchedule, updateSchedule, deleteSchedule } = useScheduleStore()
```

## 스타일링 가이드

### CSS 구조

- 전역 스타일: `src/index.css`, `src/App.css`
- 컴포넌트별 스타일: 각 `.jsx` 파일과 같은 이름의 `.css` 파일

### 색상 팔레트

```css
/* 주요 색상 */
--primary: #4285f4;
--success: #34a853;
--warning: #fbbc04;
--danger: #ea4335;

/* 텍스트 */
--text-primary: #202124;
--text-secondary: #5f6368;
--text-disabled: #80868b;

/* 배경 */
--bg-primary: #ffffff;
--bg-secondary: #f8f9fa;
--border: #e8eaed;
```

### 반응형 디자인

```css
/* 모바일 */
@media (max-width: 768px) {
  /* 스타일 */
}

/* 태블릿 */
@media (max-width: 968px) {
  /* 스타일 */
}
```

## 디버깅

### 개발자 도구 활용

1. React DevTools 설치
2. Zustand DevTools 활용:

```javascript
// store 파일에 devtools 추가
import { devtools } from 'zustand/middleware'

export const useStore = create(
  devtools(
    persist(
      (set) => ({
        // state
      }),
      { name: 'store-name' }
    )
  )
)
```

### 로그 확인

```javascript
// API 호출 로그
console.log('API Request:', data)
console.log('API Response:', response)

// 계산 로그
console.log('Salary Detail:', salaryDetail)
```

## 테스트

### 수동 테스트 체크리스트

#### 로그인
- [ ] Google 로그인 성공
- [ ] 로그아웃 후 재로그인
- [ ] 권한 요청 확인

#### 알바처 관리
- [ ] 알바처 추가
- [ ] 알바처 수정
- [ ] 알바처 삭제
- [ ] 수당 설정 저장

#### 일정 관리
- [ ] 수동 일정 추가
- [ ] 일정 수정
- [ ] 일정 삭제
- [ ] 이미지 업로드 (Gemini 분석)

#### 급여 계산
- [ ] 기본급 계산 정확성
- [ ] 야간수당 계산
- [ ] 주휴수당 계산
- [ ] 휴일수당 계산
- [ ] 세금 공제 (사업소득)

## 성능 최적화

### 1. 컴포넌트 최적화

```javascript
import { memo, useMemo, useCallback } from 'react'

const Component = memo(({ data }) => {
  const calculated = useMemo(() => expensiveCalculation(data), [data])
  
  const handleClick = useCallback(() => {
    // 핸들러
  }, [])
  
  return <div>{calculated}</div>
})
```

### 2. 이미지 최적화

- 업로드 전 이미지 리사이징
- WebP 형식 사용 권장

### 3. 번들 크기 최적화

```bash
# 번들 분석
npm run build -- --mode analyze
```

## 코드 규칙

### 네이밍 컨벤션

- 컴포넌트: PascalCase (`WorkplaceManager`)
- 함수/변수: camelCase (`calculateSalary`)
- 상수: UPPER_SNAKE_CASE (`API_URL`)
- 파일명: 컴포넌트는 PascalCase, 나머지는 camelCase

### import 순서

```javascript
// 1. React
import { useState, useEffect } from 'react'

// 2. 외부 라이브러리
import { useNavigate } from 'react-router-dom'

// 3. 내부 모듈
import { useAuthStore } from '../store/authStore'
import { calculateSalary } from '../utils/salaryCalculator'

// 4. 스타일
import './Component.css'
```

### 주석 작성

```javascript
/**
 * 급여 계산 함수
 * 
 * @param {Array} schedules - 근무 일정 배열
 * @param {Object} workplace - 알바처 정보
 * @returns {Object} 급여 상세 내역
 */
function calculateSalaryDetail(schedules, workplace) {
  // 구현
}
```

## 문제 해결

### 자주 발생하는 문제

#### 1. Google OAuth 오류

```
Error: redirect_uri_mismatch
```

**해결**: Google Cloud Console에서 리디렉션 URI 확인

#### 2. Gemini API 오류

```
Error: API key not valid
```

**해결**: `.env` 파일의 `VITE_GEMINI_API_KEY` 확인

#### 3. 상태가 유지되지 않음

**해결**: Zustand persist 설정 확인

```javascript
// localStorage 확인
localStorage.getItem('auth-storage')
```

## 기여 가이드

1. 새 브랜치 생성
```bash
git checkout -b feature/new-feature
```

2. 코드 작성 및 테스트

3. 커밋
```bash
git commit -m "Feature: 새로운 기능 설명"
```

4. 푸시
```bash
git push origin feature/new-feature
```

5. Pull Request 생성

## 참고 자료

- [React 공식 문서](https://react.dev/)
- [Vite 공식 문서](https://vitejs.dev/)
- [Zustand 공식 문서](https://github.com/pmndrs/zustand)
- [Google AI Studio](https://makersuite.google.com/)
- [Google Calendar API](https://developers.google.com/calendar)
- [Google Sheets API](https://developers.google.com/sheets)
