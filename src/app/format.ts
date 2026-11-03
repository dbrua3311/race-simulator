import { DT } from '../simulation/params';

/** 시뮬레이션 시간(초) → "mm:ss.cc" */
export function formatSimTime(seconds: number): string {
  const totalCentis = Math.floor(seconds * 100 + 1e-6);
  const minutes = Math.floor(totalCentis / 6000);
  const secs = Math.floor((totalCentis % 6000) / 100);
  const centis = totalCentis % 100;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

/** 오른쪽 위 최고 완주 기록 (원문 40절): 아직 없음 / 완주 시간 / 세대가 끝났는데 완주 차 없음 */
export function finishRecordText(bestFinish: { tick: number } | null, runFinished: boolean): string {
  if (bestFinish) return formatSimTime(bestFinish.tick * DT);
  return runFinished ? '완주 기록 없음' : '--:--.--';
}
