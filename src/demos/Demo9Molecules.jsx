import React, { useRef, useState } from 'react'
import { Stage, Panel, Readout, Slider, useRaf, num } from '../ui.jsx'

/* Молекулы и температура. Модель стакана и ведра кипятка: температура одна
   и та же, а энергии в большом сосуде во столько раз больше, во сколько
   там больше молекул.

   Скорость молекул считается от АБСОЛЮТНОЙ температуры, v ~ sqrt(T_K), и
   отсюда два места, ради которых демо и сделано. При −273 °C множитель
   ровно ноль и движение прекращается. А нагрев от комнаты до кипятка
   ускоряет молекулы всего в 1,13 раза: по Цельсию разница выглядит
   огромной, но скорость растёт как корень, и это правда, а не огрубление. */

const T0_K = 273       // ноль Цельсия в Кельвинах
const T_REF = 293      // 20 °C, опорная точка: при ней всё равно единице
const N_LEFT = 10
const N_RIGHT = 50
const BASE = 74        // px/с при 20 °C и единичном личном множителе
const R = 5            // радиус молекулы, px
const TRAIL_DT = 0.05  // как часто запоминаем позицию для следа
const TRAIL_N = 3      // сколько прошлых позиций храним

const BOX_L = { x: 66, y: 152, w: 176, h: 178 }
const BOX_R = { x: 302, y: 96, w: 452, h: 234 }

const PRESETS = [
  { t: -273, label: '−273 °C' },
  { t: 20, label: '20 °C · комната' },
  { t: 100, label: '100 °C · кипяток' },
  { t: 500, label: '500 °C' }
]

/* У num() минус выводится дефисом, а на кнопках пресетов стоит настоящий
   минус. Приводим к одному виду, чтобы −273 везде выглядело одинаково. */
const degC = (v) => num(v, 0).replace('-', '−')

function makeMolecules(box, n) {
  const mols = []
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    mols.push({
      x: box.x + R + 2 + Math.random() * (box.w - 2 * R - 4),
      y: box.y + R + 2 + Math.random() * (box.h - 2 * R - 4),
      dx: Math.cos(a),
      dy: Math.sin(a),
      /* Личный множитель скорости. Он нужен, чтобы можно было честно
         сказать: у каждой молекулы своя скорость, а температура говорит
         только про среднюю. */
      k: 0.6 + Math.random() * 0.8,
      trail: []
    })
  }
  return mols
}

/* Столкновения молекул друг с другом не считаем: нужной мысли они ничего
   не добавляют, хватает отражений от стенок. */
function moveMolecules(mols, box, dist) {
  const minX = box.x + R
  const maxX = box.x + box.w - R
  const minY = box.y + R
  const maxY = box.y + box.h - R
  for (const m of mols) {
    const s = dist * m.k
    m.x += m.dx * s
    m.y += m.dy * s
    if (m.x < minX) {
      m.x = minX
      m.dx = -m.dx
    } else if (m.x > maxX) {
      m.x = maxX
      m.dx = -m.dx
    }
    if (m.y < minY) {
      m.y = minY
      m.dy = -m.dy
    } else if (m.y > maxY) {
      m.y = maxY
      m.dy = -m.dy
    }
  }
}

/* След рисуем не отдельными узлами на каждую молекулу, а тремя путями на
   сосуд, по одному на возраст сегмента. Затухание получается такое же, а
   в разметке остаётся шесть элементов вместо двух сотен, которые иначе
   пришлось бы сверять каждый кадр. */
function trailPaths(mols) {
  const segs = ['', '', '']
  for (const m of mols) {
    const pts = m.trail.concat([{ x: m.x, y: m.y }])
    for (let i = 0; i + 1 < pts.length; i++) {
      const k = segs.length - (pts.length - 1) + i
      if (k >= 0) {
        segs[k] +=
          'M' + pts[i].x.toFixed(1) + ' ' + pts[i].y.toFixed(1) +
          'L' + pts[i + 1].x.toFixed(1) + ' ' + pts[i + 1].y.toFixed(1)
      }
    }
  }
  return segs
}

function Vessel({ box, title, count, energy, mols, factor }) {
  const cx = box.x + box.w / 2
  const segs = trailPaths(mols)

  return (
    <g>
      <text x={box.x} y={box.y - 11} fontSize="12.5" fill="var(--ink-soft)" fontFamily="var(--sans)">
        {title} · {count} молекул
      </text>

      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        fill="var(--paper-warm)"
        stroke="var(--ink)"
        strokeWidth="2.4"
      />

      {segs.map((d, i) =>
        d ? (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="var(--kinetic)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity={(0.14 + i * 0.13) * factor}
          />
        ) : null
      )}

      {mols.map((m, i) => (
        <circle key={i} cx={m.x.toFixed(1)} cy={m.y.toFixed(1)} r={R} fill="var(--kinetic)" opacity="0.9" />
      ))}

      {/* полная энергия сосуда: поверх молекул, чтобы разница читалась всегда */}
      <rect x={cx - 84} y={box.y + 8} width="168" height="48" fill="var(--paper-warm)" opacity="0.88" />
      <text
        x={cx}
        y={box.y + 25}
        textAnchor="middle"
        fontSize="11.5"
        letterSpacing="1"
        fill="var(--ink-soft)"
        fontFamily="var(--sans)"
      >
        ЭНЕРГИЯ В СОСУДЕ
      </text>
      <text
        x={cx}
        y={box.y + 49}
        textAnchor="middle"
        fontSize="23"
        fontWeight="700"
        fontFamily="var(--mono)"
        fill="var(--internal)"
      >
        {num(energy, 1)}
      </text>
    </g>
  )
}

export default function Demo9Molecules() {
  const [tempC, setTempC] = useState(20)
  const [, force] = useState(0)

  const mols = useRef(null)
  if (mols.current === null) {
    mols.current = { left: makeMolecules(BOX_L, N_LEFT), right: makeMolecules(BOX_R, N_RIGHT) }
  }
  const clock = useRef(0)

  /* Ключевое место: скорость идёт от Кельвинов, а не от Цельсия. Иначе при
     нуле и ниже формула разваливается. */
  const tK = Math.max(0, tempC + T0_K)
  const speedFactor = Math.sqrt(tK / T_REF)

  const eOne = tK / T_REF
  const eLeft = N_LEFT * eOne
  const eRight = N_RIGHT * eOne

  useRaf((dt) => {
    const dist = BASE * speedFactor * dt
    moveMolecules(mols.current.left, BOX_L, dist)
    moveMolecules(mols.current.right, BOX_R, dist)

    clock.current += dt
    if (clock.current >= TRAIL_DT) {
      clock.current = 0
      for (const side of [mols.current.left, mols.current.right]) {
        for (const m of side) {
          m.trail.push({ x: m.x, y: m.y })
          if (m.trail.length > TRAIL_N) m.trail.shift()
        }
      }
    }
    force((n) => n + 1)
  }, speedFactor > 0)

  const frozen = tK === 0

  return (
    <>
      <div className="head">
        <div className="head__eyebrow">Демо 9 · внутренняя энергия</div>
        <h1 className="head__title">Температура и запас энергии — разные вещи</h1>
        <p className="head__hint">
          Ползунок греет оба сосуда сразу, температура у них общая. Молекулы разгоняются
          одинаково, но в большом сосуде их в пять раз больше, поэтому и энергии в нём
          столько же раз больше — при любой температуре. Дотяни ползунок до −273 °C:
          движение прекратится совсем.
        </p>
        <div className="head__ask">
          <b>Вопрос:</b> в каком сосуде молекулы быстрее, а в каком энергии больше?
        </div>
      </div>

      <Stage>
        <Vessel
          box={BOX_L}
          title="Маленький сосуд"
          count={N_LEFT}
          energy={eLeft}
          mols={mols.current.left}
          factor={speedFactor}
        />
        <Vessel
          box={BOX_R}
          title="Большой сосуд"
          count={N_RIGHT}
          energy={eRight}
          mols={mols.current.right}
          factor={speedFactor}
        />

        {frozen && (
          <text
            x="400"
            y="362"
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fill="var(--internal)"
            fontFamily="var(--sans)"
          >
            абсолютный ноль: движение прекращается
          </text>
        )}

        <text
          x="400"
          y="394"
          textAnchor="middle"
          fontSize="14.5"
          fontWeight="600"
          fill="var(--total)"
          fontFamily="var(--sans)"
        >
          {frozen
            ? 'При абсолютном нуле энергии нет ни в одном сосуде'
            : 'Температура одинаковая, а энергии в большом сосуде в 5 раз больше'}
        </text>

        {!frozen && (
          <text x="400" y="416" textAnchor="middle" fontSize="13" fill="var(--ink-soft)" fontFamily="var(--mono)">
            {num(eRight, 1)} против {num(eLeft, 1)} усл. ед. при {degC(tempC)} °C
          </text>
        )}
      </Stage>

      <Panel>
        <Readout label="Температура" value={degC(tempC)} unit="°C" color="var(--internal)" />
        <Readout label="По Кельвину" value={num(tK, 0)} unit="K" color="var(--ink-soft)" />
        <Readout label="Средняя энергия одной молекулы" value={num(eOne, 2)} unit="усл. ед." color="var(--kinetic)" />
        <Readout
          label="Полная энергия, малый / большой"
          value={num(eLeft, 1) + ' / ' + num(eRight, 1)}
          unit="усл. ед."
          color="var(--internal)"
        />
      </Panel>

      <div className="controls">
        <Slider
          label="Температура"
          value={tempC}
          set={(v) => setTempC(Math.round(v))}
          min={-273}
          max={500}
          step={1}
          display={degC(tempC) + ' °C'}
          note={
            frozen
              ? 'абсолютный ноль: молекулы стоят'
              : 'скорость молекул ×' + num(speedFactor, 2) + ' от комнатной'
          }
        />
        <div className="btnrow">
          {PRESETS.map((p) => (
            <button key={p.t} className={'btn' + (tempC === p.t ? ' btn--on' : '')} onClick={() => setTempC(p.t)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <p className="note">
        Это модель стакана и ведра кипятка. Температура у них одна, а энергии в ведре во
        столько раз больше, во сколько там больше воды. Значит{' '}
        <b>температура показывает среднюю скорость молекул, а не запас энергии</b>: запас
        зависит ещё и от того, сколько вещества мы взяли. Обрати внимание и на другое: от
        комнаты до кипятка молекулы ускоряются всего в 1,13 раза, хотя по Цельсию разница
        кажется огромной. Скорость растёт как корень из температуры по Кельвину.
      </p>
    </>
  )
}
