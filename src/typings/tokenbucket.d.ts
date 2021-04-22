declare module 'tokenbucket' {
  import Promise = require('bluebird');
  import redis = require('redis');
  declare class TokenBucket {
      lastFill: any;
  
      tokensToAddPerInterval: any;
  
      tokensLeft: any;
  
      constructor(config?: any);
  
      removeTokens(tokensToRemove?: any): any;
  
      removeTokensSync(tokensToRemove?: any): any;
  
      save(): any;
  
      loadSaved(): any;
  
  }
  
  export = TokenBucket;
}
