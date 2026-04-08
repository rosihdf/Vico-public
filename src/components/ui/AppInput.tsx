import { forwardRef, type InputHTMLAttributes } from 'react'
import { appInputClassName } from './appInputStyles'

type AppInputProps = InputHTMLAttributes<HTMLInputElement>

const AppInput = forwardRef<HTMLInputElement, AppInputProps>(({ className = '', ...rest }, ref) => (
  <input ref={ref} className={`${appInputClassName} ${className}`.trim()} {...rest} />
))

AppInput.displayName = 'AppInput'

export default AppInput
