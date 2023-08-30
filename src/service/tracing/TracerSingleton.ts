import { initTracer as initJaegerTracer, PrometheusMetricsFactory, TracingConfig, TracingOptions } from 'jaeger-client'
import { Tracer } from 'opentracing'
import promClient from 'prom-client'
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
      serviceName,
    }

    const options: TracingOptions = {
      /**
       * Jaeger metric names are available in:
       * https://github.com/jaegertracing/jaeger-client-node/blob/master/src/metrics/metrics.js
       *
       * Runtime will prefix these metrics with 'runtime:'
       */
      metrics: new PrometheusMetricsFactory(promClient as any, 'runtime'),
      tags: defaultTags,
    }

    return initJaegerTracer(config, options)
  }
}
