import React, { useEffect, useRef } from 'react'
import katex from 'katex'

export const G = 10 // Н/кг, как договорились в методичках

/* ---------- формулы ----------

   Формулы пишутся на LaTeX, KaTeX переводит их в MathML, а рисует его
   уже сам браузер своим математическим шрифтом. Поэтому шрифты KaTeX
   встраивать в файл не нужно и он остаётся лёгким — это важно, ведь
   всё приложение уезжает одним самодостаточным dist/index.html.

   Единицы измерения держим снаружи формулы: в шрифтах KaTeX нет
   кириллицы, и «Н» внутри \text{} осталось бы пустым местом.          */

const mathCache = new Map()

function toMathML(tex) {
  let html = mathCache.get(tex)
  if (html === undefined) {
    html = katex.renderToString(tex, { output: 'mathml', throwOnError: false })
    mathCache.set(tex, html)
  }
  return html
}

/* Число в формулу. У num() дробная часть отделена запятой, а LaTeX считает
   запятую знаком препинания и ставит после неё пробел: 12{,}5 это чинит. */
export function texNum(v, digits = 1) {
  return num(v, digits).replace(',', '{,}')
}

/* Формула в обычном тексте. Единица измерения передаётся отдельно и
   остаётся снаружи математики. */
export function Formula({ tex, unit }) {
  return (
    <span className="formula">
      <span dangerouslySetInnerHTML={{ __html: toMathML(tex) }} />
      {unit ? ` ${unit}` : null}
    </span>
  )
}

/* Формула внутри сцены. MathML это HTML, а не SVG, поэтому его приходится
   вставлять через foreignObject. Координаты и размер задаются в единицах
   viewBox, так что формула масштабируется вместе со сценой. В отличие от
   <text>, y это верх блока, а не базовая линия. */
export function SvgFormula({ tex, unit, x = 0, y = 0, width, height, size = 19, fill = 'var(--ink)' }) {
  return (
    <foreignObject x={x} y={y} width={width} height={height}>
      <div className="formula" style={{ fontSize: `${size}px`, lineHeight: 1.25, color: fill }}>
        <span dangerouslySetInnerHTML={{ __html: toMathML(tex) }} />
        {unit ? ` ${unit}` : null}
      </div>
    </foreignObject>
  )
}

/* ---------- цикл анимации ---------- */

export function useRaf(cb, active = true) {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => {
    if (!active) return
    let id
    let last = performance.now()
    const loop = (t) => {
      const dt = Math.min((t - last) / 1000, 0.05)
      last = t
      ref.current(dt)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [active])
}

/* ---------- форматирование чисел ---------- */

export function num(v, digits = 1) {
  if (!isFinite(v)) return '0'
  const r = Math.abs(v) < 1e-9 ? 0 : v
  return r.toFixed(digits).replace('.', ',').replace('-0,0', '0,0')
}

/* ---------- сцена с миллиметровкой ---------- */

export function Stage({ children, viewBox = '0 0 800 450' }) {
  return (
    <div className="stage">
      <svg viewBox={viewBox} xmlns="http://www.w3.org/2000/svg" role="img">
        <defs>
          <pattern id="mm" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" fill="none" stroke="var(--grid)" strokeWidth="0.6" />
          </pattern>
          <pattern id="mm10" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#mm)" />
            <path d="M100 0H0V100" fill="none" stroke="var(--grid-bold)" strokeWidth="1.1" />
          </pattern>
          <marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
            <path d="M0 0L9 4.5L0 9z" fill="var(--kinetic)" />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill="url(#mm10)" />
        {children}
      </svg>
    </div>
  )
}

/* ---------- показания приборов ---------- */

export function Readout({ label, value, unit, color, flag }) {
  return (
    <div className={'readout' + (flag ? ' readout--flag' : '')} style={color ? { '--accent': color } : undefined}>
      <div className="readout__label">{label}</div>
      <div className="readout__value">
        {value}
        {unit && <span className="readout__unit">{unit}</span>}
      </div>
    </div>
  )
}

export function Panel({ children }) {
  return <div className="panel">{children}</div>
}

/* ---------- ползунок ---------- */

export function Slider({ label, value, set, min, max, step = 0.1, display, note }) {
  return (
    <div className="ctrl">
      <div className="ctrl__top">
        <label className="ctrl__label" htmlFor={'s-' + label}>{label}</label>
        <span className="ctrl__value">{display}</span>
      </div>
      <input
        id={'s-' + label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(parseFloat(e.target.value))}
      />
      {note && <div className="ctrl__note">{note}</div>}
    </div>
  )
}

/* ---------- столбики энергии; сигнатурный элемент всего стенда ----------
   Линия полной энергии рисуется поверх столбиков и никогда не двигается.
   Именно её неподвижность и есть главная мысль всей серии.               */

export function EnergyBars({ items, max, x = 596, y = 40, h = 330, showInvariant = true, unit = 'Дж' }) {
  const bw = 46
  const gap = 22
  const scale = (v) => (max > 0 ? Math.max(0, Math.min(1, v / max)) * h : 0)
  const total = items.reduce((s, it) => s + (it.inTotal === false ? 0 : it.value), 0)

  return (
    <g>
      {items.map((it, i) => {
        const bx = x + i * (bw + gap)
        const bh = scale(it.value)
        return (
          <g key={it.label}>
            <rect x={bx} y={y} width={bw} height={h} fill="#fff" stroke="var(--edge)" strokeWidth="1" />
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1={bx}
                x2={bx + bw}
                y1={y + h * f}
                y2={y + h * f}
                stroke="var(--edge)"
                strokeWidth="1"
              />
            ))}
            <rect x={bx} y={y + h - bh} width={bw} height={bh} fill={it.color} opacity="0.9" />
            <text
              x={bx + bw / 2}
              y={y + h + 17}
              textAnchor="middle"
              fontSize="12.5"
              fill="var(--ink-soft)"
              fontFamily="var(--sans)"
            >
              {it.label}
            </text>
            <text
              x={bx + bw / 2}
              y={y + h + 35}
              textAnchor="middle"
              fontSize="15"
              fontWeight="700"
              fill={it.color}
              fontFamily="var(--mono)"
            >
              {num(it.value, 2)}
            </text>
          </g>
        )
      })}

      {showInvariant && (
        <g>
          <line
            x1={x - 12}
            x2={x + items.length * (bw + gap) - gap + 12}
            y1={y + h - scale(max)}
            y2={y + h - scale(max)}
            stroke="var(--total)"
            strokeWidth="2.2"
            strokeDasharray="7 5"
          />
          <text
            x={x - 16}
            y={y + h - scale(max) - 7}
            textAnchor="start"
            fontSize="12"
            fill="var(--total)"
            fontFamily="var(--sans)"
            fontWeight="600"
          >
            полная энергия {num(total, 2)} {unit}: линия не двигается
          </text>
        </g>
      )}
    </g>
  )
}

/* ---------- вспомогательное: подпись оси ---------- */

export function Tick({ x1, y1, x2, y2, label, anchor = 'end', dx = -7, dy = 4 }) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink-soft)" strokeWidth="1" strokeDasharray="3 3" />
      <text
        x={x1 + dx}
        y={y1 + dy}
        textAnchor={anchor}
        fontSize="12"
        fill="var(--ink-soft)"
        fontFamily="var(--mono)"
      >
        {label}
      </text>
    </g>
  )
}
