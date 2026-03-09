type FormFieldProps = {
  id: string
  label: string
  error?: string | null
  required?: boolean
  children: React.ReactNode
}

const FormField = ({ id, label, error, required, children }: FormFieldProps) => (
  <div>
    <label
      htmlFor={id}
      className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
    >
      {label}
      {required && <span className="text-red-500" aria-hidden> *</span>}
    </label>
    {children}
    {error && (
      <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
        {error}
      </p>
    )}
  </div>
)

export default FormField
