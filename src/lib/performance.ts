export interface PerformanceMeasurement {
  name: string;
  durationMs: number;
}

export function measurePerformance(
  name: string,
  startMark: string,
  endMark: string
): PerformanceMeasurement | null {
  if (typeof performance === 'undefined') return null;

  performance.mark(endMark);
  const measurement = performance.measure(name, startMark, endMark);
  const result = {
    name,
    durationMs: Math.round(measurement.duration),
  };
  performance.clearMarks(startMark);
  performance.clearMarks(endMark);
  performance.clearMeasures(name);
  return result;
}
