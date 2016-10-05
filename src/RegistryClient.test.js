import test from 'ava'
import Vinyl from 'vinyl'
import {PassThrough} from 'stream'
import {createServer} from 'http'
import {createGunzip} from 'zlib'
import RegistryClient from './RegistryClient'

const jsFile = new Vinyl({
  base: '/',
  path: '/render/index.js',
  contents: new Buffer('const x = 123', 'utf8'),
})

const manifest = new Vinyl({
  base: '/',
  path: '/manifest.json',
  contents: new Buffer('{"name": "test"}', 'utf8'),
})

const expectedMultipartBody = (boundary) =>
`--${boundary}
Content-Disposition: file; filename="manifest.json"
Content-Type: application/octet-stream

{"name": "test"}
--${boundary}
Content-Disposition: file; filename="render/index.js"
Content-Type: application/octet-stream

const x = 123
--${boundary}--`.replace(/\n/g, '\r\n')

test('publishApp streams a multipart/mixed request', async t => {
  t.plan(3)
  const requestHandler = (req, res) => {
    t.true(req.headers['content-type'].startsWith('multipart/mixed'))
    t.is(req.url, '/account/workspace/registry?isDevelopment=false')
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
  const pass = new PassThrough({objectMode: true})
  const server = createServer(requestHandler)
  server.listen(13377)
  const reply = client.publishApp('account', 'workspace', pass, false)
  pass.write(manifest)
  pass.write(jsFile)
  pass.end()
  await reply
  server.close()
})
