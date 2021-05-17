import TokenBucket from 'tokenbucket'

export function createTokenBucket(rateLimit?: number, globalRateTokenBucket?: TokenBucket){
  return rateLimit ? new TokenBucket({
    interval: 'minute',
    parentBucket: globalRateTokenBucket,
    size: Math.ceil(rateLimit / 2.0),
    spread: true,
    tokensToAddPerInterval: rateLimit,
  }) : globalRateTokenBucket!
}