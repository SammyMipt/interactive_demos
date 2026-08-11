import React, { useRef, useState } from 'react'
import { Stage, Panel, Readout, Slider, num, G } from '../ui.jsx'

/* Потенциальная энергия считается относительно выбранного нулевого уровня.
   Пунктир перетаскивается мышкой, предмет при этом не меняется.        */

const PX_PER_M = 74
const Y_TABLE = 250          // высота стола на экране
const H_TABLE = 0.8          // м над полом
const Y_FLOOR = Y_TABLE + H_TABLE * PX_PER_M

const LEVELS = [
  { name: 'полка', h: 2.0 },
  { name: 'стол', h: 0.8 },
  { name: 'пол', h: 0 },
  { name: 'дно подвала', h: -2.5 }
]

export default function Demo4ZeroLevel() {
  const [mass, setMass] = useState(3)
  const [zeroH, setZeroH] = useState(0) // выбранный нулевой уровень, м от пола
  const svgRef = useRef(null)

  const objH = H_TABLE // предмет лежит на столе
  const h = objH - zeroH
  const Ep = mass * G * h

  const yOf = (hm) => Y_FLOOR - hm * PX_PER_M

  function onMove(e) {
    if (e.buttons !== 1) return
    const svg = svgRef.current
    if (!svg) return
    const r = svg.getBoundingClientRect()
    const cy = e.touches ? e.touches[0].clientY : e.clientY
    const py = ((cy - r.top) / r.height) * 450
    const hm = (Y_FLOOR - py) / PX_PER_M
    setZeroH(Math.max(-2.5, Math.min(2.4, Math.round(hm * 20) / 20)))
  }

  return (
    <>
      <div className="head">
        <div className="head__eyebrow">Демо 4</div>
        <h1 className="head__title">Высота считается от выбранного уровня</h1>
        <p className="head__hint">
          Предмет лежит на столе и никуда не двигается. Перетаскивай зелёный пунктир нулевого
          уровня мышкой и смотри, как меняется потенциальная энергия. Опусти нуль в подвал или
          подними выше предмета.
        </p>
        <div className="head__ask">
          <b>Вопрос:</b> предмет тот же самый, а энергия разная. Как так?
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
          onPointerDown={onMove}
        >
          <rect width="800" height="450" fill="transparent" />

          {/* подвал */}
          <rect x="60" y={Y_FLOOR} width="470" height={2.5 * PX_PER_M} fill="#EDEFF2" />
          <line x1="60" y1={Y_FLOOR} x2="530" y2={Y_FLOOR} stroke="var(--ink)" strokeWidth="3" />
          <line x1="60" y1={yOf(-2.5)} x2="530" y2={yOf(-2.5)} stroke="var(--ink)" strokeWidth="3" />
          <text x="70" y={yOf(-2.5) - 9} fontSize="12" fill="var(--ink-soft)">
            дно подвала
          </text>
          <text x="70" y={Y_FLOOR - 9} fontSize="12" fill="var(--ink-soft)">
            пол
          </text>

          {/* стол */}
          <rect x="196" y={Y_TABLE} width="190" height="9" fill="var(--ink)" />
          <rect x="212" y={Y_TABLE + 9} width="11" height={H_TABLE * PX_PER_M - 9} fill="var(--ink)" />
          <rect x="359" y={Y_TABLE + 9} width="11" height={H_TABLE * PX_PER_M - 9} fill="var(--ink)" />
          <text x="396" y={Y_TABLE + 5} fontSize="12" fill="var(--ink-soft)">
            стол 0,8 м
          </text>

          {/* полка */}
          <rect x="196" y={yOf(2.0)} width="130" height="8" fill="var(--ink-soft)" />
          <text x="332" y={yOf(2.0) + 6} fontSize="12" fill="var(--ink-soft)">
            полка 2,0 м
          </text>

          {/* предмет */}
          <g transform={`translate(266, ${Y_TABLE - 52})`}>
            <rect width="62" height="52" rx="3" fill="var(--chrome-lt)" stroke="var(--potential)" strokeWidth="2.5" />
            <text x="31" y="27" textAnchor="middle" fontSize="17" fontWeight="700" fontFamily="var(--mono)" fill="var(--potential)">
              {num(mass, 0)}
            </text>
            <text x="31" y="44" textAnchor="middle" fontSize="11" fill="var(--ink-soft)">
              кг
            </text>
          </g>

          {/* выбранный нулевой уровень */}
          <g>
            <line x1="60" y1={yOf(zeroH)} x2="620" y2={yOf(zeroH)} stroke="var(--total)" strokeWidth="2.8" strokeDasharray="9 6" />
            <rect x="536" y={yOf(zeroH) - 15} width="84" height="30" rx="4" fill="var(--total)" />
            <text x="578" y={yOf(zeroH) + 5} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#fff">
              нуль
            </text>
          </g>

          {/* измеряемая высота */}
          <g>
            <line x1="150" y1={Y_TABLE - 26} x2="150" y2={yOf(zeroH)} stroke="var(--kinetic)" strokeWidth="2.6" />
            <line x1="140" y1={Y_TABLE - 26} x2="160" y2={Y_TABLE - 26} stroke="var(--kinetic)" strokeWidth="2.6" />
            <line x1="140" y1={yOf(zeroH)} x2="160" y2={yOf(zeroH)} stroke="var(--kinetic)" strokeWidth="2.6" />
            <text
              x="134"
              y={(Y_TABLE - 26 + yOf(zeroH)) / 2 + 5}
              textAnchor="end"
              fontSize="16"
              fontWeight="700"
              fontFamily="var(--mono)"
              fill="var(--kinetic)"
            >
              h = {num(h, 2)} м
            </text>
          </g>

          {/* формула */}
          <g transform="translate(636, 84)">
            <text fontSize="12" fill="var(--ink-soft)" letterSpacing="1">
              Ep = m · g · h
            </text>
            <text y="42" fontSize="27" fontWeight="700" fontFamily="var(--mono)" fill={Ep < 0 ? 'var(--kinetic)' : 'var(--potential)'}>
              {num(Ep, 1)}
            </text>
            <text y="62" fontSize="13" fill="var(--ink-soft)">
              джоулей
            </text>
            {Ep < 0 && (
              <text y="92" fontSize="11.5" fill="var(--kinetic)" fontWeight="600">
                нуль выше предмета,
              </text>
            )}
            {Ep < 0 && (
              <text y="108" fontSize="11.5" fill="var(--kinetic)" fontWeight="600">
                энергия отрицательная
              </text>
            )}
          </g>
        </svg>
      </Stage>

      <Panel>
        <Readout label="Масса" value={num(mass, 0)} unit="кг" color="var(--potential)" />
        <Readout label="Высота от нуля" value={num(h, 2)} unit="м" color="var(--kinetic)" />
        <Readout label="Потенциальная энергия" value={num(Ep, 1)} unit="Дж" color="var(--total)" />
      </Panel>

      <div className="controls">
        <Slider label="Масса предмета" value={mass} set={setMass} min={1} max={10} step={1} display={`${mass} кг`} />
        <div className="btnrow">
          {LEVELS.map((l) => (
            <button key={l.name} className={'btn' + (Math.abs(zeroH - l.h) < 0.03 ? ' btn--on' : '')} onClick={() => setZeroH(l.h)}>
              нуль на {l.name}
            </button>
          ))}
        </div>
      </div>

      <p className="note">
        Предмет не менялся ни разу, а число получилось разное: от стола ноль, от пола 24 Дж,
        от дна подвала 99 Дж. Потенциальная энергия <b>всегда считается относительно уровня,
        который мы выбрали сами</b>. Поэтому в задаче первым делом надо договориться, где нуль.
      </p>
    </>
  )
}
