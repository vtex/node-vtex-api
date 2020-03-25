import { initTracer as initJaegerTracer, TracingConfig, TracingOptions } from 'jaeger-client'
import { APP, LINKED, NODE_VTEX_API_VERSION, PRODUCTION, REGION, WORKSPACE } from '../../constants'
import { Tags } from '../../tracing/Tags'
import { appIdToAppAtMajor } from '../../utils'

const initTracer = (serviceName: string, defaultTags: Record<string, string | boolean>) => {
  const config: TracingConfig = {
    reporter: {
      agentHost: process.env.VTEX_OWN_NODE_IP,
      logSpans: true,
    },
    sampler: {
      param: 0.50,
      type: 'probabilistic',
    },
    serviceName,
  }

  const options: TracingOptions = {
    tags: defaultTags,
  }

  return initJaegerTracer(config, options)
}

export const initServiceTracer = () => {
  return initTracer(appIdToAppAtMajor(APP.ID), {
    [Tags.VTEX_APP_LINKED]: LINKED,
    [Tags.VTEX_APP_NODE_VTEX_API_VERSION]: NODE_VTEX_API_VERSION,
    [Tags.VTEX_APP_PRODUCTION]: PRODUCTION,
    [Tags.VTEX_APP_REGION]: REGION,
    [Tags.VTEX_APP_VERSION]: APP.VERSION,
    [Tags.VTEX_APP_WORKSPACE]: WORKSPACE,
  })
}
