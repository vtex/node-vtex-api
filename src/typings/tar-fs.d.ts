declare module 'tar-fs' {
  import { Writable } from 'stream'
  export function extract(targetPath: string): Writable
}
