"use client"

export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-red-400 font-mono text-sm">
        Backend connection failed: {error.message}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-mono text-sm rounded-xl transition-colors"
      >
        Retry
      </button>
    </div>
  )
}
