import { useState } from 'react'
import { useWorkplaceStore } from '../store/workplaceStore'
import { getAllowanceQnA } from '../api/gemini'
import './WorkplaceManager.css'

const COLORS = [
  '#4285f4',
  '#ea4335',
  '#fbbc04',
  '#34a853',
  '#ff6d00',
  '#46bdc6',
  '#7c4dff',
  '#f50057',
]
const MINIMUM_WAGE_BY_YEAR = {
  2026: 10320,
}

function WorkplaceManager() {
  const { workplaces, addWorkplace, updateWorkplace, deleteWorkplace } =
    useWorkplaceStore()
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(getEmptyForm())
  const [allowanceQuestion, setAllowanceQuestion] = useState('')
  const [allowanceAnswer, setAllowanceAnswer] = useState('')
  const [allowanceModelName, setAllowanceModelName] = useState('')
  const [allowanceError, setAllowanceError] = useState('')
  const [isAskingAllowance, setIsAskingAllowance] = useState(false)
  const currentYear = new Date().getFullYear()
  const minimumWage = MINIMUM_WAGE_BY_YEAR[currentYear]

  function getEmptyForm() {
    const breakDefaults = normalizeBreakSettings({})
    const insuranceDefaults = normalizeInsuranceSettings({})
    return {
      name: '',
      hourlyWage: '',
      breakType: breakDefaults.breakType,
      breakEveryHours: breakDefaults.breakEveryHours,
      breakMinutesPerBlock: breakDefaults.breakMinutesPerBlock,
      salaryType: 'monthly',
      taxType: normalizeTaxType({}),
      insuranceSettings: insuranceDefaults,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      settings: normalizeSettings({}),
    }
  }

  function normalizeSettings(settings) {
    return {
      weeklyHolidayPay: normalizeAllowanceSetting(
        settings?.weeklyHolidayPay,
        'weeklyHours >= 15'
      ),
      nightPay: normalizeAllowanceSetting(
        settings?.nightPay,
        'workTime between 22:00-06:00'
      ),
      holidayPay: normalizeAllowanceSetting(
        settings?.holidayPay,
        'weekend or holiday'
      ),
    }
  }

  function normalizeAllowanceSetting(setting, condition) {
    const base = {
      supported: false,
      userConfirmed: false,
      status: 'unknown',
      selection: 'unknown',
      condition,
      ...setting,
    }
    const selection = base.selection
      ? base.selection
      : base.supported
      ? base.userConfirmed
        ? 'yes'
        : 'unknown'
      : 'no'
    return applySelection(base, selection)
  }

  function applySelection(setting, selection) {
    const isYes = selection === 'yes'
    const isUnknown = selection === 'unknown'
    return {
      ...setting,
      selection,
      supported: isYes || isUnknown,
      userConfirmed: isYes,
      status: isYes ? 'confirmed' : isUnknown ? 'conditional' : 'unknown',
    }
  }

  function normalizeBreakSettings(workplace) {
    if (workplace?.breakType) {
      return {
        breakType: workplace.breakType,
        breakEveryHours: Number(workplace.breakEveryHours || 4),
        breakMinutesPerBlock: Number(workplace.breakMinutesPerBlock || 30),
      }
    }

    const legacyBreakMinutes = Number(workplace?.breakMinutes || 0)
    if (legacyBreakMinutes > 0) {
      return {
        breakType: 'custom',
        breakEveryHours: 4,
        breakMinutesPerBlock: legacyBreakMinutes,
      }
    }

    return {
      breakType: 'none',
      breakEveryHours: 4,
      breakMinutesPerBlock: 30,
    }
  }

  function normalizeTaxType(workplace) {
    if (workplace?.taxType) return workplace.taxType
    return 'unknown'
  }

  function normalizeInsuranceSettings(workplace) {
    const defaults = {
      pension: { enabled: true, rate: 4.5 },
      health: { enabled: true, rate: 3.545 },
      longTermCare: { enabled: true, rate: 12.81 },
      employment: { enabled: true, rate: 0.9 },
      accident: { enabled: false, rate: 0 },
    }
    return {
      ...defaults,
      ...(workplace?.insuranceSettings || {}),
    }
  }

  function normalizeInsuranceForSubmit(settings) {
    const safeNumber = (value) => Number(value || 0)
    return {
      pension: {
        enabled: Boolean(settings?.pension?.enabled),
        rate: safeNumber(settings?.pension?.rate),
      },
      health: {
        enabled: Boolean(settings?.health?.enabled),
        rate: safeNumber(settings?.health?.rate),
      },
      longTermCare: {
        enabled: Boolean(settings?.longTermCare?.enabled),
        rate: safeNumber(settings?.longTermCare?.rate),
      },
      employment: {
        enabled: Boolean(settings?.employment?.enabled),
        rate: safeNumber(settings?.employment?.rate),
      },
      accident: {
        enabled: false,
        rate: 0,
      },
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name || !formData.hourlyWage) {
      alert('알바처 이름과 시급을 입력해주세요.')
      return
    }

    const workplace = {
      ...formData,
      hourlyWage: Number(formData.hourlyWage),
      breakType: formData.breakType,
      breakEveryHours: Number(formData.breakEveryHours || 0),
      breakMinutesPerBlock: Number(formData.breakMinutesPerBlock || 0),
      taxType: formData.taxType,
      insuranceSettings: normalizeInsuranceForSubmit(formData.insuranceSettings),
      settings: normalizeSettings(formData.settings),
    }

    if (editingId) {
      updateWorkplace(editingId, workplace)
      setEditingId(null)
    } else {
      await addWorkplace(workplace)
    }

    setFormData(getEmptyForm())
    setIsAdding(false)
  }

  const handleEdit = (workplace) => {
    const breakDefaults = normalizeBreakSettings(workplace)
    const insuranceDefaults = normalizeInsuranceSettings(workplace)
    setFormData({
      ...workplace,
      breakType: breakDefaults.breakType,
      breakEveryHours: breakDefaults.breakEveryHours,
      breakMinutesPerBlock: breakDefaults.breakMinutesPerBlock,
      taxType: normalizeTaxType(workplace),
      insuranceSettings: insuranceDefaults,
      settings: normalizeSettings(workplace.settings || {}),
    })
    setEditingId(workplace.id)
    setIsAdding(true)
    setAllowanceQuestion('')
    setAllowanceAnswer('')
    setAllowanceModelName('')
    setAllowanceError('')
  }

  const handleDelete = async (id) => {
    if (confirm('이 알바처를 삭제하시겠습니까?')) {
      await deleteWorkplace(id)
    }
  }

  const handleCancel = () => {
    setFormData(getEmptyForm())
    setIsAdding(false)
    setEditingId(null)
    setAllowanceQuestion('')
    setAllowanceAnswer('')
    setAllowanceModelName('')
    setAllowanceError('')
  }

  const updateAllowanceSelection = (settingKey, selection) => {
    setFormData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [settingKey]: applySelection(prev.settings[settingKey], selection),
      },
    }))
  }

  const updateInsuranceSetting = (key, field, value) => {
    setFormData((prev) => ({
      ...prev,
      insuranceSettings: {
        ...prev.insuranceSettings,
        [key]: {
          ...prev.insuranceSettings[key],
          [field]: value,
        },
      },
    }))
  }

  const handleAskAllowance = async () => {
    const question = allowanceQuestion.trim()
    if (!question) {
      alert('질문을 입력해주세요.')
      return
    }

    setIsAskingAllowance(true)
    setAllowanceError('')
    setAllowanceAnswer('')
    setAllowanceModelName('')

    const result = await getAllowanceQnA(question, formData.name)
    if (!result?.success) {
      setAllowanceError(result?.error || 'AI 응답을 가져오지 못했습니다.')
      setIsAskingAllowance(false)
      return
    }

    setAllowanceAnswer(result.answer)
    setAllowanceModelName(result.modelName || '')
    setIsAskingAllowance(false)
  }

  const isAllowanceConfirmed = (setting) => {
    if (setting?.selection) return setting.selection === 'yes'
    return Boolean(setting?.supported && setting?.userConfirmed)
  }

  return (
    <div className="workplace-manager">
      <div className="page-header">
        <h1>알바처 관리</h1>
        <p>알바처를 등록하고 급여 조건을 설정하세요</p>
      </div>

      {!isAdding && (
        <button className="btn-primary" onClick={() => setIsAdding(true)}>
          + 알바처 추가
        </button>
      )}

      {isAdding && (
        <div className="card">
          <div className="card-header">
            <h2>{editingId ? '알바처 수정' : '새 알바처 추가'}</h2>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>알바처 이름 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 스타벅스 강남점"
                required
              />
            </div>

            <div className="input-group">
              <label>시급 (원) *</label>
              <input
                type="number"
                value={formData.hourlyWage}
                onChange={(e) =>
                  setFormData({ ...formData, hourlyWage: e.target.value })
                }
                placeholder="예: 10000"
                required
              />
              {minimumWage && (
                <div className="input-hint">
                  {currentYear}년 최저시급: {minimumWage.toLocaleString()}원
                </div>
              )}
            </div>

            <div className="input-group">
              <label>휴게시간</label>
              <select
                value={formData.breakType}
                onChange={(e) =>
                  setFormData({ ...formData, breakType: e.target.value })
                }
              >
                <option value="none">없음</option>
                <option value="standard">4시간당 30분</option>
                <option value="custom">기타 (직접 입력)</option>
              </select>
              <div className="input-hint">
                4시간당 30분 휴게시간이 법적으로 주어집니다.
                근무일정이 4시간을 넘으면 설정한 휴게시간이 자동 적용됩니다.
              </div>
            </div>

            {formData.breakType === 'custom' && (
              <div className="input-row">
                <div className="input-group">
                  <label>몇 시간당</label>
                  <input
                    type="number"
                    value={formData.breakEveryHours}
                    onChange={(e) =>
                      setFormData({ ...formData, breakEveryHours: e.target.value })
                    }
                    placeholder="예: 4"
                    min="1"
                  />
                </div>
                <div className="input-group">
                  <label>휴게 분</label>
                  <input
                    type="number"
                    value={formData.breakMinutesPerBlock}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        breakMinutesPerBlock: e.target.value,
                      })
                    }
                    placeholder="예: 30"
                    min="0"
                  />
                </div>
              </div>
            )}

            <div className="input-group">
              <label>급여 주기</label>
              <select
                value={formData.salaryType}
                onChange={(e) =>
                  setFormData({ ...formData, salaryType: e.target.value })
                }
              >
                <option value="weekly">주급</option>
                <option value="monthly">월급</option>
              </select>
            </div>

            <div className="tax-section">
              <h3>세금/공제 설정</h3>
              <p className="settings-hint">
                알바 급여 공제 방식만 선택하면 됩니다.
              </p>
              <div className="tax-options">
                <label className="setting-option">
                  <input
                    type="radio"
                    name="taxType"
                    value="withholding3_3"
                    checked={formData.taxType === 'withholding3_3'}
                    onChange={(e) =>
                      setFormData({ ...formData, taxType: e.target.value })
                    }
                  />
                  3.3% 공제 (소득세 3% + 지방소득세 0.3%)
                </label>
                <label className="setting-option">
                  <input
                    type="radio"
                    name="taxType"
                    value="four_insurance"
                    checked={formData.taxType === 'four_insurance'}
                    onChange={(e) =>
                      setFormData({ ...formData, taxType: e.target.value })
                    }
                  />
                  4대보험 공제 (국민연금·건강보험·고용보험·산재보험)
                </label>
                <label className="setting-option">
                  <input
                    type="radio"
                    name="taxType"
                    value="unknown"
                    checked={formData.taxType === 'unknown'}
                    onChange={(e) =>
                      setFormData({ ...formData, taxType: e.target.value })
                    }
                  />
                  잘 모르겠음
                </label>
              </div>
              {formData.taxType === 'four_insurance' && (
                <div className="insurance-options">
                  <div className="insurance-row">
                    <label className="setting-option">
                      <input
                        type="checkbox"
                        checked={formData.insuranceSettings.pension.enabled}
                        onChange={(e) =>
                          updateInsuranceSetting('pension', 'enabled', e.target.checked)
                        }
                      />
                      국민연금
                    </label>
                    <input
                      type="number"
                      value={formData.insuranceSettings.pension.rate}
                      onChange={(e) =>
                        updateInsuranceSetting('pension', 'rate', e.target.value)
                      }
                      min="0"
                      step="0.001"
                      className="insurance-rate"
                    />
                    <span className="insurance-unit">%</span>
                  </div>
                  <div className="insurance-row">
                    <label className="setting-option">
                      <input
                        type="checkbox"
                        checked={formData.insuranceSettings.health.enabled}
                        onChange={(e) =>
                          updateInsuranceSetting('health', 'enabled', e.target.checked)
                        }
                      />
                      건강보험
                    </label>
                    <input
                      type="number"
                      value={formData.insuranceSettings.health.rate}
                      onChange={(e) =>
                        updateInsuranceSetting('health', 'rate', e.target.value)
                      }
                      min="0"
                      step="0.001"
                      className="insurance-rate"
                    />
                    <span className="insurance-unit">%</span>
                  </div>
                  <div className="insurance-row">
                    <label className="setting-option">
                      <input
                        type="checkbox"
                        checked={formData.insuranceSettings.longTermCare.enabled}
                        onChange={(e) =>
                          updateInsuranceSetting(
                            'longTermCare',
                            'enabled',
                            e.target.checked
                          )
                        }
                      />
                      장기요양보험 (건강보험료의 %)
                    </label>
                    <input
                      type="number"
                      value={formData.insuranceSettings.longTermCare.rate}
                      onChange={(e) =>
                        updateInsuranceSetting('longTermCare', 'rate', e.target.value)
                      }
                      min="0"
                      step="0.01"
                      className="insurance-rate"
                    />
                    <span className="insurance-unit">%</span>
                  </div>
                  <div className="insurance-row">
                    <label className="setting-option">
                      <input
                        type="checkbox"
                        checked={formData.insuranceSettings.employment.enabled}
                        onChange={(e) =>
                          updateInsuranceSetting(
                            'employment',
                            'enabled',
                            e.target.checked
                          )
                        }
                      />
                      고용보험
                    </label>
                    <input
                      type="number"
                      value={formData.insuranceSettings.employment.rate}
                      onChange={(e) =>
                        updateInsuranceSetting('employment', 'rate', e.target.value)
                      }
                      min="0"
                      step="0.001"
                      className="insurance-rate"
                    />
                    <span className="insurance-unit">%</span>
                  </div>
                  <div className="insurance-row">
                    <label className="setting-option">
                      <input type="checkbox" checked={false} disabled />
                      산재보험 (사업주 전액 부담)
                    </label>
                    <input
                      type="number"
                      value={0}
                      disabled
                      className="insurance-rate"
                    />
                    <span className="insurance-unit">%</span>
                  </div>
                </div>
              )}
              <div className="tax-note">
                <p>1️⃣ 알바하면 기본적으로 떼이는 세금</p>
                <p>보통 시급 알바는 3.3% 공제(소득세 3% + 지방소득세 0.3%).</p>
                <p>단기 알바, 일용직, 계약서 없이 하는 알바에서 흔합니다.</p>
                <p>
                  예시: 시급 10,000원 × 100시간 = 1,000,000원 →
                  33,000원 공제 후 967,000원 수령
                </p>
                <p>2️⃣ 4대보험 적용되는 알바도 있음</p>
                <p>주 15시간 이상 (또는 월 60시간 이상), 1개월 이상 근무 등 조건 충족 시 적용됩니다.</p>
                <p>4대보험 구성 & 근로자 부담률</p>
                <p>- 국민연금 4.5%</p>
                <p>- 건강보험 3.545%</p>
                <p>- 장기요양보험: 건강보험료의 12.81%</p>
                <p>- 고용보험 0.9%</p>
                <p>- 산재보험: 사업주 전액 부담(월급에서 공제되지 않음)</p>
              </div>
            </div>

            <div className="input-group">
              <label>캘린더 색상</label>
              <div className="color-picker">
                {COLORS.map((color) => (
                  <div
                    key={color}
                    className={`color-option ${
                      formData.color === color ? 'selected' : ''
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>

            <div className="settings-section">
              <h3>수당 설정</h3>
              <p className="settings-hint">
                해당 알바처에서 지원하는 수당을 선택해주세요
              </p>

              {/* 주휴수당 */}
              <div className="setting-item">
                <div className="setting-header">
                  <div className="setting-title">주휴수당</div>
                  <span className="setting-info">주 15시간 이상 근무 시 적용</span>
                </div>
                <div className="setting-options">
                  <label className="setting-option">
                    <input
                      type="radio"
                      name="weeklyHolidayPay"
                      value="yes"
                      checked={formData.settings.weeklyHolidayPay.selection === 'yes'}
                      onChange={() =>
                        updateAllowanceSelection('weeklyHolidayPay', 'yes')
                      }
                    />
                    지급함 (확실함)
                  </label>
                  <label className="setting-option">
                    <input
                      type="radio"
                      name="weeklyHolidayPay"
                      value="no"
                      checked={formData.settings.weeklyHolidayPay.selection === 'no'}
                      onChange={() =>
                        updateAllowanceSelection('weeklyHolidayPay', 'no')
                      }
                    />
                    지급하지 않음
                  </label>
                  <label className="setting-option">
                    <input
                      type="radio"
                      name="weeklyHolidayPay"
                      value="unknown"
                      checked={formData.settings.weeklyHolidayPay.selection === 'unknown'}
                      onChange={() =>
                        updateAllowanceSelection('weeklyHolidayPay', 'unknown')
                      }
                    />
                    잘 모르겠음
                  </label>
                </div>
              </div>

              {/* 야간수당 */}
              <div className="setting-item">
                <div className="setting-header">
                  <div className="setting-title">야간수당</div>
                  <span className="setting-info">22:00~06:00 근무 시 기본급의 50%</span>
                </div>
                <div className="setting-options">
                  <label className="setting-option">
                    <input
                      type="radio"
                      name="nightPay"
                      value="yes"
                      checked={formData.settings.nightPay.selection === 'yes'}
                      onChange={() => updateAllowanceSelection('nightPay', 'yes')}
                    />
                    지급함 (확실함)
                  </label>
                  <label className="setting-option">
                    <input
                      type="radio"
                      name="nightPay"
                      value="no"
                      checked={formData.settings.nightPay.selection === 'no'}
                      onChange={() => updateAllowanceSelection('nightPay', 'no')}
                    />
                    지급하지 않음
                  </label>
                  <label className="setting-option">
                    <input
                      type="radio"
                      name="nightPay"
                      value="unknown"
                      checked={formData.settings.nightPay.selection === 'unknown'}
                      onChange={() => updateAllowanceSelection('nightPay', 'unknown')}
                    />
                    잘 모르겠음
                  </label>
                </div>
              </div>

              {/* 휴일수당 */}
              <div className="setting-item">
                <div className="setting-header">
                  <div className="setting-title">휴일수당</div>
                  <span className="setting-info">
                    법정공휴일 근무 시 기본급의 50%
                  </span>
                </div>
                <div className="setting-options">
                  <label className="setting-option">
                    <input
                      type="radio"
                      name="holidayPay"
                      value="yes"
                      checked={formData.settings.holidayPay.selection === 'yes'}
                      onChange={() => updateAllowanceSelection('holidayPay', 'yes')}
                    />
                    지급함 (확실함)
                  </label>
                  <label className="setting-option">
                    <input
                      type="radio"
                      name="holidayPay"
                      value="no"
                      checked={formData.settings.holidayPay.selection === 'no'}
                      onChange={() => updateAllowanceSelection('holidayPay', 'no')}
                    />
                    지급하지 않음
                  </label>
                  <label className="setting-option">
                    <input
                      type="radio"
                      name="holidayPay"
                      value="unknown"
                      checked={formData.settings.holidayPay.selection === 'unknown'}
                      onChange={() => updateAllowanceSelection('holidayPay', 'unknown')}
                    />
                    잘 모르겠음
                  </label>
                </div>
              </div>
            </div>

            <div className="ai-assistant">
              <h3>AI 수당 상담</h3>
              <p className="settings-hint">
                수당, 세금/공제, 근무 조건에 대해 질문하면 안내해드려요.
              </p>
              <textarea
                value={allowanceQuestion}
                onChange={(e) => setAllowanceQuestion(e.target.value)}
                placeholder="예: 주말에 야간 근무를 하면 어떤 수당을 받을 수 있나요?"
                rows="3"
              />
              <div className="ai-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleAskAllowance}
                  disabled={isAskingAllowance}
                >
                  {isAskingAllowance ? '답변 생성 중...' : '질문하기'}
                </button>
              </div>
              {allowanceAnswer && (
                <div className="ai-answer">
                  {allowanceAnswer}
                  {allowanceModelName && (
                    <div className="ai-meta">사용 모델: {allowanceModelName}</div>
                  )}
                </div>
              )}
              {allowanceError && (
                <div className="ai-error">{allowanceError}</div>
              )}
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

      {/* 알바처 목록 */}
      <div className="workplace-list-section">
        {workplaces.length === 0 ? (
          <div className="empty-state">
            <p>등록된 알바처가 없습니다.</p>
            <p className="empty-hint">첫 알바처를 추가해보세요.</p>
          </div>
        ) : (
          <div className="workplace-grid">
            {workplaces.map((workplace) => (
              <div key={workplace.id} className="workplace-card">
                <div className="workplace-card-header">
                  <div
                    className="workplace-color-big"
                    style={{ backgroundColor: workplace.color }}
                  />
                  <h3>{workplace.name}</h3>
                </div>
                <div className="workplace-card-body">
                  <div className="info-row">
                    <span className="label">시급:</span>
                    <span className="value">
                      {workplace.hourlyWage.toLocaleString()}원
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="label">급여 주기:</span>
                    <span className="value">
                      {workplace.salaryType === 'weekly' ? '주급' : '월급'}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="label">급여 형태:</span>
                    <span className="value">
                      {workplace.incomeType === 'employment'
                        ? '근로소득'
                        : '사업소득'}
                    </span>
                  </div>
                  <div className="allowances">
                    {isAllowanceConfirmed(workplace.settings.weeklyHolidayPay) && (
                      <span className="allowance-badge">주휴수당</span>
                    )}
                    {isAllowanceConfirmed(workplace.settings.nightPay) && (
                      <span className="allowance-badge">야간수당</span>
                    )}
                    {isAllowanceConfirmed(workplace.settings.holidayPay) && (
                      <span className="allowance-badge">휴일수당</span>
                    )}
                  </div>
                </div>
                <div className="workplace-card-actions">
                  <button
                    className="btn-edit"
                    onClick={() => handleEdit(workplace)}
                  >
                    수정
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => handleDelete(workplace.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default WorkplaceManager
