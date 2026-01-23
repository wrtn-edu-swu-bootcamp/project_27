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
export function calculateNightPay(
  startTime,
  endTime,
  hourlyWage,
  settings,
  breakMinutes,
  totalMinutes
) {
  if (!settings?.nightPay?.supported || !settings?.nightPay?.userConfirmed) {
    return 0
  }
  
  const nightMinutes = calculateNightMinutes(startTime, endTime)
  const adjustedNightMinutes = adjustMinutesForBreak(
    nightMinutes,
    totalMinutes,
    breakMinutes
  )
  const nightHours = adjustedNightMinutes / 60
  return Math.floor(nightHours * hourlyWage * 0.5)
}

/**
 * 주휴수당 계산
 * 주 15시간 이상 근무 시 근무시간에 비례하여 지급
 *
 * 참고 공식(일반적 계산):
 * (주간 총 근무시간 ÷ 40시간) × 8시간 × 시급
 */
export function calculateWeeklyHolidayPay(weeklyMinutes, hourlyWage, settings) {
  if (!settings?.weeklyHolidayPay?.supported || !settings?.weeklyHolidayPay?.userConfirmed) {
    return 0
  }
  
  const weeklyHours = weeklyMinutes / 60
  
  // 주 15시간 이상 근무 시 적용
  if (weeklyHours < 15) {
    return 0
  }

  // 40시간 기준 비례 계산 (최대 8시간분)
  const cappedWeeklyHours = Math.min(weeklyHours, 40)
  const weeklyHolidayHours = (cappedWeeklyHours / 40) * 8
  return Math.floor(weeklyHolidayHours * hourlyWage)
  
}

/**
 * 휴일 수당 계산 (기본급의 50%)
 */
export function calculateHolidayPay(date, minutes, hourlyWage, settings, isHoliday) {
  if (!settings?.holidayPay?.supported || !settings?.holidayPay?.userConfirmed) {
    return 0
  }

  // 휴일 기준: "구글 캘린더에 공휴일(휴일 캘린더)로 등록된 날"만 휴일로 인정
  if (!isHoliday) return 0

  const hours = minutes / 60
  return Math.floor(hours * hourlyWage * 0.5)
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
export function calculateSalaryDetail(schedules, workplace, options = {}) {
  let totalMinutes = 0
  let basicPay = 0
  let nightPay = 0
  let holidayPay = 0
  let weeklyHolidayPay = 0
  
  // 주휴수당은 '주' 단위로 계산되므로,
  // 선택한 기간(schedules)이 주의 일부만 포함하는 경우에도
  // 해당 주의 전체 근무시간(가능하면 allSchedulesForWeeklyHolidayPay 기반)으로 판정/계산합니다.
  const allSchedulesForWeeklyHolidayPay =
    options?.allSchedulesForWeeklyHolidayPay || schedules

  const targetWeekKeys = new Set()
  
  schedules.forEach((schedule) => {
    const minutes = calculateWorkMinutes(schedule.startTime, schedule.endTime)
    const breakMinutes = calculateBreakMinutes(minutes, workplace)
    const effectiveMinutes = Math.max(0, minutes - breakMinutes)
    totalMinutes += effectiveMinutes
    
    // 기본급
    basicPay += calculateBasicPay(effectiveMinutes, workplace.hourlyWage)
    
    // 야간수당
    nightPay += calculateNightPay(
      schedule.startTime,
      schedule.endTime,
      workplace.hourlyWage,
      workplace.settings,
      breakMinutes,
      minutes
    )
    
    // 휴일수당
    holidayPay += calculateHolidayPay(
      schedule.date,
      effectiveMinutes,
      workplace.hourlyWage,
      workplace.settings,
      schedule?.isHoliday === true
    )

    // 기간 내 포함된 주(week)를 기록
    targetWeekKeys.add(getWeekKey(schedule.date))
  })

  // 전체(또는 제공된) 스케줄로 주별 근무 시간 집계
  const weeklyMinutesAll = {}
  allSchedulesForWeeklyHolidayPay.forEach((schedule) => {
    const minutes = calculateWorkMinutes(schedule.startTime, schedule.endTime)
    const breakMinutes = calculateBreakMinutes(minutes, workplace)
    const effectiveMinutes = Math.max(0, minutes - breakMinutes)
    const weekKey = getWeekKey(schedule.date)
    weeklyMinutesAll[weekKey] = (weeklyMinutesAll[weekKey] || 0) + effectiveMinutes
  })
  
  // 주휴수당 계산
  targetWeekKeys.forEach((weekKey) => {
    const minutes = weeklyMinutesAll[weekKey] || 0
    weeklyHolidayPay += calculateWeeklyHolidayPay(
      minutes,
      workplace.hourlyWage,
      workplace.settings
    )
  })
  
  const totalBeforeTax = basicPay + nightPay + holidayPay + weeklyHolidayPay
  
  const taxType = workplace.taxType || 'unknown'
  const insuranceSettings = workplace.insuranceSettings || {}
  const insuranceBreakdown = calculateInsuranceDeduction(
    totalBeforeTax,
    insuranceSettings
  )
  const tax =
    taxType === 'withholding3_3'
      ? calculateBusinessIncomeTax(totalBeforeTax)
      : taxType === 'four_insurance'
      ? insuranceBreakdown.total
      : 0
  
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
    taxType,
    insuranceBreakdown,
    totalAfterTax,
    warnings: generateWarnings(workplace),
  }
}

function adjustMinutesForBreak(targetMinutes, totalMinutes, breakMinutes) {
  if (!totalMinutes || !breakMinutes) {
    return targetMinutes
  }
  const effectiveMinutes = Math.max(0, totalMinutes - breakMinutes)
  const ratio = effectiveMinutes / totalMinutes
  return Math.max(0, Math.round(targetMinutes * ratio))
}

export function calculateBreakMinutes(totalMinutes, workplace) {
  const breakType = workplace.breakType || 'none'
  if (!totalMinutes || breakType === 'none') {
    return 0
  }

  if (breakType === 'standard') {
    return calculateBreakByRule(totalMinutes, 4, 30)
  }

  if (breakType === 'custom') {
    const everyHours = Number(workplace.breakEveryHours || 0)
    const minutesPerBlock = Number(workplace.breakMinutesPerBlock || 0)
    if (!everyHours || !minutesPerBlock) {
      return 0
    }
    return calculateBreakByRule(totalMinutes, everyHours, minutesPerBlock)
  }

  return 0
}

function calculateBreakByRule(totalMinutes, everyHours, minutesPerBlock) {
  const blockMinutes = everyHours * 60
  if (!blockMinutes || totalMinutes < blockMinutes) {
    return 0
  }
  const blocks = Math.floor(totalMinutes / blockMinutes)
  return Math.min(totalMinutes, blocks * minutesPerBlock)
}

function calculateInsuranceDeduction(totalBeforeTax, settings) {
  const safeNumber = (value) => Number(value || 0)
  const pensionRate = safeNumber(settings?.pension?.rate)
  const healthRate = safeNumber(settings?.health?.rate)
  const longTermRate = safeNumber(settings?.longTermCare?.rate)
  const employmentRate = safeNumber(settings?.employment?.rate)

  const pension = settings?.pension?.enabled
    ? Math.floor(totalBeforeTax * (pensionRate / 100))
    : 0
  const health = settings?.health?.enabled
    ? Math.floor(totalBeforeTax * (healthRate / 100))
    : 0
  const longTermCare =
    settings?.longTermCare?.enabled && health > 0
      ? Math.floor(health * (longTermRate / 100))
      : 0
  const employment = settings?.employment?.enabled
    ? Math.floor(totalBeforeTax * (employmentRate / 100))
    : 0

  return {
    pension,
    health,
    longTermCare,
    employment,
    total: pension + health + longTermCare + employment,
  }
}

/**
 * 주차 키 생성 (YYYY-Www)
 */
function getWeekKey(dateString) {
  // 월/기간 경계에서도 안정적으로 묶이도록 "해당 주의 시작일(월요일)"을 키로 사용
  const date = new Date(dateString)
  date.setHours(0, 0, 0, 0)

  // 월요일 기준 (0=일,1=월,...6=토)
  const day = date.getDay()
  const diffFromMonday = (day + 6) % 7
  date.setDate(date.getDate() - diffFromMonday)

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 설정 경고 메시지 생성
 */
function generateWarnings(workplace) {
  const warnings = []
  
  const settings = workplace.settings || {}
  
  // 주휴수당 미확인
  if (
    settings.weeklyHolidayPay?.selection === 'unknown' ||
    (settings.weeklyHolidayPay?.supported &&
      !settings.weeklyHolidayPay?.userConfirmed)
  ) {
    warnings.push('주휴수당 설정이 확인되지 않아 계산에서 제외되었습니다.')
  }
  
  // 야간수당 미확인
  if (
    settings.nightPay?.selection === 'unknown' ||
    (settings.nightPay?.supported && !settings.nightPay?.userConfirmed)
  ) {
    warnings.push('야간수당 설정이 확인되지 않아 계산에서 제외되었습니다.')
  }
  
  // 휴일수당 미확인
  if (
    settings.holidayPay?.selection === 'unknown' ||
    (settings.holidayPay?.supported && !settings.holidayPay?.userConfirmed)
  ) {
    warnings.push('휴일수당 설정이 확인되지 않아 계산에서 제외되었습니다.')
  }

  if (workplace.taxType === 'unknown') {
    warnings.push('세금/공제 유형이 설정되지 않아 공제가 반영되지 않았습니다.')
  }

  if (workplace.taxType === 'four_insurance') {
    if (!hasInsuranceSelection(workplace.insuranceSettings)) {
      warnings.push('4대보험 공제 항목이 설정되지 않아 계산에서 제외되었습니다.')
    }
  }
  
  return warnings
}

function hasInsuranceSelection(settings) {
  if (!settings) return false
  return Boolean(
    settings?.pension?.enabled ||
      settings?.health?.enabled ||
      settings?.longTermCare?.enabled ||
      settings?.employment?.enabled
  )
}
