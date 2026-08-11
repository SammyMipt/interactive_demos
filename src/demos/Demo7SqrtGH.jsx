import React, { useState, useRef } from 'react'
import { Stage, Panel, Readout, Slider, SvgFormula, useRaf, num, G } from '../ui.jsx'

/* Скорость внизу горки не зависит от массы.
   Ползунок массы намеренно ни на что не влияет, и это подписано.
   Два шара разной массы стартуют вместе и приезжают вместе.       */

const PX_PER_M = 58
const Y_BOT = 372
const X_START = 130
const RUN = 300 // горизонтальная длина склона, px

export default function Demo7SqrtGH() {
  const [h, setH] = useState(3)
  const [mLight, setMLight] = useState(1)
  const [mHeavy, setMHeavy] = useState(30)
  const tRef = useRef(0)
  const [running, setRunning] = useState(false)
  const hRef = useRef(3)
  const [, force] = useState(0)
  const t = tRef.current

  const vEnd = Math.sqrt(2 * G * hRef.current)
  // равноускоренный спуск вдоль склона длиной sLen
  const yTop = Y_BOT - hRef.current * PX_PER_M
  const sLenPx = Math.hypot(RUN, hRef.current * PX_PER_M)
  const sLenM = sLenPx / PX_PER_M
  const aAlong = (vEnd * vEnd) / (2 * sLenM)
  const tTotal = vEnd / aAlong

  const sNow = Math.min(sLenM, 0.5 * aAlong * t * t)
  const frac = sLenM > 0 ? sNow / sLenM : 0
  const vNow = Math.min(vEnd, aAlong * t)

  useRaf((dt) => {
    const nt = tRef.current + dt
    if (nt >= tTotal) {
      tRef.current = tTotal
      setRunning(false)
    } else {
      tRef.current = nt
    }
    force((n) => n + 1)
  }, running)

  function start() {
    hRef.current = h
    tRef.current = 0
    setRunning(true)
  }

  const ballX = X_START + frac * RUN
  const ballY = (yTopVal) => yTopVal + frac * (Y_BOT - yTopVal)

  return (
    <>
      <div className="head">
        <div className="head__eyebrow">Демо 7</div>
        <h1 className="head__title">Скорость внизу не зависит от массы</h1>
        <p className="head__hint">
          Два шара, лёгкий и тяжёлый, съезжают с одинаковой горки. Они приходят вниз
          одновременно и с одинаковой скоростью, потому что масса сокращается в формуле.
          Ползунки массы можешь крутить как угодно.
        </p>
        <div className="head__ask">
          <b>Вопрос:</b> почему масса не важна, хотя тяжёлое тело вроде должно ехать иначе?
        </div>
      </div>

      <Stage>
        <line x1="0" y1={Y_BOT} x2="800" y2={Y_BOT} stroke="var(--ink)" strokeWidth="3" />

        {/* склон */}
        <path
          d={`M ${X_START} ${yTop} L ${X_START + RUN} ${Y_BOT} L ${X_START} ${Y_BOT} Z`}
          fill="var(--grid)"
          opacity="0.45"
        />
        <line x1={X_START} y1={yTop} x2={X_START + RUN} y2={Y_BOT} stroke="var(--ink)" strokeWidth="3.5" />

        {/* высота */}
        <line x1={X_START} y1={yTop} x2={X_START} y2={Y_BOT} stroke="var(--potential)" strokeWidth="2.4" strokeDasharray="6 4" />
        <text
          x={X_START - 12}
          y={(yTop + Y_BOT) / 2}
          textAnchor="end"
          fontSize="16"
          fontWeight="700"
          fontFamily="var(--mono)"
          fill="var(--potential)"
        >
          h = {num(hRef.current, 1)} м
        </text>

        {/* два шара, слегка смещены, чтобы оба были видны */}
        <g>
          <circle cx={ballX} cy={ballY(yTop) - 14} r={10} fill="var(--kinetic)" stroke="#fff" strokeWidth="2" />
          <text x={ballX} y={ballY(yTop) - 30} textAnchor="middle" fontSize="11.5" fontFamily="var(--mono)" fill="var(--kinetic)" fontWeight="700">
            {num(mLight, 0)} кг
          </text>
        </g>
        <g>
          <circle cx={ballX} cy={ballY(yTop) + 16} r={19} fill="var(--potential)" stroke="#fff" strokeWidth="2" />
          <text x={ballX} y={ballY(yTop) + 44} textAnchor="middle" fontSize="11.5" fontFamily="var(--mono)" fill="var(--potential)" fontWeight="700">
            {num(mHeavy, 0)} кг
          </text>
        </g>

        {/* финиш */}
        <line x1={X_START + RUN} y1={Y_BOT - 54} x2={X_START + RUN} y2={Y_BOT} stroke="var(--total)" strokeWidth="2.6" />
        <text x={X_START + RUN + 8} y={Y_BOT - 40} fontSize="12" fill="var(--total)" fontWeight="600">
          финиш
        </text>

        {/* формула и результат */}
        <g transform="translate(520, 74)">
          <text fontSize="12" fill="var(--ink-soft)" letterSpacing="1">
            ФОРМУЛА
          </text>
          <SvgFormula tex="mgh = \frac{mv^2}{2}" y={12} width={250} height={52} size={19} />
          <text y="80" fontSize="13" fill="var(--kinetic)" fontWeight="600">
            масса сокращается с обеих сторон
          </text>
          <SvgFormula tex="v = \sqrt{2gh}" y={90} width={250} height={40} size={20} />

          <text y="148" fontSize="12" fill="var(--ink-soft)" letterSpacing="1">
            СКОРОСТЬ ВНИЗУ
          </text>
          <text y="186" fontSize="34" fontWeight="700" fontFamily="var(--mono)" fill="var(--total)">
            {num(vEnd, 1)} м/с
          </text>
          <text y="212" fontSize="12.5" fill="var(--ink-soft)">
            одинаковая для обоих шаров
          </text>

          <text y="252" fontSize="13" fontFamily="var(--mono)" fill="var(--ink-soft)">
            сейчас: {num(vNow, 1)} м/с
          </text>
        </g>
      </Stage>

      <Panel>
        <Readout label="Высота" value={num(hRef.current, 1)} unit="м" color="var(--potential)" />
        <Readout label="Скорость внизу" value={num(vEnd, 1)} unit="м/с" color="var(--total)" />
        <Readout label="Лёгкий шар" value={num(mLight, 0)} unit="кг" color="var(--kinetic)" />
        <Readout label="Тяжёлый шар" value={num(mHeavy, 0)} unit="кг" color="var(--potential)" />
      </Panel>

      <div className="controls">
        <Slider label="Высота горки" value={h} set={setH} min={0.5} max={5} step={0.5} display={`${num(h, 1)} м`} />
        <Slider
          label="Масса лёгкого шара"
          value={mLight}
          set={setMLight}
          min={1}
          max={20}
          step={1}
          display={`${mLight} кг`}
          note="этот ползунок ничего не меняет, попробуй сам"
        />
        <Slider
          label="Масса тяжёлого шара"
          value={mHeavy}
          set={setMHeavy}
          min={20}
          max={100}
          step={5}
          display={`${mHeavy} кг`}
          note="и этот тоже"
        />
        <div className="btnrow">
          <button className="btn btn--go" onClick={start} disabled={running}>
            {running ? 'Едут...' : 'Пуск'}
          </button>
        </div>
      </div>

      <p className="note">
        При высоте 5 м обе получают ровно <b>10 м/с</b>, при 0,45 м обе получают <b>3 м/с</b>.
        Масса стоит и слева, и справа в уравнении сохранения, поэтому сокращается: тяжёлому телу
        нужно больше энергии, но у него её ровно во столько же раз больше.
      </p>
    </>
  )
}
