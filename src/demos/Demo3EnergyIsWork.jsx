import React, { useState, useRef } from 'react'
import { Stage, Panel, Readout, Slider, useRaf, num, G } from '../ui.jsx'

/* Энергия это способность совершить работу.
   Тележка со скоростью v цепляет подъёмник, тормозит до полной остановки
   и поднимает груз на высоту h. Вся кинетическая энергия ушла в работу mgh.
   Удвоил скорость - груз поднялся вчетверо выше.                        */

const M_CART = 2      // кг
const M_LOAD = 1      // кг
const PX_PER_M = 78   // масштаб по высоте
const GROUND = 372
const HITCH = 470     // где тележка цепляет подъёмник, px

export default function Demo3EnergyIsWork() {
  const [v0, setV0] = useState(4)
  const [phase, setPhase] = useState('idle') // idle | roll | lift | done
  const xRef = useRef(120)
  const pRef = useRef(0)                     // доля израсходованной энергии
  const [ghost, setGhost] = useState(null)   // предыдущий результат
  const [, force] = useState(0)

  const x = xRef.current
  const p = pRef.current
  const startV = useRef(4)

  const Ek0 = (M_CART * startV.current ** 2) / 2
  const hMax = Ek0 / (M_LOAD * G)
  const h = hMax * p
  const vNow = phase === 'roll' ? startV.current : startV.current * Math.sqrt(Math.max(0, 1 - p))
  const EkNow = (M_CART * vNow ** 2) / 2
  const workNow = M_LOAD * G * h

  useRaf((dt) => {
    if (phase === 'roll') {
      const nx = xRef.current + startV.current * 46 * dt
      if (nx >= HITCH) {
        xRef.current = HITCH
        setPhase('lift')
      } else {
        xRef.current = nx
      }
    } else if (phase === 'lift') {
      // энергия расходуется равномерно по времени подъёма
      const np = pRef.current + dt * 0.85
      if (np >= 1) {
        pRef.current = 1
        setGhost({ v: startV.current, h: hMax })
        setPhase('done')
      } else {
        pRef.current = np
      }
    }
    force((n) => n + 1)
  }, phase === 'roll' || phase === 'lift')

  function launch() {
    startV.current = v0
    xRef.current = 120
    pRef.current = 0
    setPhase('roll')
  }

  function reset() {
    setPhase('idle')
    xRef.current = 120
    pRef.current = 0
    setGhost(null)
    force((n) => n + 1)
  }

  const loadY = GROUND - 34 - h * PX_PER_M
  const running = phase === 'roll' || phase === 'lift'

  return (
    <>
      <div className="head">
        <div className="head__eyebrow">Демо 3</div>
        <h1 className="head__title">Энергия это способность совершить работу</h1>
        <p className="head__hint">
          Тележка разгоняется, цепляет подъёмник и тормозит. Вся её энергия движения уходит
          на подъём груза. Запусти при скорости 2 м/с, потом при 4 м/с и сравни высоту:
          скорость выросла вдвое, а груз поднялся вчетверо выше.
        </p>
        <div className="head__ask">
          <b>Вопрос:</b> тележка остановилась. Куда делась её энергия и что она успела сделать?
        </div>
      </div>

      <Stage>
        {/* пол и рельс */}
        <line x1="0" y1={GROUND} x2="800" y2={GROUND} stroke="var(--ink)" strokeWidth="3" />

        {/* мачта подъёмника */}
        <line x1={HITCH + 128} y1={GROUND} x2={HITCH + 128} y2="52" stroke="var(--ink)" strokeWidth="4" />
        <line x1={HITCH + 118} y1="52" x2={HITCH + 196} y2="52" stroke="var(--ink)" strokeWidth="4" />

        {/* шкала высоты */}
        {Array.from({ length: 5 }).map((_, i) => {
          const m = i + 1
          const yy = GROUND - 34 - m * PX_PER_M
          if (yy < 44) return null
          return (
            <g key={m}>
              <line x1={HITCH + 122} y1={yy} x2={HITCH + 210} y2={yy} stroke="var(--edge)" strokeWidth="1" strokeDasharray="4 4" />
              <text x={HITCH + 216} y={yy + 4} fontSize="11.5" fontFamily="var(--mono)" fill="var(--ink-soft)">
                {m} м
              </text>
            </g>
          )
        })}

        {/* призрак предыдущего запуска */}
        {ghost && (
          <g>
            <line
              x1={HITCH + 122}
              y1={GROUND - 34 - ghost.h * PX_PER_M}
              x2={HITCH + 196}
              y2={GROUND - 34 - ghost.h * PX_PER_M}
              stroke="var(--ink-soft)"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
            <text
              x={HITCH + 118}
              y={GROUND - 38 - ghost.h * PX_PER_M}
              textAnchor="end"
              fontSize="11.5"
              fill="var(--ink-soft)"
              fontFamily="var(--mono)"
            >
              было при {num(ghost.v, 0)} м/с: {num(ghost.h, 2)} м
            </text>
          </g>
        )}

        {/* трос и груз */}
        <line x1={HITCH + 160} y1="52" x2={HITCH + 160} y2={loadY} stroke="var(--ink)" strokeWidth="2" />
        <g transform={`translate(${HITCH + 160}, ${loadY})`}>
          <rect x="-31" y="0" width="62" height="34" rx="3" fill="#F3E2CF" stroke="var(--internal)" strokeWidth="2.5" />
          <text y="22" textAnchor="middle" fontSize="15" fontWeight="700" fontFamily="var(--mono)" fill="var(--internal)">
            {M_LOAD} кг
          </text>
        </g>

        {/* текущая высота подъёма */}
        {h > 0.02 && (
          <g>
            <line x1={HITCH + 104} y1={GROUND - 34} x2={HITCH + 104} y2={loadY} stroke="var(--total)" strokeWidth="2.6" />
            <text
              x={HITCH + 96}
              y={(GROUND - 34 + loadY) / 2}
              textAnchor="end"
              fontSize="15"
              fontWeight="700"
              fontFamily="var(--mono)"
              fill="var(--total)"
            >
              h = {num(h, 2)} м
            </text>
          </g>
        )}

        {/* тележка */}
        <g transform={`translate(${x}, ${GROUND - 42})`}>
          <rect x="-40" y="0" width="80" height="30" rx="3" fill="var(--chrome-lt)" stroke="var(--potential)" strokeWidth="2.5" />
          <text y="21" textAnchor="middle" fontSize="14" fontWeight="700" fontFamily="var(--mono)" fill="var(--potential)">
            {M_CART} кг
          </text>
          <circle cx="-22" cy="38" r="11" fill="#fff" stroke="var(--ink)" strokeWidth="2.4" />
          <circle cx="22" cy="38" r="11" fill="#fff" stroke="var(--ink)" strokeWidth="2.4" />
          {vNow > 0.05 && (
            <g>
              <line x1="46" y1="14" x2={46 + Math.min(70, vNow * 13)} y2="14" stroke="var(--kinetic)" strokeWidth="3" markerEnd="url(#arrow)" />
              <text x="46" y="-6" fontSize="13" fontWeight="700" fontFamily="var(--mono)" fill="var(--kinetic)">
                {num(vNow, 1)} м/с
              </text>
            </g>
          )}
        </g>

        {/* энергетический баланс слева */}
        <g transform="translate(46, 60)">
          <text fontSize="12" fill="var(--ink-soft)" letterSpacing="1">
            ЭНЕРГИЯ ТЕЛЕЖКИ
          </text>
          <rect y="12" width="200" height="26" fill="#fff" stroke="var(--edge)" />
          <rect y="12" width={Ek0 > 0 ? (EkNow / Ek0) * 200 : 0} height="26" fill="var(--kinetic)" opacity="0.88" />
          <text x="0" y="56" fontSize="14" fontFamily="var(--mono)" fontWeight="700" fill="var(--kinetic)">
            {num(EkNow, 1)} Дж
          </text>

          <text y="92" fontSize="12" fill="var(--ink-soft)" letterSpacing="1">
            РАБОТА ПО ПОДЪЁМУ ГРУЗА
          </text>
          <rect y="104" width="200" height="26" fill="#fff" stroke="var(--edge)" />
          <rect y="104" width={Ek0 > 0 ? (workNow / Ek0) * 200 : 0} height="26" fill="var(--total)" opacity="0.88" />
          <text x="0" y="148" fontSize="14" fontFamily="var(--mono)" fontWeight="700" fill="var(--total)">
            {num(workNow, 1)} Дж
          </text>

          <text y="182" fontSize="12.5" fill="var(--ink)" fontFamily="var(--mono)">
            сумма всегда {num(Ek0, 1)} Дж
          </text>
        </g>

        {phase === 'done' && (
          <g transform="translate(400, 424)">
            <text textAnchor="middle" fontSize="14.5" fontWeight="700" fill="var(--total)">
              тележка остановилась, груз поднят на {num(hMax, 2)} м
            </text>
          </g>
        )}
      </Stage>

      <Panel>
        <Readout label="Скорость сейчас" value={num(vNow, 1)} unit="м/с" color="var(--kinetic)" />
        <Readout label="Энергия в начале" value={num(Ek0, 1)} unit="Дж" color="var(--potential)" />
        <Readout label="Высота подъёма" value={num(h, 2)} unit="м" color="var(--total)" />
        <Readout label="Совершённая работа" value={num(workNow, 1)} unit="Дж" color="var(--total)" />
      </Panel>

      <div className="controls">
        <Slider
          label="Скорость тележки"
          value={v0}
          set={setV0}
          min={1}
          max={6}
          step={1}
          display={`${v0} м/с`}
          note={`поднимет груз на ${num((M_CART * v0 ** 2) / 2 / (M_LOAD * G), 2)} м`}
        />
        <div className="btnrow">
          <button className="btn btn--go" onClick={launch} disabled={running}>
            {running ? 'Едет...' : 'Запустить'}
          </button>
          <button className="btn" onClick={reset}>
            Сброс
          </button>
        </div>
      </div>

      <p className="note">
        Тележка массой 2 кг при 2 м/с несёт 4 Дж и поднимает килограммовый груз на 0,40 м.
        При 4 м/с у неё уже 16 Дж и груз идёт на <b>1,60 м</b>, вчетверо выше. Скорость входит
        в энергию <b>в квадрате</b>, поэтому вдвое быстрее означает вчетверо больше работы.
      </p>
    </>
  )
}
