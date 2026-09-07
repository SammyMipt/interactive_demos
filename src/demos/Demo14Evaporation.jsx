import React, { useRef, useState } from 'react'
import { Stage, Panel, Readout, useRaf, num } from '../ui.jsx'

/* Почему испарение охлаждает. Открытый сосуд, шестьдесят молекул, у каждой
   своя скорость. С поверхности уходят только те, кто быстрее порога, —
   и температура падает сама, потому что она и есть средняя кинетическая
   энергия оставшихся.

   Ключевое место кода: температуру нигде не понижают. Её каждый кадр
   пересчитывают по формуле T = 20 · <Ek оставшихся> / <Ek в начале>.
   Убери вылет молекул — и она не сдвинется. Именно поэтому здесь нет
   ни таймера охлаждения, ни коэффициента остывания: любая такая строчка
   превратила бы доказательство в мультфильм.

   Столкновения молекул между собой не моделируются, как и в демо 9. Отсюда
   честное следствие: скорости не перемешиваются, и когда все быстрые ушли,
   испарение само собой прекращается. На занятии это плюс — видно, что
   улететь может только меньшинство, а ветер сдвигает порог и открывает
   дорогу следующим. */

const N = 60
const R = 5

const LEFT = 150
const RIGHT = 570
const LID_Y = 86       // верх сосуда, здесь же рисуется крышка
const SURFACE = 156    // поверхность жидкости
const BOTTOM = 280

const XMIN = LEFT + R
const XMAX = RIGHT - R
const YMIN = SURFACE + R
const YMAX = BOTTOM - R
const SKY = 8          // выше этого молекула считается улетевшей безвозвратно

const BASE = 34        // px/с, масштаб скоростей
const V_ESC = 39       // px/с, порог вылета в открытом сосуде
const WIND_K = 0.8     // ветер уносит пар, и уйти становится легче
const WIND_DX = 90     // px/с, снос улетевших вбок
const WIND_UP = 1.7    // и вверх они уходят быстрее

const T0 = 20          // °C в начале

/* Скорость в усл. ед.: за сто взят порог вылета, поэтому на гистограмме
   видно сразу, кто может улететь, а кто нет. */
const UNIT = 100 / V_ESC
const BINS = 10
const V_MAX = 200      // усл. ед., правый край гистограммы
const HIST_REF = 16    // столбик такой высоты занимает всю рамку

const HX0 = LEFT
const HX1 = RIGHT
const HW = (HX1 - HX0) / BINS
const HY = 390         // основание гистограммы
const HH = 70

const TH_X = 612       // термометр
const TH_TOP = LID_Y   // отметка 25 °C
const TH_BOT = BOTTOM  // отметка 0 °C
const TH_MAX = 25

const MODES = [
  { id: 'open', label: 'Открытый сосуд', note: null },
  { id: 'lid', label: 'Накрыть крышкой', note: 'наступило равновесие' },
  { id: 'wind', label: 'Подуть', note: 'поэтому на ветру мокрому холоднее' }
]

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const r1 = (v) => v.toFixed(1)

/* Скорости раздаём по распределению Максвелла для плоскости: быстрых мало,
   медленных много, и «хвост» справа как раз тот, который испаряется. */
function makeMolecules() {
  const list = []
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2
    const v = BASE * Math.sqrt(-Math.log(1 - Math.random() * 0.999))
    list.push({
      x: XMIN + Math.random() * (XMAX - XMIN),
      y: YMIN + Math.random() * (YMAX - YMIN),
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      v,
      state: 'liquid'
    })
  }
  return list
}

function meanEk(mols) {
  let s = 0
  let n = 0
  for (const m of mols) {
    if (m.state !== 'liquid') continue
    s += m.v * m.v
    n++
  }
  return n > 0 ? s / n : 0
}

function step(mols, mode, dt) {
  const vEsc = mode === 'wind' ? V_ESC * WIND_K : V_ESC

  for (const m of mols) {
    if (m.state === 'gone') continue

    if (m.state === 'liquid') {
      m.x += m.vx * dt
      m.y += m.vy * dt
      if (m.x < XMIN) {
        m.x = XMIN
        m.vx = -m.vx
      } else if (m.x > XMAX) {
        m.x = XMAX
        m.vx = -m.vx
      }
      if (m.y > YMAX) {
        m.y = YMAX
        m.vy = -m.vy
      } else if (m.y < YMIN) {
        // единственная проверка на вылет: вверх и быстрее порога
        if (m.v > vEsc) m.state = 'air'
        else {
          m.y = YMIN
          m.vy = -m.vy
        }
      }
      continue
    }

    // над жидкостью
    const up = mode === 'wind' ? WIND_UP : 1
    m.x += m.vx * dt + (mode === 'wind' ? WIND_DX * dt : 0)
    m.y += m.vy * up * dt

    if (mode === 'lid') {
      if (m.x < XMIN) {
        m.x = XMIN
        m.vx = -m.vx
      } else if (m.x > XMAX) {
        m.x = XMAX
        m.vx = -m.vx
      }
      if (m.y < LID_Y + R) {
        m.y = LID_Y + R
        m.vy = -m.vy
      } else if (m.y > YMIN) {
        // вернулась в жидкость со своей прежней скоростью
        m.state = 'liquid'
      }
    } else if (m.y < SKY || m.x > 800 + R) {
      m.state = 'gone'
    }
  }
}

function Thermometer({ temp }) {
  const yFor = (v) => TH_BOT - clamp01(v / TH_MAX) * (TH_BOT - TH_TOP)
  const top = yFor(temp)
  return (
    <g>
      <rect
        x={TH_X}
        y={TH_TOP - 10}
        width="14"
        height={TH_BOT - TH_TOP + 20}
        rx="7"
        fill="var(--paper-warm)"
        stroke="var(--ink-soft)"
        strokeWidth="1.4"
      />
      <rect x={TH_X + 3} y={top} width="8" height={TH_BOT + 10 - top} fill="var(--internal)" />
      <circle cx={TH_X + 7} cy={TH_BOT + 16} r="9" fill="var(--internal)" stroke="var(--ink-soft)" strokeWidth="1.4" />
      {[0, 5, 10, 15, 20, 25].map((tick) => (
        <g key={tick}>
          <line x1={TH_X + 14} y1={yFor(tick)} x2={TH_X + 19} y2={yFor(tick)} stroke="var(--ink-soft)" strokeWidth="1.2" />
          <text x={TH_X + 23} y={yFor(tick) + 3.5} fontSize="9.5" fill="var(--ink-soft)" fontFamily="var(--mono)">
            {tick}
          </text>
        </g>
      ))}
      {/* отметка, с которой начали: падение видно даже без чисел */}
      <line
        x1={TH_X - 8}
        y1={yFor(T0)}
        x2={TH_X}
        y2={yFor(T0)}
        stroke="var(--ink-soft)"
        strokeWidth="1.2"
        strokeDasharray="3 2"
      />
      <text x={TH_X - 11} y={yFor(T0) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--ink-soft)" fontFamily="var(--sans)">
        было
      </text>
    </g>
  )
}

/* Гистограмма скоростей тех, кто ещё в жидкости. Столбики правее порога
   покрашены как быстрые: именно они и исчезают по ходу опыта. */
function Histogram({ mols, vEsc }) {
  const counts = new Array(BINS).fill(0)
  for (const m of mols) {
    if (m.state !== 'liquid') continue
    const k = Math.min(BINS - 1, Math.floor((m.v * UNIT) / (V_MAX / BINS)))
    counts[k]++
  }
  const gate = (vEsc * UNIT) / V_MAX
  const gateX = HX0 + gate * (HX1 - HX0)

  return (
    <g>
      <rect x={HX0} y={HY - HH} width={HX1 - HX0} height={HH} fill="var(--paper-warm)" stroke="var(--edge)" strokeWidth="1" />
      <rect x={gateX} y={HY - HH} width={HX1 - gateX} height={HH} fill="var(--kinetic)" opacity="0.07" />

      {counts.map((c, i) => {
        const h = Math.min(HH - 2, (c / HIST_REF) * (HH - 2))
        const fast = i * (V_MAX / BINS) >= vEsc * UNIT - 0.001
        return (
          <rect
            key={i}
            x={HX0 + i * HW + 1.5}
            y={HY - h}
            width={HW - 3}
            height={h}
            fill={fast ? 'var(--kinetic)' : 'var(--potential)'}
            opacity="0.85"
          />
        )
      })}

      <line x1={HX0} y1={HY} x2={HX1} y2={HY} stroke="var(--ink-soft)" strokeWidth="1.2" />
      <line x1={gateX} y1={HY - HH - 6} x2={gateX} y2={HY + 5} stroke="var(--kinetic)" strokeWidth="2" />

      {[0, 2, 4, 6, 8, 10].map((i) => (
        <text
          key={i}
          x={HX0 + i * HW}
          y={HY + 15}
          textAnchor="middle"
          fontSize="9.5"
          fill="var(--ink-soft)"
          fontFamily="var(--mono)"
        >
          {i * (V_MAX / BINS)}
        </text>
      ))}
      <text x={HX1} y={HY + 30} textAnchor="end" fontSize="11" fill="var(--ink-soft)" fontFamily="var(--sans)">
        скорость молекулы, усл. ед.
      </text>

      <text x={HX0} y={HY - HH - 10} fontSize="11" fill="var(--ink-soft)" fontFamily="var(--sans)">
        сколько кого осталось
      </text>
      <text x={gateX + 7} y={HY - HH - 10} fontSize="11.5" fontWeight="700" fill="var(--kinetic)" fontFamily="var(--sans)">
        улететь могут только эти
      </text>
    </g>
  )
}

export default function Demo14Evaporation() {
  const [mode, setMode] = useState('open')
  const [, force] = useState(0)

  const mols = useRef(null)
  const ek0 = useRef(1)
  if (mols.current === null) {
    mols.current = makeMolecules()
    ek0.current = meanEk(mols.current)
  }

  const inside = mols.current.filter((m) => m.state === 'liquid')
  const alive = inside.length > 0

  useRaf((dt) => {
    step(mols.current, mode, dt)
    force((n) => n + 1)
  }, alive)

  function reset() {
    mols.current = makeMolecules()
    ek0.current = meanEk(mols.current)
    force((n) => n + 1)
  }

  /* Вот и вся «физика охлаждения»: средняя энергия оставшихся, поделённая
     на начальную. Ни одного слагаемого, которое понижало бы температуру. */
  const temp = alive ? T0 * (meanEk(mols.current) / ek0.current) : 0
  const meanV = alive ? inside.reduce((s, m) => s + m.v, 0) / inside.length : 0
  const vEsc = mode === 'wind' ? V_ESC * WIND_K : V_ESC
  const current = MODES.find((m) => m.id === mode)

  return (
    <>
      <div className="head">
        <div className="head__eyebrow">Демо 14 · испарение</div>
        <h1 className="head__title">Почему испарение охлаждает</h1>
        <p className="head__hint">
          Шестьдесят молекул, у каждой своя скорость. С поверхности уходят только те, кто
          быстрее порога, — остальным не хватает на отрыв. Смотри на термометр и на правый
          край гистограммы: он редеет, и ровно поэтому падает температура.
        </p>
        <div className="head__ask">
          <b>Вопрос:</b> из воды улетают самые быстрые молекулы. Что тогда происходит со
          средней скоростью тех, кто остался?
        </div>
      </div>

      <Stage>
        <text x="24" y="40" fontSize="12" letterSpacing="1" fill="var(--ink-soft)" fontFamily="var(--sans)">
          ЦВЕТ — ЭТО СКОРОСТЬ
        </text>
        <circle cx="32" cy="66" r={R} fill="var(--potential)" />
        <text x="46" y="70" fontSize="11.5" fill="var(--ink-soft)" fontFamily="var(--sans)">
          медленная
        </text>
        <circle cx="32" cy="92" r={R} fill="var(--potential)" />
        <circle cx="32" cy="92" r={R} fill="var(--kinetic)" />
        <text x="46" y="96" fontSize="11.5" fill="var(--ink-soft)" fontFamily="var(--sans)">
          быстрая
        </text>

        <rect x={LEFT} y={LID_Y} width={RIGHT - LEFT} height={BOTTOM - LID_Y} fill="var(--paper-warm)" />
        <rect x={LEFT} y={SURFACE} width={RIGHT - LEFT} height={BOTTOM - SURFACE} fill="var(--grid)" />
        <line x1={LEFT} y1={SURFACE} x2={RIGHT} y2={SURFACE} stroke="var(--ink-soft)" strokeWidth="1.4" />

        {mols.current.map((m, i) =>
          m.state === 'gone' ? null : (
            <g key={i}>
              <circle cx={r1(m.x)} cy={r1(m.y)} r={R} fill="var(--potential)" />
              <circle
                cx={r1(m.x)}
                cy={r1(m.y)}
                r={R}
                fill="var(--kinetic)"
                opacity={clamp01(m.v / (V_ESC * 1.35)).toFixed(2)}
              />
            </g>
          )
        )}

        <path
          d={'M' + LEFT + ' ' + LID_Y + 'V' + BOTTOM + 'H' + RIGHT + 'V' + LID_Y}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="2.4"
        />

        {mode === 'lid' && (
          <line x1={LEFT - 8} y1={LID_Y} x2={RIGHT + 8} y2={LID_Y} stroke="var(--ink)" strokeWidth="4" />
        )}

        {mode === 'wind' && (
          <g>
            {[112, 130].map((y) => (
              <line
                key={y}
                x1="60"
                y1={y}
                x2="138"
                y2={y}
                stroke="var(--chrome)"
                strokeWidth="2.4"
                markerEnd="url(#arrow)"
                opacity="0.75"
              />
            ))}
          </g>
        )}

        <Thermometer temp={temp} />
        <text x="712" y="146" textAnchor="middle" fontSize="11" fill="var(--ink-soft)" fontFamily="var(--sans)">
          температура
        </text>
        <text x="712" y="160" textAnchor="middle" fontSize="11" fill="var(--ink-soft)" fontFamily="var(--sans)">
          жидкости
        </text>
        <text x="712" y="192" textAnchor="middle" fontSize="26" fontWeight="700" fontFamily="var(--mono)" fill="var(--internal)">
          {num(temp, 1)} °C
        </text>
        <text x="712" y="214" textAnchor="middle" fontSize="11.5" fill="var(--ink-soft)" fontFamily="var(--mono)">
          было 20,0 °C
        </text>

        <Histogram mols={mols.current} vEsc={vEsc} />

        <text
          x="360"
          y="442"
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          fill="var(--total)"
          fontFamily="var(--sans)"
        >
          {!alive ? 'жидкость испарилась' : current.note}
        </text>
      </Stage>

      <Panel>
        <Readout label="Температура жидкости" value={num(temp, 1)} unit="°C" color="var(--internal)" />
        <Readout label="Молекул осталось" value={inside.length} unit={'из ' + N} color="var(--potential)" />
        <Readout
          label="Улетело"
          value={N - inside.length}
          unit="шт"
          color="var(--kinetic)"
        />
        <Readout label="Средняя скорость оставшихся" value={num(meanV * UNIT, 0)} unit="усл. ед." color="var(--kinetic)" />
      </Panel>

      <div className="controls">
        <div className="btnrow">
          <div className="seg" role="group" aria-label="Что делаем с сосудом">
            {MODES.map((m) => (
              <button key={m.id} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          <button className="btn" onClick={reset}>
            Сброс
          </button>
        </div>
      </div>

      <p className="note">
        Температуру здесь никто не понижает: она каждый кадр считается как{' '}
        <b>средняя кинетическая энергия оставшихся молекул</b>. Улетают только те, кто
        быстрее порога, — значит средняя по оставшимся падает сама собой. Крышка возвращает
        беглецов обратно, и падение прекращается: сколько молекул улетает, столько же и
        возвращается — это равновесие. Ветер уносит пар от поверхности, вернуться некому,
        и уйти становится легче — порог сдвигается влево, гистограмма съедается дальше,
        мокрому на ветру холоднее. Столкновения молекул друг с другом не моделируются,
        поэтому, когда все быстрые ушли, испарение в закрытой модели прекращается.
      </p>
    </>
  )
}
