import React, { useState } from 'react'
import Demo1Work from './demos/Demo1Work.jsx'
import Demo2MassWeight from './demos/Demo2MassWeight.jsx'
import Demo3EnergyIsWork from './demos/Demo3EnergyIsWork.jsx'
import Demo4ZeroLevel from './demos/Demo4ZeroLevel.jsx'
import Demo5Hill from './demos/Demo5Hill.jsx'
import Demo6Pendulum from './demos/Demo6Pendulum.jsx'
import Demo7SqrtGH from './demos/Demo7SqrtGH.jsx'
import Demo8Bounce from './demos/Demo8Bounce.jsx'
import Demo9Molecules from './demos/Demo9Molecules.jsx'
import Demo10Heating from './demos/Demo10Heating.jsx'

/* Нумерация демонстраций сквозная: на занятии достаточно сказать
   «открой демо 5» и не искать нужную по названию. */

const DEMOS = [
  { n: 1, title: 'Работа и перемещение', C: Demo1Work },
  { n: 2, title: 'Масса и вес', C: Demo2MassWeight },
  { n: 3, title: 'Энергия как работа', C: Demo3EnergyIsWork },
  { n: 4, title: 'Нулевой уровень', C: Demo4ZeroLevel },
  { n: 5, title: 'Шарик на горке', C: Demo5Hill, key: true },
  { n: 6, title: 'Маятник', C: Demo6Pendulum },
  { n: 7, title: 'Масса не влияет', C: Demo7SqrtGH },
  { n: 8, title: 'Мяч и нагрев', C: Demo8Bounce, key: true },
  { n: 9, title: 'Молекулы и температура', C: Demo9Molecules, key: true },
  { n: 10, title: 'Что труднее нагреть', C: Demo10Heating }
]

export default function App() {
  const [active, setActive] = useState(1)
  const current = DEMOS.find((d) => d.n === active) || DEMOS[0]
  const Current = current.C

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__title">
          Энергия<span>интерактивные демонстрации</span>
        </div>
        <div className="topbar__const">g = 10 Н/кг</div>
      </header>

      <nav className="rail" aria-label="Список демонстраций">
        {DEMOS.map((d) => (
          <button
            key={d.n}
            className={'rail__item' + (d.n === active ? ' rail__item--active' : '')}
            onClick={() => setActive(d.n)}
            aria-current={d.n === active ? 'page' : undefined}
          >
            <span className="rail__num">{String(d.n).padStart(2, '0')}</span>
            <span>
              {d.title}
              {d.key && <span className="rail__star" title="ключевое демо">★</span>}
            </span>
          </button>
        ))}
      </nav>

      <main className="main">
        <Current />
      </main>
    </div>
  )
}
