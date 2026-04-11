/**
 * Mandanten-Briefbogen für PDFs (J10 / Vico.md §11.2) – Haupt-App (Supabase-Client gebunden).
 */
import { supabase } from '../supabase'
import {
  fetchBriefbogenStoragePath as fetchBriefbogenStoragePathFromClient,
  fetchBriefbogenDataUrlForPdf as fetchBriefbogenDataUrlForPdfFromClient,
  fetchBriefbogenLetterheadPagesForPdf as fetchBriefbogenLetterheadPagesForPdfFromClient,
  fetchBriefbogenPdfMarginsMm as fetchBriefbogenPdfMarginsMmFromClient,
  fetchBriefbogenPdfTextLayout as fetchBriefbogenPdfTextLayoutFromClient,
  saveBriefbogenPdfTextLayout as saveBriefbogenPdfTextLayoutFromClient,
  removeBriefbogenPdfMargins as removeBriefbogenPdfMarginsFromClient,
  createBriefbogenPreviewUrl as createBriefbogenPreviewUrlFromClient,
  uploadBriefbogenFile as uploadBriefbogenFileToClient,
  removeBriefbogen as removeBriefbogenFromClient,
  type BriefbogenLetterheadPages,
  type BriefbogenPdfTextLayout,
} from '../../shared/briefbogenClient'
import type { BriefbogenDinMarginsMm } from '../../shared/pdfBriefbogenLayout'

export type { BriefbogenLetterheadPages }
export type { BriefbogenDinMarginsMm }
export type { BriefbogenPdfTextLayout }

export const fetchBriefbogenStoragePath = async (): Promise<string | null> =>
  fetchBriefbogenStoragePathFromClient(supabase)

export const fetchBriefbogenDataUrlForPdf = async (): Promise<string | null> =>
  fetchBriefbogenDataUrlForPdfFromClient(supabase)

export const fetchBriefbogenLetterheadPagesForPdf = async (): Promise<BriefbogenLetterheadPages | null> =>
  fetchBriefbogenLetterheadPagesForPdfFromClient(supabase)

export const fetchBriefbogenPdfMarginsMm = async () => fetchBriefbogenPdfMarginsMmFromClient(supabase)

export const fetchBriefbogenPdfTextLayout = async () => fetchBriefbogenPdfTextLayoutFromClient(supabase)

export const saveBriefbogenPdfTextLayout = async (layout: BriefbogenPdfTextLayout) =>
  saveBriefbogenPdfTextLayoutFromClient(supabase, layout)

export const removeBriefbogenPdfMargins = async () => removeBriefbogenPdfMarginsFromClient(supabase)

export const createBriefbogenPreviewUrl = async (): Promise<string | null> =>
  createBriefbogenPreviewUrlFromClient(supabase)

export const uploadBriefbogenFile = async (file: File): Promise<{ ok: boolean; error?: string }> =>
  uploadBriefbogenFileToClient(supabase, file)

export const removeBriefbogen = async (): Promise<{ ok: boolean; error?: string }> =>
  removeBriefbogenFromClient(supabase)
