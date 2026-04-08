import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { appTextareaClassName } from './appInputStyles'

type AppTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

const AppTextarea = forwardRef<HTMLTextAreaElement, AppTextareaProps>(
  ({ className = '', ...rest }, ref) => (
    <textarea ref={ref} className={`${appTextareaClassName} ${className}`.trim()} {...rest} />
  )
)

AppTextarea.displayName = 'AppTextarea'

export default AppTextarea
