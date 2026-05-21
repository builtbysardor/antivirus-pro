'use client'

import { useRef, useState, useCallback, DragEvent, ChangeEvent } from 'react'
import { Upload, FileText, X, Radar } from 'lucide-react'
import { formatBytes } from '@/lib/utils'

interface ScanDropzoneProps {
  onFileSelected: (file: File) => void
  disabled?: boolean
  maxSizeMB?: number
}

const MAX_DEFAULT_MB = 100

export default function ScanDropzone({
  onFileSelected,
  disabled = false,
  maxSizeMB = MAX_DEFAULT_MB,
}: ScanDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null)
      const maxBytes = maxSizeMB * 1024 * 1024
      if (file.size > maxBytes) {
        setError(`File exceeds maximum size of ${maxSizeMB} MB`)
        return
      }
      setSelectedFile(file)
      onFileSelected(file)
    },
    [maxSizeMB, onFileSelected]
  )

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return
      const file = e.dataTransfer.files?.[0]
      if (file) validateAndSelect(file)
    },
    [disabled, validateAndSelect]
  )

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (!disabled) setIsDragging(true)
    },
    [disabled]
  )

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
    },
    []
  )

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) validateAndSelect(file)
      e.target.value = ''
    },
    [validateAndSelect]
  )

  const handleClick = () => {
    if (!disabled) inputRef.current?.click()
  }

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedFile(null)
    setError(null)
  }

  const getFileIcon = (file: File) => {
    const type = file.type
    if (type.startsWith('image/')) return '🖼'
    if (type.includes('pdf')) return '📄'
    if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return '📦'
    if (type.includes('executable') || file.name.endsWith('.exe') || file.name.endsWith('.dll')) return '⚙'
    return '📁'
  }

  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative rounded-2xl p-10 text-center transition-all duration-300
          border-2 border-dashed cursor-pointer select-none overflow-hidden
          ${disabled
            ? 'opacity-50 cursor-not-allowed border-gray-700'
            : isDragging
            ? 'border-success bg-success/5 shadow-[0_0_40px_rgba(0,255,136,0.2)]'
            : selectedFile
            ? 'border-cyan/50 bg-cyan/5 shadow-[0_0_20px_rgba(0,212,255,0.1)]'
            : 'border-cyan/30 bg-surface hover:border-cyan/60 hover:bg-cyan/5 hover:shadow-[0_0_30px_rgba(0,212,255,0.1)]'
          }
        `}
      >
        {/* Radar background animation */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
          <div
            className="w-64 h-64 rounded-full border border-cyan/30 animate-radar-spin"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, rgba(0,212,255,0.15) 60deg, transparent 61deg)',
            }}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
          <div className="w-48 h-48 rounded-full border border-cyan/20" />
          <div className="absolute w-32 h-32 rounded-full border border-cyan/20" />
          <div className="absolute w-16 h-16 rounded-full border border-cyan/20" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {selectedFile ? (
            <div className="animate-fade-in">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-xl bg-cyan/10 border border-cyan/30 flex items-center justify-center">
                  <FileText size={28} className="text-cyan" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-mono text-white font-semibold truncate max-w-sm mx-auto">
                  {getFileIcon(selectedFile)} {selectedFile.name}
                </p>
                <p className="text-sm text-gray-400 font-mono">
                  {formatBytes(selectedFile.size)}
                  {selectedFile.type && (
                    <span className="ml-2 text-cyan/60">· {selectedFile.type || 'unknown type'}</span>
                  )}
                </p>
              </div>
              <button
                onClick={clearFile}
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg
                  bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white
                  text-xs font-mono transition-colors border border-gray-700"
              >
                <X size={12} />
                Remove file
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-center mb-5">
                {isDragging ? (
                  <div className="w-20 h-20 rounded-2xl bg-success/10 border border-success/30 flex items-center justify-center">
                    <Radar size={40} className="text-success animate-radar-spin" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-cyan/10 border border-cyan/20 flex items-center justify-center">
                    <Upload size={40} className="text-cyan" />
                  </div>
                )}
              </div>

              {isDragging ? (
                <p className="text-xl font-mono font-bold text-success neon-green">
                  Drop to scan
                </p>
              ) : (
                <>
                  <p className="text-xl font-mono font-bold text-white mb-2">
                    Drop file here or{' '}
                    <span className="text-cyan neon-cyan">click to browse</span>
                  </p>
                  <p className="text-sm text-gray-500 font-mono">
                    Any file type · Max {maxSizeMB} MB
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-danger font-mono flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />
    </div>
  )
}
