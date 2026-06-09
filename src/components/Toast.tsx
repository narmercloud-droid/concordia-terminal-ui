interface ToastProps {
  visible: boolean
  message: string
  onClose: () => void
}

export const Toast = ({ visible, message, onClose }: ToastProps) => {
  if (!visible) return null

  return (
    <div className="toast-banner" role="status" aria-live="polite">
      <span>{message}</span>
      <button className="toast-close" type="button" onClick={onClose}>
        Close
      </button>
    </div>
  )
}
