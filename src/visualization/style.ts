/** 화면 그림 방식. 시뮬레이션·판정과는 무관하다 */
export type RenderStyle = 'pixel' | 'smooth';

export const RENDER_STYLE_LABEL: Record<RenderStyle, string> = {
  pixel: '픽셀아트',
  smooth: '기본',
};

/** 픽셀아트: 이 배율만큼 낮은 해상도로 그린 뒤 그대로(보간 없이) 키운다 */
export const PIXEL_FACTOR = 2;
