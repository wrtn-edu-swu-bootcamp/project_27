import { useState } from 'react'
import { useWorkplaceStore } from '../store/workplaceStore'
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

function WorkplaceManager() {
  const { workplaces, addWorkplace, updateWorkplace, deleteWorkplace } =
    useWorkplaceStore()
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(getEmptyForm())

  function getEmptyForm() {
    return {
      name: '',
      hourlyWage: '',
      salaryType: 'monthly',
      incomeType: 'employment',
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      settings: {
        weeklyHolidayPay: {
          supported: false,
          userConfirmed: false,
          condition: 'weeklyHours >= 15',
          status: 'unknown',
        },
        nightPay: {
          supported: false,
          userConfirmed: false,
          condition: 'workTime between 22:00-06:00',
          status: 'unknown',
        },
        holidayPay: {
          supported: false,
          userConfirmed: false,
          condition: 'weekend or holiday',
          status: 'unknown',
        },
      },
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!formData.name || !formData.hourlyWage) {
      alert('알바처 이름과 시급을 입력해주세요.')
      return
    }

    const workplace = {
      ...formData,
      hourlyWage: Number(formData.hourlyWage),
    }

    if (editingId) {
      updateWorkplace(editingId, workplace)
      setEditingId(null)
    } else {
      addWorkplace(workplace)
    }

    setFormData(getEmptyForm())
    setIsAdding(false)
  }

  const handleEdit = (workplace) => {
    setFormData(workplace)
    setEditingId(workplace.id)
    setIsAdding(true)
  }

  const handleDelete = (id) => {
    if (confirm('이 알바처를 삭제하시겠습니까?')) {
      deleteWorkplace(id)
    }
  }

  const handleCancel = () => {
    setFormData(getEmptyForm())
    setIsAdding(false)
    setEditingId(null)
  }

  const updateSettings = (settingKey, field, value) => {
    setFormData({
      ...formData,
      settings: {
        ...formData.settings,
        [settingKey]: {
          ...formData.settings[settingKey],
          [field]: value,
          status:
            field === 'supported' && value
              ? 'conditional'
              : field === 'userConfirmed' && value
              ? 'confirmed'
              : 'unknown',
        },
      },
    })
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
            </div>

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

            <div className="input-group">
              <label>급여 형태</label>
              <select
                value={formData.incomeType}
                onChange={(e) =>
                  setFormData({ ...formData, incomeType: e.target.value })
                }
              >
                <option value="employment">근로소득</option>
                <option value="business">사업소득 (3.3% 공제)</option>
              </select>
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
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.settings.weeklyHolidayPay.supported}
                      onChange={(e) =>
                        updateSettings('weeklyHolidayPay', 'supported', e.target.checked)
                      }
                    />
                    주휴수당
                  </label>
                  <span className="setting-info">주 15시간 이상 근무 시 적용</span>
                </div>
                {formData.settings.weeklyHolidayPay.supported && (
                  <div className="setting-confirm">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.settings.weeklyHolidayPay.userConfirmed}
                        onChange={(e) =>
                          updateSettings(
                            'weeklyHolidayPay',
                            'userConfirmed',
                            e.target.checked
                          )
                        }
                      />
                      이 알바처에서 주휴수당을 지급함을 확인했습니다
                    </label>
                  </div>
                )}
              </div>

              {/* 야간수당 */}
              <div className="setting-item">
                <div className="setting-header">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.settings.nightPay.supported}
                      onChange={(e) =>
                        updateSettings('nightPay', 'supported', e.target.checked)
                      }
                    />
                    야간수당
                  </label>
                  <span className="setting-info">22:00~06:00 근무 시 기본급의 50%</span>
                </div>
                {formData.settings.nightPay.supported && (
                  <div className="setting-confirm">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.settings.nightPay.userConfirmed}
                        onChange={(e) =>
                          updateSettings('nightPay', 'userConfirmed', e.target.checked)
                        }
                      />
                      이 알바처에서 야간수당을 지급함을 확인했습니다
                    </label>
                  </div>
                )}
              </div>

              {/* 휴일수당 */}
              <div className="setting-item">
                <div className="setting-header">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.settings.holidayPay.supported}
                      onChange={(e) =>
                        updateSettings('holidayPay', 'supported', e.target.checked)
                      }
                    />
                    휴일수당
                  </label>
                  <span className="setting-info">
                    주말/공휴일 근무 시 기본급의 50%
                  </span>
                </div>
                {formData.settings.holidayPay.supported && (
                  <div className="setting-confirm">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.settings.holidayPay.userConfirmed}
                        onChange={(e) =>
                          updateSettings('holidayPay', 'userConfirmed', e.target.checked)
                        }
                      />
                      이 알바처에서 휴일수당을 지급함을 확인했습니다
                    </label>
                  </div>
                )}
              </div>
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
                    {workplace.settings.weeklyHolidayPay.userConfirmed && (
                      <span className="allowance-badge">주휴수당</span>
                    )}
                    {workplace.settings.nightPay.userConfirmed && (
                      <span className="allowance-badge">야간수당</span>
                    )}
                    {workplace.settings.holidayPay.userConfirmed && (
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
