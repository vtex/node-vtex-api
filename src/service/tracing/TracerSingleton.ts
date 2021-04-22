import { APP } from '../../constants'

import api, { Tracer } from '@opentelemetry/api'
import { NodeTracerProvider } from '@opentelemetry/node'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql'
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/tracing'
import { KoaInstrumentation } from '@opentelemetry/koa-instrumentation'

const provider = new NodeTracerProvider()

provider.register()

registerInstrumentations({
  instrumentations: [new HttpInstrumentation(), new GraphQLInstrumentation()],
  tracerProvider: provider,
})

export class TracerSingleton {
  public static getTracer() {
    if (!TracerSingleton.singleton) {
      TracerSingleton.singleton = TracerSingleton.createTracer()
    }

    return TracerSingleton.singleton
  }

  private static singleton: Tracer

  private static createTracer() {
    const exporter = new ConsoleSpanExporter()
    const provider = new NodeTracerProvider()

    //@ts-ignore
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter))

    registerInstrumentations({
      instrumentations: [
        //@ts-ignore
        new KoaInstrumentation(),
        new HttpInstrumentation(),
      ],
      tracerProvider: provider,
    })

    provider.register()

    return api.trace.getTracer(APP.NAME, APP.VERSION)
  }
}
