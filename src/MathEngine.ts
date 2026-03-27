// ===== АРМ Ножедела — Математическое ядро =====

export type GrindType = 'flat' | 'scandi' | 'hollow' | 'convex' | 'chisel';
export type BladeShape = 'drop_point' | 'clip_point' | 'tanto' | 'bowie' | 'spear_point' | 'dagger' | 'cleaver' | 'sheepsfoot' | 'custom';

export interface BladeParams {
  spine: number;       // Толщина обуха, мм
  width: number;       // Общая ширина клинка, мм
  grindHeight: number; // Высота спуска, мм
  edge: number;        // Сведение, мм
  grindType: GrindType;
  bladeShape: BladeShape;
  positionX: number;   // Позиция на клинке 0..100
}

/**
 * Расчёт половинного угла спуска (для настройки приспособы гриндера).
 * angle = atan((Spine - Edge) / (2 * GrindHeight)) * (180 / PI)
 */
export function calcHalfAngle(spine: number, edge: number, grindHeight: number): number {
  if (grindHeight <= 0) return 0;
  return Math.atan((spine - edge) / (2 * grindHeight)) * (180 / Math.PI);
}

/**
 * Дистальное сужение: при позиции > 70% уменьшаем толщину обуха и высоту спуска
 * пропорционально (имитация утончения к острию).
 */
export function applyDistalTaper(
  positionX: number,
  spine: number,
  grindHeight: number,
  width: number
): { spine: number; grindHeight: number; width: number } {
  if (positionX <= 70) {
    return { spine, grindHeight, width };
  }
  // От 70 до 100 — линейное уменьшение до 30% от исходных значений
  const t = (positionX - 70) / 30; // 0..1
  const factor = 1 - t * 0.7; // 1.0 → 0.3
  return {
    spine: spine * factor,
    grindHeight: grindHeight * factor,
    width: width * (1 - t * 0.4), // ширина уменьшается мягче
  };
}

/**
 * Определяет, можно ли для данного типа спуска выставить угол на гриндере.
 */
export function isAngleApplicable(grindType: GrindType): boolean {
  return grindType === 'flat' || grindType === 'scandi' || grindType === 'chisel';
}

/**
 * Генерация SVG path для сечения клинка (вид с торца).
 * Возвращает массив из двух путей: левая и правая стороны.
 * Координаты нормализованы в viewBox: центр по X, Y=0 сверху.
 */
export function generateCrossSectionPaths(
  params: BladeParams,
  viewWidth: number,
  viewHeight: number
): { left: string; right: string; outline: string } {
  const tapered = applyDistalTaper(params.positionX, params.spine, params.grindHeight, params.width);

  const cx = viewWidth / 2;
  const topY = 30; // отступ сверху

  // Масштабирование: пиксели на мм
  const availableH = viewHeight - 60;
  const scale = Math.min(availableH / params.width, (viewWidth - 60) / params.spine);

  const halfSpine = (tapered.spine / 2) * scale;
  const halfEdge = (params.edge / 2) * scale;
  const widthPx = tapered.width * scale;
  const grindStartY = topY + (tapered.width - tapered.grindHeight) * scale;
  const bottomY = topY + widthPx;

  // Контрольные точки
  const topLeft = { x: cx - halfSpine, y: topY };
  const topRight = { x: cx + halfSpine, y: topY };
  const grindLeftStart = { x: cx - halfSpine, y: grindStartY };
  const grindRightStart = { x: cx + halfSpine, y: grindStartY };
  const edgeLeft = { x: cx - halfEdge, y: bottomY };
  const edgeRight = { x: cx + halfEdge, y: bottomY };

  let leftPath = '';
  let rightPath = '';

  const { grindType } = params;

  if (grindType === 'chisel') {
    // Стамеска: левая сторона — прямая вертикальная, правая — под углом
    leftPath = `M ${topLeft.x} ${topLeft.y} L ${topLeft.x} ${bottomY}`;
    rightPath = `M ${topRight.x} ${topRight.y} L ${topRight.x} ${grindRightStart.y} L ${edgeRight.x} ${bottomY}`;
  } else if (grindType === 'hollow') {
    // Вогнутые спуски — кривые Безье внутрь
    const cpOffsetX = halfSpine * 0.7;
    leftPath = `M ${grindLeftStart.x} ${grindLeftStart.y} C ${grindLeftStart.x + cpOffsetX} ${grindLeftStart.y + (bottomY - grindStartY) * 0.5} ${edgeLeft.x + cpOffsetX * 0.3} ${bottomY} ${edgeLeft.x} ${bottomY}`;
    rightPath = `M ${grindRightStart.x} ${grindRightStart.y} C ${grindRightStart.x - cpOffsetX} ${grindRightStart.y + (bottomY - grindStartY) * 0.5} ${edgeRight.x - cpOffsetX * 0.3} ${bottomY} ${edgeRight.x} ${bottomY}`;
  } else if (grindType === 'convex') {
    // Выпуклая линза — кривые Безье наружу
    const cpOffsetX = halfSpine * 0.5;
    leftPath = `M ${grindLeftStart.x} ${grindLeftStart.y} C ${grindLeftStart.x - cpOffsetX} ${grindLeftStart.y + (bottomY - grindStartY) * 0.5} ${edgeLeft.x - cpOffsetX * 0.3} ${bottomY} ${edgeLeft.x} ${bottomY}`;
    rightPath = `M ${grindRightStart.x} ${grindRightStart.y} C ${grindRightStart.x + cpOffsetX} ${grindRightStart.y + (bottomY - grindStartY) * 0.5} ${edgeRight.x + cpOffsetX * 0.3} ${bottomY} ${edgeRight.x} ${bottomY}`;
  } else {
    // flat / scandi — прямые линии
    leftPath = `M ${grindLeftStart.x} ${grindLeftStart.y} L ${edgeLeft.x} ${bottomY}`;
    rightPath = `M ${grindRightStart.x} ${grindRightStart.y} L ${edgeRight.x} ${bottomY}`;
  }

  // Общий контур (обух + прямые стенки до начала спуска)
  const outline = `M ${topLeft.x} ${topLeft.y} L ${topRight.x} ${topRight.y} L ${topRight.x} ${grindRightStart.y} M ${topLeft.x} ${topLeft.y} L ${topLeft.x} ${grindLeftStart.y}`;

  return { left: leftPath, right: rightPath, outline };
}

/**
 * Генерация данных для бокового вида ножа (силуэт drop-point).
 */
export interface BladeShapePoints {
  spineDropX: number; // Х начала скоса обуха
  spineCpX: number;   // Контрольная точка обуха X
  spineCpY: number;   // Контрольная точка обуха Y
  tipX: number;       // Острие клинка X
  tipY: number;       // Острие клинка Y
  bellyCpX: number;   // Контрольная точка брюшка X
  bellyCpY: number;   // Контрольная точка брюшка Y
  bellyStartX: number;// Х начала подъема брюшка лезвия
  ricassoX: number;   // Позиция рикассо (ограничитель)
}

/**
 * Возвращает пресеты точек Безье для различных форм клинка
 */
export function getDefaultShapePoints(shape: BladeShape, viewWidth: number, viewHeight: number): BladeShapePoints {
  const padding = 20;
  const bladeLen = viewWidth - padding * 2;
  const bladeH = viewHeight * 0.45;
  const startX = padding;
  const spineY = viewHeight * 0.25;
  const edgeY = spineY + bladeH;

  const ricassoX = startX + bladeLen * 0.12;
  const straightEdgeW = bladeLen * 0.55;
  const bellyStartX = ricassoX + straightEdgeW;
  const tipX = startX + bladeLen;

  let pts: Partial<BladeShapePoints> = { ricassoX, tipX, bellyStartX };

  if (shape === 'clip_point') {
    pts.spineDropX = startX + bladeLen * 0.55;
    pts.spineCpX = startX + bladeLen * 0.8;
    pts.spineCpY = spineY + bladeH * 0.25;
    pts.tipY = spineY + bladeH * 0.35;
    pts.bellyCpX = bellyStartX + (tipX - bellyStartX) * 0.5;
    pts.bellyCpY = edgeY;
  } else if (shape === 'tanto') {
    pts.spineDropX = tipX - 15;
    pts.spineCpX = tipX;
    pts.spineCpY = spineY;
    pts.tipY = spineY + bladeH * 0.25;
    pts.bellyStartX = startX + bladeLen * 0.8;
    pts.bellyCpX = pts.bellyStartX;
    pts.bellyCpY = edgeY;
  } else if (shape === 'bowie') {
    pts.spineDropX = startX + bladeLen * 0.45;
    pts.spineCpX = startX + bladeLen * 0.75;
    pts.spineCpY = spineY + bladeH * 0.2;
    pts.tipY = spineY + bladeH * 0.35;
    pts.bellyCpX = bellyStartX + (tipX - bellyStartX) * 0.6;
    pts.bellyCpY = edgeY;
  } else if (shape === 'spear_point') {
    pts.spineDropX = startX + bladeLen * 0.65;
    pts.spineCpX = tipX - 15;
    pts.spineCpY = spineY;
    pts.tipY = spineY + bladeH * 0.5;
    pts.bellyStartX = startX + bladeLen * 0.65;
    pts.bellyCpX = tipX - 15;
    pts.bellyCpY = edgeY;
  } else if (shape === 'dagger') {
    pts.spineDropX = startX + bladeLen * 0.75;
    pts.spineCpX = tipX;
    pts.spineCpY = spineY + bladeH * 0.25; // approximated
    pts.tipY = spineY + bladeH * 0.5;
    pts.bellyStartX = startX + bladeLen * 0.75;
    pts.bellyCpX = tipX;
    pts.bellyCpY = edgeY - bladeH * 0.25;
  } else if (shape === 'cleaver') {
    pts.spineDropX = startX + bladeLen * 0.5;
    pts.spineCpX = tipX - 20;
    pts.spineCpY = spineY + bladeH * 0.2;
    pts.tipY = edgeY - bladeH * 0.1;
    pts.bellyStartX = startX + bladeLen * 0.8;
    pts.bellyCpX = tipX - 5;
    pts.bellyCpY = edgeY;
  } else if (shape === 'sheepsfoot') {
    pts.spineDropX = startX + bladeLen * 0.6;
    pts.spineCpX = tipX;
    pts.spineCpY = edgeY - bladeH * 0.2;
    pts.tipY = edgeY;
    pts.bellyStartX = tipX - 10;
    pts.bellyCpX = tipX;
    pts.bellyCpY = edgeY;
  } else if (shape === 'custom') {
    pts.spineDropX = startX + bladeLen * 0.5;
    pts.spineCpX = startX + bladeLen * 0.75;
    pts.spineCpY = spineY + bladeH * 0.2;
    pts.tipY = spineY + bladeH * 0.5;
    pts.bellyStartX = startX + bladeLen * 0.5;
    pts.bellyCpX = startX + bladeLen * 0.8;
    pts.bellyCpY = edgeY;
  } else {
    // drop_point
    pts.spineDropX = startX + bladeLen * 0.6;
    pts.spineCpX = tipX - 10;
    pts.spineCpY = spineY;
    pts.tipY = spineY + bladeH * 0.4;
    pts.bellyCpX = bellyStartX + (tipX - bellyStartX) * 0.5;
    pts.bellyCpY = edgeY;
  }

  return pts as BladeShapePoints;
}

/**
 * Генерация данных для бокового вида ножа
 */
export function generateSideViewData(
  params: BladeParams,
  pts: BladeShapePoints,
  viewWidth: number,
  viewHeight: number
) {
  const padding = 20;
  const bladeLen = viewWidth - padding * 2;
  const bladeH = viewHeight * 0.45;
  const startX = padding;
  const startY = viewHeight * 0.25;

  const spineY = startY;
  const edgeY = startY + bladeH;

  // Главный силуэт (Контур)
  const silhouette = `
    M ${startX} ${spineY}
    L ${pts.spineDropX} ${spineY}
    Q ${pts.spineCpX} ${pts.spineCpY} ${pts.tipX} ${pts.tipY}
    Q ${pts.bellyCpX} ${pts.bellyCpY} ${pts.bellyStartX} ${edgeY}
    L ${startX} ${edgeY}
    Z
  `;

  // Расчёт высоты спуска (Grind Line Offset)
  const grindRatio = params.grindHeight / params.width;
  // Смещение Y для края при прямом участке
  const grindLineY = edgeY - bladeH * grindRatio;
  
  // Создание радиуса Plunge Line
  const plungeBottomX = pts.ricassoX;
  const plungeTopX = plungeBottomX - 8;
  
  // Смещаем контрольную точку брюшка
  const gBellyCpY = pts.bellyCpY - bladeH * grindRatio;
  const gTipY = pts.tipY - (bladeH * grindRatio * 0.5); // Спуск сходится к острию

  let grindLine = '';
  if (params.bladeShape === 'dagger') {
    // Для кинжала линия спуска всегда центрирована
    const daggerCenterY = spineY + bladeH * 0.5;
    grindLine = `
      M ${plungeBottomX} ${spineY + bladeH * 0.1}
      L ${plungeBottomX} ${daggerCenterY}
      L ${pts.tipX} ${daggerCenterY}
      M ${plungeBottomX} ${daggerCenterY}
      L ${plungeBottomX} ${edgeY - bladeH * 0.1}
    `;
  } else {
    grindLine = `
      M ${plungeTopX} ${spineY + bladeH * 0.05}
      Q ${plungeBottomX} ${spineY + bladeH * 0.1} ${plungeBottomX} ${grindLineY}
      L ${pts.bellyStartX} ${grindLineY}
      Q ${pts.bellyCpX} ${gBellyCpY} ${pts.tipX} ${gTipY}
    `;
  }

  // Маркер позиции (ограничен длиной клинка)
  const markerX = startX + (bladeLen * params.positionX) / 100;

  // Хвостовик (tang)
  const tang = `
    M ${startX} ${spineY}
    L ${startX - 40} ${spineY + bladeH * 0.15}
    L ${startX - 40} ${edgeY - bladeH * 0.15}
    L ${startX} ${edgeY}
  `;

  return {
    silhouette,
    grindLine,
    markerX,
    spineY,
    edgeY,
    ricassoX: pts.ricassoX,
    tang,
    startX,
    bladeLen,
  };
}
