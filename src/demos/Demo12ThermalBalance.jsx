import React, { useRef, useState } from 'react'
import { Stage, Panel, Readout, Slider, SvgFormula, useRaf, num, texNum } from '../ui.jsx'

/* Тепловой баланс: первая задача, где тел два.

   Показать надо две вещи. Первая: сколько энергии отдало горячее тело,
   ровно столько получило холодное — для этого под сценой две полосы,
   которые обязаны совпадать на каждом кадре, а не только в конце. Вторая:
   общая температура не равна среднему арифметическому, если массы или
   вещества разные. Пресет «вода и вода» даёт 44 °C вместо ожидаемых 50,
   а «свинец и вода» — вовсе 25 °C.

   Обе температуры анимируются одним параметром p, поэтому равенство
   отданного и полученного выполняется тождественно:
   c1·m1·(t1 − θ) = c2·m2·(θ − t2) прямо следует из формулы θ, а умножение
   обеих частей на p равенства не портит. Если полосы разъехались —
   значит сломан код, а не физика. */

const SUBSTANCES = [
  { name: 'Вода', c: 4200, cooled: 'остыла', heated: 'нагрелась' },
  { name: 'Алюминий', c: 920, cooled: 'остыл', heated: 'нагрелся' },
  { name: 'Железо', c: 460, cooled: 'остыло', heated: 'нагрелось' },
  { name: 'Свинец', c: 140, cooled: 'остыл', heated: 'нагрелся' }
]

const PRESETS = [
  { label: 'Вода и вода', a: { i: 0, m: 2, t: 80 }, b: { i: 0, m: 3, t: 20 } },
  { label: 'Свинец и вода', a: { i: 3, m: 2, t: 100 }, b: { i: 0, m: 1, t: 20 } }
]

const DUR = 3 // секунды на выравнивание температур

const BODY_W = 150
const BODY_TOP = 74
const BODY_H = 132
const CX_APART = [300, 500]
const CX_TOUCH = [325, 475]

const TH_TOP = 78  // отметка 100 °C
const TH_BOT = 202 // отметка 0 °C

const BAR_X = 150
const BAR_MAX = 440

const r1 = (v) => v.toFixed(1)

/* 21000 -> «21 000»: длинные джоули читаются только с разрядами. */
function groupJ(v) {
  return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function degrees(v) {
  const n = Math.abs(Math.round(v))
  const a = n % 10
  const b = n % 100
  let word = 'градусов'
  if (a === 1 && b !== 11) word = 'градус'
  else if (a >= 2 && a <= 4 && (b < 10 || b > 20)) word = 'градуса'
  return n + ' ' + word
}

function Thermo({ x, temp, side }) {
  const yFor = (v) => TH_BOT - (v / 100) * (TH_BOT - TH_TOP)
  const top = yFor(temp)
  return (
    <g>
      <rect
        x={x}
        y={TH_TOP - 8}
        width="14"
        height={TH_BOT - TH_TOP + 16}
        rx="7"
        fill="var(--paper-warm)"
        stroke="var(--ink-soft)"
        strokeWidth="1.4"
      />
      <rect x={x + 3} y={top} width="8" height={TH_BOT + 8 - top} fill="var(--internal)" />
      <circle cx={x + 7} cy={TH_BOT + 14} r="9" fill="var(--internal)" stroke="var(--ink-soft)" strokeWidth="1.4" />
      {[0, 25, 50, 75, 100].map((tick) => (
        <g key={tick}>
          <line
            x1={side < 0 ? x - 5 : x + 14}
            y1={yFor(tick)}
            x2={side < 0 ? x : x + 19}
            y2={yFor(tick)}
            stroke="var(--ink-soft)"
            strokeWidth="1.2"
          />
          <text
            x={side < 0 ? x - 9 : x + 23}
            y={yFor(tick) + 3.5}
            textAnchor={side < 0 ? 'end' : 'start'}
            fontSize="9.5"
            fill="var(--ink-soft)"
            fontFamily="var(--mono)"
          >
            {tick}
          </text>
        </g>
      ))}
    </g>
  )
}

function Body({ cx, sub, mass, temp, role, side }) {
  const x = cx - BODY_W / 2
  // цвет тела — интерполяция холодного и горячего: снизу --potential,
  // сверху --kinetic с прозрачностью по температуре
  const hot = Math.max(0, Math.min(1, temp / 100))
  return (
    <g>
      <text x={cx} y="64" textAnchor="middle" fontSize="13.5" fontWeight="600" fill="var(--ink)" fontFamily="var(--sans)">
        {sub.name} · {num(mass, 1)} кг
      </text>

      <rect x={x} y={BODY_TOP} width={BODY_W} height={BODY_H} fill="var(--potential)" />
      <rect x={x} y={BODY_TOP} width={BODY_W} height={BODY_H} fill="var(--kinetic)" opacity={r1(hot)} />
      <rect
        x={x}
        y={BODY_TOP}
        width={BODY_W}
        height={BODY_H}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="2.4"
      />

      <rect x={cx - 62} y="122" width="124" height="46" rx="3" fill="var(--paper-warm)" opacity="0.88" />
      <text x={cx} y="154" textAnchor="middle" fontSize="27" fontWeight="700" fontFamily="var(--mono)" fill="var(--ink)">
        {num(temp, 1)} °C
      </text>

      {role && (
        <text
          x={cx}
          y="226"
          textAnchor="middle"
          fontSize="12.5"
          fontWeight="700"
          fill={role === 'отдаёт' ? 'var(--kinetic)' : 'var(--potential)'}
          fontFamily="var(--sans)"
        >
          {role}
        </text>
      )}

      <Thermo x={side < 0 ? x - 34 : x + BODY_W + 20} temp={temp} side={side} />
    </g>
  )
}

function Bars({ given, received, full }) {
  const len = (q) => (full > 0 ? (q / full) * BAR_MAX : 0)
  const rows = [
    { label: 'Отдано', q: given, color: 'var(--kinetic)', y: 276 },
    { label: 'Получено', q: received, color: 'var(--potential)', y: 310 }
  ]
  return (
    <g>
      <rect x="48" y="240" width="656" height="96" rx="4" fill="none" stroke="var(--total)" strokeWidth="1.8" />
      <text x="62" y="258" fontSize="11.5" fontWeight="700" fill="var(--total)" fontFamily="var(--sans)">
        сколько ушло, столько и пришло
      </text>

      {rows.map((row) => (
        <g key={row.label}>
          <text x="62" y={row.y + 13} fontSize="12" fill="var(--ink-soft)" fontFamily="var(--sans)">
            {row.label}
          </text>
          <rect x={BAR_X} y={row.y} width={BAR_MAX} height="18" fill="var(--paper-warm)" stroke="var(--edge)" strokeWidth="1" />
          <rect x={BAR_X} y={row.y} width={r1(len(row.q))} height="18" fill={row.color} />
          <text x={BAR_X + BAR_MAX + 10} y={row.y + 13} fontSize="12" fontFamily="var(--mono)" fill="var(--ink)">
            {groupJ(row.q)} Дж
          </text>
        </g>
      ))}
    </g>
  )
}

export default function Demo12ThermalBalance() {
  const [iA, setIA] = useState(0)
  const [iB, setIB] = useState(0)
  const [mA, setMA] = useState(2)
  const [mB, setMB] = useState(3)
  const [tA, setTA] = useState(80)
  const [tB, setTB] = useState(20)
  const [contact, setContact] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [, force] = useState(0)

  const s = useRef(0)

  useRaf((dt) => {
    s.current = Math.min(1, s.current + dt / DUR)
    if (s.current >= 1) setPlaying(false)
    force((n) => n + 1)
  }, playing)

  function reset() {
    s.current = 0
    setContact(false)
    setPlaying(false)
    force((n) => n + 1)
  }

  /* Любая правка условий начинает опыт заново: уже перенесённые джоули
     считались для прежних c·m и прежних температур. */
  function change(setter, value) {
    setter(value)
    reset()
  }

  function applyPreset(p) {
    setIA(p.a.i)
    setMA(p.a.m)
    setTA(p.a.t)
    setIB(p.b.i)
    setMB(p.b.m)
    setTB(p.b.t)
    reset()
  }

  const subA = SUBSTANCES[iA]
  const subB = SUBSTANCES[iB]
  const CA = subA.c * mA
  const CB = subB.c * mB
  const theta = (CA * tA + CB * tB) / (CA + CB)

  // замедление к концу, чтобы сближение температур читалось
  const p = contact ? 1 - Math.pow(1 - s.current, 3) : 0
  const TA = tA + (theta - tA) * p
  const TB = tB + (theta - tB) * p

  const equal = Math.abs(tA - tB) < 1e-9
  const aIsHot = tA >= tB
  const hot = aIsHot
    ? { sub: subA, C: CA, t0: tA, T: TA }
    : { sub: subB, C: CB, t0: tB, T: TB }
  const cold = aIsHot
    ? { sub: subB, C: CB, t0: tB, T: TB }
    : { sub: subA, C: CA, t0: tA, T: TA }

  const given = hot.C * (hot.t0 - hot.T)
  const received = cold.C * (cold.T - cold.t0)
  const full = hot.C * Math.abs(hot.t0 - theta)
  const finished = contact && s.current >= 1

  const cx = contact ? CX_TOUCH : CX_APART

  let verdict = null
  if (finished && !equal) {
    const dHot = hot.t0 - theta
    const dCold = theta - cold.t0
    verdict =
      hot.sub.name + ' ' + hot.sub.cooled + ' на ' + degrees(dHot) + ', а ' +
      cold.sub.name.toLowerCase() + ' ' + cold.sub.heated + ' ' +
      (dCold < dHot ? 'всего ' : '') + 'на ' + degrees(dCold)
  }

  return (
    <>
      <div className="head">
        <div className="head__eyebrow">Демо 12 · тепловой баланс</div>
        <h1 className="head__title">Сколько ушло, столько и пришло</h1>
        <p className="head__hint">
          Два тела с разной температурой приводим в контакт. Полосы под сценой растут
          одновременно и всегда одинаковой длины. А общая температура почти никогда не
          равна среднему арифметическому: в пресете «вода и вода» это 44 °C, а не 50.
        </p>
        <div className="head__ask">
          <b>Вопрос:</b> два килограмма кипящего свинца и килограмм воды — на сколько
          градусов нагреется вода?
        </div>
      </div>

      <Stage>
        {contact && !equal && p < 0.999 && (
          <g>
            <text x="400" y="36" textAnchor="middle" fontSize="12" fill="var(--internal)" fontFamily="var(--sans)" fontWeight="600">
              энергия
            </text>
            <line
              x1={aIsHot ? 355 : 445}
              y1="48"
              x2={aIsHot ? 445 : 355}
              y2="48"
              stroke="var(--kinetic)"
              strokeWidth="3"
              markerEnd="url(#arrow)"
            />
          </g>
        )}

        <Body
          cx={cx[0]}
          sub={subA}
          mass={mA}
          temp={TA}
          role={equal ? null : aIsHot ? 'отдаёт' : 'получает'}
          side={-1}
        />
        <Body
          cx={cx[1]}
          sub={subB}
          mass={mB}
          temp={TB}
          role={equal ? null : aIsHot ? 'получает' : 'отдаёт'}
          side={1}
        />

        {equal && (
          <text x="400" y="226" textAnchor="middle" fontSize="12.5" fill="var(--ink-soft)" fontFamily="var(--sans)">
            температуры уже равны, обмена не будет
          </text>
        )}

        <Bars given={given} received={received} full={full} />

        <SvgFormula
          tex={
            hot.sub.c + ' \\cdot ' + texNum(aIsHot ? mA : mB, 1) +
            ' \\cdot (' + texNum(hot.t0, 0) + ' - ' + texNum(hot.T, 1) + ') = ' +
            cold.sub.c + ' \\cdot ' + texNum(aIsHot ? mB : mA, 1) +
            ' \\cdot (' + texNum(cold.T, 1) + ' - ' + texNum(cold.t0, 0) + ')'
          }
          x={70}
          y={346}
          width={660}
          height={28}
          size={14}
          fill="var(--ink)"
        />

        <text x="400" y="394" textAnchor="middle" fontSize="14" fontWeight="700" fontFamily="var(--mono)" fill="var(--total)">
          {groupJ(given)} Дж = {groupJ(received)} Дж
        </text>

        {verdict && (
          <text x="400" y="424" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--total)" fontFamily="var(--sans)">
            {verdict}
          </text>
        )}
      </Stage>

      <Panel>
        <Readout label={'Слева · ' + subA.name} value={num(TA, 1)} unit="°C" color="var(--internal)" />
        <Readout label={'Справа · ' + subB.name} value={num(TB, 1)} unit="°C" color="var(--internal)" />
        <Readout label="Общая температура" value={num(theta, 1)} unit="°C" color="var(--total)" />
        <Readout label="Передано энергии" value={num(given / 1000, 1)} unit="кДж" color="var(--chrome)" />
      </Panel>

      <div className="controls">
        <Slider
          label="Масса слева"
          value={mA}
          set={(v) => change(setMA, v)}
          min={0.5}
          max={5}
          step={0.5}
          display={num(mA, 1) + ' кг'}
          note={'c = ' + subA.c + ' Дж/(кг·°C)'}
        />
        <Slider
          label="Температура слева"
          value={tA}
          set={(v) => change(setTA, v)}
          min={0}
          max={100}
          step={5}
          display={num(tA, 0) + ' °C'}
        />
        <Slider
          label="Масса справа"
          value={mB}
          set={(v) => change(setMB, v)}
          min={0.5}
          max={5}
          step={0.5}
          display={num(mB, 1) + ' кг'}
          note={'c = ' + subB.c + ' Дж/(кг·°C)'}
        />
        <Slider
          label="Температура справа"
          value={tB}
          set={(v) => change(setTB, v)}
          min={0}
          max={100}
          step={5}
          display={num(tB, 0) + ' °C'}
        />

        <div className="btnrow">
          <div className="seg" role="group" aria-label="Вещество слева">
            {SUBSTANCES.map((sub, i) => (
              <button key={sub.name} aria-pressed={iA === i} onClick={() => change(setIA, i)}>
                {sub.name}
              </button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Вещество справа">
            {SUBSTANCES.map((sub, i) => (
              <button key={sub.name} aria-pressed={iB === i} onClick={() => change(setIB, i)}>
                {sub.name}
              </button>
            ))}
          </div>
        </div>

        <div className="btnrow">
          {PRESETS.map((preset) => (
            <button key={preset.label} className="btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
          <button
            className="btn btn--go"
            onClick={() => {
              s.current = 0
              setContact(true)
              setPlaying(true)
            }}
            disabled={equal || contact}
          >
            Привести в контакт
          </button>
          <button className="btn" onClick={reset}>
            Сброс
          </button>
        </div>
      </div>

      <p className="note">
        Уравнение теплового баланса — это закон сохранения энергии для двух тел:
        <b> отданное равно полученному</b>. Общая температура делит разницу не пополам, а в
        отношении c · m, поэтому вода почти всегда перетягивает на себя. Плавление и кипение
        здесь не моделируются, температуры ограничены диапазоном 0–100 °C: это тема
        следующего занятия.
      </p>
    </>
  )
}
