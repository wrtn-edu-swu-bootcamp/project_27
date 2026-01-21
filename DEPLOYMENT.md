# 배포 가이드

이 문서는 N잡 매니저를 Vercel에 배포하는 방법을 설명합니다.

## 사전 준비

1. GitHub 계정
2. Vercel 계정 ([vercel.com](https://vercel.com))
3. 환경 변수 (Google OAuth, Gemini API Key)

## 배포 단계

### 1. GitHub 저장소 생성

```bash
# Git 초기화 (아직 안 했다면)
git init

# 원격 저장소 추가
git remote add origin https://github.com/your-username/n-job-manager.git

# 커밋 및 푸시
git add .
git commit -m "Initial commit: N잡 매니저 프로젝트"
git push -u origin main
```

### 2. Vercel 프로젝트 생성

#### 방법 1: Vercel Dashboard 사용

1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. "New Project" 클릭
3. GitHub 저장소 선택
4. 프로젝트 설정:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. "Deploy" 클릭

#### 방법 2: Vercel CLI 사용

```bash
# Vercel CLI 설치
npm install -g vercel

# 로그인
vercel login

# 배포
vercel

# 프로덕션 배포
vercel --prod
```

### 3. 환경 변수 설정

Vercel Dashboard에서:

1. 프로젝트 선택
2. "Settings" > "Environment Variables"
3. 다음 변수 추가:

```
VITE_GOOGLE_CLIENT_ID = your_google_client_id
VITE_GEMINI_API_KEY = your_gemini_api_key
```

4. "Save" 클릭
5. 프로젝트 재배포 (자동 또는 수동)

### 4. Google OAuth 설정 업데이트

배포 후 Vercel이 제공하는 도메인을 Google OAuth 설정에 추가:

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. OAuth 클라이언트 ID 편집
3. 승인된 JavaScript 원본에 추가:
   - `https://your-project.vercel.app`
4. 승인된 리디렉션 URI에 추가:
   - `https://your-project.vercel.app`
5. 저장

### 5. 배포 확인

1. Vercel이 제공하는 URL 접속
2. 로그인 기능 테스트
3. 모든 주요 기능 테스트:
   - 알바처 등록
   - 일정 추가
   - 급여 계산
   - 이미지 분석 (Gemini)

## 자동 배포 설정

Vercel은 기본적으로 GitHub와 연동되어 자동 배포를 지원합니다:

- `main` 브랜치에 푸시 → 프로덕션 자동 배포
- 다른 브랜치에 푸시 → 프리뷰 배포

### 브랜치별 배포 전략

```bash
# 개발 브랜치
git checkout -b dev
git push origin dev
# → Vercel이 프리뷰 URL 생성

# 프로덕션 배포
git checkout main
git merge dev
git push origin main
# → 프로덕션 자동 배포
```

## 커스텀 도메인 설정

1. Vercel Dashboard에서 프로젝트 선택
2. "Settings" > "Domains"
3. 커스텀 도메인 추가
4. DNS 설정 (Vercel이 제공하는 안내 따르기)
5. SSL 인증서 자동 발급 (Vercel 자동 처리)

## 성능 최적화

### 1. 빌드 최적화

```javascript
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          google: ['@google/generative-ai', '@react-oauth/google'],
        },
      },
    },
  },
})
```

### 2. 이미지 최적화

- 이미지는 Vercel Image Optimization 사용 권장
- 로고/아이콘은 SVG 사용

### 3. 캐싱 전략

Vercel은 자동으로 정적 파일에 캐싱을 적용합니다.

## 모니터링

### Vercel Analytics 활성화

1. Vercel Dashboard에서 "Analytics" 탭
2. "Enable Analytics" 클릭
3. 트래픽, 성능 지표 확인

### 에러 로깅

```bash
# Vercel Logs 확인
vercel logs
```

## 문제 해결

### 배포 실패 시

1. 빌드 로그 확인
2. 환경 변수 확인
3. `package.json`의 의존성 확인

```bash
# 로컬에서 프로덕션 빌드 테스트
npm run build
npm run preview
```

### API 오류 시

1. Serverless Function 로그 확인
2. API 키 권한 확인
3. CORS 설정 확인

## 업데이트 및 유지보수

```bash
# 코드 수정 후
git add .
git commit -m "Feature: 새로운 기능 추가"
git push origin main
# Vercel이 자동으로 배포
```

## 비용

- Vercel Free Tier:
  - 대역폭: 100GB/월
  - Serverless Function 실행 시간: 100시간/월
  - 대부분의 개인 프로젝트에 충분

- Gemini API:
  - Free Tier: 분당 15회 요청
  - 개인 사용에 충분

## 보안 체크리스트

- [ ] `.env` 파일이 `.gitignore`에 포함되어 있는가?
- [ ] 환경 변수가 Vercel에만 저장되어 있는가?
- [ ] Google OAuth 도메인 제한이 설정되어 있는가?
- [ ] API 키가 코드에 하드코딩되어 있지 않은가?

## 참고 자료

- [Vercel 공식 문서](https://vercel.com/docs)
- [Vite 배포 가이드](https://vitejs.dev/guide/static-deploy.html)
- [React 프로덕션 빌드](https://react.dev/learn/start-a-new-react-project)
