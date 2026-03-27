import { useState, useRef, useCallback, useEffect } from 'react';
import { calcHalfAngle } from '../MathEngine';

// @ts-ignore
import DxfParser from 'dxf-parser';

type BlueprintMode = 'idle' | 'calibrate' | 'measure';

interface Point {
  x: number;
  y: number;
}

const DEMO_BLUEPRINTS = [
  {
    name: 'Охотничий Скиннер (Full Tang)',
    paths: [
      // Главный контур: острие (10, 80) -> обух -> рукоять -> тыльник -> выемки под пальцы -> пузико -> острие
      'M 10 90 Q 60 40 160 40 L 250 40 Q 280 40 290 60 Q 300 80 280 100 Q 275 110 260 105 Q 240 100 230 110 Q 220 120 200 110 C 180 100 190 120 170 120 L 150 120 Q 80 150 10 90 Z',
      // Отверстия под пины (x3)
      'M 180 50 A 6 6 0 1 0 192 50 A 6 6 0 1 0 180 50',
      'M 230 50 A 6 6 0 1 0 242 50 A 6 6 0 1 0 230 50',
      // Темляк
      'M 270 70 A 8 8 0 1 0 286 70 A 8 8 0 1 0 270 70'
    ],
    bounds: { minX: 0, minY: 30, w: 310, h: 130 }
  },
  {
    name: 'Шеф-нож (Gyuto) 210mm',
    paths: [
      'M 10 120 Q 150 60 270 60 L 330 60 L 330 130 L 20 180 Q 5 150 10 120 Z',
      'M 290 80 A 4 4 0 1 0 298 80 A 4 4 0 1 0 290 80',
      'M 310 105 A 4 4 0 1 0 318 105 A 4 4 0 1 0 310 105'
    ],
    bounds: { minX: 0, minY: 50, w: 350, h: 140 }
  }
];

export default function BlueprintTab() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [dxfPaths, setDxfPaths] = useState<string[] | null>(null);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [mode, setMode] = useState<BlueprintMode>('idle');
  const [scale, setScale] = useState<number | null>(null); // мм/пиксель

  // Калибровка
  const [calibPoints, setCalibPoints] = useState<Point[]>([]);
  const [calibInput, setCalibInput] = useState('');
  const [showCalibInput, setShowCalibInput] = useState(false);

  // Измерение
  const [measurePoints, setMeasurePoints] = useState<Point[]>([]);
  const [measureResult, setMeasureResult] = useState<{
    bladeWidth: number;
    grindHeight: number;
    halfAngle: number;
    fullAngle: number;
  } | null>(null);

  // Пан/зум 
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1000, h: 700 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const resetBlueprintState = () => {
    setImageSrc(null);
    setDxfPaths(null);
    setScale(null);
    setCalibPoints([]);
    setMeasurePoints([]);
    setMeasureResult(null);
    setMode('idle');
  };

  const loadDemoBlueprint = (index: number) => {
    if (index < 0) return;
    const bp = DEMO_BLUEPRINTS[index];
    resetBlueprintState();
    setDxfPaths(bp.paths);
    const { minX, minY, w, h } = bp.bounds;
    setViewBox({ x: minX, y: minY, w, h });
    setImageSize({ w: Math.round(w), h: Math.round(h) });
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    resetBlueprintState();

    const name = file.name.toLowerCase();
    
    if (name.endsWith('.dxf')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        try {
          const parser = new DxfParser();
          const parsed = parser.parseSync(text);
          parseDxfGeometry(parsed);
        } catch (err) {
          console.error("DXF Parse error", err);
          alert("Ошибка парсинга DXF файла. Убедитесь, что это корректный R12/2000 DXF.");
        }
      };
      reader.readAsText(file);
    } else {
      // Изображения (PNG/JPEG/SVG)
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        setImageSrc(src);
        const img = new Image();
        img.onload = () => {
          setImageSize({ w: img.width, h: img.height });
          setViewBox({ x: 0, y: 0, w: img.width, h: img.height });
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const parseDxfGeometry = (parsed: any) => {
    let paths: string[] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const addPoint = (x: number, y: number) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    };

    if (parsed && parsed.entities) {
      parsed.entities.forEach((ent: any) => {
        // Конвертируем DXF-сущности в SVG <path d="..." />
        // Ось Y в DXF смотрит вверх, в SVG - вниз. Инвертируем Y.
        if (ent.type === 'LINE') {
          const v0 = ent.vertices[0];
          const v1 = ent.vertices[1];
          paths.push(`M ${v0.x} ${-v0.y} L ${v1.x} ${-v1.y}`);
          addPoint(v0.x, -v0.y);
          addPoint(v1.x, -v1.y);
        } else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
          if (ent.vertices && ent.vertices.length > 0) {
            let d = `M ${ent.vertices[0].x} ${-ent.vertices[0].y}`;
            addPoint(ent.vertices[0].x, -ent.vertices[0].y);
            for (let i = 1; i < ent.vertices.length; i++) {
              d += ` L ${ent.vertices[i].x} ${-ent.vertices[i].y}`;
              addPoint(ent.vertices[i].x, -ent.vertices[i].y);
            }
            if (ent.shape || ent.closed) d += ' Z';
            paths.push(d);
          }
        } else if (ent.type === 'ARC' || ent.type === 'CIRCLE') {
          const cx = ent.center.x;
          const cy = -ent.center.y;
          const r = ent.radius;
          addPoint(cx-r, cy-r); 
          addPoint(cx+r, cy+r);
          
          if (ent.type === 'CIRCLE') {
             paths.push(`M ${cx-r} ${cy} A ${r} ${r} 0 1 0 ${cx+r} ${cy} A ${r} ${r} 0 1 0 ${cx-r} ${cy}`);
          } else {
             // Так как Y инвертирован, углы тоже отражаются!
             const startRad = -ent.endAngle;
             const endRad = -ent.startAngle;
             const x1 = cx + r * Math.cos(startRad);
             const y1 = cy + r * Math.sin(startRad);
             const x2 = cx + r * Math.cos(endRad);
             const y2 = cy + r * Math.sin(endRad);
             
             let delta = endRad - startRad;
             if (delta < 0) delta += Math.PI * 2;
             const largeArc = delta > Math.PI ? 1 : 0;
             paths.push(`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`);
          }
        }
      });
    }

    if (minX === Infinity) {
      minX = 0; minY = 0; maxX = 500; maxY = 500;
      paths.push(`M 0 0 L 500 500 M 500 0 L 0 500`);
    }

    const padX = (maxX - minX) * 0.05;
    const padY = (maxY - minY) * 0.05;
    
    setDxfPaths(paths);
    const box = { x: minX - padX, y: minY - padY, w: (maxX - minX) + Math.max(1, padX*2), h: (maxY - minY) + Math.max(1, padY*2) };
    setViewBox(box);
    setImageSize({ w: Math.round(box.w), h: Math.round(box.h) });
  };

  // Пересчёт координат клика в координаты SVG
  const getSvgPoint = useCallback(
    (e: React.MouseEvent<SVGSVGElement>): Point => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const x = viewBox.x + ((e.clientX - rect.left) / rect.width) * viewBox.w;
      const y = viewBox.y + ((e.clientY - rect.top) / rect.height) * viewBox.h;
      return { x, y };
    },
    [viewBox]
  );

  // Расстояние между двумя точками
  const dist = (a: Point, b: Point) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

  // Клик на SVG
  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (isPanning) return;
      const pt = getSvgPoint(e);

      if (mode === 'calibrate') {
        if (calibPoints.length < 2) {
          const next = [...calibPoints, pt];
          setCalibPoints(next);
          if (next.length === 2) {
            setShowCalibInput(true);
          }
        }
      } else if (mode === 'measure') {
        if (measurePoints.length < 3) {
          const next = [...measurePoints, pt];
          setMeasurePoints(next);

          // Когда поставлены 3 точки — считаем
          if (next.length === 3 && scale) {
            const spinePoint = next[0];    // обух
            const grindStart = next[1];    // начало спуска
            const edgePoint = next[2];     // режущая кромка

            const bladeWidthPx = dist(spinePoint, edgePoint);
            const grindHeightPx = dist(grindStart, edgePoint);
            const bladeWidth = bladeWidthPx * scale;
            const grindH = grindHeightPx * scale;

            // Считаем угол (сведение принимаем за 0 для простоты)
            const spineThickness = 4; // допущение: обух 4мм для расчёта
            const ha = calcHalfAngle(spineThickness, 0, grindH);

            setMeasureResult({
              bladeWidth: bladeWidth,
              grindHeight: grindH,
              halfAngle: ha,
              fullAngle: ha * 2,
            });
          }
        }
      }
    },
    [mode, calibPoints, measurePoints, isPanning, getSvgPoint, scale]
  );

  // Подтверждение калибровки
  const confirmCalibration = useCallback(() => {
    const realMM = parseFloat(calibInput);
    if (isNaN(realMM) || realMM <= 0 || calibPoints.length < 2) return;
    const px = dist(calibPoints[0], calibPoints[1]);
    if (px === 0) return;
    setScale(realMM / px);
    setShowCalibInput(false);
    setMode('idle');
  }, [calibInput, calibPoints]);

  // Пан (перетаскивание)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (mode !== 'idle' && mode !== 'measure' && mode !== 'calibrate') return;
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    },
    [mode]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!isPanning) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dx = ((e.clientX - panStart.x) / rect.width) * viewBox.w;
      const dy = ((e.clientY - panStart.y) / rect.height) * viewBox.h;
      setViewBox((prev) => ({ ...prev, x: prev.x - dx, y: prev.y - dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
    },
    [isPanning, panStart, viewBox]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Зум колесом
  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();

      const mouseX = viewBox.x + ((e.clientX - rect.left) / rect.width) * viewBox.w;
      const mouseY = viewBox.y + ((e.clientY - rect.top) / rect.height) * viewBox.h;

      const newW = viewBox.w * factor;
      const newH = viewBox.h * factor;
      const newX = mouseX - ((mouseX - viewBox.x) / viewBox.w) * newW;
      const newY = mouseY - ((mouseY - viewBox.y) / viewBox.h) * newH;

      setViewBox({ x: newX, y: newY, w: newW, h: newH });
    },
    [viewBox]
  );

  // Предотвращаем скролл на wheel
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => e.preventDefault();
    svg.addEventListener('wheel', handler, { passive: false });
    return () => svg.removeEventListener('wheel', handler);
  }, [imageSrc]);

  const POINT_LABELS_CALIB = ['A', 'B'];
  const POINT_LABELS_MEASURE = ['Обух', 'Спуск', 'Кромка'];

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-full fade-in">
      {/* Боковая панель инструментов */}
      <div className="order-2 lg:order-1 lg:w-[320px] shrink-0 bg-cad-surface rounded-xl border border-cad-border p-5 overflow-y-auto">
        <h2 className="text-lg font-semibold text-cad-text mb-1 flex items-center gap-2">
          <span className="text-cad-accent">📐</span> Чертёжная доска
        </h2>
        <p className="text-xs text-cad-text-dim mb-5">Загрузите чертёж и проведите замеры</p>

        {/* Загрузка */}
        <div className="mb-5">
          <label className="flex items-center justify-center gap-2 bg-cad-accent/15 border border-cad-accent/30 rounded-lg px-4 py-3 cursor-pointer hover:bg-cad-accent/25 transition-colors text-sm text-cad-accent">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Загрузить чертёж
            <input
              type="file"
              accept=".dxf, image/svg+xml, image/png, image/jpeg"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Демо-чертежи */}
        <div className="mb-4">
          <label className="text-xs font-medium text-cad-text-dim mb-1.5 block">
            Нет чертежа? Выберите демо (Тест векторов):
          </label>
          <select
            onChange={(e) => loadDemoBlueprint(Number(e.target.value))}
            className="w-full bg-cad-bg border border-cad-border rounded text-sm text-cad-text p-2"
          >
            <option value="-1">-- Загрузить пример --</option>
            {DEMO_BLUEPRINTS.map((bp, i) => (
              <option key={i} value={i}>{bp.name}</option>
            ))}
          </select>
        </div>

        {(imageSrc || dxfPaths) && (
          <>
            <div className="text-xs text-cad-text-dim mb-4">
              Размер: {imageSize.w} × {imageSize.h} px
            </div>

            {/* Режимы */}
            <div className="space-y-2 mb-5">
              <button
                onClick={() => {
                  setMode('calibrate');
                  setCalibPoints([]);
                  setShowCalibInput(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                  mode === 'calibrate'
                    ? 'bg-cad-yellow/15 border-cad-yellow/40 text-cad-yellow'
                    : 'bg-cad-bg border-cad-border text-cad-text-dim hover:border-cad-border-light'
                }`}
              >
                <div className="font-medium flex items-center gap-2">
                  <span>📏</span> Калибровка масштаба
                </div>
                <div className="text-[11px] mt-0.5 opacity-70">
                  Укажите 2 точки и введите реальное расстояние
                </div>
              </button>

              <button
                onClick={() => {
                  setMode('measure');
                  setMeasurePoints([]);
                  setMeasureResult(null);
                }}
                disabled={!scale}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                  mode === 'measure'
                    ? 'bg-cad-cyan/15 border-cad-cyan/40 text-cad-cyan'
                    : scale
                    ? 'bg-cad-bg border-cad-border text-cad-text-dim hover:border-cad-border-light'
                    : 'bg-cad-bg border-cad-border text-cad-text-dim opacity-40 cursor-not-allowed'
                }`}
              >
                <div className="font-medium flex items-center gap-2">
                  <span>🔍</span> Измерение
                </div>
                <div className="text-[11px] mt-0.5 opacity-70">
                  {scale ? 'Укажите 3 точки: обух, начало спуска, кромка' : 'Сначала откалибруйте масштаб'}
                </div>
              </button>
            </div>

            {/* Статус калибровки */}
            {scale !== null && (
              <div className="bg-cad-accent-2/10 border border-cad-accent-2/30 rounded-lg p-3 mb-4">
                <div className="text-xs text-cad-accent-2 font-medium">✓ Масштаб откалиброван</div>
                <div className="text-xs text-cad-text-dim mt-1 font-mono">
                  1 px = {scale.toFixed(4)} мм
                </div>
              </div>
            )}

            {/* Popup ввода расстояния */}
            {showCalibInput && (
              <div className="bg-cad-surface-2 border border-cad-yellow/40 rounded-lg p-4 mb-4">
                <div className="text-sm text-cad-yellow mb-2">
                  Введите реальную длину отрезка A→B (мм):
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={calibInput}
                    onChange={(e) => setCalibInput(e.target.value)}
                    placeholder="например, 100"
                    className="flex-1 bg-cad-bg border border-cad-border rounded px-3 py-1.5 text-sm text-cad-text font-mono focus:outline-none focus:border-cad-yellow"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && confirmCalibration()}
                  />
                  <button
                    onClick={confirmCalibration}
                    className="px-4 py-1.5 bg-cad-yellow/20 border border-cad-yellow/40 rounded text-sm text-cad-yellow hover:bg-cad-yellow/30 transition-colors"
                  >
                    OK
                  </button>
                </div>
                <div className="text-[11px] text-cad-text-dim mt-2 font-mono">
                  Расстояние в px: {calibPoints.length === 2 ? dist(calibPoints[0], calibPoints[1]).toFixed(1) : '—'}
                </div>
              </div>
            )}

            {/* Результат измерения */}
            {measureResult && (
              <div className="bg-cad-bg rounded-xl border border-cad-border p-4">
                <div className="text-xs text-cad-text-dim uppercase tracking-wider mb-3">Результат измерения</div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-cad-text-dim">Ширина клинка</span>
                    <span className="text-sm font-mono text-cad-text">{measureResult.bladeWidth.toFixed(1)} мм</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-cad-text-dim">Высота спуска</span>
                    <span className="text-sm font-mono text-cad-text">{measureResult.grindHeight.toFixed(1)} мм</span>
                  </div>
                  <div className="border-t border-cad-border my-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-cad-text-dim">Половинный угол</span>
                    <span className="text-lg font-mono font-bold text-cad-accent">{measureResult.halfAngle.toFixed(2)}°</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-cad-text-dim">Полный угол</span>
                    <span className="text-lg font-mono font-bold text-cad-accent-2">{measureResult.fullAngle.toFixed(2)}°</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMeasurePoints([]);
                    setMeasureResult(null);
                  }}
                  className="mt-3 w-full px-3 py-1.5 bg-cad-surface border border-cad-border rounded text-xs text-cad-text-dim hover:border-cad-border-light transition-colors"
                >
                  Новое измерение
                </button>
              </div>
            )}

            {/* Подсказка */}
            {mode === 'calibrate' && calibPoints.length < 2 && !showCalibInput && (
              <div className="bg-cad-yellow/5 border border-cad-yellow/20 rounded-lg p-3 text-xs text-cad-yellow/80">
                Кликните на чертёж, чтобы поставить точку {POINT_LABELS_CALIB[calibPoints.length]}
              </div>
            )}

            {mode === 'measure' && measurePoints.length < 3 && (
              <div className="bg-cad-cyan/5 border border-cad-cyan/20 rounded-lg p-3 text-xs text-cad-cyan/80">
                Кликните на: <strong>{POINT_LABELS_MEASURE[measurePoints.length]}</strong>
                <div className="mt-1 opacity-60">
                  ({measurePoints.length + 1} из 3 точек)
                </div>
              </div>
            )}

            {/* Навигация */}
            <div className="mt-4 text-[11px] text-cad-text-dim space-y-1">
              <div>🖱 <span className="opacity-60">Alt+ЛКМ</span> — панорамирование</div>
              <div>🖱 <span className="opacity-60">Колесо</span> — масштаб</div>
            </div>
          </>
        )}
      </div>

      {/* SVG холст */}
      <div className="order-1 lg:order-2 flex-1 min-w-0 min-h-[400px] lg:min-h-[500px]">
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          className="w-full h-full svg-canvas cursor-crosshair touch-none"
          preserveAspectRatio="xMidYMid meet"
          onClick={handleSvgClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Пустое состояние */}
          {!imageSrc && !dxfPaths && (
            <g>
              <rect x="0" y="0" width="1000" height="700" fill="var(--color-cad-surface)" />
              {/* Сетка */}
              {Array.from({ length: 41 }).map((_, i) => (
                <line key={`gv${i}`} x1={i * 25} y1={0} x2={i * 25} y2={700} stroke="var(--color-cad-grid)" strokeWidth="0.5" />
              ))}
              {Array.from({ length: 29 }).map((_, i) => (
                <line key={`gh${i}`} x1={0} y1={i * 25} x2={1000} y2={i * 25} stroke="var(--color-cad-grid)" strokeWidth="0.5" />
              ))}
              <text x="500" y="330" textAnchor="middle" fontSize="18" fill="var(--color-cad-text-dim)" opacity={0.4}>
                Загрузите DXF, SVG, PNG для чертежа
              </text>
              <text x="500" y="360" textAnchor="middle" fontSize="13" fill="var(--color-cad-text-dim)" opacity={0.25}>
                Или выберите Demo DXF/SVG из списка слева
              </text>
            </g>
          )}

          {/* Растровый Чертёж */}
          {imageSrc && (
            <image href={imageSrc} x={0} y={0} width={imageSize.w} height={imageSize.h} />
          )}

          {/* Векторный Чертёж (DXF) */}
          {dxfPaths && (
            <g id="dxf-layer" stroke="var(--color-cad-cyan)" strokeWidth={viewBox.w * 0.0015} fill="none">
              {dxfPaths.map((d, i) => (
                <path key={`dxf_${i}`} d={d} />
              ))}
            </g>
          )}

          {/* Точки и линия калибровки */}
          {calibPoints.map((pt, i) => (
            <g key={`cp${i}`}>
              <circle cx={pt.x} cy={pt.y} r={viewBox.w * 0.006} fill="none" stroke="#f0883e" strokeWidth={viewBox.w * 0.002} />
              <circle cx={pt.x} cy={pt.y} r={viewBox.w * 0.002} fill="#f0883e" />
              <text
                x={pt.x + viewBox.w * 0.01}
                y={pt.y - viewBox.w * 0.01}
                fontSize={viewBox.w * 0.015}
                fill="#f0883e"
                fontWeight="bold"
              >
                {POINT_LABELS_CALIB[i]}
              </text>
            </g>
          ))}
          {calibPoints.length === 2 && (
            <line
              x1={calibPoints[0].x}
              y1={calibPoints[0].y}
              x2={calibPoints[1].x}
              y2={calibPoints[1].y}
              stroke="#f0883e"
              strokeWidth={viewBox.w * 0.002}
              strokeDasharray={`${viewBox.w * 0.008} ${viewBox.w * 0.004}`}
            />
          )}

          {/* Точки и линии измерения */}
          {measurePoints.map((pt, i) => (
            <g key={`mp${i}`}>
              <circle cx={pt.x} cy={pt.y} r={viewBox.w * 0.006} fill="none" stroke="#39d2c0" strokeWidth={viewBox.w * 0.002} />
              <circle cx={pt.x} cy={pt.y} r={viewBox.w * 0.002} fill="#39d2c0" />
              <text
                x={pt.x + viewBox.w * 0.01}
                y={pt.y - viewBox.w * 0.01}
                fontSize={viewBox.w * 0.013}
                fill="#39d2c0"
                fontWeight="bold"
              >
                {POINT_LABELS_MEASURE[i]}
              </text>
            </g>
          ))}
          {measurePoints.length >= 2 && (
            <>
              {/* Линия обух → спуск */}
              <line
                x1={measurePoints[0].x}
                y1={measurePoints[0].y}
                x2={measurePoints[1].x}
                y2={measurePoints[1].y}
                stroke="#39d2c0"
                strokeWidth={viewBox.w * 0.0015}
                strokeDasharray={`${viewBox.w * 0.006} ${viewBox.w * 0.003}`}
              />
            </>
          )}
          {measurePoints.length === 3 && (
            <>
              {/* Линия спуск → кромка */}
              <line
                x1={measurePoints[1].x}
                y1={measurePoints[1].y}
                x2={measurePoints[2].x}
                y2={measurePoints[2].y}
                stroke="#58a6ff"
                strokeWidth={viewBox.w * 0.0015}
                strokeDasharray={`${viewBox.w * 0.006} ${viewBox.w * 0.003}`}
              />
              {/* Линия обух → кромка */}
              <line
                x1={measurePoints[0].x}
                y1={measurePoints[0].y}
                x2={measurePoints[2].x}
                y2={measurePoints[2].y}
                stroke="#3fb950"
                strokeWidth={viewBox.w * 0.001}
                strokeDasharray={`${viewBox.w * 0.004} ${viewBox.w * 0.004}`}
                opacity={0.5}
              />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
