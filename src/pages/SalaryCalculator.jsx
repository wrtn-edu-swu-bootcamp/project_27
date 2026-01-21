import { useState, useEffect } from 'react'
import { useWorkplaceStore } from '../store/workplaceStore'
import { useScheduleStore } from '../store/scheduleStore'
import { calculateSalaryDetail } from '../utils/salaryCalculator'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import './SalaryCalculator.css'

function SalaryCalculator() {
  const { workplaces } = useWorkplaceStore()
  const { schedules } = useScheduleStore()
  const [selectedWorkplaceId, setSelectedWorkplaceId] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(
    format(new Date(), 'yyyy-MM')
  )
  const [salaryDetail, setSalaryDetail] = useState(null)

  useEffect(() => {
    if (selectedWorkplaceId) {
      calculateSalary()
    }
  }, [selectedWorkplaceId, selectedMonth, schedules])

  const calculateSalary = () => {
    const workplace = workplaces.find((w) => w.id === selectedWorkplaceId)
    if (!workplace) return

    const monthDate = new Date(selectedMonth + '-01')
    const monthStart = startOfMonth(monthDate)
    const monthEnd = endOfMonth(monthDate)

    const workplaceSchedules = schedules.filter(
      (s) =>
        s.workplaceId === selectedWorkplaceId &&
        new Date(s.date) >= monthStart &&
        new Date(s.date) <= monthEnd
    )

    if (workplaceSchedules.length === 0) {
      setSalaryDetail(null)
      return
    }

    const detail = calculateSalaryDetail(workplaceSchedules, workplace)
    setSalaryDetail({ ...detail, workplace, scheduleCount: workplaceSchedules.length })
  }

  return (
    <div className="salary-calculator">
      <div className="page-header">
        <h1>급여 계산</h1>
        <p>알바처와 기간을 선택하여 상세 급여를 확인하세요</p>
      </div>

      <div className="card">
        <div className="filters">
          <div className="input-group">
            <label>알바처</label>
            <select
              value={selectedWorkplaceId}
              onChange={(e) => setSelectedWorkplaceId(e.target.value)}
            >
              <option value="">선택하세요</option>
              {workplaces.map((workplace) => (
                <option key={workplace.id} value={workplace.id}>
                  {workplace.name}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>기간</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
        </div>
      </div>

      {!selectedWorkplaceId ? (
        <div className="empty-state">
          <p>알바처를 선택해주세요</p>
        </div>
      ) : !salaryDetail ? (
        <div className="empty-state">
          <p>선택한 기간에 근무 일정이 없습니다</p>
        </div>
      ) : (
        <>
          {/* 급여 요약 */}
          <div className="salary-summary-card">
            <div className="summary-header">
              <div>
                <h2>{salaryDetail.workplace.name}</h2>
                <p className="summary-period">
                  {format(new Date(selectedMonth + '-01'), 'yyyy년 M월')}
                </p>
              </div>
              <div className="total-amount">
                {salaryDetail.totalAfterTax.toLocaleString()}원
              </div>
            </div>

            <div className="summary-grid">
              <div className="summary-item">
                <span className="label">근무 일수</span>
                <span className="value">{salaryDetail.scheduleCount}일</span>
              </div>
              <div className="summary-item">
                <span className="label">총 근무 시간</span>
                <span className="value">{salaryDetail.totalHours}시간</span>
              </div>
              <div className="summary-item">
                <span className="label">시급</span>
                <span className="value">
                  {salaryDetail.workplace.hourlyWage.toLocaleString()}원
                </span>
              </div>
              <div className="summary-item">
                <span className="label">급여 형태</span>
                <span className="value">
                  {salaryDetail.workplace.incomeType === 'employment'
                    ? '근로소득'
                    : '사업소득'}
                </span>
              </div>
            </div>
          </div>

          {/* 급여 상세 */}
          <div className="card">
            <div className="card-header">
              <h2>급여 상세 내역</h2>
            </div>

            <div className="salary-breakdown">
              <div className="breakdown-item">
                <div className="breakdown-label">
                  <span className="label-text">기본급</span>
                  <span className="label-hint">
                    {salaryDetail.totalHours}시간 ×{' '}
                    {salaryDetail.workplace.hourlyWage.toLocaleString()}원
                  </span>
                </div>
                <div className="breakdown-value">
                  {salaryDetail.basicPay.toLocaleString()}원
                </div>
              </div>

              {salaryDetail.nightPay > 0 && (
                <div className="breakdown-item extra">
                  <div className="breakdown-label">
                    <span className="label-text">야간수당</span>
                    <span className="label-hint">22:00~06:00 근무 시 50%</span>
                  </div>
                  <div className="breakdown-value extra-value">
                    +{salaryDetail.nightPay.toLocaleString()}원
                  </div>
                </div>
              )}

              {salaryDetail.holidayPay > 0 && (
                <div className="breakdown-item extra">
                  <div className="breakdown-label">
                    <span className="label-text">휴일수당</span>
                    <span className="label-hint">주말/공휴일 근무 시 50%</span>
                  </div>
                  <div className="breakdown-value extra-value">
                    +{salaryDetail.holidayPay.toLocaleString()}원
                  </div>
                </div>
              )}

              {salaryDetail.weeklyHolidayPay > 0 && (
                <div className="breakdown-item extra">
                  <div className="breakdown-label">
                    <span className="label-text">주휴수당</span>
                    <span className="label-hint">주 15시간 이상 근무 시</span>
                  </div>
                  <div className="breakdown-value extra-value">
                    +{salaryDetail.weeklyHolidayPay.toLocaleString()}원
                  </div>
                </div>
              )}

              <div className="breakdown-divider"></div>

              <div className="breakdown-item subtotal">
                <div className="breakdown-label">
                  <span className="label-text">세전 총액</span>
                </div>
                <div className="breakdown-value">
                  {salaryDetail.totalBeforeTax.toLocaleString()}원
                </div>
              </div>

              {salaryDetail.tax > 0 && (
                <div className="breakdown-item deduction">
                  <div className="breakdown-label">
                    <span className="label-text">세금 (3.3%)</span>
                    <span className="label-hint">사업소득 공제</span>
                  </div>
                  <div className="breakdown-value deduction-value">
                    -{salaryDetail.tax.toLocaleString()}원
                  </div>
                </div>
              )}

              <div className="breakdown-divider"></div>

              <div className="breakdown-item total">
                <div className="breakdown-label">
                  <span className="label-text">실수령액</span>
                </div>
                <div className="breakdown-value total-value">
                  {salaryDetail.totalAfterTax.toLocaleString()}원
                </div>
              </div>
            </div>

            {/* 경고 메시지 */}
            {salaryDetail.warnings && salaryDetail.warnings.length > 0 && (
              <div className="warnings-section">
                <h3>⚠️ 확인이 필요한 항목</h3>
                {salaryDetail.warnings.map((warning, idx) => (
                  <div key={idx} className="warning-item">
                    {warning}
                  </div>
                ))}
              </div>
            )}

            {/* 계산 설명 */}
            <div className="calculation-note">
              <h4>💡 급여 계산 안내</h4>
              <ul>
                <li>
                  <strong>기본급:</strong> 근무 시간 × 시급
                </li>
                <li>
                  <strong>야간수당:</strong> 22:00~06:00 근무 시 기본급의 50% 추가
                </li>
                <li>
                  <strong>휴일수당:</strong> 주말/공휴일 근무 시 기본급의 50% 추가
                </li>
                <li>
                  <strong>주휴수당:</strong> 주 15시간 이상 근무 시 1일치 급여(8시간)
                  지급
                </li>
                <li>
                  <strong>사업소득:</strong> 총 급여에서 3.3% 세금 공제
                </li>
              </ul>
              <p className="note-footer">
                * 모든 계산은 명확한 규칙 기반으로 처리되며, AI는 설명과 보조 역할만
                수행합니다.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default SalaryCalculator
