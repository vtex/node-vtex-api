declare module 'tokenbucket' {
  import Promise = require('bluebird')
  import redis = require('redis')
  declare class TokenBucket {
      public lastFill: any
  
      public tokensToAddPerInterval: any
  
      public tokensLeft: any
  
      constructor(config?: any);
  
      public removeTokens(tokensToRemove?: any): any
  
      public removeTokensSync(tokensToRemove?: any): any
  
      public save(): any
  
      public loadSaved(): any
  
  }
  
  export = TokenBucket
}
