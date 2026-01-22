import { useGoogleLogin } from '@react-oauth/google'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import './Login.css'

function Login() {
  const navigate = useNavigate()
  const { login } = useAuthStore()

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        // 사용자 정보 가져오기
        const userInfoResponse = await fetch(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
          }
        )

        const userInfo = await userInfoResponse.json()

        // 상태 저장
        login(
          {
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
          },
          tokenResponse.access_token
        )

        // 대시보드로 이동
        navigate('/')
      } catch (error) {
        console.error('로그인 중 오류 발생:', error)
        alert('로그인에 실패했습니다. 다시 시도해주세요.')
      }
    },
    onError: (error) => {
      console.error('로그인 실패:', error)
      alert('로그인에 실패했습니다.')
    },
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/calendar',
    ].join(' '),
  })

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>N잡 매니저</h1>
          <p>AI 기반 근무 일정 및 급여 관리</p>
        </div>

        <div className="login-features">
          <div className="feature-item">
            <span className="feature-icon">🏢</span>
            <span>여러 알바처 통합 관리</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">💰</span>
            <span>정확한 급여 계산</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🤖</span>
            <span>AI 일정표 분석</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📅</span>
            <span>Google Calendar 연동</span>
          </div>
        </div>

        <button className="google-login-btn" onClick={() => googleLogin()}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9c0 1.452.348 2.827.957 4.042l3.007-2.335z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
            />
          </svg>
          Google 계정으로 시작하기
        </button>

        <div className="login-footer">
          <p>
            로그인하면 Google Calendar 접근 권한이 요청됩니다.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
