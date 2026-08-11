import React, { useState, useRef } from 'react'
import { Stage, Panel, Readout, EnergyBars, useRaf, num, G } from '../ui.jsx'

/* Главное демо. Шарик 0,2 кг съезжает с высоты 1,25 м.
   Числа совпадают с таблицей из плана:
   верх 2,5 / 0 ; середина 1,25 / 1,25 ; низ 0 / 2,5.
   Третий столбик, полная энергия, не двигается вообще.        */

const M = 0.2
const H0 = 1.25
const E0 = M * G * H0 // 2,5 Дж

const L = 430          // длина горки по горизонтали, px
const X_LEFT = 96
const Y_BOT = 384
const PX_PER_M = 168   // 1,25 м = 210 px

// профиль горки: y(x) = H0 * (1 + cos(pi * x / L)) / 2
const hAt = (xPx) => (H0 * (1 + Math.cos((Math.PI * xPx) / L))) / 2
const xForH = (hm) => (L / Math.PI) * Math.acos(Math.max(-1, Math.min(1, (2 * hm) / H0 - 1)))

const POINTS = [
  { name: 'Верх', h: H0 },
  { name: 'Середина', h: H0 / 2 },
  { name: 'Низ', h: 0 }
]

export default function Demo5Hill() {
  const xRef = useRef(0)
  const [playing, setPlaying] = useState(false)
  const dir = useRef(1)
  const [, force] = useState(0)
  const xPx = xRef.current

  const h = hAt(xPx)
  const Ep = M * G * h
  const Ek = Math.max(0, E0 - Ep)
  const v = Math.sqrt((2 * Ek) / M)

  useRaf((dt) => {
    // скорость вдоль склона: dx/dt = v / sqrt(1 + (dy/dx)^2)
    const cur = xRef.current
    const hh = hAt(cur)
    const vv = Math.sqrt(Math.max(0, 2 * G * (H0 - hh)))
    const dydx = ((-H0 * Math.PI * Math.sin((Math.PI * cur) / L)) / (2 * L)) * PX_PER_M
    const slope = Math.sqrt(1 + dydx * dydx)
    let nx = cur + (dir.current * vv * PX_PER_M * dt) / slope
    if (nx >= L) {
      nx = L
      setPlaying(false)
    }
    if (nx <= 0) {
      nx = 0
      dir.current = 1
    }
    xRef.current = nx
    force((n) => n + 1)
  }, playing)

  const setXPx = (v) => {
    xRef.current = v
    force((n) => n + 1)
  }

  const pathD = () => {
    let d = ''
    for (let i = 0; i <= 60; i++) {
      const px = (L * i) / 60
      const py = Y_BOT - hAt(px) * PX_PER_M
      d += (i === 0 ? 'M' : 'L') + (X_LEFT + px).toFixed(1) + ' ' + py.toFixed(1) + ' '
    }
    return d
  }

  const ballX = X_LEFT + xPx
  const ballY = Y_BOT - h * PX_PER_M - 11

  function goTo(hm) {
    setPlaying(false)
    dir.current = 1
    setXPx(xForH(hm))
  }

  return (
    <>
      <div className="head">
        <div className="head__eyebrow">Демо 5 · главное демо</div>
        <h1 className="head__title">Шарик на горке: сумма не меняется</h1>
        <p className="head__hint">
          Шарик массой 0,2 кг съезжает с высоты 1,25 м. Синий столбик опускается, красный
          поднимается, а зелёная линия полной энергии стоит на месте. Кнопки «Верх»,
          «Середина» и «Низ» дают ровно те три строки, что мы считали в таблице.
        </p>
        <div className="head__ask">
          <b>Вопрос:</b> какой столбик не двигается вообще, и почему именно он?
        </div>
      </div>

      <Stage>
        {/* земля */}
        <line x1="0" y1={Y_BOT} x2="560" y2={Y_BOT} stroke="var(--ink)" strokeWidth="3" />

        {/* отметки высот */}
        {POINTS.map((p) => (
          <g key={p.name}>
            <line
              x1={X_LEFT - 34}
              y1={Y_BOT - p.h * PX_PER_M}
              x2={X_LEFT + L}
              y2={Y_BOT - p.h * PX_PER_M}
              stroke="var(--edge)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              x={X_LEFT - 40}
              y={Y_BOT - p.h * PX_PER_M + 4}
              textAnchor="end"
              fontSize="11.5"
              fontFamily="var(--mono)"
              fill="var(--ink-soft)"
            >
              {num(p.h, 2)} м
            </text>
          </g>
        ))}

        {/* горка */}
        <path d={pathD()} fill="none" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" />
        <path d={pathD() + `L ${X_LEFT + L} ${Y_BOT} L ${X_LEFT} ${Y_BOT} Z`} fill="var(--grid)" opacity="0.4" />

        {/* шарик */}
        <circle cx={ballX} cy={ballY} r="11" fill="var(--kinetic)" stroke="#fff" strokeWidth="2" />

        {/* вектор скорости */}
        {v > 0.15 && (
          <line
            x1={ballX}
            y1={ballY}
            x2={ballX + Math.min(66, v * 13)}
            y2={ballY}
            stroke="var(--kinetic)"
            strokeWidth="3"
            markerEnd="url(#arrow)"
          />
        )}

        {/* текущие числа рядом со сценой */}
        <g transform="translate(40, 52)">
          <text fontSize="12" fill="var(--ink-soft)" letterSpacing="1">
            ВЫСОТА
          </text>
          <text y="27" fontSize="21" fontWeight="700" fontFamily="var(--mono)" fill="var(--potential)">
            {num(h, 2)} м
          </text>
          <text y="60" fontSize="12" fill="var(--ink-soft)" letterSpacing="1">
            СКОРОСТЬ
          </text>
          <text y="87" fontSize="21" fontWeight="700" fontFamily="var(--mono)" fill="var(--kinetic)">
            {num(v, 2)} м/с
          </text>
        </g>

        <EnergyBars
          max={E0}
          x={600}
          y={44}
          h={300}
          items={[
            { label: 'Ep', value: Ep, color: 'var(--potential)' },
            { label: 'Ek', value: Ek, color: 'var(--kinetic)' }
          ]}
        />
      </Stage>

      <Panel>
        <Readout label="Потенциальная" value={num(Ep, 2)} unit="Дж" color="var(--potential)" />
        <Readout label="Кинетическая" value={num(Ek, 2)} unit="Дж" color="var(--kinetic)" />
        <Readout label="Полная" value={num(Ep + Ek, 2)} unit="Дж" color="var(--total)" />
        <Readout label="Скорость" value={num(v, 2)} unit="м/с" color="var(--ink-soft)" />
      </Panel>

      <div className="controls">
        <div className="btnrow">
          <button
            className="btn btn--go"
            onClick={() => {
              if (xPx >= L - 0.5) {
                setXPx(0)
              }
              dir.current = 1
              setPlaying((p) => !p)
            }}
          >
            {playing ? 'Пауза' : 'Пустить шарик'}
          </button>
          {POINTS.map((p) => (
            <button key={p.name} className="btn" onClick={() => goTo(p.h)}>
              {p.name}
            </button>
          ))}
          <button
            className="btn"
            onClick={() => {
              setPlaying(false)
              setXPx(0)
            }}
          >
            Сброс
          </button>
        </div>
      </div>

      <p className="note">
        Три точки из таблицы: наверху <b>2,5 и 0</b>, на середине <b>1,25 и 1,25</b>, внизу{' '}
        <b>0 и 2,5</b>. В каждой строке сумма одна и та же. Кинетическая энергия действительно
        растёт при спуске, но ровно настолько, насколько убывает потенциальная.
      </p>
    </>
  )
}
