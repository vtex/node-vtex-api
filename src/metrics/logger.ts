export interface Key {
  name: string
}

export interface MetricsLogger {
  add: (key: Key, value: any) => void
}
