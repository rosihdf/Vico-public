import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useComponentSettings } from './ComponentSettingsContext'

type ComponentGuardProps = {
  componentKey: string
  children: React.ReactNode
}

const ComponentGuard = ({ componentKey, children }: ComponentGuardProps) => {
  const { isEnabled } = useComponentSettings()
  const location = useLocation()

  if (isEnabled(componentKey)) return <>{children}</>
  return <Navigate to="/" state={{ from: location }} replace />
}

export default ComponentGuard
