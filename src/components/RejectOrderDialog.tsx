import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/index.js'
import '../App.css'

interface RejectOrderDialogProps {
  open: boolean
  busy?: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}

export function RejectOrderDialog({ open, busy, onClose, onConfirm }: RejectOrderDialogProps) {
  const t = useI18n((s) => s.t)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) setReason('')
  }, [open])

  if (!open) return null

  return (
    <div className="reject-dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="reject-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="reject-dialog-title">{t('rejectDialogTitle')}</h2>
        <label className="reject-dialog-field">
          <span>{t('rejectReasonLabel')}</span>
          <textarea
            rows={3}
            value={reason}
            disabled={busy}
            placeholder={t('rejectPrompt')}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <div className="reject-dialog-actions">
          <button type="button" className="button tertiary" onClick={onClose} disabled={busy}>
            {t('rejectCancel')}
          </button>
          <button
            type="button"
            className="button danger"
            disabled={busy}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy ? t('rejecting') : t('rejectConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
