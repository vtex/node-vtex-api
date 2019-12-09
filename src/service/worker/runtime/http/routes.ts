import {
  ACCOUNT,
  APP as APP_ENV,
  PUBLIC_ENDPOINT,
  REGION,
  WORKSPACE,
} from '../../../../constants'
import { ServiceJSON, ServiceRoute } from '../typings'

const getPath = ({ public: publicRoute, path }: ServiceRoute) => publicRoute
  ? `https://${WORKSPACE}--${ACCOUNT}.${PUBLIC_ENDPOINT}${path}`
  : `http://${APP_ENV.NAME}.${APP_ENV.VENDOR}.${REGION}.vtex.io/${ACCOUNT}/${WORKSPACE}${path}?__v=${APP_ENV.VERSION}`

export const logAvailableRoutes = (service: ServiceJSON) => {
  const available = Object.values(service.routes || {}).reduce(
    (acc, route) => `${acc}\n${getPath(route)}`,
    'Available service routes:'
  )
  console.info(available)
}
