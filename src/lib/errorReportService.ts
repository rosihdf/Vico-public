import { supabase } from '../supabase'
import { createErrorReporter } from '../../shared/errorReportService'

const { reportError } = createErrorReporter(supabase)

export { reportError }
export type { ErrorReportPayload } from '../../shared/errorReportService'
