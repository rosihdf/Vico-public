import { forwardRef, type SelectHTMLAttributes } from 'react'
import { appSelectClassName } from './appInputStyles'

type AppSelectProps = SelectHTMLAttributes<HTMLSelectElement>

const AppSelect = forwardRef<HTMLSelectElement, AppSelectProps>(({ className = '', ...rest }, ref) => (
  <select ref={ref} className={`${appSelectClassName} ${className}`.trim()} {...rest} />
))

AppSelect.displayName = 'AppSelect'

export default AppSelect
