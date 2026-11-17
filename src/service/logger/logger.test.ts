import { LoggerContext } from './loggerTypes'

const ENV_KEYS = ['VTEX_APP_VENDOR', 'VTEX_APP_NAME', 'VTEX_APP_ID', 'VTEX_APP_VERSION'] as const

const savedEnv = ENV_KEYS.reduce<Record<string, string | undefined>>((acc, key) => {
  acc[key] = process.env[key]
  return acc
}, {})

const context = (account: string | undefined): LoggerContext => ({
  account: account as string,
  operationId: 'op-1',
  production: true,
  requestId: 'req-1',
  workspace: 'master',
})

function loadLogger(env: { vendor?: string; name?: string }) {
  jest.resetModules()
  if (env.vendor === undefined) {
    delete process.env.VTEX_APP_VENDOR
  } else {
    process.env.VTEX_APP_VENDOR = env.vendor
  }
  process.env.VTEX_APP_NAME = env.name ?? 'zenvia-whatsapp'
  process.env.VTEX_APP_ID = `${env.vendor ?? 'app'}.${process.env.VTEX_APP_NAME}@2.4.0`
  process.env.VTEX_APP_VERSION = '2.4.0'

  let loggerCtor: new (ctx: LoggerContext) => { log: (message: any, level: string) => void }
  jest.doMock('./client', () => ({
    getLogClient: () => Promise.resolve(undefined),
  }))
  jest.isolateModules(() => {
    loggerCtor = require('./logger').Logger
  })
  return loggerCtor!
}

function loggedLine(spy: jest.SpyInstance): any {
  const raw = spy.mock.calls
    .map(call => call[0])
    .reverse()
    .find(value => typeof value === 'string' && value.indexOf('"__VTEX_IO_LOG"') >= 0)
  return JSON.parse(raw as string)
}

describe('Logger Skidder topics', () => {
  let consoleLog: jest.SpyInstance

  beforeEach(() => {
    jest.useFakeTimers()
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    consoleLog.mockRestore()
    ENV_KEYS.forEach(key => {
      if (savedEnv[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = savedEnv[key]
      }
    })
    jest.resetModules()
  })

  test('third-party log uses the runtime account, not the vendor', () => {
    const loggerCtor = loadLogger({ vendor: 'zenvia', name: 'zenvia-whatsapp' })
    const logger = new loggerCtor(context('lojax'))

    logger.log('hello', 'info')

    const line = loggedLine(consoleLog)
    expect(line.account).toBe('lojax')
    expect(line.workspace).toBe('master')
    expect(line.__SKIDDER_TOPIC_1).toBe('skidder.vendor.lojax')
    expect(line.__SKIDDER_TOPIC_2).toBe('skidder.app.lojax.zenvia-whatsapp')
    expect(line.__SKIDDER_TOPIC_1).not.toContain('zenvia')
  })

  test('third-party log in the vendor account uses that account', () => {
    const loggerCtor = loadLogger({ vendor: 'zenvia', name: 'zenvia-whatsapp' })
    const logger = new loggerCtor(context('zenvia'))

    logger.log('hello', 'info')

    const line = loggedLine(consoleLog)
    expect(line.__SKIDDER_TOPIC_1).toBe('skidder.vendor.zenvia')
    expect(line.__SKIDDER_TOPIC_2).toBe('skidder.app.zenvia.zenvia-whatsapp')
  })

  test.each(['vtex', 'gocommerce'])('vendor %s does not stamp Skidder topics', vendor => {
    const loggerCtor = loadLogger({ vendor, name: 'checkout' })
    const logger = new loggerCtor(context('lojax'))

    logger.log('hello', 'info')

    const line = loggedLine(consoleLog)
    expect(line.account).toBe('lojax')
    expect(line.workspace).toBe('master')
    expect(line.__SKIDDER_TOPIC_1).toBeUndefined()
    expect(line.__SKIDDER_TOPIC_2).toBeUndefined()
  })

  test.each(['', undefined])('missing account %p does not stamp Skidder topics or throw', account => {
    const loggerCtor = loadLogger({ vendor: 'zenvia', name: 'zenvia-whatsapp' })
    const logger = new loggerCtor(context(account))

    expect(() => logger.log('hello', 'info')).not.toThrow()

    const line = loggedLine(consoleLog)
    expect(line.__SKIDDER_TOPIC_1).toBeUndefined()
    expect(line.__SKIDDER_TOPIC_2).toBeUndefined()
  })
})
