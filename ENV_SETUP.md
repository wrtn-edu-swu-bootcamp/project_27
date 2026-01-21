# 환경 변수 설정 가이드

이 프로젝트를 실행하려면 다음 환경 변수가 필요합니다.

## 로컬 개발 환경

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# Google OAuth
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here

# Gemini API
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

## 환경 변수 발급 방법

### 1. Google OAuth Client ID

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. "API 및 서비스" > "사용자 인증 정보" 이동
4. "+ 사용자 인증 정보 만들기" > "OAuth 클라이언트 ID" 선택
5. 애플리케이션 유형: "웹 애플리케이션" 선택
6. 승인된 JavaScript 원본:
   - `http://localhost:3000` (개발)
   - `https://yourdomain.com` (프로덕션)
7. 승인된 리디렉션 URI:
   - `http://localhost:3000` (개발)
   - `https://yourdomain.com` (프로덕션)
8. 생성된 클라이언트 ID 복사

### 2. Google Calendar API 활성화

1. Google Cloud Console에서 "API 및 서비스" > "라이브러리" 이동
2. "Google Calendar API" 검색 및 선택
3. "사용 설정" 클릭

### 3. Google Sheets API 활성화

1. Google Cloud Console에서 "API 및 서비스" > "라이브러리" 이동
2. "Google Sheets API" 검색 및 선택
3. "사용 설정" 클릭

### 4. Gemini API Key

1. [Google AI Studio](https://makersuite.google.com/app/apikey) 접속
2. "Get API Key" 클릭
3. API 키 생성 및 복사

## Vercel 배포 시 환경 변수 설정

1. Vercel Dashboard에서 프로젝트 선택
2. "Settings" > "Environment Variables" 이동
3. 다음 변수 추가:
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_GEMINI_API_KEY`
4. "Save" 클릭

## 주의사항

- `.env` 파일은 절대 Git에 커밋하지 마세요
- API 키는 안전하게 보관하세요
- 프로덕션 환경에서는 도메인 제한을 설정하세요
- API 키가 노출되면 즉시 재발급하세요

## 테스트

환경 변수가 제대로 설정되었는지 확인:

```bash
npm run dev
```

브라우저 콘솔에서 API 키 관련 오류가 없는지 확인하세요.
