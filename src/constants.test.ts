describe('DIAGNOSTICS_TELEMETRY_ENABLED', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('is disabled when the env var is unset', () => {
    delete process.env.VTEX_DIAGNOSTICS_TELEMETRY_ENABLED
    const { DIAGNOSTICS_TELEMETRY_ENABLED } = require('./constants')

    expect(DIAGNOSTICS_TELEMETRY_ENABLED).toBe(false)
  })

  it.each(['false', '0', 'no', 'TRUE'])('is disabled for the falsy/invalid value %p', value => {
    process.env.VTEX_DIAGNOSTICS_TELEMETRY_ENABLED = value
    const { DIAGNOSTICS_TELEMETRY_ENABLED } = require('./constants')

    expect(DIAGNOSTICS_TELEMETRY_ENABLED).toBe(false)
  })

  it('is enabled only for the exact literal "true"', () => {
    process.env.VTEX_DIAGNOSTICS_TELEMETRY_ENABLED = 'true'
    const { DIAGNOSTICS_TELEMETRY_ENABLED } = require('./constants')

    expect(DIAGNOSTICS_TELEMETRY_ENABLED).toBe(true)
  })
})
