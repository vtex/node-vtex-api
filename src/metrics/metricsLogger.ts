export interface Key {
  key1: string
  key2?: string
  key3?: string
}

export interface MetricsLogger {
  add: (key: Key, value: number) => void
}
