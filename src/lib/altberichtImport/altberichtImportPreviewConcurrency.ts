/** Max. parallele PDF→Canvas Preview-Jobs — testweise 1, um Speicher- und Main-Thread-Druck zu senken. */
export const MAX_PREVIEW_CONCURRENCY = 1 as const

const MAX_CONCURRENT_PREVIEW_RENDERS = MAX_PREVIEW_CONCURRENCY

let activePreviewRenders = 0

const previewWaiters: Array<() => void> = []

const acquirePreviewSlot = (): Promise<void> =>
  new Promise<void>((resolve) => {
    if (activePreviewRenders < MAX_CONCURRENT_PREVIEW_RENDERS) {
      activePreviewRenders += 1
      resolve()
      return
    }
    previewWaiters.push(() => {
      activePreviewRenders += 1
      resolve()
    })
  })

const releasePreviewSlot = (): void => {
  activePreviewRenders -= 1
  const next = previewWaiters.shift()
  if (next) next()
}

export const withAltberichtImportPreviewConcurrency = async <T>(fn: () => Promise<T>): Promise<T> => {
  await acquirePreviewSlot()
  try {
    return await fn()
  } finally {
    releasePreviewSlot()
  }
}
