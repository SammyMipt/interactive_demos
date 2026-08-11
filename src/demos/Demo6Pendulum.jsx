import React, { useRef, useState } from 'react'
import { Stage, Panel, Readout, EnergyBars, useRaf, num, G } from '../ui.jsx'

/* Маятник: то же превращение, но циклическое.
   Кнопка трения заранее готовит демо 8.                */

const M = 0.5
const LEN = 1.0        // м
const PIVOT = { x: 300, y: 70 }
const PX_PER_M = 210

export default function Demo6Pendulum() {
  const [friction, setFriction] = useState(false)
  const [playing, setPlaying] = useState(true)
  const th = useRef(0.9)     // угол, рад
  const om = useRef(0)       // угловая скорость
  const [, force] = useState(0)

  useRaf((dt) => {
    const steps = 4
    const sdt = dt / steps
    for (let i = 0; i < steps; i++) {
      const a = -(G / LEN) * Math.sin(th.current) - (friction ? 0.35 : 0) * om.current
      om.current += a * sdt
      th.current += om.current * sdt
    }
    force((n) => n + 1)
  }, playing)

  const h = LEN * (1 - Math.cos(th.current))
  const Ep = M * G * h
  const Ek = 0.5 * M * LEN * LEN * om.current * om.current
  const E0 = M * G * LEN * (1 - Math.cos(0.9))

  const bx = PIVOT.x + Math.sin(th.current) * LEN * PX_PER_M
  const by = PIVOT.y + Math.cos(th.current) * LEN * PX_PER_M

  function reset() {
    th.current = 0.9
    om.current = 0
    force((n) => n + 1)
  }

  return (
    <>
      <div className="head">
        <div className="head__eyebrow">Демо 6</div>
        <h1 className="head__title">Маятник: энергия перекачивается туда и обратно</h1>
        <p className="head__hint">
          В крайних точках вся энергия потенциальная, в нижней вся кинетическая. Столбики
          перекачиваются, а полная энергия стоит. Включи трение и посмотри, что начнёт
          происходить с размахом.
        </p>
        <div className="head__ask">
          <b>Вопрос:</b> где маятник движется быстрее всего и почему именно там?
        </div>
      </div>

      <Stage>
        {/* потолок */}
        <line x1="180" y1={PIVOT.y} x2="420" y2={PIVOT.y} stroke="var(--ink)" strokeWidth="5" />
        {Array.from({ length: 9 }).map((_, i) => (
          <line
            key={i}
            x1={186 + i * 28}
            y1={PIVOT.y}
            x2={176 + i * 28}
            y2={PIVOT.y - 12}
            stroke="var(--grid-bold)"
            strokeWidth="2"
          />
        ))}

        {/* нижний уровень */}
        <line
          x1="120"
          y1={PIVOT.y + LEN * PX_PER_M}
          x2="500"
          y2={PIVOT.y + LEN * PX_PER_M}
          stroke="var(--edge)"
          strokeWidth="1.4"
          strokeDasharray="5 5"
        />
        <text x="120" y={PIVOT.y + LEN * PX_PER_M + 18} fontSize="11.5" fill="var(--ink-soft)" fontFamily="var(--mono)">
          нижняя точка, h = 0
        </text>

        {/* высота подъёма */}
        {h > 0.005 && (
          <g>
            <line x1="140" y1={by} x2="140" y2={PIVOT.y + LEN * PX_PER_M} stroke="var(--potential)" strokeWidth="2.4" />
            <text
              x="134"
              y={(by + PIVOT.y + LEN * PX_PER_M) / 2}
              textAnchor="end"
              fontSize="13"
              fontWeight="700"
              fontFamily="var(--mono)"
              fill="var(--potential)"
            >
              {num(h, 2)} м
            </text>
          </g>
        )}

        {/* нить и груз */}
        <line x1={PIVOT.x} y1={PIVOT.y} x2={bx} y2={by} stroke="var(--ink)" strokeWidth="2.4" />
        <circle cx={PIVOT.x} cy={PIVOT.y} r="6" fill="var(--ink)" />
        <circle cx={bx} cy={by} r="19" fill="var(--potential)" stroke="#fff" strokeWidth="2.5" />
        <text x={bx} y={by + 5} textAnchor="middle" fontSize="12" fontWeight="700" fontFamily="var(--mono)" fill="#fff">
          {num(M, 1)}
        </text>

        <EnergyBars
          max={E0}
          x={600}
          y={44}
          h={300}
          items={[
            { label: 'Ep', value: Ep, color: 'var(--potential)' },
            { label: 'Ek', value: Ek, color: 'var(--kinetic)' }
          ]}
          showInvariant={!friction}
        />

        {friction && (
          <text x="600" y="386" fontSize="12.5" fill="var(--internal)" fontWeight="600">
            трение включено: сумма тает, куда она уходит смотри в демо 8
          </text>
        )}
      </Stage>

      <Panel>
        <Readout label="Потенциальная" value={num(Ep, 2)} unit="Дж" color="var(--potential)" />
        <Readout label="Кинетическая" value={num(Ek, 2)} unit="Дж" color="var(--kinetic)" />
        <Readout label="Полная" value={num(Ep + Ek, 2)} unit="Дж" color="var(--total)" />
        <Readout label="Высота" value={num(h, 2)} unit="м" color="var(--ink-soft)" />
      </Panel>

      <div className="controls">
        <div className="btnrow">
          <button className="btn btn--go" onClick={() => setPlaying((p) => !p)}>
            {playing ? 'Пауза' : 'Пуск'}
          </button>
          <button className={'btn' + (friction ? ' btn--on' : '')} onClick={() => setFriction((f) => !f)}>
            {friction ? 'Трение включено' : 'Включить трение'}
          </button>
          <button className="btn" onClick={reset}>
            Отвести и отпустить
          </button>
        </div>
      </div>

      <p className="note">
        Без трения маятник качался бы вечно: энергия просто ходит из потенциальной в
        кинетическую и обратно. С трением размах падает, и <b>полная механическая энергия
        уменьшается</b>. Это подводит к главному вопросу следующего демо: куда она уходит.
      </p>
    </>
  )
}
