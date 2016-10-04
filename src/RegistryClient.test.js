import test from 'ava'
import Vinyl from 'vinyl'
import {PassThrough} from 'stream'
import {createServer} from 'http'
import {createGunzip} from 'zlib'
import RegistryClient from './RegistryClient'

test('publishApp streams a multipart/mixed request', async t => {
  const jsContents = 'const x = 123'
  const jsFile = new Vinyl({
    cwd: '/',
    base: '/',
    path: '/render/index.js',
    contents: new Buffer(jsContents, 'utf8'),
  })
  const manifestContents = '{"name": "test"}'
  const manifest = new Vinyl({
    cwd: '/',
    base: '/',
    path: '/manifest.json',
    contents: new Buffer(manifestContents, 'utf8'),
  })
  const client = new RegistryClient('auth', 'agent', 'http://localhost:13377')
  const pass = new PassThrough({objectMode: true})
  const server = createServer((req, res) => {
    t.true(req.headers['content-type'].startsWith('multipart/mixed; boundary='))
    const boundary = req.headers['content-type'].split('multipart/mixed; boundary=')[1]
    let data = ''
    const gz = createGunzip()
    req.pipe(gz)
    gz.on('data', c => { data += c })
    gz.on('end', () => {
      const [manifestData, jsData] = data.split(`--${boundary}`).slice(1)
      t.true(manifestData.includes(manifestContents))
      t.true(jsData.includes(jsContents))
      res.end('ok')
    })
  })
  server.listen(13377)
  pass.write(manifest)
  pass.write(jsFile)
  pass.end()
  const reply = await client.publishApp('account', 'workspace', pass, false)
  t.is(reply.data, 'ok')
  server.close()
})
