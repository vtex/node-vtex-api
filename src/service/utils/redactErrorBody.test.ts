import { redactErrorBody, SLOW_ERROR_REDACTION_MS } from './redactErrorBody'

// Fake credential only.
const TOKEN = 'app-token-eyJhbGciOiJSUzI1NiJ9.payload.signature'

describe('redactErrorBody', () => {
  afterEach(() => jest.restoreAllMocks())

  it('replaces the tokens of the request', () => {
    const vtex = { authToken: TOKEN, logger: { warn: jest.fn() } } as any

    expect(redactErrorBody({ message: `failed ${TOKEN}` }, vtex)).toEqual({ message: 'failed [Redacted]' })
    expect(vtex.logger.warn).not.toHaveBeenCalled()
  })

  it('logs a slow redaction with its duration only, and still returns the body', () => {
    const hrtime = jest.spyOn(process, 'hrtime') as jest.SpyInstance
    hrtime.mockReturnValueOnce([0, 0]).mockReturnValueOnce([0, (SLOW_ERROR_REDACTION_MS + 10) * 1e6])
    const vtex = { authToken: TOKEN, logger: { warn: jest.fn() } } as any

    const body = redactErrorBody({ message: `failed ${TOKEN}` }, vtex)

    expect(body).toEqual({ message: 'failed [Redacted]' })
    expect(vtex.logger.warn).toHaveBeenCalledWith({ durationMs: SLOW_ERROR_REDACTION_MS + 10, message: 'error-redaction: slow' })
    expect(JSON.stringify(vtex.logger.warn.mock.calls)).not.toContain(TOKEN)
  })

  it('does not let a failing logger change the response', () => {
    const hrtime = jest.spyOn(process, 'hrtime') as jest.SpyInstance
    hrtime.mockReturnValueOnce([0, 0]).mockReturnValueOnce([1, 0])
    const vtex = { authToken: TOKEN, logger: { warn: () => { throw new Error('logger down') } } } as any

    expect(redactErrorBody({ message: 'failed' }, vtex)).toEqual({ message: 'failed' })
  })
})
