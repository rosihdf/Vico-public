/**
 * Gemeinsame Eingabe-Stile (Design-System v1).
 * An CSS-Variablen aus `index.css` gebunden für Light/Dark.
 */
export const appInputClassName =
  'w-full min-w-0 px-3 py-2 text-sm rounded-lg border border-app-border bg-app-surface text-app-foreground placeholder:text-app-muted shadow-sm focus:outline-none focus:ring-2 focus:ring-vico-primary/40 focus:border-vico-primary disabled:opacity-50 disabled:cursor-not-allowed'

export const appSelectClassName = appInputClassName

export const appTextareaClassName = appInputClassName

export const appLabelClassName = 'block text-sm font-medium text-app-label mb-1'

export const appLabelClassNameSmall = 'block text-xs font-medium text-app-label mb-1'

/** Native date/time: 16px auf schmalen Screens (iOS-Zoom), sonst text-sm; max Breite begrenzt. */
export const appNativeDateTimeInputClassName = `${appInputClassName} max-w-full min-w-0 text-base sm:text-sm`
