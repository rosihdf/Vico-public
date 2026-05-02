/// <reference types="vite/client" />

declare const __APP_VERSION__: string
declare const __APP_RELEASE_LABEL__: string

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Optional: Direktlink zur GitHub-Actions-Übersicht (z. B. Mandanten-DB-Rollout). */
  readonly VITE_GITHUB_ACTIONS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
