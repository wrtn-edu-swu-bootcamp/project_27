/**
 * 급여 계산 유틸리티
 * 
 * 중요: AI를 사용하지 않고 명확한 규칙 기반으로 계산합니다.
 */

/**
 * 근무 시간 계산 (분 단위)
 */
export function calculateWorkMinutes(startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)
  
  let start = startHour * 60 + startMin
  let end = endHour * 60 + endMin
  
  // 자정을 넘는 경우 처리
  if (end < start) {
    end += 24 * 60
  }
  
  return end - start
}

/**
 * 기본 급여 계산
 */
export function calculateBasicPay(minutes, hourlyWage) {
  const hours = minutes / 60
  return Math.floor(hours * hourlyWage)
}

/**
 * 야간 근무 시간 계산 (22:00 ~ 06:00)
 */
export function calculateNightMinutes(startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)
  
  let nightMinutes = 0
  let currentHour = startHour
  let currentMin = startMin
  
  const totalMinutes = calculateWorkMinutes(startTime, endTime)
  
  for (let i = 0; i < totalMinutes; i++) {
    // 22:00 ~ 23:59 또는 00:00 ~ 05:59
    if ((currentHour >= 22 && currentHour <= 23) || (currentHour >= 0 && currentHour < 6)) {
      nightMinutes++
    }
    
    currentMin++
    if (currentMin >= 60) {
      currentMin = 0
      currentHour++
      if (currentHour >= 24) {
        currentHour = 0
      }
    }
  }
  
  return nightMinutes
}

/**
 * 야간 수당 계산 (기본급의 50%)
 */
export function calculateNightPay(startTime, endTime, hourlyWage, settings) {
  if (!settings?.nightPay?.supported || !settings?.nightPay?.userConfirmed) {
    return 0
  }
  
  const nightMinutes = calculateNightMinutes(startTime, endTime)
  const nightHours = nightMinutes / 60
  return Math.floor(nightHours * hourlyWage * 0.5)
}

/**
 * 주휴수당 계산
 * 주 15시간 이상 근무 시 1일치 급여
 */
export function calculateWeeklyHolidayPay(weeklyMinutes, hourlyWage, settings) {
  if (!settings?.weeklyHolidayPay?.supported || !settings?.weeklyHolidayPay?.userConfirmed) {
    return 0
  }
  
  const weeklyHours = weeklyMinutes / 60
  
  // 주 15시간 이상 근무 시 적용
  if (weeklyHours >= 15) {
    return Math.floor(hourlyWage * 8) // 1일 8시간 기준
  }
  
  return 0
}

/**
 * 주말/공휴일 수당 계산 (기본급의 50%)
 */
export function calculateHolidayPay(date, minutes, hourlyWage, settings) {
  if (!settings?.holidayPay?.supported || !settings?.holidayPay?.userConfirmed) {
    return 0
  }
  
  const dayOfWeek = new Date(date).getDay()
  
  // 일요일(0) 또는 토요일(6)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const hours = minutes / 60
    return Math.floor(hours * hourlyWage * 0.5)
  }
  
  // TODO: 공휴일 체크 로직 추가 필요
  
  return 0
}

/**
 * 사업소득 3.3% 공제 계산
 */
export function calculateBusinessIncomeTax(totalPay) {
  return Math.floor(totalPay * 0.033)
}

/**
 * 급여 상세 계산
 */
export function calculateSalaryDetail(schedules, workplace) {
  let totalMinutes = 0
  let basicPay = 0
  let nightPay = 0
  let holidayPay = 0
  let weeklyHolidayPay = 0
  
  // 주별 근무 시간 집계 (주휴수당 계산용)
  const weeklyMinutes = {}
  
  schedules.forEach((schedule) => {
    const minutes = calculateWorkMinutes(schedule.startTime, schedule.endTime)
    totalMinutes += minutes
    
    // 기본급
    basicPay += calculateBasicPay(minutes, workplace.hourlyWage)
    
    // 야간수당
    nightPay += calculateNightPay(
      schedule.startTime,
      schedule.endTime,
      workplace.hourlyWage,
      workplace.settings
    )
    
    // 휴일수당
    holidayPay += calculateHolidayPay(
      schedule.date,
      minutes,
      workplace.hourlyWage,
      workplace.settings
    )
    
    // 주별 근무 시간 집계
    const weekKey = getWeekKey(schedule.date)
    weeklyMinutes[weekKey] = (weeklyMinutes[weekKey] || 0) + minutes
  })
  
  // 주휴수당 계산
  Object.values(weeklyMinutes).forEach((minutes) => {
    weeklyHolidayPay += calculateWeeklyHolidayPay(
      minutes,
      workplace.hourlyWage,
      workplace.settings
    )
  })
  
  const totalBeforeTax = basicPay + nightPay + holidayPay + weeklyHolidayPay
  
  // 사업소득인 경우 3.3% 공제
  const tax =
    workplace.incomeType === 'business' ? calculateBusinessIncomeTax(totalBeforeTax) : 0
  
  const totalAfterTax = totalBeforeTax - tax
  
  return {
    totalMinutes,
    totalHours: Math.floor(totalMinutes / 60),
    basicPay,
    nightPay,
    holidayPay,
    weeklyHolidayPay,
    totalBeforeTax,
    tax,
    totalAfterTax,
    warnings: generateWarnings(workplace),
  }
}

/**
 * 주차 키 생성 (YYYY-Www)
 */
function getWeekKey(dateString) {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const firstDayOfYear = new Date(year, 0, 1)
  const days = Math.floor((date - firstDayOfYear) / (24 * 60 * 60 * 1000))
  const week = Math.ceil((days + firstDayOfYear.getDay() + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

/**
 * 설정 경고 메시지 생성
 */
function generateWarnings(workplace) {
  const warnings = []
  
  const settings = workplace.settings || {}
  
  // 주휴수당 미확인
  if (
    settings.weeklyHolidayPay?.supported &&
    !settings.weeklyHolidayPay?.userConfirmed
  ) {
    warnings.push('주휴수당 설정이 확인되지 않아 계산에서 제외되었습니다.')
  }
  
  // 야간수당 미확인
  if (settings.nightPay?.supported && !settings.nightPay?.userConfirmed) {
    warnings.push('야간수당 설정이 확인되지 않아 계산에서 제외되었습니다.')
  }
  
  // 휴일수당 미확인
  if (settings.holidayPay?.supported && !settings.holidayPay?.userConfirmed) {
    warnings.push('휴일수당 설정이 확인되지 않아 계산에서 제외되었습니다.')
  }
  
  return warnings
}
