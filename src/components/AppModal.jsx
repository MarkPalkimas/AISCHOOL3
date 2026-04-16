import React, { useEffect, useId } from 'react'

function AppModal({
  title,
  description = '',
  size = 'medium',
  onClose,
  disableClose = false,
  children,
}) {
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !disableClose) {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [disableClose, onClose])

  return (
    <div
      className="app-modal"
      role="presentation"
      onMouseDown={(event) => {
        if (!disableClose && event.target === event.currentTarget) {
          onClose?.()
        }
      }}
    >
      <div
        className={`app-modal__panel app-modal__panel--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="app-modal__header">
          <div>
            <h2 id={titleId} className="app-modal__title">{title}</h2>
            {description && <p id={descriptionId} className="app-modal__description">{description}</p>}
          </div>

          <button
            type="button"
            className="app-modal__close"
            onClick={() => onClose?.()}
            aria-label="Close dialog"
            disabled={disableClose}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="app-modal__body">
          {children}
        </div>
      </div>
    </div>
  )
}

export default AppModal
