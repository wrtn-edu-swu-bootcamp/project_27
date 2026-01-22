import { useState } from 'react'
import { useWorkplaceStore } from '../store/workplaceStore'
import { useScheduleStore } from '../store/scheduleStore'
import { analyzeScheduleImage, getAvailableGeminiModels } from '../api/gemini'
import {
  calculateBreakMinutes,
  calculateWorkMinutes,
} from '../utils/salaryCalculator'
import './ScheduleManager.css'

function ScheduleManager() {
  const { workplaces } = useWorkplaceStore()
  const { schedules, addSchedule, updateSchedule, deleteSchedule } =
    useScheduleStore()
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(getEmptyForm())
  const [imageFile, setImageFile] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [selectedDates, setSelectedDates] = useState([])
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [listMonth, setListMonth] = useState(new Date())
  const [viewMode, setViewMode] = useState('list')

  function getEmptyForm() {
    return {
      workplaceId: '',
      date: '',
      startTime: '',
      endTime: '',
      memo: '',
      source: 'manual',
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.workplaceId || !formData.startTime || !formData.endTime) {
      alert('모든 필수 항목을 입력해주세요.')
      return
    }

    const hasSingleDate = Boolean(formData.date)

    if (editingId && !hasSingleDate) {
      alert('수정 시에는 날짜를 선택해주세요.')
      return
    }

    if (!editingId && selectedDates.length === 0) {
      alert('모든 필수 항목을 입력해주세요.')
      return
    }

    if (editingId) {
      await updateSchedule(editingId, formData)
      setEditingId(null)
    } else {
      const datesToAdd = selectedDates.slice().sort()
      let failedCalendarCount = 0
      let successCount = 0
      let lastError = ''

      for (const date of datesToAdd) {
        const result = await addSchedule({
          ...formData,
          date,
          source: 'manual',
        })
        if (!result?.calendarSaved) {
          failedCalendarCount += 1
          lastError = result?.error || lastError
        } else {
          successCount += 1
        }
      }

      if (failedCalendarCount > 0) {
        const errors = []
        if (failedCalendarCount > 0) {
          errors.push(`캘린더 추가 실패 ${failedCalendarCount}건`)
        }
        const errorText = lastError ? `\n\n오류: ${lastError}` : ''
        alert(
          `일정 추가 중 오류가 발생했습니다.\n성공 ${successCount}건, ${errors.join(
            ', '
          )}${errorText}`
        )
      } else {
        alert(
          datesToAdd.length > 1
            ? `${datesToAdd.length}개의 일정이 추가되었습니다.`
            : '근무 일정이 추가되었습니다.'
        )
      }
    }

    setFormData(getEmptyForm())
    setIsAdding(false)
    setSelectedDates([])
    setCalendarMonth(new Date())
  }

  const handleEdit = (schedule) => {
    setFormData({ ...schedule })
    setEditingId(schedule.id)
    setIsAdding(true)
    setSelectedDates([])
    setCalendarMonth(new Date(schedule.date || Date.now()))
  }

  const handleDelete = async (id) => {
    if (confirm('이 근무 일정을 삭제하시겠습니까?')) {
      await deleteSchedule(id)
    }
  }

  const handleCancel = () => {
    setFormData(getEmptyForm())
    setIsAdding(false)
    setEditingId(null)
    setImageFile(null)
    setSelectedDates([])
    setCalendarMonth(new Date())
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const targetName = prompt(
      '전체 일정표라면 본인 이름/닉네임을 입력해주세요.'
    )
    if (!targetName) {
      setImageFile(null)
      return
    }

    setImageFile(file)
    setIsAnalyzing(true)

    try {
      // Gemini API를 직접 호출 (로컬 개발 환경)
      const result = await analyzeScheduleImage(file, targetName.trim())
      const availableModelsResult = await getAvailableGeminiModels()
      
      if (!result.success) {
        throw new Error(result.error || '이미지 분석에 실패했습니다.')
      }

      // 분석 결과를 사용자에게 보여주고 확인 받기
      if (result.data?.schedules && result.data.schedules.length > 0) {
        const schedules = result.data.schedules
        const modelInfo = result.modelName
          ? `\n\n사용 모델: ${result.modelName}`
          : '\n\n사용 모델: 알 수 없음'
        const availableModelsInfo = formatAvailableModelsInfo(
          availableModelsResult
        )
        const confirmMsg = `${schedules.length}개의 일정을 찾았습니다:\n\n${schedules
          .map((s, i) => {
            const normalizedDate = normalizeImageScheduleDate(s.date)
            const displayDate = normalizedDate || s.date || '날짜 없음'
            return `${i + 1}. ${displayDate} ${s.startTime}-${s.endTime}${s.uncertain ? ' (확인필요)' : ''}`
          })
          .join('\n')}${modelInfo}${availableModelsInfo}\n\n이 일정들을 추가하시겠습니까?`
        
        if (confirm(confirmMsg)) {
          // 알바처 선택
          if (workplaces.length === 0) {
            alert('먼저 알바처를 등록해주세요.')
            return
          }
          
          const workplaceId = workplaces.length === 1 
            ? workplaces[0].id 
            : prompt(`알바처 번호를 선택하세요:\n${workplaces.map((w, i) => `${i + 1}. ${w.name}`).join('\n')}`)
          
          if (!workplaceId) return
          
          const selectedWorkplace = workplaces.length === 1 
            ? workplaces[0] 
            : workplaces[parseInt(workplaceId) - 1]
          
          // 일정 추가
          let failedCalendarCount = 0
          let lastError = ''
          for (const schedule of schedules) {
            const normalizedDate = normalizeImageScheduleDate(schedule.date)
            if (normalizedDate && schedule.startTime && schedule.endTime) {
              const result = await addSchedule({
                workplaceId: selectedWorkplace.id,
                date: normalizedDate,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                memo:
                  schedule.memo ||
                  (schedule.uncertain ? '(AI 분석 - 확인 필요)' : '(AI 분석)'),
                source: 'image',
              })
              if (!result?.calendarSaved) {
                failedCalendarCount += 1
                lastError = result?.error || lastError
              }
            }
          }

          if (failedCalendarCount > 0) {
            const errors = []
            if (failedCalendarCount > 0) {
              errors.push(`캘린더 추가 실패 ${failedCalendarCount}건`)
            }
            const errorText = lastError ? `\n\n오류: ${lastError}` : ''
            alert(`일정 추가 중 오류가 발생했습니다.\n${errors.join(', ')}${errorText}`)
          } else {
            alert(`${schedules.length}개의 일정이 추가되었습니다.`)
          }
        }
      } else {
        alert('일정을 찾을 수 없습니다. 다른 이미지를 시도해보세요.')
      }
      
      if (result.data?.notes) {
        console.log('AI 주의사항:', result.data.notes)
      }
    } catch (error) {
      console.error('이미지 분석 오류:', error)
      alert(`이미지 분석 중 오류가 발생했습니다: ${error.message}`)
    } finally {
      setIsAnalyzing(false)
      setImageFile(null)
    }
  }

  const listMonthStart = new Date(listMonth.getFullYear(), listMonth.getMonth(), 1)
  const listMonthEnd = new Date(listMonth.getFullYear(), listMonth.getMonth() + 1, 0)

  const visibleSchedules = schedules.filter((schedule) => {
    const date = new Date(schedule.date)
    return date >= listMonthStart && date <= listMonthEnd
  })

  // 일정을 날짜별로 그룹화
  const groupedSchedules = visibleSchedules.reduce((acc, schedule) => {
    const date = schedule.date
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(schedule)
    return acc
  }, {})

  // 날짜를 최신순으로 정렬
  const sortedDates = Object.keys(groupedSchedules).sort(
    (a, b) => new Date(b) - new Date(a)
  )

  const getWorkSummary = (schedule, workplace) => {
    if (!workplace) return 0
    if (!schedule.startTime || !schedule.endTime) return 0
    const totalMinutes = calculateWorkMinutes(
      schedule.startTime,
      schedule.endTime
    )
    const breakMinutes = calculateBreakMinutes(totalMinutes, workplace)
    const effectiveMinutes = Math.max(0, totalMinutes - breakMinutes)
    return { totalMinutes, breakMinutes, effectiveMinutes }
  }

  const formatMinutes = (minutes) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}시간 ${mins}분`
  }

  const calendarCells = buildCalendarCells(calendarMonth)
  const listCalendarCells = buildCalendarCells(listMonth)
  const selectedSet = new Set(selectedDates)
  const selectedDatesSorted = selectedDates.slice().sort()

  const toggleSelectedDate = (dateKey) => {
    setSelectedDates((prev) =>
      prev.includes(dateKey) ? prev.filter((date) => date !== dateKey) : [...prev, dateKey]
    )
  }

  const moveCalendarMonth = (offset) => {
    setCalendarMonth((prev) => {
      const next = new Date(prev)
      next.setMonth(prev.getMonth() + offset)
      return next
    })
  }

  const moveListMonth = (offset) => {
    setListMonth((prev) => {
      const next = new Date(prev)
      next.setMonth(prev.getMonth() + offset)
      return next
    })
  }

  return (
    <div className="schedule-manager">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>근무 일정 관리</h1>
            <p>근무 일정을 추가하고 관리하세요</p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setViewMode((prev) => (prev === 'list' ? 'calendar' : 'list'))}
          >
            {viewMode === 'list' ? '달력으로 보기' : '표 상태로 보기'}
          </button>
        </div>
      </div>

      <div className="action-buttons">
        {!isAdding && (
          <>
            <button className="btn-primary" onClick={() => setIsAdding(true)}>
              + 수동 추가
            </button>
            <label className="btn-secondary upload-btn">
              📸 이미지 업로드
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
            </label>
          </>
        )}
      </div>

      {isAnalyzing && (
        <div className="card">
          <div className="analyzing-state">
            <div className="spinner"></div>
            <p>AI가 일정표를 분석하고 있습니다...</p>
          </div>
        </div>
      )}

      {isAdding && (
        <div className="card">
          <div className="card-header">
            <h2>{editingId ? '일정 수정' : '새 일정 추가'}</h2>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>알바처 *</label>
              <select
                value={formData.workplaceId}
                onChange={(e) =>
                  setFormData({ ...formData, workplaceId: e.target.value })
                }
                required
              >
                <option value="">선택하세요</option>
                {workplaces.map((workplace) => (
                  <option key={workplace.id} value={workplace.id}>
                    {workplace.name}
                  </option>
                ))}
              </select>
            </div>

            {editingId ? (
              <div className="input-group">
                <label>날짜 *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
            ) : (
              <div className="input-group">
                <label>날짜 선택 *</label>
                <div className="calendar">
                  <div className="calendar-header">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => moveCalendarMonth(-1)}
                    >
                      이전
                    </button>
                    <div className="calendar-title">
                      {formatMonthLabel(calendarMonth)}
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => moveCalendarMonth(1)}
                    >
                      다음
                    </button>
                  </div>
                  <div className="calendar-weekdays">
                    {CALENDAR_WEEKDAYS.map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>
                  <div className="calendar-grid">
                    {calendarCells.map((cell, index) => {
                      if (!cell) {
                        return <div key={`empty-${index}`} className="calendar-cell empty" />
                      }
                      const isSelected = selectedSet.has(cell.dateKey)
                      return (
                        <button
                          key={cell.dateKey}
                          type="button"
                          className={`calendar-cell calendar-day ${
                            isSelected ? 'selected' : ''
                          }`}
                          onClick={() => toggleSelectedDate(cell.dateKey)}
                        >
                          {cell.day}
                        </button>
                      )
                    })}
                  </div>
                  <div className="calendar-actions">
                    <div className="calendar-hint">
                      선택된 날짜: {selectedDatesSorted.length}개
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setSelectedDates([])}
                      disabled={selectedDatesSorted.length === 0}
                    >
                      선택 초기화
                    </button>
                  </div>
                  {selectedDatesSorted.length > 0 && (
                    <div className="selected-dates">
                      {selectedDatesSorted.map((date) => (
                        <span key={date} className="selected-date-chip">
                          {date}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="input-row">
              <div className="input-group">
                <label>시작 시간 *</label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                  required
                />
              </div>

              <div className="input-group">
                <label>종료 시간 *</label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label>메모</label>
              <textarea
                value={formData.memo}
                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                placeholder="근무 중 특이사항이나 할 일을 기록하세요"
                rows="3"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">
                {editingId ? '수정 완료' : '추가'}
              </button>
              <button type="button" className="btn-secondary" onClick={handleCancel}>
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {viewMode === 'calendar' ? (
        <div className="calendar-view">
          <div className="calendar-view-header">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => moveListMonth(-1)}
              aria-label="이전 달"
            >
              &lt;
            </button>
            <div className="calendar-view-title">
              {formatMonthLabel(listMonth)}
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => moveListMonth(1)}
              aria-label="다음 달"
            >
              &gt;
            </button>
          </div>
          <div className="calendar-weekdays calendar-view-weekdays">
            {CALENDAR_WEEKDAYS.map((day) => (
              <span key={`view-${day}`}>{day}</span>
            ))}
          </div>
          <div className="calendar-view-grid">
            {listCalendarCells.map((cell, index) => {
              if (!cell) {
                return (
                  <div key={`view-empty-${index}`} className="calendar-view-cell empty" />
                )
              }
              const daySchedules = groupedSchedules[cell.dateKey] || []
              return (
                <div key={cell.dateKey} className="calendar-view-cell">
                  <div className="calendar-view-day">{cell.day}</div>
                  <div className="calendar-view-events">
                    {daySchedules.slice(0, 3).map((schedule) => {
                      const workplace = workplaces.find(
                        (w) => w.id === schedule.workplaceId
                      )
                      return (
                        <div
                          key={schedule.id}
                          className="calendar-view-chip"
                          style={{
                            borderColor: workplace?.color || '#4285f4',
                          }}
                        >
                          <span className="calendar-view-chip-name">
                            {workplace?.name || '알 수 없음'}
                          </span>
                          <span className="calendar-view-chip-time">
                            {schedule.startTime}-{schedule.endTime}
                          </span>
                        </div>
                      )
                    })}
                    {daySchedules.length > 3 && (
                      <div className="calendar-view-more">
                        +{daySchedules.length - 3}개
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="schedules-list">
          <div className="list-month-selector">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => moveListMonth(-1)}
              aria-label="이전 달"
            >
              &lt;
            </button>
            <div className="list-month-label">
              {`${listMonth.getMonth() + 1}월`}
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => moveListMonth(1)}
              aria-label="다음 달"
            >
              &gt;
            </button>
          </div>

          {schedules.length === 0 ? (
            <div className="empty-state">
              <p>등록된 근무 일정이 없습니다.</p>
              <p className="empty-hint">
                수동으로 추가하거나 이미지를 업로드해보세요.
              </p>
            </div>
          ) : visibleSchedules.length === 0 ? (
            <div className="empty-state">
              <p>선택한 월에 근무 일정이 없습니다.</p>
            </div>
          ) : (
            sortedDates.map((date) => {
              const dateSchedules = groupedSchedules[date]
              return (
                <div key={date} className="date-group">
                  <div className="date-header">
                    <h3>{formatDate(date)}</h3>
                    <span className="schedule-count">
                      {dateSchedules.length}개 근무
                    </span>
                  </div>
                  <div className="schedule-items">
                    {dateSchedules.map((schedule) => {
                      const workplace = workplaces.find(
                        (w) => w.id === schedule.workplaceId
                      )
                      const summary = getWorkSummary(schedule, workplace)
                      const breakMinutes = summary?.breakMinutes ?? 0
                      const effectiveMinutes = summary?.effectiveMinutes ?? 0
                      return (
                        <div key={schedule.id} className="schedule-item">
                          <div
                            className="schedule-color"
                            style={{
                              backgroundColor: workplace?.color || '#4285f4',
                            }}
                          />
                          <div className="schedule-content">
                            <div className="schedule-main">
                              <h4>{workplace?.name || '알 수 없음'}</h4>
                              <div className="schedule-time">
                                {schedule.startTime} - {schedule.endTime}
                              </div>
                            </div>
                            <div className="schedule-break">
                              휴게시간: {breakMinutes}분
                            </div>
                            <div className="schedule-total">
                              총 근무시간: {formatMinutes(effectiveMinutes)}
                            </div>
                            {schedule.memo && (
                              <div className="schedule-memo">{schedule.memo}</div>
                            )}
                          </div>
                          <div className="schedule-actions">
                            <button
                              className="btn-icon"
                              onClick={() => handleEdit(schedule)}
                              title="수정"
                            >
                              ✏️
                            </button>
                            <button
                              className="btn-icon"
                              onClick={() => handleDelete(schedule.id)}
                              title="삭제"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function formatDate(dateString) {
  const date = new Date(dateString)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const dayOfWeek = days[date.getDay()]
  
  return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`
}

function formatAvailableModelsInfo(result) {
  if (!result?.success || !Array.isArray(result.models)) return ''

  const uniqueModels = Array.from(new Set(result.models))
  if (uniqueModels.length === 0) return ''

  if (uniqueModels.length <= 6) {
    return `\n사용 가능 모델: ${uniqueModels.join(', ')}`
  }

  const preview = uniqueModels.slice(0, 6).join(', ')
  const remaining = uniqueModels.length - 6
  return `\n사용 가능 모델: ${preview} 외 ${remaining}개`
}

function normalizeImageScheduleDate(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  const currentYear = new Date().getFullYear()
  const placeholderMatch = trimmed.match(/^yyyy[-/.](\d{1,2})[-/.](\d{1,2})$/i)
  if (placeholderMatch) {
    return formatDateParts(currentYear, placeholderMatch[1], placeholderMatch[2])
  }

  const fullMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (fullMatch) {
    return formatDateParts(currentYear, fullMatch[2], fullMatch[3])
  }

  const shortYearMatch = trimmed.match(/^(\d{2})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (shortYearMatch) {
    return formatDateParts(currentYear, shortYearMatch[2], shortYearMatch[3])
  }

  const shortMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})$/)
  if (shortMatch) {
    return formatDateParts(currentYear, shortMatch[1], shortMatch[2])
  }

  return null
}

function formatDateParts(year, month, day) {
  const y = String(year).padStart(4, '0')
  const m = String(month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const CALENDAR_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function buildCalendarCells(baseDate) {
  const year = baseDate.getFullYear()
  const monthIndex = baseDate.getMonth()
  const startDay = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells = []

  for (let i = 0; i < startDay; i += 1) {
    cells.push(null)
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = formatDateParts(year, monthIndex + 1, day)
    cells.push({ day, dateKey })
  }

  const remainder = cells.length % 7
  if (remainder !== 0) {
    const fillerCount = 7 - remainder
    for (let i = 0; i < fillerCount; i += 1) {
      cells.push(null)
    }
  }

  return cells
}

function formatMonthLabel(date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  return `${year}년 ${month}월`
}

export default ScheduleManager
