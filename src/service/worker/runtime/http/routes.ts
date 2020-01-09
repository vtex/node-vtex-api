import {
  ACCOUNT,
  APP as APP_ENV,
  PUBLIC_ENDPOINT,
  WORKSPACE,
} from '../../../../constants'
import { ServiceJSON, ServiceRoute } from '../typings'

interface PrivateRouteInfo {
  protocol?: 'http' | 'https'
  vendor: string,
  name: string,
  major: string | number,
  account: string,
  workspace: string,
  path?: string
}

export const formatPrivateRoute = ({protocol = 'https', vendor, name, major, account, workspace, path}: PrivateRouteInfo) =>
  `${protocol}://app.io.vtex.com/${vendor}.${name}/v${major}/${account}/${workspace}${path || ''}`

export const formatPublicRoute = ({workspace, account, endpoint, path}: {workspace: string, account: string, endpoint: string, path: string}) =>
  `https://${workspace}--${account}.${endpoint}${path}`

const getPath = ({ public: publicRoute, path }: ServiceRoute) => publicRoute
  ? formatPublicRoute({workspace: WORKSPACE, account: ACCOUNT, endpoint: PUBLIC_ENDPOINT, path})
  : formatPrivateRoute({protocol: 'https', vendor: APP_ENV.VENDOR, name: APP_ENV.NAME, major: APP_ENV.MAJOR, account: ACCOUNT, workspace: WORKSPACE, path})

export const logAvailableRoutes = (service: ServiceJSON) => {
  const available = Object.values(service.routes || {}).reduce(
    (acc, route) => `${acc}\n${getPath(route)}`,
    'Available service routes:'
  )
  console.info(available)
}
