type SkeletonLoaderProps = {
  lines?: number
  className?: string
}

const SkeletonLoader = ({ lines = 3, className = '' }: SkeletonLoaderProps) => (
  <div
    className={`space-y-3 animate-pulse ${className}`}
    role="status"
    aria-label="Lade"
  >
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className="h-4 bg-slate-200 dark:bg-slate-700 rounded"
        style={{ width: i === lines - 1 && lines > 1 ? '75%' : '100%' }}
      />
    ))}
    <span className="sr-only">Lade...</span>
  </div>
)

export default SkeletonLoader
