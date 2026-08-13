import React, { useRef, useState } from 'react'
import { Stage, Panel, Readout, EnergyBars, Slider, useRaf, num, G } from '../ui.jsx'

/* Прыгающий мяч. Механическая энергия тает, внутренняя растёт ровно настолько же.
   Полная сумма стоит на месте. Это вход в блок тепловых явлений.           */

const M = 0.2
const H0 = 2.0
const E0 = M * G * H0 // 4 Дж
const PX_PER_M = 140
const Y_GROUND = 372

const V0 = Math.sqrt(2 * G * H0) // скорость у земли при падении с H0
const V_STOP = 0.25              // ниже этой скорости считаем, что мяч улёгся

/* Полёт между ударами считается точной формулой, а не пошаговым
   интегрированием: y = v0·t − g·t²/2 и vy = v0 − g·t. При этом
   Ep + Ek = m·v0²/2 выполняется тождественно, поэтому полная энергия не
   зависит ни от частоты кадров, ни от длины шага.

   Раньше шаг считался полунеявной схемой Эйлера, а она для постоянной
   тяжести теряет ровно g²·Δt²/2 на единицу массы каждый шаг. Потеря шла
   мимо счётчика нагрева: «Полная» уползала с 4,00 тем сильнее, чем ниже
   был фреймрейт, а в конце присваивание eInt = E0 возвращало её к 4,00
   рывком. Здесь терять нечего: сумма сходится по построению.          */

export default function Demo8Bounce() {
  const [loss, setLoss] = useState(0.3) // доля энергии, теряемая за удар
  const [playing, setPlaying] = useState(false)
  const t = useRef(V0 / G)  // время от последнего удара; старт — в верхней точке
  const v0 = useRef(V0)     // скорость сразу после последнего удара
  const eInt = useRef(0)    // накопленная внутренняя энергия
  const heat = useRef(0)    // вспышка нагрева для подсветки
  const [, force] = useState(0)

  useRaf((dt) => {
    let v = v0.current

    /* Если мяч уже улёгся, время стоит вместе с ним. Без этого несколько
       кадров всё же успевают пройти — setPlaying(false) обновляет состояние
       не мгновенно, — и t продолжало бы расти при нулевой v0, разгоняя
       мнимую скорость v0 − g·t и раздувая Ek на ровном месте. */
    let tt = v > 0 ? t.current + dt : 0

    // за один кадр может уместиться несколько ударов, когда мяч уже частит
    for (let guard = 0; v > 0 && tt >= (2 * v) / G && guard < 200; guard++) {
      tt -= (2 * v) / G
      const ekBefore = 0.5 * M * v * v
      const ekAfter = ekBefore * (1 - loss)
      eInt.current += ekBefore - ekAfter
      heat.current = 1
      v = Math.sqrt((2 * ekAfter) / M)
      if (v < V_STOP) {
        // последние капли механической энергии тоже уходят в нагрев,
        // поэтому в покое нагрев равен ровно E0 без всякой подгонки
        eInt.current += 0.5 * M * v * v
        v = 0
        tt = 0
        setPlaying(false)
      }
    }

    t.current = tt
    v0.current = v
    heat.current = Math.max(0, heat.current - dt * 2.2)
    force((n) => n + 1)
  }, playing)

  /* Фаза полёта заведомо лежит внутри одного прыжка: от 0 до 2·v0/g.
     При такой t высота неотрицательна, а |v0 − g·t| никогда не больше v0,
     то есть Ek не может превысить m·v0²/2, а сумма — E0. Это делает
     всплеск энергии невозможным арифметически, а не по договорённости о
     том, в каком порядке сработают кадры и обновления состояния. */
  const flight = v0.current > 0 ? Math.min(Math.max(t.current, 0), (2 * v0.current) / G) : 0
  const height = Math.max(0, v0.current * flight - 0.5 * G * flight * flight)
  const speed = v0.current - G * flight

  const Ep = M * G * height
  const Ek = 0.5 * M * speed * speed
  const total = Ep + Ek + eInt.current

  function reset() {
    t.current = V0 / G
    v0.current = V0
    eInt.current = 0
    heat.current = 0
    setPlaying(false)
    force((n) => n + 1)
  }

  const ballY = Y_GROUND - height * PX_PER_M - 15

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
            {num(height, 2)} м
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
