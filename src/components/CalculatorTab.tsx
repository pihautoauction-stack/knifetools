import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  calcHalfAngle,
  applyDistalTaper,
  isAngleApplicable,
  generateCrossSectionPaths,
  generateSideViewData,
  getDefaultShapePoints,
  calcSideViewLayout,
} from '../MathEngine';
import type { BladeParams, GrindType, BladeShape, BladeShapePoints } from '../MathEngine';

const GRIND_TYPES: { value: GrindType; label: string }[] = [
  { value: 'flat', label: 'Прямые (Flat)' },
  { value: 'scandi', label: 'Сканди (Scandi)' },
  { value: 'hollow', label: 'Вогнутые (Hollow)' },
  { value: 'convex', label: 'Выпуклая линза (Convex)' },
  { value: 'chisel', label: 'Стамеска (Chisel)' },
];

const BLADE_SHAPES: { value: BladeShape; label: string }[] = [
  { value: 'drop_point', label: 'Drop Point' },
  { value: 'clip_point', label: 'Clip Point' },
  { value: 'tanto', label: 'Tanto (Американский)' },
  { value: 'bowie', label: 'Bowie (Боуи)' },
  { value: 'spear_point', label: 'Spear Point (Копьевидный)' },
  { value: 'dagger', label: 'Dagger (Кинжал)' },
  { value: 'cleaver', label: 'Cleaver (Сербский шеф)' },
  { value: 'sheepsfoot', label: 'Sheepsfoot (Копытце)' },
  { value: 'custom', label: 'Custom (Произвольный)' },
];

const DICTIONARY: Record<string, string> = {
  bladeLength: 'Полная длина клинка от кончика (острия) до начала хвостовика. Масштабный якорь для чертежа.',
  ricasso: 'Рикассо (Пята) — незаточенная часть клинка у рукояти. Обеспечивает прочность узла крепления и удобство при заточке.',
  spine: 'Обух — тупая (противоположная лезвию) сторона клинка. Определяет общую прочность и вес.',
  width: 'Ширина клинка — расстояние от обуха до режущей кромки.',
  grindHeight: 'Высота спуска — расстояние от режущей кромки до начала сведения (Grind Line). Влияет на угол заточки и геометрию реза.',
  edge: 'Сведение — толщина металла непосредственно перед режущей кромкой. Тонкое сведение (0.1-0.3 мм) даёт "вкусный" рез, толстое (0.5+ мм) — прочность.',
  grindLine: 'Линия спуска (Grind Line / Грань) — граница, где плоская часть клинка переходит в спуск. Автоматически огибает контур лезвия.',
  bladeShape: 'Форма клинка (Силуэт) — геометрический профиль ножа. Выбор шаблона загружает базовые точки Безье для радактора.',
  grindType: 'Тип спуска (Сечение) — профиль выборки металла. Прямые — универсальны, сканди — для дерева, вогнутые — для бритвенного реза.',
  positionX: 'Позиция на клинке — ползунок позволяет посмотреть сечение ножа в любой его точке (от рукояти до острия) для оценки сужения.',
};

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  icon?: string;
  tooltipKey?: keyof typeof DICTIONARY;
}

function InfoTooltip({ textKey }: { textKey?: keyof typeof DICTIONARY }) {
  if (!textKey) return null;
  return (
    <div className="group relative inline-flex items-center">
      <div className="inline-flex items-center justify-center w-[14px] h-[14px] ml-1.5 rounded-full bg-cad-text-dim/20 text-cad-text-dim text-[9px] font-bold cursor-help transition-colors group-hover:bg-cad-accent group-hover:text-cad-bg">
        ?
      </div>
      {/* Мгновенная красивая подсказка */}
      <div className="absolute left-1/2 bottom-full -translate-x-1/2 mb-2 w-64 p-3 bg-cad-surface-2 border border-cad-border rounded shadow-2xl text-xs text-cad-text opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
        <div className="font-semibold text-cad-accent mb-1">{DICTIONARY[textKey].split('—')[0]}</div>
        <div className="text-cad-text-dim">{DICTIONARY[textKey].split('—')[1] || DICTIONARY[textKey]}</div>
        {/* Треугольник */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-cad-border"></div>
      </div>
    </div>
  );
}

function SliderControl({ label, value, min, max, step, unit, onChange, icon, tooltipKey }: SliderControlProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-cad-text-dim flex items-center gap-1.5">
          {icon && <span className="text-base">{icon}</span>}
          <span>{label}</span>
          <InfoTooltip textKey={tooltipKey} />
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
            }}
            className="w-18 bg-cad-bg border border-cad-border rounded px-2 py-0.5 text-sm text-cad-accent text-right font-mono focus:outline-none focus:border-cad-accent transition-colors"
          />
          <span className="text-xs text-cad-text-dim w-6">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between text-[10px] text-cad-text-dim mt-0.5 px-0.5">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// Компонент сетки внутри SVG
function SvgGrid({ width, height, step = 20 }: { width: number; height: number; step?: number }) {
  const lines = [];
  for (let x = 0; x <= width; x += step) {
    lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={height} stroke="var(--color-cad-grid)" strokeWidth="0.5" />);
  }
  for (let y = 0; y <= height; y += step) {
    lines.push(<line key={`h${y}`} x1={0} y1={y} x2={width} y2={y} stroke="var(--color-cad-grid)" strokeWidth="0.5" />);
  }
  return <g>{lines}</g>;
}

// Типы для перетаскиваемых маркеров
type DragNode = 'spineDropX' | 'spineCp' | 'tip' | 'bellyCp' | 'bellyStartX' | 'ricassoX';

export default function CalculatorTab() {
  const [bladeLength, setBladeLength] = useState(120);
  const [spine, setSpine] = useState(4.0);
  const [width, setWidth] = useState(30);
  const [grindHeight, setGrindHeight] = useState(20);
  const [edge, setEdge] = useState(0.3);
  const [grindType, setGrindType] = useState<GrindType>('flat');
  const [bladeShape, setBladeShape] = useState<BladeShape>('drop_point');
  const [positionX, setPositionX] = useState(0);

  const layout = useMemo(() => calcSideViewLayout(bladeLength, width, 700), [bladeLength, width]);
  const sideViewW = layout.viewWidth;
  const sideViewH = layout.viewHeight;

  // Интерактивные точки Безье
  const [shapePoints, setShapePoints] = useState<BladeShapePoints>(() =>
    getDefaultShapePoints('drop_point', calcSideViewLayout(120, 30, 700))
  );
  const [draggingNode, setDraggingNode] = useState<DragNode | null>(null);

  const prevLayoutRef = useRef(layout);
  const prevShapeRef = useRef(bladeShape);

  useEffect(() => {
    const prevLayout = prevLayoutRef.current;
    const prevShape = prevShapeRef.current;

    const layoutChanged = prevLayout.bladeH !== layout.bladeH || prevLayout.bladeLen !== layout.bladeLen;
    const shapeChanged = prevShape !== bladeShape;

    if (shapeChanged && bladeShape !== 'custom') {
      // Выбрали новый пресет
      setShapePoints(getDefaultShapePoints(bladeShape, layout));
    } else if (layoutChanged) {
      if (bladeShape === 'custom') {
        // Если это произвольная форма, масштабируем (растягиваем) пользовательские точки!
        const scaleX = layout.bladeLen / prevLayout.bladeLen;
        const scaleY = layout.bladeH / prevLayout.bladeH;
        setShapePoints(pts => ({
          ricassoX: layout.startX + (pts.ricassoX - prevLayout.startX) * scaleX,
          spineDropX: layout.startX + (pts.spineDropX - prevLayout.startX) * scaleX,
          spineCpX: layout.startX + (pts.spineCpX - prevLayout.startX) * scaleX,
          spineCpY: layout.spineY + (pts.spineCpY - prevLayout.spineY) * scaleY,
          tipX: layout.startX + (pts.tipX - prevLayout.startX) * scaleX,
          tipY: layout.spineY + (pts.tipY - prevLayout.spineY) * scaleY,
          bellyCpX: layout.startX + (pts.bellyCpX - prevLayout.startX) * scaleX,
          bellyCpY: layout.spineY + (pts.bellyCpY - prevLayout.spineY) * scaleY,
          bellyStartX: layout.startX + (pts.bellyStartX - prevLayout.startX) * scaleX,
        }));
      } else {
        // Пересчет пресета под новые размеры
        setShapePoints(getDefaultShapePoints(bladeShape, layout));
      }
    }

    prevLayoutRef.current = layout;
    prevShapeRef.current = bladeShape;
  }, [layout, bladeShape]);

  // Применяем дистальное сужение
  const tapered = useMemo(
    () => applyDistalTaper(positionX, spine, grindHeight, width),
    [positionX, spine, grindHeight, width]
  );

  // Параметры для расчётов
  const params: BladeParams = useMemo(
    () => ({
      spine: tapered.spine,
      width: tapered.width,
      grindHeight: Math.min(tapered.grindHeight, tapered.width),
      edge,
      grindType,
      bladeShape,
      positionX,
    }),
    [tapered, edge, grindType, bladeShape, positionX]
  );

  // Расчёт угла
  const halfAngle = useMemo(
    () => calcHalfAngle(params.spine, params.edge, params.grindHeight),
    [params.spine, params.edge, params.grindHeight]
  );

  const fullAngle = halfAngle * 2;
  const angleApplicable = isAngleApplicable(grindType);

  // SVG данные
  const crossSectionW = 350;
  const crossSectionH = 400;
  const crossSection = useMemo(
    () => generateCrossSectionPaths(params, crossSectionW, crossSectionH),
    [params]
  );

  const sideView = useMemo(
    () => generateSideViewData({ ...params, width, grindHeight, positionX }, shapePoints, layout),
    [params, width, grindHeight, positionX, shapePoints, layout]
  );

  // Обработчики Drag And Drop
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingNode) return;
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    if (!loc) return;

    setShapePoints((prev) => {
      const next = { ...prev };
      if (draggingNode === 'spineDropX') next.spineDropX = loc.x;
      if (draggingNode === 'spineCp') { next.spineCpX = loc.x; next.spineCpY = loc.y; }
      if (draggingNode === 'tip') { next.tipX = loc.x; next.tipY = loc.y; }
      if (draggingNode === 'bellyCp') { next.bellyCpX = loc.x; next.bellyCpY = loc.y; }
      if (draggingNode === 'bellyStartX') { next.bellyStartX = loc.x; }
      if (draggingNode === 'ricassoX') { next.ricassoX = loc.x; }
      return next;
    });
  };

  const handlePointerUp = () => setDraggingNode(null);

  const renderHandle = (id: DragNode, cx: number, cy: number, color = 'var(--color-cad-yellow)') => (
    <circle
      cx={cx}
      cy={cy}
      r="6"
      fill={color}
      stroke="var(--color-cad-bg)"
      strokeWidth="2"
      className="cursor-pointer transition-transform hover:scale-125 hover:stroke-[3px]"
      style={{ transformOrigin: `${cx}px ${cy}px` }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDraggingNode(id);
      }}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-full fade-in">
      {/* ===== ЛЕВАЯ ПАНЕЛЬ: КОНТРОЛЫ ===== */}
      <div className="order-2 lg:order-1 lg:w-[340px] shrink-0 bg-cad-surface rounded-xl border border-cad-border p-5 overflow-y-auto">
        <h2 className="text-lg font-semibold text-cad-text mb-1 flex items-center gap-2">
          <span className="text-cad-accent">⚙</span> Параметры клинка
        </h2>
        <p className="text-xs text-cad-text-dim mb-5">Настройте геометрию спусков</p>

        <SliderControl
          label="Длина клинка"
          icon="📏"
          value={bladeLength}
          min={50}
          max={350}
          step={5}
          unit="мм"
          tooltipKey="bladeLength"
          onChange={setBladeLength}
        />

        <SliderControl
          label="Толщина обуха"
          icon="⛓"
          value={spine}
          min={1}
          max={8}
          step={0.1}
          unit="мм"
          tooltipKey="spine"
          onChange={setSpine}
        />

        <SliderControl
          label="Ширина клинка"
          icon="↔"
          value={width}
          min={15}
          max={100}
          step={1}
          unit="мм"
          tooltipKey="width"
          onChange={setWidth}
        />

        <SliderControl
          label="Высота спуска"
          icon="📐"
          value={grindHeight}
          min={5}
          max={width}
          step={1}
          unit="мм"
          tooltipKey="grindHeight"
          onChange={(v) => setGrindHeight(Math.min(v, width))}
        />

        <SliderControl
          label="Сведение (кромка)"
          icon="🔪"
          value={edge}
          min={0}
          max={3}
          step={0.1}
          unit="мм"
          tooltipKey="edge"
          onChange={setEdge}
        />

        {/* Форма клинка */}
        <div className="mb-4">
          <label className="text-sm font-medium text-cad-text-dim flex items-center gap-1.5 mb-1.5">
            <span className="text-base">🗡</span>
            <span>Форма клинка</span>
            <InfoTooltip textKey="bladeShape" />
          </label>
          <select
            value={bladeShape}
            onChange={(e) => setBladeShape(e.target.value as BladeShape)}
            className="w-full bg-cad-bg border border-cad-border rounded-lg px-3 py-2 text-sm text-cad-text focus:outline-none focus:border-cad-accent transition-colors cursor-pointer"
          >
            {BLADE_SHAPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Тип спуска */}
        <div className="mb-4">
          <label className="text-sm font-medium text-cad-text-dim flex items-center gap-1.5 mb-1.5">
            <span className="text-base">🔧</span>
            <span>Тип спуска</span>
            <InfoTooltip textKey="grindType" />
          </label>
          <select
            value={grindType}
            onChange={(e) => setGrindType(e.target.value as GrindType)}
            className="w-full bg-cad-bg border border-cad-border rounded-lg px-3 py-2 text-sm text-cad-text focus:outline-none focus:border-cad-accent transition-colors cursor-pointer"
          >
            {GRIND_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <SliderControl
          label="Позиция на клинке"
          icon="📍"
          value={positionX}
          min={0}
          max={100}
          step={1}
          unit="%"
          tooltipKey="positionX"
          onChange={setPositionX}
        />

        {/* Информация о дистальном сужении */}
        {positionX > 70 && (
          <div className="bg-cad-orange/10 border border-cad-orange/30 rounded-lg p-3 mb-4 text-xs text-cad-orange">
            ⚠ Дистальное сужение активно (позиция {positionX}%)
            <div className="mt-1 text-cad-text-dim">
              Обух: {tapered.spine.toFixed(2)} мм · Спуск: {tapered.grindHeight.toFixed(1)} мм
            </div>
          </div>
        )}

        {/* ===== РЕЗУЛЬТАТ: РАСЧЁТНЫЙ УГОЛ ===== */}
        <div className="mt-2 bg-cad-bg rounded-xl border border-cad-border p-4">
          <div className="text-xs text-cad-text-dim uppercase tracking-wider mb-2">Расчётный угол</div>
          {angleApplicable ? (
            <>
              <div className="text-4xl font-bold font-mono text-cad-accent leading-tight">
                {halfAngle.toFixed(2)}°
              </div>
              <div className="text-sm text-cad-text-dim mt-1">
                половинный (для приспособы)
              </div>
              <div className="mt-3 pt-3 border-t border-cad-border">
                <div className="text-2xl font-semibold font-mono text-cad-accent-2">
                  {fullAngle.toFixed(2)}°
                </div>
                <div className="text-sm text-cad-text-dim">
                  полный угол спуска
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-cad-yellow leading-relaxed">
              ⚡ Угол не выставляется — работа на колесе / провисе ({grindType === 'hollow' ? 'вогнутые' : 'выпуклая линза'})
            </div>
          )}
        </div>

        {/* Метрики */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="bg-cad-bg rounded-lg border border-cad-border p-2.5 text-center">
            <div className="text-[10px] text-cad-text-dim uppercase">Обух</div>
            <div className="text-sm font-mono text-cad-text">{params.spine.toFixed(2)} мм</div>
          </div>
          <div className="bg-cad-bg rounded-lg border border-cad-border p-2.5 text-center">
            <div className="text-[10px] text-cad-text-dim uppercase">Сведение</div>
            <div className="text-sm font-mono text-cad-text">{params.edge.toFixed(2)} мм</div>
          </div>
          <div className="bg-cad-bg rounded-lg border border-cad-border p-2.5 text-center">
            <div className="text-[10px] text-cad-text-dim uppercase">Ширина</div>
            <div className="text-sm font-mono text-cad-text">{params.width.toFixed(1)} мм</div>
          </div>
          <div className="bg-cad-bg rounded-lg border border-cad-border p-2.5 text-center">
            <div className="text-[10px] text-cad-text-dim uppercase">Спуск</div>
            <div className="text-sm font-mono text-cad-text">{params.grindHeight.toFixed(1)} мм</div>
          </div>
        </div>
      </div>

      {/* ===== ПРАВАЯ ПАНЕЛЬ: SVG ВИЗУАЛИЗАЦИЯ ===== */}
      <div className="order-1 lg:order-2 flex-1 flex flex-col gap-5 min-w-0">
        
        {/* Вид сбоку */}
        <div className="w-full shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-cad-accent-2" />
            <h3 className="text-sm font-semibold text-cad-text">Вид сбоку · Чертеж</h3>
            <span className="text-xs text-cad-text-dim">({bladeLength} мм)</span>
          </div>
          <svg
            viewBox={`0 0 ${sideViewW} ${sideViewH}`}
            className="w-full lg:h-[250px] svg-canvas cursor-crosshair pb-5 touch-none"
            style={{ aspectRatio: `${sideViewW} / ${sideViewH}` }}
            preserveAspectRatio="xMidYMid meet"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <SvgGrid width={sideViewW} height={sideViewH} step={25} />

            {/* Якорь нулевой высоты обуха для отрисовки Grind Line сверху */}
            <path
              d={sideView.tang}
              stroke="var(--color-cad-text-dim)"
              strokeWidth="1.5"
              fill="var(--color-cad-surface-2)"
              opacity={0.5}
            />

            {/* Силуэт клинка */}
            <path
              d={sideView.silhouette}
              stroke="var(--color-cad-text)"
              strokeWidth="2"
              fill="var(--color-cad-surface-2)"
            />

            {/* Линия спуска (Grind Line) */}
            <path
              d={sideView.grindLine}
              stroke="var(--color-cad-cyan)"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="6 3"
            />

            {/* Подпись линии спуска */}
            <text
              x={sideView.startX + sideView.bladeLen * 0.15 - 5}
              y={sideView.edgeY - (sideView.edgeY - sideView.spineY) * (grindHeight / width) - 8}
              fontSize="9"
              fill="var(--color-cad-cyan)"
              className="cursor-help"
            >
              <title>{DICTIONARY.grindLine}</title>
              Grind Line
            </text>

            {/* Маркер позиции */}
            <line
              x1={sideView.markerX}
              y1={sideView.spineY - 15}
              x2={sideView.markerX}
              y2={sideView.edgeY + 15}
              stroke="var(--color-cad-red)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              className="marker-pulse"
            />
            <circle
              cx={sideView.markerX}
              cy={sideView.spineY - 18}
              r="4"
              fill="var(--color-cad-red)"
              className="marker-pulse"
            />
            <text
              x={sideView.markerX}
              y={sideView.spineY - 26}
              fontSize="9"
              fill="var(--color-cad-red)"
              textAnchor="middle"
            >
              {positionX}%
            </text>

            {/* Разметка рикассо */}
            <line
              x1={sideView.ricassoX}
              y1={sideView.spineY - 10}
              x2={sideView.ricassoX}
              y2={sideView.edgeY + 10}
              stroke="var(--color-cad-yellow)"
              strokeWidth="0.8"
              strokeDasharray="3 3"
              opacity={0.5}
            >
              <title>{DICTIONARY.ricasso}</title>
            </line>
            <text
              x={sideView.ricassoX + 4}
              y={sideView.spineY - 4}
              fontSize="9"
              fill="var(--color-cad-yellow)"
              opacity={0.8}
            >
              Рикассо
            </text>

            {/* Dimensional Lines (Размерные линии) */}
            <g className="dimension-group" opacity={0.7}>
              {/* Full Length (привязана к реальному положению острия) */}
              <line x1={sideView.startX} y1={sideView.edgeY + 30} x2={shapePoints.tipX} y2={sideView.edgeY + 30} stroke="var(--color-cad-text-dim)" strokeWidth="1" />
              <line x1={sideView.startX} y1={sideView.edgeY + 25} x2={sideView.startX} y2={sideView.edgeY + 35} stroke="var(--color-cad-text-dim)" strokeWidth="1" />
              <line x1={shapePoints.tipX} y1={sideView.edgeY + 25} x2={shapePoints.tipX} y2={sideView.edgeY + 35} stroke="var(--color-cad-text-dim)" strokeWidth="1" />
              <text x={sideView.startX + (shapePoints.tipX - sideView.startX) / 2} y={sideView.edgeY + 25} fontSize="10" fill="var(--color-cad-text)" textAnchor="middle" fontWeight="bold">
                {((shapePoints.tipX - sideView.startX) / sideView.bladeLen * bladeLength).toFixed(1)} мм
              </text>
              
              {/* Ricasso Length */}
              <line x1={sideView.startX} y1={sideView.edgeY + 15} x2={sideView.ricassoX} y2={sideView.edgeY + 15} stroke="var(--color-cad-yellow)" strokeWidth="0.8" />
              <line x1={sideView.ricassoX} y1={sideView.edgeY + 12} x2={sideView.ricassoX} y2={sideView.edgeY + 18} stroke="var(--color-cad-yellow)" strokeWidth="0.8" />
              <text x={sideView.startX + (sideView.ricassoX - sideView.startX) / 2} y={sideView.edgeY + 11} fontSize="8" fill="var(--color-cad-yellow)" textAnchor="middle">
                {((sideView.ricassoX - sideView.startX) / sideView.bladeLen * bladeLength).toFixed(1)} мм
              </text>
            </g>

            {/* Вспомогательные линии (Guides) для сплайнов */}
            <path
              d={`M ${shapePoints.spineDropX} ${sideView.spineY} L ${shapePoints.spineCpX} ${shapePoints.spineCpY} L ${shapePoints.tipX} ${shapePoints.tipY}`}
              stroke="var(--color-cad-yellow)"
              strokeWidth="0.8"
              fill="none"
              strokeDasharray="4 4"
              opacity={0.6}
            />
            <path
              d={`M ${shapePoints.bellyStartX} ${sideView.edgeY} L ${shapePoints.bellyCpX} ${shapePoints.bellyCpY} L ${shapePoints.tipX} ${shapePoints.tipY}`}
              stroke="var(--color-cad-yellow)"
              strokeWidth="0.8"
              fill="none"
              strokeDasharray="4 4"
              opacity={0.6}
            />

            {/* Интерактивные узлы-маркеры Безье */}
            {renderHandle('ricassoX', shapePoints.ricassoX, sideView.edgeY, 'var(--color-cad-yellow)')}
            {renderHandle('spineDropX', shapePoints.spineDropX, sideView.spineY, 'var(--color-cad-accent)')}
            {renderHandle('spineCp', shapePoints.spineCpX, shapePoints.spineCpY, 'var(--color-cad-orange)')}
            {renderHandle('tip', shapePoints.tipX, shapePoints.tipY, 'var(--color-cad-red)')}
            {renderHandle('bellyCp', shapePoints.bellyCpX, shapePoints.bellyCpY, 'var(--color-cad-orange)')}
            {renderHandle('bellyStartX', shapePoints.bellyStartX, sideView.edgeY, 'var(--color-cad-accent)')}
          </svg>
        </div>

        {/* Вид с торца (сечение) */}
        <div className="w-full flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-cad-accent" />
            <h3 className="text-sm font-semibold text-cad-text">Вид с торца · Сечение</h3>
            <span className="text-xs text-cad-text-dim">({GRIND_TYPES.find(t => t.value === grindType)?.label})</span>
          </div>
          <svg
            viewBox={`0 0 ${crossSectionW} ${crossSectionH}`}
            className="w-full aspect-[7/8] lg:h-[400px] svg-canvas touch-none"
            preserveAspectRatio="xMidYMid meet"
          >
            <SvgGrid width={crossSectionW} height={crossSectionH} step={25} />

            {/* Осевая линия */}
            <line
              x1={crossSectionW / 2}
              y1={10}
              x2={crossSectionW / 2}
              y2={crossSectionH - 10}
              stroke="var(--color-cad-accent)"
              strokeWidth="0.8"
              strokeDasharray="8 4"
              opacity={0.4}
            />
            <text
              x={crossSectionW / 2 + 6}
              y={20}
              fontSize="9"
              fill="var(--color-cad-accent)"
              opacity={0.5}
            >
              ЦЛ
            </text>

            {/* Контур обуха и стенок */}
            <path
              d={crossSection.outline}
              stroke="var(--color-cad-text)"
              strokeWidth="2"
              fill="none"
            />

            {/* Левый спуск */}
            <path
              d={crossSection.left}
              stroke="var(--color-cad-accent)"
              strokeWidth="2.5"
              fill="none"
              strokeLinejoin="round"
            />

            {/* Правый спуск */}
            <path
              d={crossSection.right}
              stroke="var(--color-cad-accent-2)"
              strokeWidth="2.5"
              fill="none"
              strokeLinejoin="round"
            />

            {/* Заливка сечения */}
            {(() => {
              const tapered2 = applyDistalTaper(positionX, spine, grindHeight, width);
              const cx = crossSectionW / 2;
              const topY = 30;
              const availableH = crossSectionH - 60;
              const scale = Math.min(availableH / width, (crossSectionW - 60) / spine);
              const halfSpine = (tapered2.spine / 2) * scale;
              const halfEdge = (edge / 2) * scale;
              const widthPx = tapered2.width * scale;
              const grindStartY = topY + (tapered2.width - tapered2.grindHeight) * scale;
              const bottomY = topY + widthPx;

              let fillPath: string;

              if (grindType === 'chisel') {
                fillPath = `M ${cx - halfSpine} ${topY} L ${cx + halfSpine} ${topY} L ${cx + halfSpine} ${grindStartY} L ${cx + halfEdge} ${bottomY} L ${cx - halfSpine} ${bottomY} Z`;
              } else {
                fillPath = `
                  M ${cx - halfSpine} ${topY}
                  L ${cx + halfSpine} ${topY}
                  L ${cx + halfSpine} ${grindStartY}
                  ${crossSection.right.replace(/^M\s*[\d.]+\s+[\d.]+/, '')}
                  L ${cx - halfEdge} ${bottomY}
                  ${(() => {
                    // Обратный путь левого спуска
                    if (grindType === 'flat' || grindType === 'scandi') {
                      return `L ${cx - halfSpine} ${grindStartY}`;
                    }
                    return `L ${cx - halfSpine} ${grindStartY}`;
                  })()}
                  Z
                `;
              }

              return (
                <path
                  d={fillPath}
                  fill="var(--color-cad-accent)"
                  opacity={0.07}
                />
              );
            })()}

            {/* Размерные обозначения */}
            <g opacity={0.6}>
              {/* Ширина обуха */}
              {(() => {
                const tapered2 = applyDistalTaper(positionX, spine, grindHeight, width);
                const cx = crossSectionW / 2;
                const availableH = crossSectionH - 60;
                const scale = Math.min(availableH / width, (crossSectionW - 60) / spine);
                const halfSpine = (tapered2.spine / 2) * scale;
                return (
                  <>
                    <line x1={cx - halfSpine} y1={18} x2={cx + halfSpine} y2={18} stroke="var(--color-cad-orange)" strokeWidth="1" markerEnd="url(#arrowR)" markerStart="url(#arrowL)" />
                    <text x={cx} y={14} fontSize="9" fill="var(--color-cad-orange)" textAnchor="middle">
                      {tapered2.spine.toFixed(2)} мм
                    </text>
                  </>
                );
              })()}
            </g>

            {/* Стрелки-маркеры */}
            <defs>
              <marker id="arrowR" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                <path d="M 0 0 L 6 2 L 0 4 Z" fill="var(--color-cad-orange)" />
              </marker>
              <marker id="arrowL" markerWidth="6" markerHeight="4" refX="1" refY="2" orient="auto-start-reverse">
                <path d="M 6 0 L 0 2 L 6 4 Z" fill="var(--color-cad-orange)" />
              </marker>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
}
