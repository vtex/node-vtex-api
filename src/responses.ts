export type Policy = {
  name: string,
}

export type AppManifest = {
  [_extra: string]: any // internal fields like _id, _link, _registry
  vendor: string,
  name: string,
  version: string,
  title: string,
  description: string,
  categories: string[],
  dependencies: {
    [name: string]: string,
  },
  peerDependencies: {
    [name: string]: string,
  },
  settingsSchema: any,
  registries: string[],
  credentialType: string,
  policies: Policy[],
  _resolvedDependencies?: {
    [name: string]: string[],
  },
}

export type FileListItem = {
  path: string,
  hash: string,
}

export type AppFilesList = {
  data: FileListItem[],
}

export type BucketMetadata = {
  state: string,
  lastModified: string,
  hash: string,
}
