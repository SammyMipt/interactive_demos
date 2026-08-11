import React, { useState } from 'react'
import { Stage, Panel, Readout, Slider, num } from '../ui.jsx'

/* Масса и вес. Масса не меняется никогда, вес зависит от планеты. */

const PLANETS = [
  { key: 'earth', name: 'Земля', g: 10, sky: '#DCE6F1', ground: '#8FA8B8' },
  { key: 'moon', name: 'Луна', g: 1.6, sky: '#E8E8EC', ground: '#B8B8BE' },
  { key: 'jupiter', name: 'Юпитер', g: 25, sky: '#F0E3D4', ground: '#C09A72' }
]

const SCALE_MAX = 520 // предел динамометра, Н

export default function Demo2MassWeight() {
  const [mass, setMass] = useState(5)
  const [pk, setPk] = useState('earth')
  const planet = PLANETS.find((p) => p.key === pk)
  const weight = mass * planet.g
  const frac = Math.min(1, weight / SCALE_MAX)

  const springTop = 118
  const springLen = 60 + frac * 150

  return (
    <>
      <div className="head">
        <div className="head__eyebrow">Демо 2</div>
        <h1 className="head__title">Масса и вес это разные вещи</h1>
        <p className="head__hint">
          Один и тот же груз висит на динамометре. Переключай планету и следи за двумя
          табло: килограммы стоят на месте, ньютоны прыгают.
        </p>
        <div className="head__ask">
          <b>Вопрос:</b> что изменилось, а что осталось прежним, и почему.
        </div>
      </div>

      <Stage>
        <rect x="0" y="0" width="800" height="286" fill={planet.sky} opacity="0.55" />
        <rect x="0" y="286" width="800" height="164" fill={planet.ground} opacity="0.35" />
        <line x1="0" y1="286" x2="800" y2="286" stroke="var(--ink)" strokeWidth="2" />

        <text x="34" y="44" fontSize="15" fontWeight="700" fill="var(--ink)" letterSpacing="1.5">
          {planet.name.toUpperCase()}
        </text>
        <text x="34" y="65" fontSize="13" fontFamily="var(--mono)" fill="var(--ink-soft)">
          g = {num(planet.g, 1)} Н/кг
        </text>

        {/* штатив */}
        <line x1="150" y1="96" x2="330" y2="96" stroke="var(--ink)" strokeWidth="5" />
        <line x1="330" y1="96" x2="330" y2="286" stroke="var(--ink)" strokeWidth="5" />

        {/* пружина динамометра */}
        <g transform="translate(220, 0)">
          <line x1="0" y1="96" x2="0" y2={springTop} stroke="var(--ink)" strokeWidth="2" />
          {Array.from({ length: 9 }).map((_, i) => {
            const step = springLen / 9
            const y = springTop + i * step
            return (
              <path
                key={i}
                d={`M0 ${y} Q 17 ${y + step * 0.25} 0 ${y + step * 0.5} Q -17 ${y + step * 0.75} 0 ${y + step}`}
                fill="none"
                stroke="var(--potential)"
                strokeWidth="2.6"
              />
            )
          })}
          {/* груз */}
          <g transform={`translate(0, ${springTop + springLen})`}>
            <rect x="-42" y="0" width="84" height="62" rx="4" fill="var(--chrome-lt)" stroke="var(--potential)" strokeWidth="2.5" />
            <text y="30" textAnchor="middle" fontSize="21" fontWeight="700" fontFamily="var(--mono)" fill="var(--potential)">
              {num(mass, 0)}
            </text>
            <text y="49" textAnchor="middle" fontSize="12" fill="var(--ink-soft)">
              кг
            </text>
          </g>
        </g>

        {/* шкала динамометра */}
        <g transform="translate(452, 108)">
          <text fontSize="12" fill="var(--ink-soft)" letterSpacing="1">
            ДИНАМОМЕТР, Н
          </text>
          <rect x="0" y="12" width="72" height="212" fill="#fff" stroke="var(--ink)" strokeWidth="1.6" />
          <rect x="0" y={12 + 212 - frac * 212} width="72" height={frac * 212} fill="var(--kinetic)" opacity="0.85" />
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1="72" y1={12 + 212 * (1 - f)} x2="86" y2={12 + 212 * (1 - f)} stroke="var(--ink)" strokeWidth="1.4" />
              <text x="92" y={12 + 212 * (1 - f) + 4} fontSize="11.5" fontFamily="var(--mono)" fill="var(--ink-soft)">
                {Math.round(SCALE_MAX * f)}
              </text>
            </g>
          ))}
          <text x="36" y="252" textAnchor="middle" fontSize="20" fontWeight="700" fontFamily="var(--mono)" fill="var(--kinetic)">
            {num(weight, 1)}
          </text>
        </g>

        {/* два табло рядом, чтобы контраст был очевиден */}
        <g transform="translate(600, 108)">
          <rect x="0" y="0" width="168" height="86" rx="4" fill="#fff" stroke="var(--potential)" strokeWidth="2.5" />
          <text x="12" y="24" fontSize="11.5" fill="var(--ink-soft)" letterSpacing="1">
            МАССА
          </text>
          <text x="12" y="60" fontSize="30" fontWeight="700" fontFamily="var(--mono)" fill="var(--potential)">
            {num(mass, 0)} кг
          </text>
          <text x="12" y="78" fontSize="11" fill="var(--total)" fontWeight="600">
            не меняется никогда
          </text>

          <rect x="0" y="100" width="168" height="86" rx="4" fill="#fff" stroke="var(--kinetic)" strokeWidth="2.5" />
          <text x="12" y="124" fontSize="11.5" fill="var(--ink-soft)" letterSpacing="1">
            ВЕС
          </text>
          <text x="12" y="160" fontSize="30" fontWeight="700" fontFamily="var(--mono)" fill="var(--kinetic)">
            {num(weight, 0)} Н
          </text>
          <text x="12" y="178" fontSize="11" fill="var(--kinetic)" fontWeight="600">
            зависит от планеты
          </text>
        </g>

        <text x="34" y="404" fontSize="13.5" fill="var(--ink)" fontFamily="var(--mono)">
          P = m · g = {num(mass, 0)} · {num(planet.g, 1)} = {num(weight, 1)} Н
        </text>
      </Stage>

      <Panel>
        <Readout label="Масса" value={num(mass, 0)} unit="кг" color="var(--potential)" />
        <Readout label="Вес" value={num(weight, 1)} unit="Н" color="var(--kinetic)" />
        <Readout label="Ускорение g" value={num(planet.g, 1)} unit="Н/кг" color="var(--ink-soft)" />
      </Panel>

      <div className="controls">
        <Slider label="Масса груза" value={mass} set={setMass} min={1} max={20} step={1} display={`${mass} кг`} />
        <div className="btnrow">
          <div className="seg" role="group" aria-label="Планета">
            {PLANETS.map((p) => (
              <button key={p.key} aria-pressed={pk === p.key} onClick={() => setPk(p.key)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="note">
        На Луне тот же груз весит примерно <b>в шесть раз меньше</b>, а на Юпитере в два
        с половиной раза больше земного. Масса при этом одна и та же: это свойство самого
        тела, а вес это сила, с которой оно тянет подвес.
      </p>
    </>
  )
}
