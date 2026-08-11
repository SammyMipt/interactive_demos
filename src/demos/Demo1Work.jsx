import React, { useRef, useState } from 'react'
import { Stage, Panel, Readout, Slider, Formula, num, G } from '../ui.jsx'

/* Работа = сила x перемещение.
   Коробку тащит сам ученик мышкой. Ползунок задаёт массу.
   Пока сила тяги меньше силы трения покоя, коробка стоит:
   сила есть, перемещения нет, работа остаётся нулевой.      */

const MU = 0.4            // коэффициент трения
const F_MAX = 600         // предел силы человека, Н
const K = 900             // жёсткость верёвки, Н на метр растяжения
const M_PER_PX = 0.01     // масштаб сцены: 1 px = 1 см
const X0 = 90             // стартовая позиция коробки, px
const X_MAX = 700
const FLOOR = 330

export default function Demo1Work() {
  const [mass, setMass] = useState(40)
  const [boxX, setBoxX] = useState(X0)
  const [pointerX, setPointerX] = useState(null)
  const [work, setWork] = useState(0)
  const svgRef = useRef(null)

  const fNeeded = MU * mass * G                 // сила трения покоя
  const stuck = fNeeded > F_MAX                 // сдвинуть невозможно

  // сила, которую ученик реально прикладывает верёвкой
  const stretch = pointerX == null ? 0 : Math.max(0, pointerX - boxX - 46)
  const fApplied = pointerX == null ? 0 : Math.min(K * stretch * M_PER_PX, F_MAX)

  const distance = (boxX - X0) * M_PER_PX

  function toSceneX(e) {
    const svg = svgRef.current
    if (!svg) return null
    const r = svg.getBoundingClientRect()
    const cx = e.touches ? e.touches[0].clientX : e.clientX
    return ((cx - r.left) / r.width) * 800
  }

  function onGrab(e) {
    const px = toSceneX(e)
    if (px == null) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setPointerX(px)
  }

  function onMove(e) {
    if (e.buttons !== 1) return // тянем только при зажатой кнопке
    const px = toSceneX(e)
    if (px == null) return
    setPointerX(px)

    // тянем квазистатически: верёвка остаётся натянутой ровно до порога
    const f = Math.min(K * Math.max(0, px - boxX - 46) * M_PER_PX, F_MAX)
    if (f >= fNeeded && !stuck) {
      const target = Math.min(px - 46 - fNeeded / K / M_PER_PX, X_MAX)
      if (target > boxX) {
        const dx = target - boxX
        setWork((w) => w + fNeeded * dx * M_PER_PX)
        setBoxX(target)
      }
    }
  }

  function reset() {
    setBoxX(X0)
    setWork(0)
    setPointerX(null)
  }

  const handX = pointerX == null ? boxX + 46 : Math.max(pointerX, boxX + 46)
  const boxW = 92
  const boxH = 78

  return (
    <>
      <div className="head">
        <div className="head__eyebrow">Демо 1</div>
        <h1 className="head__title">Работа равна сила на перемещение</h1>
        <p className="head__hint">
          Возьмись мышкой за верёвку и тащи коробку вправо. Ползунок меняет её массу.
          Сделай коробку тяжёлой и попробуй снова: тянуть будешь изо всех сил, а счётчик работы
          останется на нуле.
        </p>
        <div className="head__ask">
          <b>Вопрос:</b> сила огромная, ты устал, а работа ноль. Почему?
        </div>
      </div>

      <Stage>
        <svg
          ref={svgRef}
          x="0"
          y="0"
          width="800"
          height="450"
          style={{ overflow: 'visible', touchAction: 'none' }}
          onPointerMove={onMove}
          onPointerDown={onGrab}
          onPointerLeave={() => setPointerX(null)}
          onPointerUp={() => setPointerX(null)}
        >
          <rect width="800" height="450" fill="transparent" />

          {/* пол */}
          <line x1="0" y1={FLOOR + boxH} x2="800" y2={FLOOR + boxH} stroke="var(--ink)" strokeWidth="3" />
          {Array.from({ length: 27 }).map((_, i) => (
            <line
              key={i}
              x1={i * 30}
              y1={FLOOR + boxH}
              x2={i * 30 - 12}
              y2={FLOOR + boxH + 13}
              stroke="var(--grid-bold)"
              strokeWidth="2"
            />
          ))}

          {/* отметка старта */}
          <line
            x1={X0}
            y1={FLOOR - 26}
            x2={X0}
            y2={FLOOR + boxH}
            stroke="var(--ink-soft)"
            strokeWidth="1.4"
            strokeDasharray="4 4"
          />
          <text x={X0 - 4} y={FLOOR - 32} textAnchor="middle" fontSize="12" fill="var(--ink-soft)">
            старт
          </text>

          {/* линейка перемещения */}
          {distance > 0.001 && (
            <g>
              <line
                x1={X0}
                y1={FLOOR + boxH + 30}
                x2={boxX}
                y2={FLOOR + boxH + 30}
                stroke="var(--total)"
                strokeWidth="2.4"
              />
              <text
                x={(X0 + boxX) / 2}
                y={FLOOR + boxH + 49}
                textAnchor="middle"
                fontSize="14"
                fontWeight="700"
                fill="var(--total)"
                fontFamily="var(--mono)"
              >
                s = {num(distance, 2)} м
              </text>
            </g>
          )}

          {/* верёвка */}
          <line
            x1={boxX + boxW}
            y1={FLOOR + 28}
            x2={handX + 46}
            y2={FLOOR + 28}
            stroke={stuck && fApplied >= F_MAX ? 'var(--kinetic)' : 'var(--ink)'}
            strokeWidth={fApplied > 1 ? 4 : 2}
          />

          {/* хват */}
          <g transform={`translate(${handX + 46}, ${FLOOR + 28})`}>
            <circle r="15" fill="var(--chrome)" opacity="0.18" />
            <circle r="8" fill="var(--chrome)" />
            <text y="-24" textAnchor="middle" fontSize="12" fill="var(--chrome)" fontWeight="700">
              тяни мышкой
            </text>
          </g>

          {/* коробка; ширина одна, а «тяжесть» показана штриховкой и подписью */}
          <g transform={`translate(${boxX}, ${FLOOR})`}>
            <rect
              width={boxW}
              height={boxH}
              rx="3"
              fill={stuck ? '#EFE2DF' : 'var(--chrome-lt)'}
              stroke={stuck ? 'var(--kinetic)' : 'var(--potential)'}
              strokeWidth="2.5"
            />
            <text
              x={boxW / 2}
              y={boxH / 2 + 2}
              textAnchor="middle"
              fontSize="19"
              fontWeight="700"
              fontFamily="var(--mono)"
              fill={stuck ? 'var(--kinetic)' : 'var(--potential)'}
            >
              {mass}
            </text>
            <text
              x={boxW / 2}
              y={boxH / 2 + 22}
              textAnchor="middle"
              fontSize="12"
              fill="var(--ink-soft)"
            >
              кг
            </text>
          </g>

          {/* шкала силы */}
          <g transform="translate(60, 40)">
            <text fontSize="12" fill="var(--ink-soft)" letterSpacing="1">
              СИЛА ТЯГИ
            </text>
            <rect y="10" width="300" height="22" fill="#fff" stroke="var(--edge)" />
            <rect
              y="10"
              width={Math.max(0, (fApplied / F_MAX) * 300)}
              height="22"
              fill={fApplied >= F_MAX ? 'var(--kinetic)' : 'var(--potential)'}
            />
            {/* порог: сколько нужно, чтобы сдвинуть */}
            {fNeeded <= F_MAX && (
              <g>
                <line
                  x1={(fNeeded / F_MAX) * 300}
                  y1="4"
                  x2={(fNeeded / F_MAX) * 300}
                  y2="38"
                  stroke="var(--total)"
                  strokeWidth="2.4"
                />
                <text
                  x={(fNeeded / F_MAX) * 300}
                  y="52"
                  textAnchor="middle"
                  fontSize="11.5"
                  fill="var(--total)"
                  fontFamily="var(--mono)"
                >
                  нужно {Math.round(fNeeded)} Н
                </text>
              </g>
            )}
            <text x="308" y="27" fontSize="14" fontFamily="var(--mono)" fontWeight="700" fill="var(--ink)">
              {Math.round(fApplied)} Н
            </text>
            <text x="308" y="45" fontSize="11" fill="var(--ink-soft)">
              предел {F_MAX} Н
            </text>
          </g>

          {stuck && (
            <g transform="translate(400, 128)">
              <rect x="-168" y="-19" width="336" height="32" rx="4" fill="#FBE9E7" stroke="var(--kinetic)" />
              <text textAnchor="middle" y="3" fontSize="14.5" fontWeight="700" fill="var(--kinetic)">
                коробка не двигается: работа равна нулю
              </text>
            </g>
          )}
        </svg>
      </Stage>

      <Panel>
        <Readout label="Сила тяги" value={Math.round(fApplied)} unit="Н" color="var(--potential)" />
        <Readout label="Перемещение" value={num(distance, 2)} unit="м" color="var(--total)" />
        <Readout label="Работа" value={num(work, 1)} unit="Дж" color="var(--chrome)" flag={stuck} />
        <Readout label="Нужная сила" value={Math.round(fNeeded)} unit="Н" color="var(--ink-soft)" />
      </Panel>

      <div className="controls">
        <Slider
          label="Масса коробки"
          value={mass}
          set={(v) => {
            setMass(v)
            setPointerX(null)
          }}
          min={10}
          max={300}
          step={5}
          display={`${mass} кг`}
          note={stuck ? 'сдвинуть невозможно: нужная сила больше предела' : 'сдвинуть можно'}
        />
        <div className="btnrow">
          <button className="btn" onClick={reset}>
            Вернуть на старт
          </button>
        </div>
      </div>

      <p className="note">
        Трение покоя равно <Formula tex="0{,}4\,mg" />. При массе больше <b>150 кг</b> нужная сила
        превышает человеческий предел в 600 Н, и коробка остаётся на месте: сила есть,
        перемещения нет, работа нулевая. Это ровно случай со шкафом из задачи З2.
      </p>
    </>
  )
}
