import { useRef, useState } from 'react'
import { useWorkplaceStore } from '../store/workplaceStore'
import { useScheduleStore } from '../store/scheduleStore'
import {
  analyzeScheduleImage,
  analyzeScheduleImageViaTable,
  getAvailableGeminiModels,
} from '../api/gemini'
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
  const [selectedDates, setSelectedDates] = useState([])
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [listMonth, setListMonth] = useState(new Date())
  const [viewMode, setViewMode] = useState('list')
  const [workplaceFilterId, setWorkplaceFilterId] = useState('all')
  const imageInputRef = useRef(null)
  const imagePreviewUrlRef = useRef(null)

  const [imageImportOpen, setImageImportOpen] = useState(false)
  const [imageImportFile, setImageImportFile] = useState(null)
  const [imageImportPreviewUrl, setImageImportPreviewUrl] = useState('')
  const [imageTargetName, setImageTargetName] = useState('')
  const [imageWorkplaceId, setImageWorkplaceId] = useState('')
  const [imageImportIsAnalyzing, setImageImportIsAnalyzing] = useState(false)
  const [imageImportIsAdding, setImageImportIsAdding] = useState(false)
  const [imageImportError, setImageImportError] = useState('')
  const [imageImportResultMessage, setImageImportResultMessage] = useState('')
  const [imageImportNotes, setImageImportNotes] = useState('')
  const [imageImportTable, setImageImportTable] = useState('')
  const [imageImportModelInfo, setImageImportModelInfo] = useState({
    usedModel: '',
    availableModelsInfo: '',
  })
  const [imageImportCandidates, setImageImportCandidates] = useState([])
  const [imageImportSelected, setImageImportSelected] = useState(() => new Set())
  const imageImportIdRef = useRef(0)
  const [imageAnalyzeMode, setImageAnalyzeMode] = useState('direct') // 'direct' | 'table'

  const [imageViewerZoom, setImageViewerZoom] = useState(1)
  const [imageViewerPan, setImageViewerPan] = useState({ x: 0, y: 0 })
  const imageViewerRef = useRef({
    isPanning: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  })

  const activeWorkplaces = workplaces.filter(
    (wp) => (wp.employmentStatus || 'active') !== 'retired'
  )

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
    setSelectedDates([])
    setCalendarMonth(new Date())
  }

  const closeImageImport = () => {
    if (imageImportIsAnalyzing || imageImportIsAdding) return
    setImageImportOpen(false)
    setImageImportFile(null)
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current)
      imagePreviewUrlRef.current = null
    }
    setImageImportPreviewUrl('')
    setImageTargetName('')
    setImageWorkplaceId('')
    setImageImportIsAnalyzing(false)
    setImageImportIsAdding(false)
    setImageImportError('')
    setImageImportResultMessage('')
    setImageImportNotes('')
    setImageImportTable('')
    setImageImportModelInfo({ usedModel: '', availableModelsInfo: '' })
    setImageImportCandidates([])
    setImageImportSelected(new Set())
    setImageViewerZoom(1)
    setImageViewerPan({ x: 0, y: 0 })
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  const openImageImport = (file) => {
    setImageImportOpen(true)
    setImageImportFile(file)
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current)
      imagePreviewUrlRef.current = null
    }
    const nextUrl = URL.createObjectURL(file)
    imagePreviewUrlRef.current = nextUrl
    setImageImportPreviewUrl(nextUrl)
    setImageTargetName('')
    setImageWorkplaceId(activeWorkplaces.length === 1 ? activeWorkplaces[0].id : '')
    setImageImportIsAnalyzing(false)
    setImageImportIsAdding(false)
    setImageImportError('')
    setImageImportResultMessage('')
    setImageImportNotes('')
    setImageImportTable('')
    setImageImportModelInfo({ usedModel: '', availableModelsInfo: '' })
    setImageImportCandidates([])
    setImageImportSelected(new Set())
    setImageViewerZoom(1)
    setImageViewerPan({ x: 0, y: 0 })
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    openImageImport(file)
  }

  const runImageAnalyze = async () => {
    setImageImportError('')
    setImageImportResultMessage('')
    setImageImportNotes('')
    setImageImportTable('')
    setImageImportCandidates([])
    setImageImportSelected(new Set())

    if (!imageImportFile) {
      setImageImportError('이미지 파일을 선택해주세요.')
      return
    }
    const name = imageTargetName.trim()
    if (!name) {
      setImageImportError('전체 일정표라면 본인 이름/닉네임을 입력해주세요.')
      return
    }
    if (activeWorkplaces.length === 0) {
      setImageImportError('먼저 알바처를 등록해주세요.')
      return
    }
    if (!imageWorkplaceId) {
      setImageImportError('등록할 알바처를 선택해주세요.')
      return
    }

    setImageImportIsAnalyzing(true)
    try {
      const analyzer =
        imageAnalyzeMode === 'table'
          ? analyzeScheduleImageViaTable
          : analyzeScheduleImage
      const [result, availableModelsResult] = await Promise.all([
        analyzer(imageImportFile, name),
        getAvailableGeminiModels(),
      ])

      if (!result?.success) {
        throw new Error(result?.error || '이미지 분석에 실패했습니다.')
      }

      if (typeof result?.table === 'string' && result.table.trim()) {
        setImageImportTable(result.table)
      }

      const found = Array.isArray(result?.data?.schedules)
        ? result.data.schedules
        : []

      const usedModel = result.modelName || ''
      const availableModelsInfo = formatAvailableModelsInfo(availableModelsResult)
      setImageImportModelInfo({ usedModel, availableModelsInfo })

      const notes = result?.data?.notes ? String(result.data.notes) : ''
      setImageImportNotes(notes)

      if (found.length === 0) {
        setImageImportError('일정을 찾을 수 없습니다. 다른 이미지를 시도해보세요.')
        return
      }

      const candidates = found.map((s, idx) => {
        const normalizedDate = normalizeImageScheduleDate(s?.date)
        const startTime = s?.startTime || ''
        const endTime = s?.endTime || ''
        const uncertain = Boolean(s?.uncertain)
        const date = normalizedDate || ''
        const isValid = Boolean(date && startTime && endTime)
        return {
          id: `${idx}`,
          date,
          rawDate: s?.date || '',
          startTime,
          endTime,
          memo: s?.memo || '',
          uncertain,
          isValid,
        }
      })

      const defaultSelected = new Set(
        candidates.filter((c) => c.isValid).map((c) => c.id)
      )

      setImageImportCandidates(candidates)
      setImageImportSelected(defaultSelected)
    } catch (error) {
      console.error('이미지 분석 오류:', error)
      setImageImportError(
        `이미지 분석 중 오류가 발생했습니다: ${error?.message || '알 수 없는 오류'}`
      )
    } finally {
      setImageImportIsAnalyzing(false)
    }
  }

  const toggleImageCandidate = (id) => {
    setImageImportSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addManualCandidate = () => {
    const id = `m-${Date.now()}-${imageImportIdRef.current++}`
    const next = {
      id,
      date: '',
      rawDate: '',
      startTime: '',
      endTime: '',
      memo: '',
      uncertain: false,
      isValid: false,
    }
    setImageImportCandidates((prev) => [next, ...prev])
    setImageImportSelected((prev) => {
      const nextSet = new Set(prev)
      nextSet.add(id)
      return nextSet
    })
  }

  const removeCandidate = (id) => {
    setImageImportCandidates((prev) => prev.filter((c) => c.id !== id))
    setImageImportSelected((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const updateImageCandidate = (id, field, value) => {
    setImageImportCandidates((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c
        const next = { ...c, [field]: value }
        next.isValid = Boolean(next.date && next.startTime && next.endTime)
        return next
      })
    )
  }

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

  const resetImageView = () => {
    setImageViewerZoom(1)
    setImageViewerPan({ x: 0, y: 0 })
  }

  const zoomBy = (delta) => {
    setImageViewerZoom((prev) => clamp(Math.round((prev + delta) * 10) / 10, 1, 4))
  }

  const handleImageWheel = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const direction = e.deltaY < 0 ? 1 : -1
    zoomBy(direction * 0.1)
  }

  const handleImagePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    imageViewerRef.current.isPanning = true
    imageViewerRef.current.pointerId = e.pointerId
    imageViewerRef.current.startX = e.clientX
    imageViewerRef.current.startY = e.clientY
    imageViewerRef.current.originX = imageViewerPan.x
    imageViewerRef.current.originY = imageViewerPan.y
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const handleImagePointerMove = (e) => {
    if (!imageViewerRef.current.isPanning) return
    if (imageViewerRef.current.pointerId !== e.pointerId) return
    const dx = e.clientX - imageViewerRef.current.startX
    const dy = e.clientY - imageViewerRef.current.startY
    setImageViewerPan({
      x: imageViewerRef.current.originX + dx,
      y: imageViewerRef.current.originY + dy,
    })
  }

  const handleImagePointerUp = (e) => {
    if (imageViewerRef.current.pointerId !== e.pointerId) return
    imageViewerRef.current.isPanning = false
    imageViewerRef.current.pointerId = null
  }

  const addImageSchedules = async () => {
    setImageImportError('')
    setImageImportResultMessage('')

    if (activeWorkplaces.length === 0) {
      setImageImportError('먼저 알바처를 등록해주세요.')
      return
    }
    const selectedWorkplace = activeWorkplaces.find(
      (w) => w.id === imageWorkplaceId
    )
    if (!selectedWorkplace) {
      setImageImportError('등록할 알바처를 선택해주세요.')
      return
    }

    const selectedCandidates = imageImportCandidates.filter((c) =>
      imageImportSelected.has(c.id)
    )
    if (selectedCandidates.length === 0) {
      setImageImportError('추가할 일정을 선택해주세요.')
      return
    }
    const invalidSelected = selectedCandidates.filter(
      (c) => !Boolean(c.date && c.startTime && c.endTime)
    )
    if (invalidSelected.length > 0) {
      setImageImportError(
        `선택한 일정 중 ${invalidSelected.length}개는 날짜/시간이 비어있습니다. 표에서 수정 후 다시 시도해주세요.`
      )
      return
    }

    setImageImportIsAdding(true)
    try {
      let failedCalendarCount = 0
      let lastError = ''
      for (const schedule of selectedCandidates) {
        const result = await addSchedule({
          workplaceId: selectedWorkplace.id,
          date: schedule.date,
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

      if (failedCalendarCount > 0) {
        const errorText = lastError ? ` (오류: ${lastError})` : ''
        setImageImportResultMessage(
          `선택한 ${selectedCandidates.length}개 일정은 저장되었습니다. 다만 캘린더 추가가 ${failedCalendarCount}건 실패했습니다.${errorText}`
        )
      } else {
        setImageImportResultMessage(
          `선택한 ${selectedCandidates.length}개의 일정이 추가되었습니다.`
        )
      }
    } finally {
      setImageImportIsAdding(false)
    }
  }

  // 날짜 필터는 Date 객체 비교를 쓰면 타임존/시간(00:00 vs 09:00 등) 때문에
  // 월 말(예: 1/31) 일정이 누락될 수 있어 YYYY-MM-DD 문자열 범위 비교로 처리합니다.
  const listYear = listMonth.getFullYear()
  const listMonthIndex = listMonth.getMonth()
  const listMonthStartKey = formatDateParts(listYear, listMonthIndex + 1, 1)
  const listMonthEndKey = formatDateParts(
    listYear,
    listMonthIndex + 1,
    new Date(listYear, listMonthIndex + 1, 0).getDate()
  )

  const filteredSchedules = schedules.filter((schedule) =>
    workplaceFilterId === 'all'
      ? true
      : schedule.workplaceId === workplaceFilterId
  )

  const visibleSchedules = filteredSchedules.filter((schedule) => {
    const dateKey = schedule.date
    if (typeof dateKey !== 'string') return false
    return dateKey >= listMonthStartKey && dateKey <= listMonthEndKey
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
  const sortedDates = Object.keys(groupedSchedules).sort((a, b) =>
    String(b).localeCompare(String(a))
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
            <p>
              근무일정을 추가하고 관리하세요. 해당 근무일정은 모두 구글
              캘린더와 자동으로 연동됩니다.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary view-toggle-btn"
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
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
            </label>
          </>
        )}
      </div>

      <div className="list-filters">
        <div className="input-group">
          <label>필터</label>
          <select
            value={workplaceFilterId}
            onChange={(e) => setWorkplaceFilterId(e.target.value)}
          >
            <option value="all">전체</option>
            {workplaces.map((workplace) => (
              <option key={workplace.id} value={workplace.id}>
                {workplace.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {imageImportOpen && (
        <div
          className="schedule-modal-overlay"
          onClick={closeImageImport}
          role="presentation"
        >
          <div
            className="schedule-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="schedule-modal-header">
              <div>
                <h2>이미지로 일정 등록</h2>
                <p>안내 확인 → 설정 → 분석 → 선택 등록까지 한 번에 진행해요.</p>
              </div>
              <button
                type="button"
                className="btn-icon schedule-modal-close"
                onClick={closeImageImport}
                aria-label="닫기"
                title="닫기"
              >
                ✕
              </button>
            </div>

            <div className="schedule-modal-body">
              <div className="schedule-modal-section">
                <div className="schedule-modal-section-title">안내</div>
                <ul className="schedule-modal-bullets">
                  <li>AI가 읽은 결과는 틀릴 수 있어요. 등록 전에 꼭 확인해주세요.</li>
                  <li>
                    전체 일정표라면 본인 <strong>이름/닉네임</strong>이 이미지에 보여야 해요.
                  </li>
                  <li>
                    <strong>(확인필요)</strong>로 표시된 일정은 특히 시간이 맞는지 확인이 필요해요.
                  </li>
                  <li>
                    사진에 연도가 나와있지않은 경우 <strong>올해(2026)년으로 자동 보정</strong>
                    합니다.
                  </li>
                </ul>
                <div className="schedule-modal-analyze-mode">
                  <div className="schedule-modal-analyze-mode-title">분석 방식</div>
                  <label className="schedule-modal-radio">
                    <input
                      type="radio"
                      name="analyzeMode"
                      value="direct"
                      checked={imageAnalyzeMode === 'direct'}
                      onChange={() => setImageAnalyzeMode('direct')}
                      disabled={imageImportIsAnalyzing || imageImportIsAdding}
                    />
                    기본(이미지 → 데이터 추출)
                  </label>
                  <label className="schedule-modal-radio">
                    <input
                      type="radio"
                      name="analyzeMode"
                      value="table"
                      checked={imageAnalyzeMode === 'table'}
                      onChange={() => setImageAnalyzeMode('table')}
                      disabled={imageImportIsAnalyzing || imageImportIsAdding}
                    />
                    표 변환 후 추출(이미지 → 표 → 데이터)
                  </label>
                </div>
              </div>

              {imageImportPreviewUrl && (
                <div className="schedule-modal-section">
                  <div className="schedule-modal-section-title">업로드한 이미지</div>
                  <div className="schedule-modal-image-toolbar">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => zoomBy(-0.2)}
                      disabled={imageViewerZoom <= 1}
                    >
                      축소
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => zoomBy(0.2)}
                      disabled={imageViewerZoom >= 4}
                    >
                      확대
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={resetImageView}
                    >
                      초기화
                    </button>
                    <span className="schedule-modal-image-zoom">
                      {Math.round(imageViewerZoom * 100)}%
                    </span>
                    <span className="schedule-modal-image-hint">
                      휠로 확대/축소, 드래그로 이동
                    </span>
                  </div>

                  <div
                    className="schedule-modal-image-wrapper"
                    onWheelCapture={handleImageWheel}
                  >
                    <img
                      className="schedule-modal-image"
                      src={imageImportPreviewUrl}
                      alt="업로드한 일정표"
                      draggable={false}
                      style={{
                        transform: `translate(${imageViewerPan.x}px, ${imageViewerPan.y}px) scale(${imageViewerZoom})`,
                      }}
                      onPointerDown={handleImagePointerDown}
                      onPointerMove={handleImagePointerMove}
                      onPointerUp={handleImagePointerUp}
                      onPointerCancel={handleImagePointerUp}
                    />
                  </div>
                  <div className="schedule-modal-image-actions">
                    <a
                      className="schedule-modal-image-link"
                      href={imageImportPreviewUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      새 창으로 크게 보기
                    </a>
                    {imageImportFile?.name ? (
                      <span className="schedule-modal-image-meta">
                        파일: {imageImportFile.name}
                      </span>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="schedule-modal-grid">
                <div className="input-group">
                  <label>이름/닉네임 *</label>
                  <input
                    type="text"
                    value={imageTargetName}
                    onChange={(e) => setImageTargetName(e.target.value)}
                    placeholder="예: 홍길동 / 길동 / Gildong"
                    disabled={imageImportIsAnalyzing || imageImportIsAdding}
                  />
                  <div className="input-hint">
                    전체 일정표일 경우 본인 이름이 정확히 매칭되어야 일정이 추출됩니다.
                  </div>
                </div>

                <div className="input-group">
                  <label>등록할 알바처 *</label>
                  <select
                    value={imageWorkplaceId}
                    onChange={(e) => setImageWorkplaceId(e.target.value)}
                    disabled={imageImportIsAnalyzing || imageImportIsAdding}
                  >
                    <option value="">선택하세요</option>
                    {activeWorkplaces.map((workplace) => (
                      <option key={workplace.id} value={workplace.id}>
                        {workplace.name}
                      </option>
                    ))}
                  </select>
                  {activeWorkplaces.length === 0 && (
                    <div className="schedule-modal-error">
                      먼저 알바처를 등록해주세요.
                    </div>
                  )}
                </div>
              </div>

              <div className="schedule-modal-divider" />

              <div className="schedule-modal-section">
                <div className="schedule-modal-section-title">분석 결과</div>

                {imageImportIsAnalyzing && (
                  <div className="analyzing-state">
                    <div className="spinner"></div>
                    <p>AI가 일정표를 분석하고 있습니다...</p>
                  </div>
                )}

                {imageImportError && (
                  <div className="schedule-modal-error">{imageImportError}</div>
                )}

                {imageImportResultMessage && (
                  <div className="schedule-modal-success">
                    {imageImportResultMessage}
                  </div>
                )}

                {!imageImportIsAnalyzing && imageImportCandidates.length > 0 && (
                  <div className="schedule-modal-results">
                    <div className="schedule-modal-results-meta">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={addManualCandidate}
                        disabled={imageImportIsAnalyzing || imageImportIsAdding}
                      >
                        + 일정 추가
                      </button>
                      <span>
                        찾은 일정: <strong>{imageImportCandidates.length}</strong>개
                      </span>
                      <span>
                        선택됨:{' '}
                        <strong>
                          {
                            imageImportCandidates.filter((c) =>
                              imageImportSelected.has(c.id)
                            ).length
                          }
                        </strong>
                        개 (추가 가능:{' '}
                        <strong>
                          {
                            imageImportCandidates.filter(
                              (c) => imageImportSelected.has(c.id) && c.isValid
                            ).length
                          }
                        </strong>
                        개)
                      </span>
                    </div>

                    <div className="schedule-modal-result-list">
                      {imageImportCandidates.map((c, index) => {
                        const disabled = imageImportIsAdding
                        const checked = imageImportSelected.has(c.id)
                        return (
                          <label
                            key={c.id}
                            className={`schedule-modal-result-item ${
                              disabled ? 'disabled' : ''
                            } ${!c.isValid ? 'invalid' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => toggleImageCandidate(c.id)}
                            />
                            <div className="schedule-modal-result-text">
                              <div className="schedule-modal-result-main">
                                <span className="schedule-modal-result-index">
                                  {index + 1}.
                                </span>
                                <button
                                  type="button"
                                  className="schedule-modal-row-delete"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    removeCandidate(c.id)
                                  }}
                                  disabled={disabled}
                                  title="이 행 삭제"
                                >
                                  삭제
                                </button>
                                {c.uncertain && (
                                  <span className="schedule-modal-badge">
                                    확인필요
                                  </span>
                                )}
                                {!c.isValid && (
                                  <span className="schedule-modal-badge warn">
                                    누락됨
                                  </span>
                                )}
                              </div>
                              <div className="schedule-modal-review-grid">
                                <div className="schedule-modal-review-field">
                                  <span className="schedule-modal-review-label">
                                    날짜
                                  </span>
                                  <input
                                    type="date"
                                    value={c.date || ''}
                                    disabled={disabled}
                                    onChange={(e) =>
                                      updateImageCandidate(c.id, 'date', e.target.value)
                                    }
                                  />
                                  {!c.date && c.rawDate ? (
                                    <div className="schedule-modal-review-hint">
                                      원본: {c.rawDate}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="schedule-modal-review-field">
                                  <span className="schedule-modal-review-label">
                                    시작
                                  </span>
                                  <input
                                    type="time"
                                    value={c.startTime || ''}
                                    disabled={disabled}
                                    onChange={(e) =>
                                      updateImageCandidate(
                                        c.id,
                                        'startTime',
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <div className="schedule-modal-review-field">
                                  <span className="schedule-modal-review-label">
                                    종료
                                  </span>
                                  <input
                                    type="time"
                                    value={c.endTime || ''}
                                    disabled={disabled}
                                    onChange={(e) =>
                                      updateImageCandidate(
                                        c.id,
                                        'endTime',
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <div className="schedule-modal-review-field wide">
                                  <span className="schedule-modal-review-label">
                                    메모
                                  </span>
                                  <input
                                    type="text"
                                    value={c.memo || ''}
                                    disabled={disabled}
                                    placeholder="메모 (선택)"
                                    onChange={(e) =>
                                      updateImageCandidate(c.id, 'memo', e.target.value)
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          </label>
                        )
                      })}
                    </div>

                    {(imageImportNotes ||
                      imageImportTable ||
                      imageImportModelInfo.usedModel ||
                      imageImportModelInfo.availableModelsInfo) && (
                      <div className="schedule-modal-ai-meta">
                        {imageImportTable && (
                          <div className="schedule-modal-ai-notes">
                            <strong>AI 변환 표</strong>
                            <pre className="schedule-modal-ai-table">
                              {imageImportTable}
                            </pre>
                          </div>
                        )}
                        {imageImportNotes && (
                          <div className="schedule-modal-ai-notes">
                            <strong>AI 알림</strong>
                            <div className="schedule-modal-ai-notes-text">
                              {imageImportNotes}
                            </div>
                          </div>
                        )}
                        {(imageImportModelInfo.usedModel ||
                          imageImportModelInfo.availableModelsInfo) && (
                          <div className="schedule-modal-ai-model">
                            {imageImportModelInfo.usedModel
                              ? `사용 모델: ${imageImportModelInfo.usedModel}`
                              : '사용 모델: 알 수 없음'}
                            {imageImportModelInfo.availableModelsInfo
                              ? ` |${imageImportModelInfo.availableModelsInfo}`
                              : ''}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!imageImportIsAnalyzing && imageImportCandidates.length === 0 && (
                  <div className="schedule-modal-muted">
                    아직 분석 결과가 없습니다. “분석 시작”을 눌러주세요.
                  </div>
                )}
              </div>
            </div>

            <div className="schedule-modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeImageImport}
                disabled={imageImportIsAnalyzing || imageImportIsAdding}
              >
                닫기
              </button>

              <div className="schedule-modal-footer-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={runImageAnalyze}
                  disabled={imageImportIsAnalyzing || imageImportIsAdding}
                >
                  분석 시작
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={addImageSchedules}
                  disabled={
                    imageImportIsAnalyzing ||
                    imageImportIsAdding ||
                    imageImportCandidates.length === 0
                  }
                >
                  {imageImportIsAdding ? '등록 중...' : '선택한 일정 추가'}
                </button>
              </div>
            </div>
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
                {(editingId
                  ? workplaces
                  : activeWorkplaces
                ).map((workplace) => (
                  <option key={workplace.id} value={workplace.id}>
                    {workplace.name}
                    {(workplace.employmentStatus || 'active') === 'retired'
                      ? ' (퇴사)'
                      : ''}
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
          {schedules.length === 0 ? (
            <div className="empty-state">
              <p>등록된 근무 일정이 없습니다.</p>
              <p className="empty-hint">
                수동으로 추가하거나 이미지를 업로드해보세요.
              </p>
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div className="empty-state">
              <p>선택한 알바처에 근무 일정이 없습니다.</p>
            </div>
          ) : visibleSchedules.length === 0 ? (
            <div className="empty-state">
              <p>선택한 월에 근무 일정이 없습니다.</p>
            </div>
          ) : null}
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
            <div className="list-month-label">{formatMonthLabel(listMonth)}</div>
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
          ) : filteredSchedules.length === 0 ? (
            <div className="empty-state">
              <p>선택한 알바처에 근무 일정이 없습니다.</p>
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
    return formatDateParts(fullMatch[1], fullMatch[2], fullMatch[3])
  }

  const shortYearMatch = trimmed.match(/^(\d{2})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (shortYearMatch) {
    // "24-01-05" 같은 2자리 연도는 20xx로 해석 (이미지에 연도가 없으면 yyyy-MM-DD로 오도록 유도)
    const year = 2000 + Number(shortYearMatch[1])
    return formatDateParts(year, shortYearMatch[2], shortYearMatch[3])
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
