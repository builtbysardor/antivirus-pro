"use client"

import { useEffect, useRef } from "react"
import { X, AlertTriangle } from "lucide-react"

export interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  confirmDanger?: boolean
  inputLabel?: string
  inputValue?: string
  onInputChange?: (v: string) => void
}

export default function ConfirmModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  confirmDanger = false,
  inputLabel,
  inputValue,
  onInputChange,
}: ConfirmModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-5 relative"
        style={{
          backgroundColor: '#09090b',
          border: '1px solid rgba(5,255,133,0.15)',
          boxShadow: '0 0 40px rgba(0,0,0,0.8)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 pr-6">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              confirmDanger
                ? 'bg-danger/10 border border-danger/25'
                : 'bg-cyan/10 border border-cyan/25'
            }`}
          >
            <AlertTriangle
              size={16}
              className={confirmDanger ? 'text-danger' : 'text-cyan'}
            />
          </div>
          <h2
            id="modal-title"
            className="font-mono font-bold text-white text-base"
          >
            {title}
          </h2>
        </div>

        {/* Message */}
        <p className="font-mono text-sm text-gray-400 leading-relaxed">
          {message}
        </p>

        {/* Optional input */}
        {inputLabel !== undefined && (
          <div className="space-y-1.5">
            <label className="block font-mono text-xs text-gray-500 uppercase tracking-widest">
              {inputLabel}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={inputValue ?? ""}
              onChange={(e) => onInputChange?.(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 font-mono text-sm text-white
                bg-white/5 border border-white/10 focus:border-cyan/40
                outline-none transition-colors placeholder:text-gray-600"
              placeholder="Enter path…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onConfirm()
                if (e.key === 'Escape') onCancel()
              }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl font-mono text-sm text-gray-400
              hover:text-white border border-white/10 hover:border-white/20
              bg-white/5 hover:bg-white/10 transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl font-mono text-sm font-semibold
              transition-all duration-200 border ${
                confirmDanger
                  ? 'bg-danger/15 hover:bg-danger/25 text-danger border-danger/30'
                  : 'bg-cyan/15 hover:bg-cyan/25 text-cyan border-cyan/30'
              }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
