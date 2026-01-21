import { useState } from 'react'
import { useWorkplaceStore } from '../store/workplaceStore'
import { useScheduleStore } from '../store/scheduleStore'
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

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!formData.workplaceId || !formData.date || !formData.startTime || !formData.endTime) {
      alert('모든 필수 항목을 입력해주세요.')
      return
    }

    if (editingId) {
      updateSchedule(editingId, formData)
      setEditingId(null)
    } else {
      addSchedule(formData)
    }

    setFormData(getEmptyForm())
    setIsAdding(false)
  }

  const handleEdit = (schedule) => {
    setFormData(schedule)
    setEditingId(schedule.id)
    setIsAdding(true)
  }

  const handleDelete = (id) => {
    if (confirm('이 근무 일정을 삭제하시겠습니까?')) {
      deleteSchedule(id)
    }
  }

  const handleCancel = () => {
    setFormData(getEmptyForm())
    setIsAdding(false)
    setEditingId(null)
    setImageFile(null)
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setImageFile(file)
    setIsAnalyzing(true)

    try {
      // Gemini API를 사용한 이미지 분석
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/analyze-schedule', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('이미지 분석에 실패했습니다.')
      }

      const result = await response.json()
      
      // 분석 결과를 사용자에게 보여주고 확인 받기
      if (result.schedules && result.schedules.length > 0) {
        alert(`${result.schedules.length}개의 일정을 찾았습니다. 확인 후 저장해주세요.`)
        // TODO: 결과 확인 UI 구현
      }
    } catch (error) {
      console.error('이미지 분석 오류:', error)
      alert('이미지 분석 중 오류가 발생했습니다.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // 일정을 날짜별로 그룹화
  const groupedSchedules = schedules.reduce((acc, schedule) => {
    const date = schedule.date
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(schedule)
    return acc
  }, {})

  // 날짜를 최신순으로 정렬
  const sortedDates = Object.keys(groupedSchedules).sort((a, b) => 
    new Date(b) - new Date(a)
  )

  return (
    <div className="schedule-manager">
      <div className="page-header">
        <h1>근무 일정 관리</h1>
        <p>근무 일정을 추가하고 관리하세요</p>
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

            <div className="input-group">
              <label>날짜 *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

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

      {/* 일정 목록 */}
      <div className="schedules-list">
        {schedules.length === 0 ? (
          <div className="empty-state">
            <p>등록된 근무 일정이 없습니다.</p>
            <p className="empty-hint">
              수동으로 추가하거나 이미지를 업로드해보세요.
            </p>
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

export default ScheduleManager
