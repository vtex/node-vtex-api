import { AxiosInstance } from 'axios'
import getPort from 'get-port'
import http from 'http'
import { TracedTestRequest } from './TracedTestRequest'

type ExpectFn = (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void> | void

interface TestRequestArgs {
  params: Record<string, any>
  url?: string
  retries?: number
  timeout?: number
  baseURL?: string
}

export class TestServer {
  public static async getAndStartTestServer() {
    const port = await getPort({ port: [3000, 3001, 3002, 3003] })
    const testServer = new TestServer(port)
    testServer.startServer()
    return testServer
  }

  private server: http.Server
  private expectFn: ExpectFn

  private responseHeaders: Record<string, string>

  constructor(private port: number) {
    // tslint:disable-next-line
    this.expectFn = () => {}
    this.responseHeaders = {}
    this.server = http.createServer(async (req, res) => {
      this.setHeaders(res)
      await this.expectFn(req, res)
      if (!res.writableEnded) {
        res.end()
      }
    })
  }

  public setExpectFn(expectFn: ExpectFn) {
    this.expectFn = expectFn
  }

  public startServer() {
    console.log(`Starting test server on port ${this.port}...`)
    this.server.listen(this.port)
  }
  public closeServer() {
    console.log('Closing test server...')
    return new Promise((resolve, reject) => {
      this.server.close(err => {
        if (err) {
          return reject(err)
        }

        resolve(undefined)
      })
    })
  }

  public getUrl(path = '') {
    return `http://localhost:${this.port}${path}`
  }

  public mockResponseHeaders(headers: Record<string, string>) {
    this.responseHeaders = headers
  }

  public async doRequest(client: AxiosInstance, reqArgs?: TestRequestArgs) {
    const url = reqArgs?.url ?? this.getUrl()
    const tracedTestRequest = new TracedTestRequest(client)
    await tracedTestRequest.runRequest({ ...reqArgs, url })
    return tracedTestRequest
  }

  private setHeaders(response: http.ServerResponse) {
    Object.keys(this.responseHeaders).forEach(header => {
      response.setHeader(header, this.responseHeaders[header])
    })
  }
}
