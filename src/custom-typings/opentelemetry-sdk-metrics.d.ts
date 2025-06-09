declare module '@opentelemetry/sdk-metrics' {
  // This stub effectively makes all imports from '@opentelemetry/sdk-metrics' of type 'any',
  // bypassing the problematic type definitions in the original package that conflict with TypeScript 3.9.7.
  const DUMMY_SDK_METRICS: any;
  export = DUMMY_SDK_METRICS;
}
