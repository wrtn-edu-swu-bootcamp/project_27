# N잡 매니저 - 빠른 시작 가이드

## 🚀 5분 안에 시작하기

### 1단계: 의존성 설치

```bash
npm install
```

### 2단계: 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GEMINI_API_KEY=your_gemini_api_key
```

**API 키 발급 방법은 `ENV_SETUP.md` 참고**

### 3단계: 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 📚 주요 문서

- **[README.md](./README.md)** - 프로젝트 개요 및 주요 기능
- **[ENV_SETUP.md](./ENV_SETUP.md)** - 환경 변수 설정 가이드
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - 개발자 가이드
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - 배포 가이드

## 🎯 핵심 기능

1. **알바처 관리** - 여러 알바를 한 곳에서 관리
2. **근무 일정 관리** - 수동 입력 또는 이미지로 일정 추가
3. **급여 계산** - 정확한 규칙 기반 급여 계산
4. **AI 도우미** - Gemini를 활용한 이미지 분석 및 설명

## 🛠️ 기술 스택

- **Frontend**: React 18 + Vite
- **State Management**: Zustand
- **AI**: Google Gemini API
- **APIs**: Google OAuth, Calendar, Sheets
- **Deployment**: Vercel

## 📖 사용 방법

### 1. 로그인
Google 계정으로 로그인

### 2. 알바처 등록
- "알바처 관리" 페이지에서 알바처 추가
- 시급, 수당 설정 입력

### 3. 일정 추가
- "일정 관리" 페이지에서 근무 일정 추가
- 수동 입력 또는 이미지 업로드

### 4. 급여 확인
- "급여 계산" 페이지에서 상세 급여 확인
- 알바처와 기간 선택

## 🎨 스크린샷

### 대시보드
전체 근무 현황 및 급여 요약

### 알바처 관리
여러 알바처 등록 및 수당 설정

### 일정 관리
근무 일정 추가 및 관리

### 급여 계산
상세 급여 내역 확인

## ⚠️ 중요 원칙

이 프로젝트에서 **AI는 보조 역할**만 수행합니다:

- ✅ 이미지를 데이터로 변환
- ✅ 제도를 쉽게 설명
- ✅ 사용자 판단을 돕는 질문
- ❌ **급여 계산 결정 (항상 명확한 규칙 기반)**

## 🤝 기여

이슈와 PR을 환영합니다!

1. 이 저장소를 Fork
2. 새 브랜치 생성 (`git checkout -b feature/amazing`)
3. 변경사항 커밋 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 푸시 (`git push origin feature/amazing`)
5. Pull Request 생성

## 📝 라이선스

MIT License

## 📧 문의

문제가 발생하면 GitHub Issues에 등록해주세요.

---

**즐거운 개발 되세요! 🎉**
