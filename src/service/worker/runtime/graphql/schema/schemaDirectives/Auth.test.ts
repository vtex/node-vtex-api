import { URL } from 'url'

import { AuthenticationError, ForbiddenError } from 'apollo-server-errors'
import axios from 'axios'

import { Auth } from './Auth'

jest.mock('axios')

const requestMock = axios.request as jest.Mock

interface CtxOptions {
  cookie?: string
  header?: string
  account?: string
}

function makeCtx (options: CtxOptions = {}): any {
  const { cookie, header, account = 'store' } = options
  return {
    cookies: {
      get: jest.fn((name: string) => (name === 'VtexIdclientAutCookie' ? cookie : undefined)),
    },
    get: jest.fn((name: string) => (name === 'VtexIdclientAutCookie' ? header : undefined)),
    vtex: {
      account,
      authToken: 'proxy-auth-token',
    },
  }
}

function makeField (args: any) {
  const resolver = jest.fn(async () => 'resolved-value')
  const field: any = { resolve: resolver }
  const directive = new (Auth as any)({
    args,
    name: 'auth',
    schema: {} as any,
    visitedType: {} as any,
  } as any)
  directive.visitFieldDefinition(field)
  return { resolver, run: (ctx: any) => field.resolve({}, {}, ctx, {}) }
}

const privateArgs = { scope: 'PRIVATE', productCode: 'cms', resourceCode: 'cms_settings' }

function queueVtexId (data: any) {
  requestMock.mockResolvedValueOnce({ data })
}

function queueLicenseManager (data: any) {
  requestMock.mockResolvedValueOnce({ data })
}

describe('Auth schema directive', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  it('denies and does not reach License Manager when VTEX ID has no valid identity', async () => {
    const scenarios = [
      { account: 'store' },
      { user: 123, account: 'store' },
      { user: '', account: 'store' },
      { user: 'user@example.com', account: 'another-store' },
    ]

    for (const vtexIdData of scenarios) {
      requestMock.mockReset()
      queueVtexId(vtexIdData)
      queueLicenseManager(true)
      const { resolver, run } = makeField(privateArgs)
      const ctx = makeCtx({ cookie: 'vtex-id-token' })

      await expect(run(ctx)).rejects.toBeInstanceOf(AuthenticationError)
      expect(resolver).not.toHaveBeenCalled()
      expect(requestMock).toHaveBeenCalledTimes(1)
    }
  })

  it('denies when License Manager does not return the boolean true', async () => {
    const scenarios = ['false', {}, 1, []]

    for (const licenseManagerData of scenarios) {
      requestMock.mockReset()
      queueVtexId({ user: 'user@example.com', account: 'store' })
      queueLicenseManager(licenseManagerData)
      const { resolver: forbiddenResolver, run: forbiddenRun } = makeField(privateArgs)
      const ctx = makeCtx({ cookie: 'vtex-id-token' })

      await expect(forbiddenRun(ctx)).rejects.toBeInstanceOf(ForbiddenError)
      expect(forbiddenResolver).not.toHaveBeenCalled()
    }

    requestMock.mockReset()
    queueVtexId({ user: 'user@example.com', account: 'store' })
    queueLicenseManager(false)
    const { resolver: falseResolver, run: falseRun } = makeField(privateArgs)

    await expect(falseRun(makeCtx({ cookie: 'vtex-id-token' }))).rejects.toBeInstanceOf(ForbiddenError)
    expect(falseResolver).not.toHaveBeenCalled()
  })

  it('percent-encodes the token and path parameters so they cannot alter the URLs', async () => {
    const token = 'tok&en?x#y'
    const emails = [
      { raw: 'a/b@example.com', encoded: 'a%2Fb@example.com', keepPath: true },
      { raw: 'a..b@example.com', encoded: 'a%2E%2Eb@example.com', keepPath: false },
      { raw: '..', encoded: '%2E%2E', keepPath: false },
    ]

    for (const { raw, encoded, keepPath } of emails) {
      requestMock.mockReset()
      queueVtexId({ user: raw, account: 'store' })
      queueLicenseManager(true)
      const { run } = makeField(privateArgs)

      await run(makeCtx({ cookie: token }))

      const vtexIdUrl: string = requestMock.mock.calls[0][0].url
      const licenseManagerUrl: string = requestMock.mock.calls[1][0].url

      expect(vtexIdUrl).toBe(
        `http://vtexid.vtex.com.br/api/vtexid/pub/authenticated/user?authToken=${encodeURIComponent(token)}`
      )
      expect(new URL(vtexIdUrl).searchParams.get('authToken')).toBe(token)
      expect(licenseManagerUrl).not.toContain(raw)
      expect(licenseManagerUrl).toContain(`/logins/${encoded}/resources/`)
      expect(licenseManagerUrl).not.toMatch(/\/\.\.?\//)

      if (keepPath) {
        const parsed = new URL(licenseManagerUrl)
        expect(parsed.pathname).toBe(
          `/api/license-manager/pvt/accounts/store/products/cms/logins/${encoded}/resources/cms_settings/granted`
        )
      }
    }
  })

  it('allows a valid cookie and keeps the License Manager URL unchanged for a plain email', async () => {
    queueVtexId({ user: 'user@example.com', account: 'store' })
    queueLicenseManager(true)
    const { resolver, run } = makeField(privateArgs)

    await expect(run(makeCtx({ cookie: 'vtex-id-token' }))).resolves.toBe('resolved-value')
    expect(resolver).toHaveBeenCalledTimes(1)
    expect(requestMock.mock.calls[0][0].url).toBe(
      'http://vtexid.vtex.com.br/api/vtexid/pub/authenticated/user?authToken=vtex-id-token'
    )
    expect(requestMock.mock.calls[1][0].url).toBe(
      'http://store.vtexcommercestable.com.br/api/license-manager/pvt/accounts/store/products/cms/logins/user@example.com/resources/cms_settings/granted'
    )
  })

  it('allows a valid token supplied only in the VtexIdclientAutCookie header', async () => {
    queueVtexId({ user: 'user@example.com', account: 'store' })
    queueLicenseManager(true)
    const { resolver, run } = makeField(privateArgs)

    await expect(run(makeCtx({ header: 'vtex-id-token' }))).resolves.toBe('resolved-value')
    expect(resolver).toHaveBeenCalledTimes(1)
  })

  it('allows PUBLIC scope without calling axios', async () => {
    const { resolver, run } = makeField({ scope: 'PUBLIC' })

    await expect(run(makeCtx())).resolves.toBe('resolved-value')
    expect(resolver).toHaveBeenCalledTimes(1)
    expect(requestMock).not.toHaveBeenCalled()
  })
})