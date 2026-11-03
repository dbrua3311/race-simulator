/** 시뮬레이션 시간(초) → "mm:ss.cc" */
export function formatSimTime(seconds: number): string {
  const totalCentis = Math.floor(seconds * 100 + 1e-6);
  const minutes = Math.floor(totalCentis / 6000);
  const secs = Math.floor((totalCentis % 6000) / 100);
  const centis = totalCentis % 100;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}
