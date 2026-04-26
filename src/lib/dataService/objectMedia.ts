import { supabase } from '../../supabase'
import { compressImageFile } from '../imageCompression'
import type { ObjectPhoto, ObjectDocument, ObjectDocumentType } from '../../types'
import { OBJECT_PHOTO_COLUMNS, OBJECT_DOCUMENT_COLUMNS } from '../dataColumns'
import { isOnline } from '../../../shared/networkUtils'
import {
  getCachedObjectPhotos,
  setCachedObjectPhotos,
  getObjectPhotoOutbox,
  addToObjectPhotoOutbox,
  removeObjectPhotoOutboxItem,
  getCachedObjectDocuments,
  setCachedObjectDocuments,
  getObjectDocumentOutbox,
  addToObjectDocumentOutbox,
  removeObjectDocumentOutboxItem,
  addToOutbox,
} from '../offlineStorage'
import { notifyDataChange } from './dataChange'

// --- Object Photos ---

export type ObjectPhotoDisplay = ObjectPhoto & { localDataUrl?: string }

export const OBJECT_PHOTOS_BUCKET = 'object-photos'
export const OBJECT_DOCUMENTS_BUCKET = 'object-documents'

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64 ?? '')
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

export const fetchObjectPhotos = async (objectId: string): Promise<ObjectPhotoDisplay[]> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('object_photos')
      .select(OBJECT_PHOTO_COLUMNS)
      .eq('object_id', objectId)
      .order('created_at', { ascending: false })
    if (error) return []
    return (data ?? []) as unknown as ObjectPhotoDisplay[]
  }
  const cached = (getCachedObjectPhotos() as ObjectPhoto[]).filter((p) => p.object_id === objectId)
  const outbox = getObjectPhotoOutbox().filter((o) => o.object_id === objectId)
  const pending: ObjectPhotoDisplay[] = outbox.map((o) => ({
    id: o.tempId,
    object_id: o.object_id,
    storage_path: '',
    caption: o.caption,
    created_at: o.timestamp,
    localDataUrl: `data:image/${o.ext === 'jpg' ? 'jpeg' : o.ext};base64,${o.fileBase64}`,
  }))
  const merged = [...pending, ...cached]
  merged.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  return merged
}

export const uploadObjectPhoto = async (
  objectId: string,
  file: File,
  caption?: string
): Promise<{ data: ObjectPhotoDisplay | null; error: { message: string } | null }> => {
  const ext = file.name.split('.').pop() || 'jpg'
  if (!isOnline()) {
    const base64 = await fileToBase64(file)
    const tempId = `temp-${crypto.randomUUID()}`
    addToObjectPhotoOutbox({
      object_id: objectId,
      tempId,
      fileBase64: base64,
      caption: caption?.trim() || null,
      ext,
    })
    notifyDataChange()
    const localDataUrl = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${base64}`
    return {
      data: {
        id: tempId,
        object_id: objectId,
        storage_path: '',
        caption: caption?.trim() || null,
        created_at: new Date().toISOString(),
        localDataUrl,
      },
      error: null,
    }
  }
  const blob = await compressImageFile(file)
  const uploadExt = blob.type === 'image/jpeg' ? 'jpg' : ext
  const path = `${objectId}/${crypto.randomUUID()}.${uploadExt}`
  const { error: uploadError } = await supabase.storage
    .from(OBJECT_PHOTOS_BUCKET)
    .upload(path, blob, { upsert: false, contentType: blob.type })
  if (uploadError) return { data: null, error: { message: uploadError.message } }
  const { data: photo, error } = await supabase
    .from('object_photos')
    .insert({ object_id: objectId, storage_path: path, caption: caption?.trim() || null })
    .select(OBJECT_PHOTO_COLUMNS)
    .single()
  return { data: photo ? (photo as unknown as ObjectPhotoDisplay) : null, error: error ? { message: error.message } : null }
}

export const deleteObjectPhoto = async (
  photoId: string,
  storagePath: string
): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) {
    if (photoId.startsWith('temp-')) {
      const outbox = getObjectPhotoOutbox()
      const item = outbox.find((o) => o.tempId === photoId)
      if (item) removeObjectPhotoOutboxItem(item.id)
    } else {
      addToOutbox({
        table: 'object_photos',
        action: 'delete',
        payload: { id: photoId, storage_path: storagePath },
      })
      const cached = (getCachedObjectPhotos() as ObjectPhoto[]).filter((p) => p.id !== photoId)
      setCachedObjectPhotos(cached)
    }
    notifyDataChange()
    return { error: null }
  }
  await supabase.storage.from(OBJECT_PHOTOS_BUCKET).remove([storagePath])
  const { error } = await supabase.from('object_photos').delete().eq('id', photoId)
  if (!error) {
    const cached = (getCachedObjectPhotos() as ObjectPhoto[]).filter((p) => p.id !== photoId)
    setCachedObjectPhotos(cached)
    notifyDataChange()
  }
  return { error: error ? { message: error.message } : null }
}

export const getObjectPhotoUrl = (storagePath: string): string => {
  const { data } = supabase.storage
    .from(OBJECT_PHOTOS_BUCKET)
    .getPublicUrl(storagePath)
  return data.publicUrl
}

export const getObjectPhotoDisplayUrl = (p: ObjectPhotoDisplay): string =>
  p.localDataUrl ?? getObjectPhotoUrl(p.storage_path)

// --- Object Documents ---

export type ObjectDocumentDisplay = ObjectDocument & { localDataUrl?: string }

export const fetchObjectDocuments = async (objectId: string): Promise<ObjectDocumentDisplay[]> => {
  if (isOnline()) {
    const { data, error } = await supabase
      .from('object_documents')
      .select(OBJECT_DOCUMENT_COLUMNS)
      .eq('object_id', objectId)
      .order('created_at', { ascending: false })
    if (error) return []
    return (data ?? []) as unknown as ObjectDocumentDisplay[]
  }
  const cached = (getCachedObjectDocuments() as ObjectDocument[]).filter((d) => d.object_id === objectId)
  const outbox = getObjectDocumentOutbox().filter((o) => o.object_id === objectId)
  const pending: ObjectDocumentDisplay[] = outbox.map((o) => ({
    id: o.tempId,
    object_id: o.object_id,
    storage_path: '',
    document_type: o.document_type,
    title: o.title,
    file_name: o.file_name,
    created_at: o.timestamp,
    localDataUrl: `data:application/octet-stream;base64,${o.fileBase64}`,
  }))
  const merged = [...pending, ...cached]
  merged.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  return merged
}

export const uploadObjectDocument = async (
  objectId: string,
  file: File,
  documentType: ObjectDocumentType,
  title?: string
): Promise<{ data: ObjectDocumentDisplay | null; error: { message: string } | null }> => {
  const ext = file.name.split('.').pop() || 'pdf'
  const fileName = file.name
  if (!isOnline()) {
    const base64 = await fileToBase64(file)
    const tempId = `temp-${crypto.randomUUID()}`
    addToObjectDocumentOutbox({
      object_id: objectId,
      tempId,
      fileBase64: base64,
      document_type: documentType,
      title: title?.trim() || null,
      file_name: fileName,
      ext,
    })
    notifyDataChange()
    return {
      data: {
        id: tempId,
        object_id: objectId,
        storage_path: '',
        document_type: documentType,
        title: title?.trim() || null,
        file_name: fileName,
        created_at: new Date().toISOString(),
        localDataUrl: `data:application/octet-stream;base64,${base64}`,
      },
      error: null,
    }
  }
  const path = `${objectId}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from(OBJECT_DOCUMENTS_BUCKET)
    .upload(path, file, { upsert: false })
  if (uploadError) return { data: null, error: { message: uploadError.message } }
  const { data: doc, error } = await supabase
    .from('object_documents')
    .insert({
      object_id: objectId,
      storage_path: path,
      document_type: documentType,
      title: title?.trim() || null,
      file_name: fileName,
    })
    .select(OBJECT_DOCUMENT_COLUMNS)
    .single()
  return { data: doc ? (doc as unknown as ObjectDocumentDisplay) : null, error: error ? { message: error.message } : null }
}

export const deleteObjectDocument = async (
  documentId: string,
  storagePath: string
): Promise<{ error: { message: string } | null }> => {
  if (!isOnline()) {
    if (documentId.startsWith('temp-')) {
      const outbox = getObjectDocumentOutbox()
      const item = outbox.find((o) => o.tempId === documentId)
      if (item) removeObjectDocumentOutboxItem(item.id)
    } else {
      addToOutbox({
        table: 'object_documents',
        action: 'delete',
        payload: { id: documentId, storage_path: storagePath },
      })
      const cached = (getCachedObjectDocuments() as ObjectDocument[]).filter((d) => d.id !== documentId)
      setCachedObjectDocuments(cached)
    }
    notifyDataChange()
    return { error: null }
  }
  await supabase.storage.from(OBJECT_DOCUMENTS_BUCKET).remove([storagePath])
  const { error } = await supabase.from('object_documents').delete().eq('id', documentId)
  if (!error) {
    const cached = (getCachedObjectDocuments() as ObjectDocument[]).filter((d) => d.id !== documentId)
    setCachedObjectDocuments(cached)
    notifyDataChange()
  }
  return { error: error ? { message: error.message } : null }
}

export const getObjectDocumentUrl = (storagePath: string): string => {
  const { data } = supabase.storage
    .from(OBJECT_DOCUMENTS_BUCKET)
    .getPublicUrl(storagePath)
  return data.publicUrl
}
