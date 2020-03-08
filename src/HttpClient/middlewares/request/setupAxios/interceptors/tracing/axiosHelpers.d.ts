declare module 'axios/lib/core/buildFullPath' {
  function buildFullPath(baseURL: string | undefined | null, requestedURL: string | undefined | null)
  export = buildFullPath
}
