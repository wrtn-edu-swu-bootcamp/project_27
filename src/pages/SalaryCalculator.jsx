import { useEffect, useMemo, useState } from 'react'
import { useWorkplaceStore } from '../store/workplaceStore'
import { useScheduleStore } from '../store/scheduleStore'
import { calculateSalaryDetail } from '../utils/salaryCalculator'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import './SalaryCalculator.css'

function SalaryCalculator() {
  const { workplaces } = useWorkplaceStore()
  const { schedules } = useScheduleStore()
  const [rangeStartMonth, setRangeStartMonth] = useState(
    format(new Date(), 'yyyy-01')
  )
  const [rangeEndMonth, setRangeEndMonth] = useState(format(new Date(), 'yyyy-MM'))

  const buildInclusiveRangeByMonth = (startMonthValue, endMonthValue) => {
    const startDate = new Date(`${startMonthValue}-01`)
    const endDate = endOfMonth(new Date(`${endMonthValue}-01`))
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return null
    }
    if (startDate <= endDate) {
      return { start: startOfMonth(startDate), end: endDate }
    }
    return {
      start: startOfMonth(new Date(`${endMonthValue}-01`)),
      end: endOfMonth(new Date(`${startMonthValue}-01`)),
    }
  }

  const rangeResult = useMemo(() => {
    const range = buildInclusiveRangeByMonth(rangeStartMonth, rangeEndMonth)
    if (!range) {
      return {
        start: null,
        end: null,
        totalPay: 0,
        totalHours: 0,
        totalDays: 0,
        perWorkplace: [],
      }
    }

    let totalHours = 0
    let totalPay = 0
    let totalDays = 0
    const perWorkplace = []

    workplaces.forEach((workplace) => {
      const workplaceSchedules = schedules.filter((schedule) => {
        if (schedule.workplaceId !== workplace.id) return false
        const date = new Date(schedule.date)
        return date >= range.start && date <= range.end
      })

      if (workplaceSchedules.length === 0) return

      const detail = calculateSalaryDetail(workplaceSchedules, workplace)
      totalHours += detail.totalHours
      totalPay += detail.totalAfterTax
      totalDays += workplaceSchedules.length
      perWorkplace.push({
        workplace,
        scheduleCount: workplaceSchedules.length,
        ...detail,
      })
    })

    return {
      start: range.start,
      end: range.end,
      totalPay,
      totalHours,
      totalDays,
      perWorkplace,
    }
  }, [rangeEndMonth, rangeStartMonth, schedules, workplaces])

  useEffect(() => {
    if (!rangeStartMonth) setRangeStartMonth(format(new Date(), 'yyyy-01'))
    if (!rangeEndMonth) setRangeEndMonth(format(new Date(), 'yyyy-MM'))
  }, [rangeEndMonth, rangeStartMonth])

  return (
    <div className="salary-calculator">
      <div className="page-header">
        <h1>급여 계산</h1>
        <p>기간별 총 수입과 알바처별 수입 상세를 확인하세요</p>
      </div>

      <div className="card">
        <div className="filters">
          <div className="input-group">
            <label>기간별 수입 (몇월~몇월)</label>
            <div className="range-row">
              <input
                type="month"
                value={rangeStartMonth}
                onChange={(e) => setRangeStartMonth(e.target.value)}
                aria-label="기간 시작 월"
              />
              <span className="range-sep">~</span>
              <input
                type="month"
                value={rangeEndMonth}
                onChange={(e) => setRangeEndMonth(e.target.value)}
                aria-label="기간 종료 월"
              />
            </div>
          </div>
        </div>
      </div>

      {workplaces.length === 0 ? (
        <div className="empty-state">
          <p>등록된 알바처가 없습니다</p>
        </div>
      ) : rangeResult.perWorkplace.length === 0 ? (
        <div className="empty-state">
          <p>선택한 기간에 근무 일정이 없습니다</p>
        </div>
      ) : (
        <>
          <div className="salary-range-summary-card">
            <div className="summary-header">
              <div>
                <h2>기간별 총 수입</h2>
                <p className="summary-period">
                  {rangeResult.start && rangeResult.end
                    ? `${format(rangeResult.start, 'yyyy년 M월')} ~ ${format(
                        rangeResult.end,
                        'yyyy년 M월'
                      )}`
                    : '기간을 선택해주세요'}
                </p>
              </div>
              <div className="total-amount">
                {rangeResult.totalPay.toLocaleString()}원
              </div>
            </div>

            <div className="summary-grid">
              <div className="summary-item">
                <span className="label">근무 일수</span>
                <span className="value">{rangeResult.totalDays}일</span>
              </div>
              <div className="summary-item">
                <span className="label">총 근무 시간</span>
                <span className="value">{rangeResult.totalHours}시간</span>
              </div>
              <div className="summary-item">
                <span className="label">알바처 수</span>
                <span className="value">{rangeResult.perWorkplace.length}곳</span>
              </div>
              <div className="summary-item">
                <span className="label">표시 기준</span>
                <span className="value">실수령액 합산</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>알바처별 기간 수입 (상세)</h2>
            </div>
            {rangeResult.perWorkplace.length === 0 ? (
              <div className="empty-state">
                <p>선택한 기간에 근무 일정이 없습니다</p>
              </div>
            ) : (
              <div className="salary-workplace-list">
                {rangeResult.perWorkplace.map((data) => (
                  <div key={data.workplace.id} className="salary-workplace-item">
                    <div className="salary-workplace-header">
                      <div className="salary-workplace-info">
                        <div
                          className="salary-workplace-color"
                          style={{
                            backgroundColor: data.workplace.color || '#4285f4',
                          }}
                        />
                        <div>
                          <div className="salary-workplace-name">{data.workplace.name}</div>
                          <div className="salary-workplace-sub">
                            근무 {data.scheduleCount}일 · {data.totalHours}시간
                          </div>
                        </div>
                      </div>
                      <div className="salary-workplace-total">
                        {data.totalAfterTax.toLocaleString()}원
                      </div>
                    </div>

                    <div className="salary-breakdown">
                      <div className="breakdown-item">
                        <div className="breakdown-label">
                          <span className="label-text">기본급</span>
                          <span className="label-hint">
                            {data.totalHours}시간 ×{' '}
                            {data.workplace.hourlyWage.toLocaleString()}원
                          </span>
                        </div>
                        <div className="breakdown-value">
                          {data.basicPay.toLocaleString()}원
                        </div>
                      </div>

                      {data.nightPay > 0 && (
                        <div className="breakdown-item extra">
                          <div className="breakdown-label">
                            <span className="label-text">야간수당</span>
                            <span className="label-hint">22:00~06:00 근무 시 50%</span>
                          </div>
                          <div className="breakdown-value extra-value">
                            +{data.nightPay.toLocaleString()}원
                          </div>
                        </div>
                      )}

                      {data.holidayPay > 0 && (
                        <div className="breakdown-item extra">
                          <div className="breakdown-label">
                            <span className="label-text">휴일수당</span>
                            <span className="label-hint">법정공휴일 근무 시 50%</span>
                          </div>
                          <div className="breakdown-value extra-value">
                            +{data.holidayPay.toLocaleString()}원
                          </div>
                        </div>
                      )}

                      {data.weeklyHolidayPay > 0 && (
                        <div className="breakdown-item extra">
                          <div className="breakdown-label">
                            <span className="label-text">주휴수당</span>
                            <span className="label-hint">주 15시간 이상 근무 시</span>
                          </div>
                          <div className="breakdown-value extra-value">
                            +{data.weeklyHolidayPay.toLocaleString()}원
                          </div>
                        </div>
                      )}

                      <div className="breakdown-divider"></div>

                      <div className="breakdown-item subtotal">
                        <div className="breakdown-label">
                          <span className="label-text">세전 총액</span>
                        </div>
                        <div className="breakdown-value">
                          {data.totalBeforeTax.toLocaleString()}원
                        </div>
                      </div>

                      {(data.tax > 0 || data.taxType === 'four_insurance') && (
                        <div className="breakdown-item deduction">
                          <div className="breakdown-label">
                            <span className="label-text">
                              {data.taxType === 'four_insurance'
                                ? '4대보험 공제'
                                : `세금 ${
                                    data.taxType === 'withholding3_3' ? '(3.3%)' : ''
                                  }`}
                            </span>
                            <span className="label-hint">
                              {data.taxType === 'withholding3_3'
                                ? '원천징수'
                                : data.taxType === 'four_insurance'
                                ? '근로자 부담'
                                : '공제'}
                            </span>
                          </div>
                          <div className="breakdown-value deduction-value">
                            -{data.tax.toLocaleString()}원
                          </div>
                          {data.taxType === 'four_insurance' &&
                            data.insuranceBreakdown && (
                              <div className="breakdown-sub">
                                <span>
                                  국민연금: -
                                  {data.insuranceBreakdown.pension.toLocaleString()}원
                                </span>
                                <span>
                                  건강보험: -
                                  {data.insuranceBreakdown.health.toLocaleString()}원
                                </span>
                                <span>
                                  장기요양: -
                                  {data.insuranceBreakdown.longTermCare.toLocaleString()}원
                                </span>
                                <span>
                                  고용보험: -
                                  {data.insuranceBreakdown.employment.toLocaleString()}원
                                </span>
                              </div>
                            )}
                        </div>
                      )}

                      <div className="breakdown-divider"></div>

                      <div className="breakdown-item total">
                        <div className="breakdown-label">
                          <span className="label-text">실수령액</span>
                        </div>
                        <div className="breakdown-value total-value">
                          {data.totalAfterTax.toLocaleString()}원
                        </div>
                      </div>
                    </div>

                    {data.warnings && data.warnings.length > 0 && (
                      <div className="warnings-section">
                        <h3>⚠️ 확인이 필요한 항목</h3>
                        {data.warnings.map((warning, idx) => (
                          <div key={idx} className="warning-item">
                            {warning}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

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
                <strong>휴일수당:</strong> 법정공휴일 근무 시 기본급의 50% 추가
              </li>
              <li>
                <strong>주휴수당:</strong> 주 15시간 이상 근무 시 1일치 급여(8시간) 지급
              </li>
              <li>
                <strong>3.3% 공제:</strong> 소득세 3% + 지방소득세 0.3%
              </li>
              <li>
                <strong>4대보험 공제(근로자 부담):</strong> 국민연금 4.5%, 건강보험
                3.545%, 장기요양보험(건강보험료의 12.81%), 고용보험 0.9% (산재보험은
                사업주 부담)
              </li>
            </ul>
            <p className="note-footer">
              * 모든 계산은 명확한 규칙 기반으로 처리되며, AI는 설명과 보조 역할만 수행합니다.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

export default SalaryCalculator
