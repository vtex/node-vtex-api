import http from 'http'
import { mergeDeepRight } from 'ramda'

import { IS_IO } from './constants'

// As we'll modify this module we need a plain-old require
// tslint:disable-next-line:no-var-requires
const https = require('https')

function setup () {
  https.request = (options: http.RequestOptions, callback?: any) => {
    const host = options.hostname || options.host
    console.info(`HTTPS requests are currently not supported in the local VTEX IO network. The request to https://${host}${options.path} was intercepted and sent using HTTP to the VTEX IO Router, which will switch to HTTPS when proxying to outside the network. Ideally, switch to HTTP explicitly and add the header "X-Vtex-Use-Https: true".`)

    const httpOptions = mergeDeepRight(options, {
      agent: undefined,
      headers: {
        'X-Vtex-Proxy-To': `https://${host}`,
      },
      protocol: 'http:',
    }) as http.RequestOptions

    return http.request(httpOptions, callback)
  }
}

// Only setup http interception if inside IO
if (IS_IO) {
  // setup()
}
