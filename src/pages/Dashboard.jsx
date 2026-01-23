import { useEffect, useState } from 'react'
import { useWorkplaceStore } from '../store/workplaceStore'
import { useScheduleStore } from '../store/scheduleStore'
import { calculateSalaryDetail } from '../utils/salaryCalculator'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import './Dashboard.css'

function Dashboard() {
  const { workplaces } = useWorkplaceStore()
  const { schedules } = useScheduleStore()
  const [currentMonth] = useState(new Date())
  const [monthlyData, setMonthlyData] = useState([])
  const [totalSummary, setTotalSummary] = useState({
    totalHours: 0,
    totalPay: 0,
  })

  useEffect(() => {
    calculateMonthlyData()
  }, [workplaces, schedules, currentMonth])

  const calculateMonthlyData = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)

    let totalHours = 0
    let totalPay = 0
    const data = []

    workplaces.forEach((workplace) => {
      const workplaceSchedules = schedules.filter(
        (s) =>
          s.workplaceId === workplace.id &&
          new Date(s.date) >= monthStart &&
          new Date(s.date) <= monthEnd
      )

      if (workplaceSchedules.length > 0) {
        const allWorkplaceSchedules = schedules.filter((s) => s.workplaceId === workplace.id)
        const salaryDetail = calculateSalaryDetail(workplaceSchedules, workplace, {
          allSchedulesForWeeklyHolidayPay: allWorkplaceSchedules,
        })
        
        totalHours += salaryDetail.totalHours
        totalPay += salaryDetail.totalAfterTax

        data.push({
          workplace,
          scheduleCount: workplaceSchedules.length,
          ...salaryDetail,
        })
      }
    })

    setMonthlyData(data)
    setTotalSummary({ totalHours, totalPay })
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>대시보드</h1>
        <p>{format(currentMonth, 'yyyy년 M월')} 근무 현황</p>
      </div>

      {/* 전체 요약 */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-label">총 근무 시간</div>
          <div className="summary-value">{totalSummary.totalHours}시간</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">예상 급여</div>
          <div className="summary-value">
            {totalSummary.totalPay.toLocaleString()}원
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">알바처</div>
          <div className="summary-value">{workplaces.length}곳</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">이번 달 근무</div>
          <div className="summary-value">
            {schedules.filter((s) => {
              const date = new Date(s.date)
              return (
                date >= startOfMonth(currentMonth) &&
                date <= endOfMonth(currentMonth)
              )
            }).length}
            일
          </div>
        </div>
      </div>

      {/* 알바처별 상세 */}
      <div className="card">
        <div className="card-header">
          <h2>알바처별 급여 상세</h2>
        </div>
        {monthlyData.length === 0 ? (
          <div className="empty-state">
            <p>등록된 근무 일정이 없습니다.</p>
            <p className="empty-hint">알바처를 등록하고 근무 일정을 추가해보세요.</p>
          </div>
        ) : (
          <div className="workplace-list">
            {monthlyData.map((data, index) => (
              <div key={index} className="workplace-item">
                <div className="workplace-header">
                  <div className="workplace-info">
                    <div
                      className="workplace-color"
                      style={{ backgroundColor: data.workplace.color || '#4285f4' }}
                    />
                    <h3>{data.workplace.name}</h3>
                  </div>
                  <div className="workplace-total">
                    {data.totalAfterTax.toLocaleString()}원
                  </div>
                </div>
                <div className="workplace-details">
                  <div className="detail-row">
                    <span>근무 일수:</span>
                    <span>{data.scheduleCount}일</span>
                  </div>
                  <div className="detail-row">
                    <span>총 근무 시간:</span>
                    <span>{data.totalHours}시간</span>
                  </div>
                  <div className="detail-row">
                    <span>기본급:</span>
                    <span>{data.basicPay.toLocaleString()}원</span>
                  </div>
                  {data.nightPay > 0 && (
                    <div className="detail-row">
                      <span>야간수당:</span>
                      <span className="extra-pay">
                        +{data.nightPay.toLocaleString()}원
                      </span>
                    </div>
                  )}
                  {data.holidayPay > 0 && (
                    <div className="detail-row">
                      <span>휴일수당:</span>
                      <span className="extra-pay">
                        +{data.holidayPay.toLocaleString()}원
                      </span>
                    </div>
                  )}
                  {data.workplace?.settings?.weeklyHolidayPay?.userConfirmed && (
                    <div className="detail-row">
                      <span>주휴수당:</span>
                      <span className="extra-pay">
                        {data.weeklyHolidayPay > 0 ? '+' : ''}
                        {data.weeklyHolidayPay.toLocaleString()}원
                      </span>
                    </div>
                  )}
                  {(data.tax > 0 || data.taxType === 'four_insurance') && (
                    <div className="detail-row">
                      <span>
                        {data.taxType === 'four_insurance'
                          ? '4대보험 공제:'
                          : `세금 ${data.taxType === 'withholding3_3' ? '(3.3%)' : ''}:`}
                      </span>
                      <span className="tax">-{data.tax.toLocaleString()}원</span>
                    </div>
                  )}
                  {data.taxType === 'four_insurance' && data.insuranceBreakdown && (
                    <div className="detail-row">
                      <span>국민연금:</span>
                      <span className="tax">
                        -{data.insuranceBreakdown.pension.toLocaleString()}원
                      </span>
                    </div>
                  )}
                  {data.taxType === 'four_insurance' && data.insuranceBreakdown && (
                    <div className="detail-row">
                      <span>건강보험:</span>
                      <span className="tax">
                        -{data.insuranceBreakdown.health.toLocaleString()}원
                      </span>
                    </div>
                  )}
                  {data.taxType === 'four_insurance' && data.insuranceBreakdown && (
                    <div className="detail-row">
                      <span>장기요양:</span>
                      <span className="tax">
                        -{data.insuranceBreakdown.longTermCare.toLocaleString()}원
                      </span>
                    </div>
                  )}
                  {data.taxType === 'four_insurance' && data.insuranceBreakdown && (
                    <div className="detail-row">
                      <span>고용보험:</span>
                      <span className="tax">
                        -{data.insuranceBreakdown.employment.toLocaleString()}원
                      </span>
                    </div>
                  )}
                  {data.warnings && data.warnings.length > 0 && (
                    <div className="warnings">
                      {data.warnings.map((warning, idx) => (
                        <div key={idx} className="warning-item">
                          ⚠️ {warning}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
