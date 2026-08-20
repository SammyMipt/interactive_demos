import React, { useRef, useState } from 'react'
import { Stage, Panel, Readout, Slider, SvgFormula, useRaf, num, texNum } from '../ui.jsx'

/* Что труднее нагреть. Две одинаковые горелки, под ними разные вещества и
   разные массы. Гонка показывает, откуда в Q = c·m·Δt берутся все три
   множителя, и что вещество решает: воду нагреть в девять раз труднее
   железа той же массы.

   Нагрев останавливается ровно на 100 °C. Это сделано намеренно: дальше
   начинается кипение, и оно требует энергии уже без роста температуры. */

const P = 3000        // Вт, мощность каждой горелки
const ACC = 15        // ускорение времени: 1 секунда на экране = 15 секунд в реальности
const T_START = 20    // °C
const T_STOP = 100    // °C

const SUBSTANCES = [
  { name: 'Вода', dat: 'воде', c: 4200 },
  { name: 'Алюминий', dat: 'алюминию', c: 920 },
  { name: 'Железо', dat: 'железу', c: 460 },
  { name: 'Свинец', dat: 'свинцу', c: 140 }
]

const CX_L = 200
const CX_R = 560

const VES_W = 144
const VES_TOP = 128
const VES_H = 120
const VES_BOT = VES_TOP + VES_H   // 248

const TH_TOP = 132    // отметка 100 °C
const TH_BOT = 248    // отметка 0 °C
const BURN_TOP = 296  // верх горелки, отсюда растут языки пламени

const r1 = (v) => v.toFixed(1)

/* 336000 -> 336\,000: длинное число в формуле читается только с разрядами. */
function texJ(v) {
  return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\\,')
}

/* Один шаг нагрева одного сосуда. Горелка отдаёт постоянную мощность,
   поэтому за кадр вещество получает P·ACC·dt джоулей, а температура растёт
   как t = 20 + Q/(c·m). Накопленное Q обрезано сверху нужным, поэтому
   температура не может перевалить за 100 °C ни при какой частоте кадров. */
function heatStep(qRef, clockRef, doneRef, need, dt) {
  if (doneRef.current !== null) return
  clockRef.current += dt
  qRef.current = Math.min(need, qRef.current + P * ACC * dt)
  if (qRef.current >= need) doneRef.current = clockRef.current
}

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

function Burner({ cx, on, t }) {
  return (
    <g>
      {on && [-26, 0, 26].map((dx, i) => <Flame key={dx} cx={cx + dx} phase={i * 2.1} t={t} />)}
      <rect x={cx - 48} y={BURN_TOP} width="96" height="20" fill="var(--ink-soft)" />
      <rect x={cx - 60} y={BURN_TOP + 22} width="120" height="7" fill="var(--ink)" />
    </g>
  )
}

function Thermometer({ cx, temp }) {
  const x = cx + 82
  const yFor = (v) => TH_BOT - v * ((TH_BOT - TH_TOP) / 100)
  const top = yFor(temp)
  return (
    <g>
      <rect
        x={x}
        y={TH_TOP - 10}
        width="14"
        height={TH_BOT - TH_TOP + 20}
        rx="7"
        fill="var(--paper-warm)"
        stroke="var(--ink-soft)"
        strokeWidth="1.4"
      />
      <rect x={x + 3} y={top} width="8" height={TH_BOT + 10 - top} fill="var(--internal)" />
      <circle cx={x + 7} cy={TH_BOT + 16} r="9" fill="var(--internal)" stroke="var(--ink-soft)" strokeWidth="1.4" />
      {[0, 20, 40, 60, 80, 100].map((tick) => (
        <g key={tick}>
          <line x1={x + 14} y1={yFor(tick)} x2={x + 19} y2={yFor(tick)} stroke="var(--ink-soft)" strokeWidth="1.2" />
          <text x={x + 23} y={yFor(tick) + 3.5} fontSize="9.5" fill="var(--ink-soft)" fontFamily="var(--mono)">
            {tick}
          </text>
        </g>
      ))}
    </g>
  )
}

function Pot({ cx, sub, mass, temp, spent, need, done, heating, t }) {
  // уровень вещества показывает массу: 3 кг заполняют сосуд почти целиком
  const fillH = (mass / 3) * (VES_H - 14)

  return (
    <g>
      <text x={cx} y={116} textAnchor="middle" fontSize="13.5" fontWeight="600" fill="var(--ink)" fontFamily="var(--sans)">
        {sub.name} · {num(mass, 1)} кг
      </text>

      <Burner cx={cx} on={heating} t={t} />

      <rect x={cx - VES_W / 2} y={VES_BOT - fillH} width={VES_W} height={fillH} fill="var(--grid)" />
      <line
        x1={cx - VES_W / 2}
        y1={VES_BOT - fillH}
        x2={cx + VES_W / 2}
        y2={VES_BOT - fillH}
        stroke="var(--ink-soft)"
        strokeWidth="1.4"
      />
      <rect
        x={cx - VES_W / 2}
        y={VES_TOP}
        width={VES_W}
        height={VES_H}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="2.4"
      />

      <text
        x={cx}
        y={186}
        textAnchor="middle"
        fontSize="26"
        fontWeight="700"
        fontFamily="var(--mono)"
        fill="var(--internal)"
      >
        {num(temp, 1)} °C
      </text>

      {done !== null && (
        <text x={cx} y={212} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--internal)" fontFamily="var(--sans)">
          100 °C за {num(done, 1)} с
        </text>
      )}

      <Thermometer cx={cx} temp={temp} />

      <text x={cx} y={346} textAnchor="middle" fontSize="13" fontFamily="var(--mono)" fill="var(--internal)">
        потрачено {num(spent / 1000, 1)} кДж
      </text>

      <SvgFormula
        tex={'Q = ' + sub.c + ' \\cdot ' + texNum(mass, 1) + ' \\cdot ' + (T_STOP - T_START) + ' = ' + texJ(need)}
        unit="Дж"
        x={cx - 125}
        y={358}
        width={250}
        height={26}
        size={14}
        fill="var(--ink)"
      />
    </g>
  )
}

export default function Demo10Heating() {
  const [iL, setIL] = useState(0) // вода
  const [iR, setIR] = useState(2) // железо
  const [mL, setML] = useState(1)
  const [mR, setMR] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [, force] = useState(0)

  const qL = useRef(0)
  const qR = useRef(0)
  const clockL = useRef(0)
  const clockR = useRef(0)
  const doneL = useRef(null)
  const doneR = useRef(null)
  const flame = useRef(0)

  const subL = SUBSTANCES[iL]
  const subR = SUBSTANCES[iR]
  const needL = subL.c * mL * (T_STOP - T_START)
  const needR = subR.c * mR * (T_STOP - T_START)

  useRaf((dt) => {
    flame.current += dt
    heatStep(qL, clockL, doneL, needL, dt)
    heatStep(qR, clockR, doneR, needR, dt)
    if (doneL.current !== null && doneR.current !== null) setPlaying(false)
    force((n) => n + 1)
  }, playing)

  function reset() {
    qL.current = 0
    qR.current = 0
    clockL.current = 0
    clockR.current = 0
    doneL.current = null
    doneR.current = null
    setPlaying(false)
    force((n) => n + 1)
  }

  /* Смена вещества или массы обнуляет гонку: уже переданные джоули считались
     для другого c·m, и оставлять их означало бы показать температуру, к
     которой сосуд никогда не приходил. */
  function change(setter, value) {
    setter(value)
    reset()
  }

  const tempL = T_START + qL.current / (subL.c * mL)
  const tempR = T_START + qR.current / (subR.c * mR)
  const bothDone = doneL.current !== null && doneR.current !== null

  let compare = null
  if (bothDone) {
    const ratio = qL.current >= qR.current ? qL.current / qR.current : qR.current / qL.current
    if (Math.abs(ratio - 1) < 0.005) {
      compare = 'Обоим сосудам понадобилось поровну энергии'
    } else {
      const big = qL.current >= qR.current ? subL : subR
      const small = qL.current >= qR.current ? subR : subL
      compare =
        big.dat[0].toUpperCase() + big.dat.slice(1) +
        ' понадобилось в ' + num(ratio, 1) + ' раза больше энергии, чем ' + small.dat +
        (mL === mR ? ' той же массы' : '')
    }
  }

  return (
    <>
      <div className="head">
        <div className="head__eyebrow">Демо 10 · количество теплоты</div>
        <h1 className="head__title">Что труднее нагреть</h1>
        <p className="head__hint">
          Две одинаковые горелки, одинаковая мощность, старт одновременный. Меняй вещество
          и массу и смотри, кто первым доберётся до 100 °C. Вода и железо одной массы
          отличаются почти в девять раз, вода и свинец — ровно в тридцать.
        </p>
        <div className="head__ask">
          <b>Вопрос:</b> от чего зависит, сколько энергии придётся потратить на нагрев?
        </div>
      </div>

      <Stage>
        <text x="36" y="52" fontSize="12" letterSpacing="1" fill="var(--ink-soft)" fontFamily="var(--sans)">
          ВРЕМЯ УСКОРЕНО В {ACC} РАЗ
        </text>

        <Pot
          cx={CX_L}
          sub={subL}
          mass={mL}
          temp={tempL}
          spent={qL.current}
          need={needL}
          done={doneL.current}
          heating={playing && doneL.current === null}
          t={flame.current}
        />
        <Pot
          cx={CX_R}
          sub={subR}
          mass={mR}
          temp={tempR}
          spent={qR.current}
          need={needR}
          done={doneR.current}
          heating={playing && doneR.current === null}
          t={flame.current}
        />

        {compare && (
          <text
            x="400"
            y="416"
            textAnchor="middle"
            fontSize="14.5"
            fontWeight="600"
            fill="var(--total)"
            fontFamily="var(--sans)"
          >
            {compare}
          </text>
        )}
      </Stage>

      <Panel>
        <Readout label={'Слева · ' + subL.name} value={num(tempL, 1)} unit="°C" color="var(--internal)" />
        <Readout label="Слева · потрачено" value={num(qL.current / 1000, 1)} unit="кДж" color="var(--chrome)" />
        <Readout label={'Справа · ' + subR.name} value={num(tempR, 1)} unit="°C" color="var(--internal)" />
        <Readout label="Справа · потрачено" value={num(qR.current / 1000, 1)} unit="кДж" color="var(--chrome)" />
      </Panel>

      <div className="controls">
        <Slider
          label="Масса слева"
          value={mL}
          set={(v) => change(setML, v)}
          min={0.5}
          max={3}
          step={0.5}
          display={num(mL, 1) + ' кг'}
          note={'c = ' + subL.c + ' Дж/(кг·°C)'}
        />
        <Slider
          label="Масса справа"
          value={mR}
          set={(v) => change(setMR, v)}
          min={0.5}
          max={3}
          step={0.5}
          display={num(mR, 1) + ' кг'}
          note={'c = ' + subR.c + ' Дж/(кг·°C)'}
        />

        <div className="btnrow">
          <div className="seg" role="group" aria-label="Вещество слева">
            {SUBSTANCES.map((s, i) => (
              <button key={s.name} aria-pressed={iL === i} onClick={() => change(setIL, i)}>
                {s.name}
              </button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Вещество справа">
            {SUBSTANCES.map((s, i) => (
              <button key={s.name} aria-pressed={iR === i} onClick={() => change(setIR, i)}>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div className="btnrow">
          <button className="btn btn--go" onClick={() => setPlaying(true)} disabled={playing || bothDone}>
            Включить нагрев
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
        Три множителя в <b>Q = c · m · Δt</b> видно прямо на стенде: вещество задаёт c,
        ползунок — m, а разница температур здесь всегда 80 градусов. Остановка на 100 °C
        сделана намеренно. То, что происходит дальше, — кипение — разбирается отдельно и
        требует ещё энергии, причём температура при этом расти уже не будет. Смена вещества
        или массы сбрасывает гонку: переданные джоули считались для прежнего c · m.
      </p>
    </>
  )
}
