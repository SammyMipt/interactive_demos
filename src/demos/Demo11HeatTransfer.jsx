import React, { useRef, useState } from 'react'
import { Stage, Panel, Readout, useRaf, num } from '../ui.jsx'

/* Три способа передачи тепла в одной сцене, все три идут одновременно —
   так их можно сравнивать глазом, а не по памяти.

   Различающее правило одно: движется ли само вещество, или оно стоит на
   месте, а энергия идёт по цепочке. Сводная таблица внизу — это то, что
   должно остаться в голове после демо.

   Про честность шкалы. Экранные скорости в панели теплопроводности сжаты:
   настоящая разница между медью и деревом примерно в 2700 раз, показать
   её в анимации нельзя. Поэтому рядом всегда висят настоящие λ и прямая
   оговорка, что шкала условная. */

const CONDUCTORS = [
  { name: 'Медь', lambda: 400, speed: 1.0 },
  { name: 'Железо', lambda: 80, speed: 0.45 },
  { name: 'Стекло', lambda: 1, speed: 0.12 },
  { name: 'Дерево', lambda: 0.15, speed: 0.05 }
]

const RATE = 0.6        // доля стержня в секунду при экранной скорости 1,00
const FRONT_END = 1.18  // фронт доходит чуть дальше конца, чтобы конец прогрелся
const SOFT = 0.18       // ширина размытия границы нагрева, в долях стержня

const PAN_X = [16, 275, 534]
const PAN_W = 250
const PAN_TOP = 56
const PAN_H = 230
const PAN_CX = PAN_X.map((x) => x + PAN_W / 2) // 141, 400, 659

/* панель 1 */
const ROD_X0 = 40
const ROD_X1 = 228
const ROD_Y = 150
const ROD_H = 24
const SLICES = 26
const MOLS = 15
const BURN1_TOP = 192

/* панель 2 */
const V2_X0 = 301
const V2_X1 = 499
const V2_TOP = 86
const V2_BOT = 216
const LOOP_TOP = 108
const LOOP_BOT = 194
const LOOP_CX = 400
const LOOP_DX = 77
const LEG_V = LOOP_BOT - LOOP_TOP
const LEG_H = LOOP_DX
const LOOP_LEN = 2 * LEG_V + 2 * LEG_H
const F1 = LEG_V / LOOP_LEN               // подъём по центру
const F2 = F1 + LEG_H / LOOP_LEN          // растекание по верху
const F3 = F2 + LEG_V / LOOP_LEN          // опускание у стенки
const PARCELS = 4                         // на каждую половину петли
const BURN2_TOP = 224

/* панель 3 */
const SUN = { x: PAN_X[2] + 46, y: 150, r: 30 }
const EARTH = { x: PAN_X[2] + 206, y: 150, r: 20 }
const RAY_X0 = SUN.x + SUN.r + 6
const RAY_X1 = EARTH.x - EARTH.r - 6

/* таблица */
const TAB_ROWS = [
  { label: ['Нужно вещество', 'между телами'], cells: ['да', 'да', 'нет'], mark: 2 },
  { label: ['Движется ли', 'само вещество'], cells: ['нет', 'да', 'нет'], mark: 1 }
]

const r1 = (v) => v.toFixed(1)
const clamp01 = (v) => Math.max(0, Math.min(1, v))

/* Насколько прогрето место u (0 — у горелки, 1 — дальний конец). */
function heatAt(front, u) {
  return clamp01((front - u) / SOFT)
}

/* Точка на конвекционной петле. dir = +1 правая половина, −1 левая.
   Заодно возвращает «горячесть»: у дна и на подъёме единица, по верху
   остывает до нуля, вниз идёт уже холодной. */
function loopPoint(u, dir) {
  if (u < F1) return { x: LOOP_CX, y: LOOP_BOT - (u / F1) * LEG_V, hot: 1 }
  if (u < F2) {
    const k = (u - F1) / (F2 - F1)
    return { x: LOOP_CX + dir * k * LEG_H, y: LOOP_TOP, hot: 1 - k }
  }
  if (u < F3) {
    const k = (u - F2) / (F3 - F2)
    return { x: LOOP_CX + dir * LEG_H, y: LOOP_TOP + k * LEG_V, hot: 0 }
  }
  const k = (u - F3) / (1 - F3)
  return { x: LOOP_CX + dir * (1 - k) * LEG_H, y: LOOP_BOT, hot: k }
}

function Flame({ cx, top, phase, t, scale = 1 }) {
  const a = Math.sin(t * 8.5 + phase)
  const b = Math.sin(t * 6.2 + phase + 1.4)
  const h = (26 + a * 4) * scale
  const w = (9 + b * 1.4) * scale
  const tip = cx + a * 2
  const d =
    'M' + r1(cx - w) + ' ' + top +
    'Q' + r1(cx - w * 0.75) + ' ' + r1(top - h * 0.5) + ' ' + r1(tip) + ' ' + r1(top - h) +
    'Q' + r1(cx + w * 0.75) + ' ' + r1(top - h * 0.5) + ' ' + r1(cx + w) + ' ' + top +
    'Z'
  return <path d={d} fill="var(--internal)" opacity="0.85" />
}

function Burner({ cx, top, on, t, width = 74 }) {
  return (
    <g>
      {on && [-20, 0, 20].map((dx, i) => <Flame key={dx} cx={cx + dx} top={top} phase={i * 2.1} t={t} />)}
      <rect x={cx - width / 2} y={top} width={width} height="14" fill="var(--ink-soft)" />
      <rect x={cx - width / 2 - 9} y={top + 16} width={width + 18} height="6" fill="var(--ink)" />
    </g>
  )
}

/* ---------- панель 1: теплопроводность ---------- */

function Conduction({ front, t, done, cond }) {
  const sliceW = (ROD_X1 - ROD_X0) / SLICES
  const endHeat = heatAt(front, 1)
  const thX = 236
  const thTop = 118
  const thBot = 182

  return (
    <g>
      {/* стержень: холодная основа, поверх неё ползёт горячая заливка */}
      <rect x={ROD_X0} y={ROD_Y} width={ROD_X1 - ROD_X0} height={ROD_H} fill="var(--potential)" opacity="0.75" />
      {Array.from({ length: SLICES }, (_, i) => {
        const u = (i + 0.5) / SLICES
        const h = heatAt(front, u)
        return h <= 0 ? null : (
          <rect
            key={i}
            x={ROD_X0 + i * sliceW}
            y={ROD_Y}
            width={sliceW + 0.6}
            height={ROD_H}
            fill="var(--kinetic)"
            opacity={h}
          />
        )
      })}
      <rect
        x={ROD_X0}
        y={ROD_Y}
        width={ROD_X1 - ROD_X0}
        height={ROD_H}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="2"
      />

      {/* молекулы: колеблются на месте, вдоль стержня не смещаются */}
      {Array.from({ length: MOLS }, (_, i) => {
        const u = (i + 0.5) / MOLS
        const x0 = ROD_X0 + u * (ROD_X1 - ROD_X0)
        const amp = 1.2 + 5 * heatAt(front, u)
        const ph = i * 1.7
        return (
          <circle
            key={i}
            cx={r1(x0 + Math.sin(t * 11 + ph) * amp * 0.55)}
            cy={r1(ROD_Y + ROD_H / 2 + Math.cos(t * 13 + ph) * amp)}
            r="2.6"
            fill="var(--paper-warm)"
            opacity="0.95"
          />
        )
      })}

      <Burner cx={ROD_X0 + 30} top={BURN1_TOP} on t={t} width={62} />

      {/* термометр на дальнем конце */}
      <rect x={thX} y={thTop} width="12" height={thBot - thTop} rx="6" fill="var(--paper-warm)" stroke="var(--ink-soft)" strokeWidth="1.3" />
      <rect
        x={thX + 2.5}
        y={thBot - 2 - endHeat * (thBot - thTop - 5)}
        width="7"
        height={2 + endHeat * (thBot - thTop - 5)}
        fill="var(--internal)"
      />
      <circle cx={thX + 6} cy={thBot + 8} r="7" fill="var(--internal)" stroke="var(--ink-soft)" strokeWidth="1.3" />

      {done !== null && (
        <text x={PAN_CX[0]} y="118" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--internal)" fontFamily="var(--sans)">
          дошло за {num(done, 1)} с
        </text>
      )}

      <text x={PAN_CX[0]} y="278" textAnchor="middle" fontSize="11.5" fontFamily="var(--mono)" fill="var(--internal)">
        {cond.name}, λ = {num(cond.lambda, cond.lambda < 10 ? 2 : 0)} Вт/(м·К)
      </text>
    </g>
  )
}

/* ---------- панель 2: конвекция ---------- */

function Convection({ t }) {
  const guide = (dir) => {
    const p = [
      [LOOP_CX, LOOP_BOT],
      [LOOP_CX, LOOP_TOP],
      [LOOP_CX + dir * LEG_H, LOOP_TOP],
      [LOOP_CX + dir * LEG_H, LOOP_BOT]
    ]
    return 'M' + p.map((q) => q[0] + ' ' + q[1]).join('L') + 'Z'
  }

  const parcels = []
  for (const dir of [1, -1]) {
    for (let i = 0; i < PARCELS; i++) {
      const u = ((t * 0.28 + i / PARCELS) % 1 + 1) % 1
      parcels.push({ key: dir + '-' + i, ...loopPoint(u, dir) })
    }
  }

  return (
    <g>
      <rect x={V2_X0} y={V2_TOP} width={V2_X1 - V2_X0} height={V2_BOT - V2_TOP} fill="var(--paper-warm)" />
      <rect
        x={V2_X0}
        y={V2_TOP}
        width={V2_X1 - V2_X0}
        height={V2_BOT - V2_TOP}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="2.4"
      />

      {[1, -1].map((dir) => (
        <path key={dir} d={guide(dir)} fill="none" stroke="var(--edge)" strokeWidth="1.2" strokeDasharray="4 4" />
      ))}

      {/* стрелки направления: вверх по центру, вниз у стенок */}
      <line x1={LOOP_CX} y1={LOOP_BOT - 24} x2={LOOP_CX} y2={LOOP_BOT - 52} stroke="var(--kinetic)" strokeWidth="2.4" markerEnd="url(#arrow)" />
      <line x1={LOOP_CX + LEG_H} y1={LOOP_TOP + 26} x2={LOOP_CX + LEG_H} y2={LOOP_TOP + 54} stroke="var(--kinetic)" strokeWidth="2.4" markerEnd="url(#arrow)" />
      <line x1={LOOP_CX - LEG_H} y1={LOOP_TOP + 26} x2={LOOP_CX - LEG_H} y2={LOOP_TOP + 54} stroke="var(--kinetic)" strokeWidth="2.4" markerEnd="url(#arrow)" />

      {parcels.map((p) => (
        <g key={p.key}>
          <circle cx={r1(p.x)} cy={r1(p.y)} r="8" fill="var(--potential)" />
          <circle cx={r1(p.x)} cy={r1(p.y)} r="8" fill="var(--kinetic)" opacity={r1(p.hot)} />
        </g>
      ))}

      <Burner cx={LOOP_CX} top={BURN2_TOP} on t={t} width={86} />

      <text x={PAN_CX[1]} y="278" textAnchor="middle" fontSize="10.5" fill="var(--ink-soft)" fontFamily="var(--sans)">
        только в жидкостях и газах, в твёрдом теле невозможно
      </text>
    </g>
  )
}

/* ---------- панель 3: излучение ---------- */

function Radiation({ t }) {
  const ray = (dy, phase) => {
    let d = ''
    for (let x = RAY_X0; x <= RAY_X1; x += 4) {
      const y = 150 + dy + 5 * Math.sin((x - RAY_X0) / 8 - t * 5 + phase)
      d += (d ? 'L' : 'M') + r1(x) + ' ' + r1(y)
    }
    return d
  }

  return (
    <g>
      {/* между телами намеренно пусто: ни одной частицы */}
      <text x={(RAY_X0 + RAY_X1) / 2} y="212" textAnchor="middle" fontSize="11.5" letterSpacing="2" fill="var(--ink-soft)" fontFamily="var(--sans)">
        ВАКУУМ
      </text>

      {[-26, 0, 26].map((dy, i) => (
        <path key={dy} d={ray(dy, i * 2.2)} fill="none" stroke="var(--internal)" strokeWidth="2.2" opacity="0.9" />
      ))}

      <circle cx={SUN.x} cy={SUN.y} r={SUN.r} fill="var(--kinetic)" stroke="var(--ink)" strokeWidth="2" />
      <circle cx={EARTH.x} cy={EARTH.y} r={EARTH.r} fill="var(--potential)" stroke="var(--ink)" strokeWidth="2" />

      <text x={SUN.x} y={SUN.y + SUN.r + 18} textAnchor="middle" fontSize="11.5" fill="var(--ink-soft)" fontFamily="var(--sans)">
        горячее тело
      </text>
      <text x={EARTH.x} y={EARTH.y + EARTH.r + 18} textAnchor="middle" fontSize="11.5" fill="var(--ink-soft)" fontFamily="var(--sans)">
        холодное тело
      </text>
    </g>
  )
}

/* ---------- сводная таблица ---------- */

function Summary() {
  return (
    <g>
      {PAN_CX.map((cx, i) => (
        <text
          key={cx}
          x={cx}
          y="306"
          textAnchor="middle"
          fontSize="11.5"
          fontWeight="600"
          fill="var(--ink)"
          fontFamily="var(--sans)"
        >
          {['Теплопроводность', 'Конвекция', 'Излучение'][i]}
        </text>
      ))}
      <line x1="16" y1="312" x2="784" y2="312" stroke="var(--edge)" strokeWidth="1.2" />

      {TAB_ROWS.map((row, r) => {
        const base = 336 + r * 40
        return (
          <g key={r}>
            {row.label.map((line, k) => (
              <text key={k} x="16" y={base - 6 + k * 13} fontSize="10.5" fill="var(--ink-soft)" fontFamily="var(--sans)">
                {line}
              </text>
            ))}
            {row.cells.map((cell, c) => (
              <g key={c}>
                {row.mark === c && (
                  <rect x={PAN_CX[c] - 28} y={base - 15} width="56" height="22" rx="3" fill="var(--chrome-lt)" />
                )}
                <text
                  x={PAN_CX[c]}
                  y={base}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight={row.mark === c ? '700' : '400'}
                  fill={row.mark === c ? 'var(--chrome)' : 'var(--ink-soft)'}
                  fontFamily="var(--sans)"
                >
                  {cell}
                </text>
              </g>
            ))}
            <line x1="16" y1={base + 16} x2="784" y2={base + 16} stroke="var(--edge)" strokeWidth="1.2" />
          </g>
        )
      })}
    </g>
  )
}

export default function Demo11HeatTransfer() {
  const [ci, setCi] = useState(0) // медь
  const [playing, setPlaying] = useState(true)
  const [, force] = useState(0)

  const front = useRef(0)
  const clock = useRef(0)
  const phase = useRef(0)
  const done = useRef(null)

  const cond = CONDUCTORS[ci]

  useRaf((dt) => {
    phase.current += dt
    if (done.current === null) {
      clock.current += dt
      front.current = Math.min(FRONT_END, front.current + RATE * cond.speed * dt)
      if (front.current >= FRONT_END) done.current = clock.current
    }
    force((n) => n + 1)
  }, playing)

  function reset() {
    front.current = 0
    clock.current = 0
    phase.current = 0
    done.current = null
    force((n) => n + 1)
  }

  /* Смена материала начинает прогрев заново: прежний фронт набегал с
     другой скоростью, и оставлять его значило бы приписать новому
     материалу чужое время. */
  function pickMaterial(i) {
    setCi(i)
    front.current = 0
    clock.current = 0
    done.current = null
    force((n) => n + 1)
  }

  const timesFaster = cond.lambda / CONDUCTORS[CONDUCTORS.length - 1].lambda

  return (
    <>
      <div className="head">
        <div className="head__eyebrow">Демо 11 · теплопередача</div>
        <h1 className="head__title">Три способа передачи тепла</h1>
        <p className="head__hint">
          Все три идут одновременно, чтобы их можно было сравнить. Слева энергия ползёт по
          неподвижному стержню от соседа к соседу, в центре вода сама поднимается и уносит
          тепло с собой, справа лучи идут через пустоту, где вещества нет вообще. Переключи
          материал стержня и сравни, за сколько тепло доходит до дальнего конца.
        </p>
        <div className="head__ask">
          <b>Вопрос:</b> в каком из трёх способов само вещество никуда не движется?
        </div>
      </div>

      <Stage>
        {PAN_X.map((x) => (
          <rect
            key={x}
            x={x}
            y={PAN_TOP}
            width={PAN_W}
            height={PAN_H}
            fill="none"
            stroke="var(--edge)"
            strokeWidth="1.4"
            rx="4"
          />
        ))}

        <Conduction front={front.current} t={phase.current} done={done.current} cond={cond} />
        <Convection t={phase.current} />
        <Radiation t={phase.current} />

        <text x={PAN_CX[0]} y="250" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)" fontFamily="var(--sans)">
          вещество на месте,
        </text>
        <text x={PAN_CX[0]} y="264" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)" fontFamily="var(--sans)">
          энергия идёт от соседа к соседу
        </text>

        <text x={PAN_CX[1]} y="250" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)" fontFamily="var(--sans)">
          само вещество перемещается
        </text>
        <text x={PAN_CX[1]} y="264" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)" fontFamily="var(--sans)">
          и уносит энергию с собой
        </text>

        <text x={PAN_CX[2]} y="250" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)" fontFamily="var(--sans)">
          среда не нужна,
        </text>
        <text x={PAN_CX[2]} y="264" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)" fontFamily="var(--sans)">
          проходит через пустоту
        </text>

        <Summary />

        <text x="16" y="410" fontSize="10.5" fill="var(--ink-soft)" fontFamily="var(--sans)">
          Скорость на экране условная и сжата, иначе разницу нельзя было бы показать.
        </text>
        <text x="16" y="424" fontSize="10.5" fill="var(--ink-soft)" fontFamily="var(--sans)">
          В действительности медь проводит тепло примерно в 2700 раз лучше дерева.
        </text>
      </Stage>

      <Panel>
        <Readout label="Материал стержня" value={cond.name} color="var(--chrome)" />
        <Readout
          label="Теплопроводность λ"
          value={num(cond.lambda, cond.lambda < 10 ? 2 : 0)}
          unit="Вт/(м·К)"
          color="var(--internal)"
        />
        <Readout
          label="Тепло дошло за"
          value={done.current === null ? '—' : num(done.current, 1)}
          unit="с"
          color="var(--kinetic)"
        />
        <Readout label="В жизни быстрее дерева в" value={num(timesFaster, 0)} unit="раз" color="var(--ink-soft)" />
      </Panel>

      <div className="controls">
        <div className="btnrow">
          <div className="seg" role="group" aria-label="Материал стержня">
            {CONDUCTORS.map((c, i) => (
              <button key={c.name} aria-pressed={ci === i} onClick={() => pickMaterial(i)}>
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="btnrow">
          <button className="btn btn--go" onClick={() => setPlaying((p) => !p)}>
            {playing ? 'Пауза' : 'Продолжить'}
          </button>
          <button className="btn" onClick={reset}>
            Сброс
          </button>
        </div>
      </div>

      <p className="note">
        Различает эти три способа один вопрос: <b>движется ли само вещество</b>. В стержне
        не движется — молекулы только сильнее колеблются на месте и раскачивают соседей, и
        так энергия идёт по цепочке. В воде движется: нагретая порция сама поднимается и
        уносит энергию с собой, поэтому в твёрдом теле конвекции быть не может. А излучению
        вещество между телами не нужно вовсе — иначе солнечное тепло не дошло бы до Земли
        через безвоздушное пространство.
      </p>
    </>
  )
}
