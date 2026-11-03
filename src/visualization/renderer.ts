// 1단계: 트랙이 아직 없으므로 배경 격자와 안내 문구만 그린다.

export function drawPlaceholder(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0d1420';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  const step = 40;
  ctx.beginPath();
  for (let x = 0.5; x < width; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0.5; y < height; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(200, 214, 235, 0.55)';
  ctx.font = '15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('트랙 미리보기 영역 — 2단계에서 트랙 생성이 연결됩니다', width / 2, height / 2);
}
