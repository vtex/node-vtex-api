declare module 'tokenbucket' {
  import Promise = require('bluebird')
  import redis = require('redis')

  declare interface TokenBucketOptions {
    size? : number = 1
    tokensToAddPerInterval? : number = 1
    interval? : number | string = 1000
    lastFill? : number
    tokensLeft? : number
    spread? : boolean = false
    maxWait? : number | string
    parentBucket? : TokenBucket
    redis? : {
      bucketName? : string
      redisClient? : redisClient
      redisClientConfig: {
        port? : number = 6379
        host? : string = '127.0.0.1'
        unixSocket? : string
        options? : string
      } 
    }
  }
  declare class TokenBucket {
      public lastFill: number
  
      public tokensToAddPerInterval: number
  
      public tokensLeft: number
  
      constructor(config?: TokenBucketOptions);
  
      public removeTokens(tokensToRemove?: number): Promise<number>
  
      public removeTokensSync(tokensToRemove?: number): boolean
  
      public save(): Promise<void>
  
      public loadSaved(): Promise<any>
  
  }
  
  export = TokenBucket
}
