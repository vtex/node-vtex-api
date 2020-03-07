import { initTracer as initJaegerTracer, TracingConfig, TracingOptions } from 'jaeger-client'
import { APP, LINKED, NODE_VTEX_API_VERSION, PRODUCTION, REGION, WORKSPACE } from '../../constants'
import { appIdToAppAtMajor } from '../../utils'

const initTracer = (serviceName: string, defaultTags: Record<string, string | boolean>) => {
  const config: TracingConfig = {
    reporter: {
      agentHost: process.env.VTEX_OWN_NODE_IP,
      logSpans: true,
    },
    sampler: {
      param: 1,
      type: 'const',
    },
    serviceName,
  }

  const options: TracingOptions = {
    logger: {
      error(msg) {
        console.log('ERROR', msg)
      },
      info(msg) {
        console.log('INFO ', msg)
      },
    },
    tags: defaultTags,
  }

  return initJaegerTracer(config, options)
}

export const initServiceTracer = () => {
  return initTracer(appIdToAppAtMajor(APP.ID), {
    linked: LINKED,
    'node-vtex-api-version': NODE_VTEX_API_VERSION,
    production: PRODUCTION,
    region: REGION,
    version: APP.VERSION,
    worskpace: WORKSPACE,
  })
}
