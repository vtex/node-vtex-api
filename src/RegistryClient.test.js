import test from 'ava'
import {createServer} from 'http'
import {createGunzip} from 'zlib'
import RegistryClient from './RegistryClient'

const jsFile = {
  path: 'render/index.js',
  contents: new Buffer('const x = 123', 'utf8'),
}

const manifest = {
  path: 'manifest.json',
  contents: new Buffer('{"name": "test"}', 'utf8'),
}

const expectedMultipartBody = (boundary) =>
`--${boundary}
Content-Disposition: inline; filename="manifest.json"
Content-Type: application/json; charset=utf-8

{"name": "test"}
--${boundary}
Content-Disposition: inline; filename="render/index.js"
Content-Type: application/javascript; charset=utf-8

const x = 123
--${boundary}--`.replace(/\n/g, '\r\n')

test('publishApp streams a multipart/mixed request', async t => {
  t.plan(5)
  const requestHandler = (req, res) => {
    t.true(req.headers['content-type'].startsWith('multipart/mixed'))
    t.is(req.url, '/account/workspace/registry?isDevelopment=false')
    t.is(req.headers['content-encoding'], 'gzip')
    t.is(req.headers['transfer-encoding'], 'chunked')
    let data = ''
    const boundary = req.headers['content-type'].split('multipart/mixed; boundary=')[1]
    const gz = createGunzip()
    req.pipe(gz)
    gz.on('data', c => { data += c })
    gz.on('end', () => {
      t.is(data, expectedMultipartBody(boundary))
      res.end()
    })
  }
  const client = new RegistryClient('auth', 'agent', 'http://localhost:13377')
  const server = createServer(requestHandler)
  server.listen(13377)
  await client.publishApp('account', 'workspace', [jsFile, manifest], false)
  server.close()
})

test('publishAppPatch sends changes array', async t => {
  t.plan(5)
  const changes = [
    {
      path: 'manifest.json',
      action: 'save',
      content: new Buffer('{"name": "app"}').toString('base64'),
      encoding: 'base64',
    },
  ]
  const requestHandler = (req, res) => {
    t.is(req.headers['content-type'], 'application/json')
    t.is(req.headers['content-encoding'], 'gzip')
    t.is(req.headers['transfer-encoding'], 'chunked')
    t.is(req.url, '/account/workspace/registry/vtex/apps/app/version')
    let data = ''
    const gz = createGunzip()
    req.pipe(gz)
    gz.on('data', c => { data += c })
    gz.on('end', () => {
      t.is(data, JSON.stringify(changes))
      res.end()
    })
  }
  const client = new RegistryClient('auth', 'agent', 'http://localhost:13378')
  const server = createServer(requestHandler)
  server.listen(13378)
  await client.publishAppPatch('account', 'workspace', 'vtex', 'app', 'version', changes)
  server.close()
})
