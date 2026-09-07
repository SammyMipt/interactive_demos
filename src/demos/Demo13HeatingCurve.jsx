import React, { useRef, useState } from 'react'
import { Stage, Panel, Readout, Slider, SvgFormula, useRaf, num } from '../ui.jsx'

/* Кривая нагревания. Один килограмм воды греется от льда при −20 °C до пара,
   слева видно вещество, справа рисуется график «температура от влитой энергии».

   Вся демка сделана ради одного факта: на двух участках горелка работает,
   а термометр стоит. Поэтому по горизонтали отложена не секунда, а джоуль:
   ширина участка на графике это и есть его цена в энергии. Отсюда главная
   картинка — площадка кипения занимает три четверти графика, а нагрев льда
   съёживается в чёрточку шириной шесть пикселей. Ровно эта диспропорция и
   есть содержание демонстрации, «подровнять» участки значило бы её стереть.

   Состояние вещества не хранится отдельно, а каждый кадр выводится из
   накопленной энергии: доля расплавленного — из положения внутри второй
   площадки, доля испарённого — из четвёртой. Поэтому кнопки перехода по
   этапам работают мгновенно и в обе стороны, ничего досчитывать не нужно. */

const M = 1             // кг
const C_ICE = 2100      // Дж/(кг·°C)
const C_WATER = 4200    // Дж/(кг·°C)
const LAMBDA = 340000   // Дж/кг, плавление
const L_VAP = 2300000   // Дж/кг, парообразование
const T_START = -20     // °C

const E1 = C_ICE * M * 20          //    42 000: лёд дошёл до нуля
const E2 = E1 + LAMBDA * M         //   382 000: лёд расплавился
const E3 = E2 + C_WATER * M * 100  //   802 000: вода дошла до ста
const E4 = E3 + L_VAP * M          // 3 102 000: вода выкипела

const P = 2000          // Вт, мощность горелки
const ACC = 7           // во столько раз ускорено экранное время при ×1
const SPEEDS = [1, 5, 20]

/* Этапы. Числа t0 и t1 — температура в начале и в конце участка, поэтому и
   кривая, и подписи, и кнопки перехода берутся из одной таблицы. */
const STAGES = [
  {
    from: 0, to: E1, t0: T_START, t1: 0, flat: false, name: 'лёд',
    what: 'лёд нагревается', tex: 'Q = cm\\Delta t = 42\\,000'
  },
  {
    from: E1, to: E2, t0: 0, t1: 0, flat: true, name: 'плавление',
    what: 'лёд плавится, температура стоит', tex: 'Q = \\lambda m = 340\\,000'
  },
  {
    from: E2, to: E3, t0: 0, t1: 100, flat: false, name: 'вода',
    what: 'вода нагревается', tex: 'Q = cm\\Delta t = 420\\,000'
  },
  {
    from: E3, to: E4, t0: 100, t1: 100, flat: true, name: 'кипение',
    what: 'вода кипит, температура стоит', tex: 'Q = Lm = 2\\,300\\,000'
  }
]

/* сцена, левая колонка */
const CX = 170
const VES_X = 96
const VES_W = 148
const VES_TOP = 136
const VES_BOT = 296
const IN_X = 105        // крайние положения центров молекул
const IN_R = 235
const IN_TOP = 145
const IN_BOT = 287
const SURF_TOP = 140    // уровень вещества в полном сосуде
const SURF_BOT = 292    // и в пустом
const BURN_TOP = 330
const R = 5
const STEAM = { x0: 62, x1: 278, y0: 46, y1: 122 }

const NX = 7
const NY = 6
const N = NX * NY
const STEP_X = (IN_R - IN_X) / NX
const STEP_Y = (IN_BOT - IN_TOP) / NY

const LIQ_BASE = 46     // px/с при 100 °C
const VAP_RISE = 90     // px/с, подъём молекулы сквозь сосуд
const STEAM_BASE = 40   // px/с в облаке пара

/* график, правая колонка */
const GX0 = 352
const GX1 = 778
const GW = GX1 - GX0
const GY_TOP = 118
const GY_BOT = 358
const T_MIN = -30
const T_MAX = 120

const gx = (e) => GX0 + (e / E4) * GW
const gy = (t) => GY_BOT - ((t - T_MIN) / (T_MAX - T_MIN)) * (GY_BOT - GY_TOP)

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const r1 = (v) => v.toFixed(1)

/* У num() минус выводится дефисом, а на оси и в показаниях нужен настоящий. */
const degC = (v, d = 1) => num(v, d).replace('-', '−')

/* Температура как функция влитой энергии. Именно она, а не таймер, решает,
   что показывает термометр: на двух участках она возвращает константу,
   сколько бы энергии туда ни влили. */
function tempAt(e) {
  if (e < E1) return T_START + e / (C_ICE * M)
  if (e < E2) return 0
  if (e < E3) return (e - E2) / (C_WATER * M)
  return 100
}

function stageAt(e) {
  if (e < E1) return 0
  if (e < E2) return 1
  if (e < E3) return 2
  return 3
}

/* Порядок, в котором молекулы плавятся и улетают. Плавление идёт снизу, от
   горелки, поэтому решётка оседает и последним рассыпается верхний слой —
   лёд и правда плавает. Шум подмешан, чтобы слои не исчезали ровными рядами. */
function ranks(list, key, weight) {
  const idx = list.map((m, i) => i)
  idx.sort((a, b) => weight(list[a]) - weight(list[b]))
  idx.forEach((id, rank) => {
    list[id][key] = rank
  })
}

function makeMolecules() {
  const list = []
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const hx = IN_X + STEP_X * (i + 0.5)
      const hy = IN_TOP + STEP_Y * (j + 0.5)
      const a = Math.random() * Math.PI * 2
      list.push({
        hx,
        hy,
        x: hx,
        y: hy,
        dx: Math.cos(a),
        dy: Math.sin(a),
        k: 0.7 + Math.random() * 0.6,
        ph: Math.random() * Math.PI * 2,
        noise: Math.random(),
        mode: 'ice',
        melt: 0,
        vap: 0
      })
    }
  }
  ranks(list, 'melt', (m) => -m.hy + m.noise * STEP_Y * 1.6)
  ranks(list, 'vap', (m) => m.noise)
  return list
}

function resetBubble(b) {
  b.x = IN_X + 8 + Math.random() * (IN_R - IN_X - 16)
  b.y = IN_BOT - Math.random() * 24
  b.r = 2.4 + Math.random() * 3.2
  b.v = 26 + Math.random() * 34
  return b
}

function makeBubbles() {
  const list = []
  for (let i = 0; i < 9; i++) list.push(resetBubble({}))
  return list
}

function surfaceOf(fVap) {
  return SURF_TOP + fVap * (SURF_BOT - SURF_TOP)
}

/* Один кадр сцены. Состояние каждой молекулы вычисляется из долей fMelt и
   fVap, то есть из энергии: перемотка по этапам сразу даёт верную картинку. */
function stepScene(mols, bubbles, e, dt, clock) {
  const t = tempAt(e)
  const fMelt = clamp01((e - E1) / (E2 - E1))
  const fVap = clamp01((e - E3) / (E4 - E3))
  const surface = surfaceOf(fVap)
  const yTop = Math.min(surface + R, IN_BOT - 1)
  const speed = LIQ_BASE * (0.55 + 0.45 * clamp01(t / 100)) * dt
  const jitter = 0.6 + 1.5 * clamp01((t - T_START) / 20)

  for (const m of mols) {
    const mode = m.vap < fVap * N ? 'vapor' : m.melt < fMelt * N ? 'liquid' : 'ice'

    if (mode !== m.mode) {
      if (mode === 'vapor') {
        const a = (Math.random() - 0.5) * 0.7
        m.dx = Math.sin(a)
        m.dy = -Math.cos(a)
      } else if (mode === 'liquid') {
        // шаг назад по графику: пар сконденсировался, вернуть молекулу в воду
        if (m.mode === 'vapor') {
          m.x = IN_X + Math.random() * (IN_R - IN_X)
          m.y = yTop + Math.random() * (IN_BOT - yTop)
        }
        const a = Math.random() * Math.PI * 2
        m.dx = Math.cos(a)
        m.dy = Math.sin(a)
      }
      m.mode = mode
    }

    if (mode === 'ice') {
      m.x = m.hx + Math.sin(clock * 9 + m.ph) * jitter
      m.y = m.hy + Math.cos(clock * 7.4 + m.ph * 1.7) * jitter
    } else if (mode === 'liquid') {
      const s = speed * m.k
      m.x += m.dx * s
      m.y += m.dy * s
      if (m.x < IN_X) {
        m.x = IN_X
        m.dx = -m.dx
      } else if (m.x > IN_R) {
        m.x = IN_R
        m.dx = -m.dx
      }
      if (m.y < yTop) {
        m.y = yTop
        m.dy = -m.dy
      } else if (m.y > IN_BOT) {
        m.y = IN_BOT
        m.dy = -m.dy
      }
    } else if (m.y > STEAM.y1) {
      // пар ещё поднимается сквозь сосуд и уходит через открытый верх
      m.y -= VAP_RISE * dt
      m.x += m.dx * VAP_RISE * 0.25 * dt
    } else {
      const s = STEAM_BASE * m.k * dt
      m.x += m.dx * s
      m.y += m.dy * s
      if (m.x < STEAM.x0) {
        m.x = STEAM.x0
        m.dx = -m.dx
      } else if (m.x > STEAM.x1) {
        m.x = STEAM.x1
        m.dx = -m.dx
      }
      if (m.y < STEAM.y0) {
        m.y = STEAM.y0
        m.dy = -m.dy
      } else if (m.y > STEAM.y1) {
        m.y = STEAM.y1
        m.dy = -m.dy
      }
    }
  }

  if (e < E3 || e >= E4) return
  for (const b of bubbles) {
    b.y -= b.v * dt
    if (b.y < surface + b.r + 2) resetBubble(b)
  }
}

/* Пламя горелки: та же форма, что в демо 10, чтобы горелка узнавалась. */
function Flame({ cx, phase, t }) {
  const a = Math.sin(t * 8.5 + phase)
  const b = Math.sin(t * 6.2 + phase + 1.4)
  const h = 34 + a * 5
  const w = 11 + b * 1.6
  const tip = cx + a * 2.5
  const outer =
    'M' + r1(cx - w) + ' ' + BURN_TOP +
    'Q' + r1(cx - w * 0.75) + ' ' + r1(BURN_TOP - h * 0.5) + ' ' + r1(tip) + ' ' + r1(BURN_TOP - h) +
    'Q' + r1(cx + w * 0.75) + ' ' + r1(BURN_TOP - h * 0.5) + ' ' + r1(cx + w) + ' ' + BURN_TOP +
    'Z'
  const inner =
    'M' + r1(cx - w * 0.45) + ' ' + BURN_TOP +
    'Q' + r1(cx - w * 0.3) + ' ' + r1(BURN_TOP - h * 0.35) + ' ' + r1((tip + cx) / 2) + ' ' + r1(BURN_TOP - h * 0.55) +
    'Q' + r1(cx + w * 0.3) + ' ' + r1(BURN_TOP - h * 0.35) + ' ' + r1(cx + w * 0.45) + ' ' + BURN_TOP +
    'Z'
  return (
    <g>
      <path d={outer} fill="var(--internal)" opacity="0.5" />
      <path d={inner} fill="var(--internal)" opacity="0.95" />
    </g>
  )
}

function Vessel({ mols, bubbles, e, t, on, clock }) {
  const fVap = clamp01((e - E3) / (E4 - E3))
  const surface = surfaceOf(fVap)
  const boiling = e >= E3 && e < E4  // в пустом сосуде кипеть уже нечему

  /* Цвет молекулы: холодная подложка --potential и горячий слой --kinetic
     поверх неё, прозрачность верхнего и есть «теплеет». Так переход цвета
     остаётся на переменных палитры, без единого хекса в коде. */
  const warmth = (m) =>
    m.mode === 'vapor'
      ? 1
      : m.mode === 'liquid'
        ? 0.12 + 0.88 * clamp01(t / 100)
        : 0.05 + 0.07 * clamp01((t - T_START) / 20)

  return (
    <g>
      {on && [-26, 0, 26].map((dx, i) => <Flame key={dx} cx={CX + dx} phase={i * 2.1} t={clock} />)}
      <rect x={CX - 48} y={BURN_TOP} width="96" height="20" fill="var(--ink-soft)" />
      <rect x={CX - 60} y={BURN_TOP + 22} width="120" height="7" fill="var(--ink)" />

      <rect x={VES_X + 2} y={surface} width={VES_W - 4} height={Math.max(0, VES_BOT - 2 - surface)} fill="var(--grid)" />
      {fVap > 0 && fVap < 1 && (
        <line
          x1={VES_X + 2}
          y1={surface}
          x2={VES_X + VES_W - 2}
          y2={surface}
          stroke="var(--ink-soft)"
          strokeWidth="1.4"
        />
      )}

      {boiling &&
        bubbles.map((b, i) => (
          <circle
            key={i}
            cx={r1(b.x)}
            cy={r1(b.y)}
            r={r1(b.r)}
            fill="none"
            stroke="var(--kinetic)"
            strokeWidth="1.3"
            opacity="0.7"
          />
        ))}

      {mols.map((m, i) => (
        <g key={i}>
          <circle cx={r1(m.x)} cy={r1(m.y)} r={R} fill="var(--potential)" />
          <circle cx={r1(m.x)} cy={r1(m.y)} r={R} fill="var(--kinetic)" opacity={warmth(m).toFixed(2)} />
        </g>
      ))}

      {/* сосуд открыт сверху: пар уходит наружу, а не бьётся о крышку */}
      <path
        d={'M' + VES_X + ' ' + VES_TOP + 'V' + VES_BOT + 'H' + (VES_X + VES_W) + 'V' + VES_TOP}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="2.4"
      />

      {fVap > 0 && (
        <text x="284" y="86" fontSize="12" fontWeight="600" fill="var(--kinetic)" fontFamily="var(--sans)">
          пар
        </text>
      )}
    </g>
  )
}

/* След кривой. Каждый участок обрезается по текущей энергии, поэтому линия
   растёт ровно вслед за точкой; площадки рисуются толще и цветом --total.
   Координата x берётся прямо из энергии, так что ширины участков
   пропорциональны их цене без единого подгоночного коэффициента. */
function Curve({ e }) {
  return (
    <g>
      {STAGES.map((st, i) => {
        if (e <= st.from) return null
        const end = Math.min(e, st.to)
        const tEnd = st.t0 + (st.t1 - st.t0) * ((end - st.from) / (st.to - st.from))
        return (
          <line
            key={i}
            x1={r1(gx(st.from))}
            y1={r1(gy(st.t0))}
            x2={r1(gx(end))}
            y2={r1(gy(tEnd))}
            stroke={st.flat ? 'var(--total)' : 'var(--kinetic)'}
            strokeWidth={st.flat ? 6 : 2.6}
            strokeLinecap="round"
          />
        )
      })}
    </g>
  )
}

function Axes() {
  const yTicks = [-20, 0, 20, 40, 60, 80, 100, 120]
  const xTicks = [0, 500, 1000, 1500, 2000, 2500, 3000]
  return (
    <g>
      <rect
        x={GX0}
        y={GY_TOP}
        width={GW}
        height={GY_BOT - GY_TOP}
        fill="var(--paper-warm)"
        stroke="var(--edge)"
        strokeWidth="1"
      />

      {[0, 100].map((t) => (
        <line
          key={t}
          x1={GX0}
          y1={gy(t)}
          x2={GX1}
          y2={gy(t)}
          stroke="var(--edge)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      ))}

      <line x1={GX0} y1={GY_TOP} x2={GX0} y2={GY_BOT} stroke="var(--ink-soft)" strokeWidth="1.2" />
      <line x1={GX0} y1={GY_BOT} x2={GX1} y2={GY_BOT} stroke="var(--ink-soft)" strokeWidth="1.2" />

      {yTicks.map((t) => (
        <g key={t}>
          <line x1={GX0 - 5} y1={gy(t)} x2={GX0} y2={gy(t)} stroke="var(--ink-soft)" strokeWidth="1.2" />
          <text
            x={GX0 - 9}
            y={gy(t) + 3.5}
            textAnchor="end"
            fontSize="9.5"
            fill="var(--ink-soft)"
            fontFamily="var(--mono)"
          >
            {degC(t, 0)}
          </text>
        </g>
      ))}
      <text x={GX0 - 9} y={GY_TOP - 8} textAnchor="end" fontSize="10.5" fill="var(--ink-soft)" fontFamily="var(--sans)">
        °C
      </text>

      {xTicks.map((k) => (
        <g key={k}>
          <line
            x1={gx(k * 1000)}
            y1={GY_BOT}
            x2={gx(k * 1000)}
            y2={GY_BOT + 5}
            stroke="var(--ink-soft)"
            strokeWidth="1.2"
          />
          <text
            x={gx(k * 1000)}
            y={GY_BOT + 17}
            textAnchor="middle"
            fontSize="9.5"
            fill="var(--ink-soft)"
            fontFamily="var(--mono)"
          >
            {k}
          </text>
        </g>
      ))}
      <text x={GX1} y={GY_BOT + 34} textAnchor="end" fontSize="11.5" fill="var(--ink-soft)" fontFamily="var(--sans)">
        влито энергии, кДж
      </text>
    </g>
  )
}

export default function Demo13HeatingCurve() {
  const [si, setSi] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [, force] = useState(0)

  const energy = useRef(0)
  const clock = useRef(0)
  const mols = useRef(null)
  if (mols.current === null) mols.current = makeMolecules()
  const bubbles = useRef(null)
  if (bubbles.current === null) bubbles.current = makeBubbles()

  /* Кадры идут всегда, а энергия растёт только на «Пуске»: на паузе вещество
     не застывает картинкой, но и джоули в него не капают. */
  useRaf((dt) => {
    clock.current += dt
    if (playing) {
      energy.current = Math.min(E4, energy.current + P * ACC * SPEEDS[si] * dt)
      if (energy.current >= E4) setPlaying(false)
    }
    stepScene(mols.current, bubbles.current, energy.current, dt, clock.current)
    force((n) => n + 1)
  }, true)

  function jump(from) {
    energy.current = from
    force((n) => n + 1)
  }

  function reset() {
    energy.current = 0
    setPlaying(false)
    force((n) => n + 1)
  }

  const e = energy.current
  const t = tempAt(e)
  const now = stageAt(e)
  const stage = STAGES[now]
  const fMelt = clamp01((e - E1) / (E2 - E1))
  const fVap = clamp01((e - E3) / (E4 - E3))
  const done = e >= E4
  const share = (st) => ((st.to - st.from) / E4) * 100

  // доля превращения имеет смысл только на площадках
  const part = now === 1 ? fMelt : now === 3 ? fVap : null
  const meltMid = (gx(E1) + gx(E2)) / 2
  const boilMid = (gx(E3) + gx(E4)) / 2

  return (
    <>
      <div className="head">
        <div className="head__eyebrow">Демо 13 · агрегатные состояния</div>
        <h1 className="head__title">Кривая нагревания</h1>
        <p className="head__hint">
          Килограмм льда при −20 °C ставим на горелку и не выключаем её до последней капли.
          По горизонтали отложены не секунды, а джоули, поэтому ширина участка — это его
          цена. Смотри, что вышло: нагрев льда — чёрточка в полтора процента, а кипение
          съедает три четверти всей энергии.
        </p>
        <div className="head__ask">
          <b>Вопрос:</b> горелка работает, энергия идёт — почему на двух участках термометр
          стоит на месте?
        </div>
      </div>

      <Stage>
        <text x={CX} y="28" textAnchor="middle" fontSize="13.5" fontWeight="600" fill="var(--ink)" fontFamily="var(--sans)">
          1 кг · от льда до пара
        </text>

        <Vessel mols={mols.current} bubbles={bubbles.current} e={e} t={t} on={playing && !done} clock={clock.current} />

        <SvgFormula tex={stage.tex} unit="Дж" x={24} y={368} width={292} height={30} size={15} fill="var(--ink)" />

        <text
          x={CX}
          y="416"
          textAnchor="middle"
          fontSize="13"
          fontWeight={stage.flat ? '700' : '400'}
          fill={stage.flat ? 'var(--total)' : 'var(--ink-soft)'}
          fontFamily="var(--sans)"
        >
          {stage.what}
        </text>

        <text x={GX0} y="36" fontSize="12" letterSpacing="1" fill="var(--ink-soft)" fontFamily="var(--sans)">
          ВРЕМЯ УСКОРЕНО В {ACC * SPEEDS[si]} РАЗ
        </text>

        <rect
          x={GX0}
          y="50"
          width={GW}
          height="38"
          fill="var(--paper-warm)"
          stroke={stage.flat ? 'var(--total)' : 'var(--edge)'}
          strokeWidth={stage.flat ? '1.8' : '1'}
        />
        <text
          x={GX0 + GW / 2}
          y="75"
          textAnchor="middle"
          fontSize={stage.flat ? '15.5' : '13'}
          fontWeight={stage.flat ? '700' : '400'}
          fill={stage.flat ? 'var(--total)' : 'var(--ink-soft)'}
          fontFamily="var(--sans)"
        >
          {stage.flat ? 'энергия поступает, а температура стоит' : 'энергия поступает, температура растёт'}
        </text>

        <Axes />
        <Curve e={e} />

        {e >= E1 && (
          <g>
            <line x1={meltMid} y1={gy(0) + 4} x2={meltMid} y2="336" stroke="var(--total)" strokeWidth="1.2" />
            <line x1={meltMid} y1="336" x2={meltMid + 20} y2="336" stroke="var(--total)" strokeWidth="1.2" />
            <text x={meltMid + 26} y="340" fontSize="11.5" fontWeight="600" fill="var(--total)" fontFamily="var(--sans)">
              расплавлено {num(fMelt * 100, 0)} % · плавление стоит {num(share(STAGES[1]), 1)} % всей энергии
            </text>
          </g>
        )}

        {e >= E3 && (
          <text
            x={boilMid}
            y={gy(100) + 22}
            textAnchor="middle"
            fontSize="11.5"
            fontWeight="600"
            fill="var(--total)"
            fontFamily="var(--sans)"
          >
            испарено {num(fVap * 100, 0)} % · кипение стоит {num(share(STAGES[3]), 1)} % всей энергии
          </text>
        )}

        <g>
          <line
            x1={r1(gx(e))}
            y1={r1(gy(t))}
            x2={r1(gx(e))}
            y2={GY_BOT}
            stroke="var(--chrome)"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.5"
          />
          <line
            x1={GX0}
            y1={r1(gy(t))}
            x2={r1(gx(e))}
            y2={r1(gy(t))}
            stroke="var(--chrome)"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.5"
          />
          <circle cx={r1(gx(e))} cy={r1(gy(t))} r="6" fill="var(--paper-warm)" />
          <circle cx={r1(gx(e))} cy={r1(gy(t))} r="4.4" fill="var(--chrome)" />
        </g>

        {done && (
          <text
            x={GX0 + GW / 2}
            y={GY_TOP - 12}
            textAnchor="middle"
            fontSize="13"
            fontWeight="700"
            fill="var(--total)"
            fontFamily="var(--mono)"
          >
            вся вода ушла в пар: 3 102 кДж
          </text>
        )}
      </Stage>

      <Panel>
        <Readout label="Температура" value={degC(t, 1)} unit="°C" color="var(--kinetic)" />
        <Readout label="Влито энергии" value={num(e / 1000, 0)} unit="кДж" color="var(--internal)" />
        <Readout label="Состояние" value={stage.name} color="var(--ink-soft)" />
        <Readout
          label="Доля превращения"
          value={part === null ? '—' : num(part * 100, 0)}
          unit={part === null ? '' : '%'}
          color="var(--total)"
        />
      </Panel>

      <div className="controls">
        <Slider
          label="Скорость"
          value={si}
          set={(v) => setSi(Math.round(v))}
          min={0}
          max={2}
          step={1}
          display={'×' + SPEEDS[si]}
          note={'весь путь занимает ' + num(E4 / (P * ACC * SPEEDS[si]), 0) + ' с экранного времени'}
        />

        <div className="btnrow">
          <div className="seg" role="group" aria-label="Перейти к этапу">
            {STAGES.map((st, i) => (
              <button key={st.name} aria-pressed={now === i} onClick={() => jump(st.from)}>
                {i + 1} · {st.name}
              </button>
            ))}
          </div>
        </div>

        <div className="btnrow">
          <button className="btn btn--go" onClick={() => setPlaying(true)} disabled={playing || done}>
            Пуск
          </button>
          <button className="btn" onClick={() => setPlaying(false)} disabled={!playing}>
            Пауза
          </button>
          <button className="btn" onClick={reset}>
            Сброс
          </button>
        </div>
      </div>

      <p className="note">
        Горелка всё время отдаёт одинаковую мощность, а термометр дважды замирает: энергия
        уходит не на разгон молекул, а на <b>разрыв связей между ними</b> — сначала решётки
        льда, потом связей внутри воды. На площадках растёт не температура, а доля
        превращённого вещества, её видно и в сосуде, и в подписи под площадкой. Сравни
        цену участков: чтобы расплавить лёд, нужно столько же энергии, сколько на нагрев
        воды от 0 до 81 °C, а чтобы выкипятить — почти втрое больше, чем на весь путь от
        льда до кипятка. Оттого чайник закипает быстро, а выкипает долго.
      </p>
    </>
  )
}
