import { initTracer as initJaegerTracer, TracingConfig, TracingOptions } from 'jaeger-client'
import { Tracer } from 'opentracing'
import { APP, LINKED, NODE_ENV, NODE_VTEX_API_VERSION, PRODUCTION, REGION, WORKSPACE } from '../../constants'
import { AppTags } from '../../tracing/Tags'
import { appIdToAppAtMajor } from '../../utils'

export class TracerSingleton {
  public static getTracer() {
    if (!TracerSingleton.singleton) {
      TracerSingleton.singleton = TracerSingleton.initServiceTracer()
    }

    return TracerSingleton.singleton
  }

  private static singleton: Tracer

  private static initServiceTracer() {
    return TracerSingleton.createJaegerTracer(appIdToAppAtMajor(APP.ID), {
      [AppTags.VTEX_APP_LINKED]: LINKED,
      [AppTags.VTEX_APP_NODE_VTEX_API_VERSION]: NODE_VTEX_API_VERSION,
      [AppTags.VTEX_APP_PRODUCTION]: PRODUCTION,
      [AppTags.VTEX_APP_REGION]: REGION,
      [AppTags.VTEX_APP_VERSION]: APP.VERSION,
      [AppTags.VTEX_APP_WORKSPACE]: WORKSPACE,
      [AppTags.VTEX_APP_NODE_ENV]: NODE_ENV ?? 'undefined',
    })
  }

  private static createJaegerTracer(serviceName: string, defaultTags: Record<string, string | boolean>) {
    const config: TracingConfig = {
      reporter: {
        agentHost: process.env.VTEX_OWN_NODE_IP,
      },
      sampler: {
        host: process.env.VTEX_OWN_NODE_IP,
        param: 0,
        refreshIntervalMs: 60 * 1000,
        type: 'const',
      },
      serviceName,
    }

    const options: TracingOptions = {
      tags: defaultTags,
    }

    return initJaegerTracer(config, options)
  }
}
