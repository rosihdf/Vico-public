import AppInfoContent from '../../../shared/AppInfoContent'
import { useDesign } from '../DesignContext'

const AppInfo = () => {
  const { appName, appVersionInfo } = useDesign()
  return <AppInfoContent appLabel={`${appName} Arbeitszeitenportal`} licenseAppInfo={appVersionInfo} />
}

export default AppInfo
