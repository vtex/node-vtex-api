export type Policy = {
  name: string,
}

export type AppManifest = {
  [_extra: string]: any // internal fields like _id, _link, _registry, _resolvedDependencies
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
}

export type FileListItem = {
  path: string,
  hash: string,
}

export type AppFilesList = {
  data: FileListItem[],
}
