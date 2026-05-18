export interface Snapshot {
  usage: NodeJS.CpuUsage,
  time: number,
}

interface CpuUsage {
  user: number,
  system: number,
}

export function cpuSnapshot (): Snapshot {
  return {
    time: microtime(),
    usage: process.cpuUsage(),
  }
}

export function snapshotDiff (curr: Snapshot, last: Snapshot): CpuUsage {
  const timeDiff = curr.time - last.time
  return {
    system: (curr.usage.system - last.usage.system) / timeDiff,
    user: (curr.usage.user - last.usage.user) / timeDiff,
  }
}

function microtime (): number {
  const hrTime = process.hrtime()
  return hrTime[0] * 1000000 + hrTime[1] / 1000
}
