/**
 * Bildkomprimierung vor Upload – reduziert Speicherverbrauch.
 * Max. 1920px längste Seite, JPEG-Qualität 0.8.
 */

const MAX_DIMENSION = 1920
const JPEG_QUALITY = 0.8

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

const isCompressibleImage = (file: File): boolean =>
  IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)

/** Base64 + ext aus Outbox zu File für Komprimierung. */
const base64ToFile = (base64: string, ext: string): File => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
  return new File([bytes], `img.${ext}`, { type: mime })
}

/**
 * Komprimiert ein Bild aus Base64 (z. B. aus Offline-Outbox).
 */
export const compressImageBase64 = async (
  base64: string,
  ext: string
): Promise<{ blob: Blob; ext: string }> => {
  const file = base64ToFile(base64, ext)
  const blob = await compressImageFile(file)
  const outExt = blob.type === 'image/jpeg' ? 'jpg' : ext
  return { blob, ext: outExt }
}

/**
 * Komprimiert ein Bild-File. Bei Nicht-Bildern wird das Original zurückgegeben.
 */
export const compressImageFile = (file: File): Promise<Blob> =>
  new Promise((resolve) => {
    if (!isCompressibleImage(file)) {
      resolve(file)
      return
    }

    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = img
      let w = width
      let h = height

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width >= height) {
          w = MAX_DIMENSION
          h = Math.round((height * MAX_DIMENSION) / width)
        } else {
          h = MAX_DIMENSION
          w = Math.round((width * MAX_DIMENSION) / height)
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0, w, h)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            resolve(file)
          }
        },
        'image/jpeg',
        JPEG_QUALITY
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }

    img.src = url
  })
