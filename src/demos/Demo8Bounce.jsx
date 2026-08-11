import React, { useRef, useState } from 'react'
import { Stage, Panel, Readout, EnergyBars, Slider, useRaf, num, G } from '../ui.jsx'

/* Прыгающий мяч. Механическая энергия тает, внутренняя растёт ровно настолько же.
   Полная сумма стоит на месте. Это вход в блок тепловых явлений.           */

const M = 0.2
const H0 = 2.0
const E0 = M * G * H0 // 4 Дж
const PX_PER_M = 140
const Y_GROUND = 372

export default function Demo8Bounce() {
  const [loss, setLoss] = useState(0.3) // доля энергии, теряемая за удар
  const [playing, setPlaying] = useState(false)
  const y = useRef(H0)      // высота, м
  const vy = useRef(0)      // скорость, м/с (вниз отрицательная)
  const eInt = useRef(0)    // накопленная внутренняя энергия
  const heat = useRef(0)    // вспышка нагрева для подсветки
  const [, force] = useState(0)

  useRaf((dt) => {
    const steps = 5
    const sdt = dt / steps
    for (let i = 0; i < steps; i++) {
      vy.current -= G * sdt
      y.current += vy.current * sdt
      if (y.current <= 0) {
        y.current = 0
        const ekBefore = 0.5 * M * vy.current * vy.current
        const ekAfter = ekBefore * (1 - loss)
        eInt.current += ekBefore - ekAfter
        heat.current = 1
        vy.current = Math.sqrt((2 * ekAfter) / M)
        if (vy.current < 0.25) {
          vy.current = 0
          eInt.current = E0
          setPlaying(false)
        }
      }
    }
    heat.current = Math.max(0, heat.current - dt * 2.2)
    force((n) => n + 1)
  }, playing)

  const Ep = M * G * y.current
  const Ek = 0.5 * M * vy.current * vy.current
  const total = Ep + Ek + eInt.current

  function reset() {
    y.current = H0
    vy.current = 0
    eInt.current = 0
    heat.current = 0
    setPlaying(false)
    force((n) => n + 1)
  }

  const ballY = Y_GROUND - y.current * PX_PER_M - 15

  return (
    <>
      <div className="head">
        <div className="head__eyebrow">Демо 8 · вход в тепловые явления</div>
        <h1 className="head__title">Мяч остановился, а энергия никуда не делась</h1>
        <p className="head__hint">
          Поставь потери на ноль: мяч скачет вечно на одну и ту же высоту. Добавь потери:
          мяч затухает, синий и красный столбики тают, а оранжевый столбик нагрева растёт
          ровно на столько же. Зелёная линия полной энергии не двигается ни разу.
        </p>
        <div className="head__ask">
          <b>Вопрос:</b> мяч остановился. Какой столбик вырос вместо него?
        </div>
      </div>

      <Stage>
        {/* пол, подсвечивается при ударе */}
        <rect
          x="0"
          y={Y_GROUND}
          width="520"
          height="10"
          fill="var(--internal)"
          opacity={0.15 + heat.current * 0.75}
        />
        <line x1="0" y1={Y_GROUND} x2="520" y2={Y_GROUND} stroke="var(--ink)" strokeWidth="3" />

        {/* стартовая высота */}
        <line x1="40" y1={Y_GROUND - H0 * PX_PER_M} x2="500" y2={Y_GROUND - H0 * PX_PER_M} stroke="var(--edge)" strokeWidth="1.4" strokeDasharray="5 5" />
        <text x="44" y={Y_GROUND - H0 * PX_PER_M - 8} fontSize="11.5" fontFamily="var(--mono)" fill="var(--ink-soft)">
          старт 2,0 м
        </text>

        {/* шкала */}
        {[0.5, 1, 1.5].map((m) => (
          <g key={m}>
            <line x1="40" y1={Y_GROUND - m * PX_PER_M} x2="56" y2={Y_GROUND - m * PX_PER_M} stroke="var(--ink-soft)" strokeWidth="1.4" />
            <text x="34" y={Y_GROUND - m * PX_PER_M + 4} textAnchor="end" fontSize="11" fontFamily="var(--mono)" fill="var(--ink-soft)">
              {num(m, 1)}
            </text>
          </g>
        ))}

        {/* мяч */}
        <circle cx="270" cy={ballY} r="15" fill="var(--kinetic)" stroke="#fff" strokeWidth="2" />

        {/* волны нагрева */}
        {heat.current > 0.05 && (
          <g opacity={heat.current}>
            <circle cx="270" cy={Y_GROUND} r={22 + (1 - heat.current) * 34} fill="none" stroke="var(--internal)" strokeWidth="2.6" />
            <text x="270" y={Y_GROUND + 34} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--internal)">
              нагрев
            </text>
          </g>
        )}

        <g transform="translate(46, 60)">
          <text fontSize="12" fill="var(--ink-soft)" letterSpacing="1">
            ВЫСОТА
          </text>
          <text y="27" fontSize="21" fontWeight="700" fontFamily="var(--mono)" fill="var(--potential)">
            {num(y.current, 2)} м
          </text>
        </g>

        <EnergyBars
          max={E0}
          x={548}
          y={44}
          h={300}
          items={[
            { label: 'Ep', value: Ep, color: 'var(--potential)' },
            { label: 'Ek', value: Ek, color: 'var(--kinetic)' },
            { label: 'нагрев', value: eInt.current, color: 'var(--internal)' }
          ]}
        />
      </Stage>

      <Panel>
        <Readout label="Потенциальная" value={num(Ep, 2)} unit="Дж" color="var(--potential)" />
        <Readout label="Кинетическая" value={num(Ek, 2)} unit="Дж" color="var(--kinetic)" />
        <Readout label="Внутренняя (нагрев)" value={num(eInt.current, 2)} unit="Дж" color="var(--internal)" />
        <Readout label="Полная" value={num(total, 2)} unit="Дж" color="var(--total)" />
      </Panel>

      <div className="controls">
        <Slider
          label="Потери за удар"
          value={loss}
          set={setLoss}
          min={0}
          max={0.5}
          step={0.05}
          display={`${Math.round(loss * 100)} %`}
          note={loss === 0 ? 'идеальный случай: мяч скачет вечно' : 'часть энергии уходит в нагрев'}
        />
        <div className="btnrow">
          <button className="btn btn--go" onClick={() => setPlaying((p) => !p)}>
            {playing ? 'Пауза' : 'Отпустить мяч'}
          </button>
          <button className="btn" onClick={reset}>
            Сброс
          </button>
        </div>
      </div>

      <p className="note">
        Это ответ на вопрос с первой диагностики. Энергия не исчезла: она перешла во
        <b> внутреннюю энергию</b> мяча, пола и воздуха, то есть они чуть-чуть нагрелись.
        Закон сохранения не сломался, просто мы раньше не смотрели в ту сторону. С этого и
        начнётся блок тепловых явлений.
      </p>
    </>
  )
}
