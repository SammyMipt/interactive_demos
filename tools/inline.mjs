// Собирает dist/index.html в один самодостаточный файл.
//
// Зачем: сборка Vite подключает бандл как <script type="module" src="...">.
// Внешний модуль браузер грузит по правилам CORS, а у файла, открытого
// двойным щелчком (протокол file://), origin равен null — запрос блокируется
// и страница остаётся пустой. Атрибут crossorigin у <link> ломает так же и CSS.
//
// Поэтому CSS уезжает в <style>, а бандл — в обычный (не module) <script>
// в конце <body>: никакой загрузки по сети, никакого CORS, работает офлайн
// в любом браузере. "use strict" сохраняет режим, который был у модуля.
//
// Зависимостей нет: скрипт запускается голым node, без npm install.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const htmlPath = join(dist, 'index.html')

if (!existsSync(htmlPath)) {
  console.error(`inline: не найден ${htmlPath} — сначала npm run build`)
  process.exit(1)
}

let html = readFileSync(htmlPath, 'utf8')

const read = (href) => {
  const file = join(dist, href.replace(/^\.?\//, ''))
  if (!existsSync(file)) {
    console.error(`inline: не найден ${file}`)
    process.exit(1)
  }
  return readFileSync(file, 'utf8')
}

// Закрывающий тег внутри строки в бандле оборвал бы <script> раньше времени.
const escape = (code) => code.replace(/<\/(script|style)/gi, '<\\/$1')

let styles = 0
html = html.replace(
  /[ \t]*<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>\n?/gi,
  (_, href) => {
    styles++
    return `    <style>${escape(read(href))}</style>\n`
  },
)

let scripts = ''
let count = 0
html = html.replace(
  /[ \t]*<script[^>]*\bsrc="([^"]+)"[^>]*><\/script>\n?/gi,
  (_, src) => {
    count++
    scripts += `    <script>(function(){"use strict";\n${escape(read(src))}\n})();</script>\n`
    return ''
  },
)

if (!count) {
  console.error('inline: в dist/index.html нет внешних скриптов — уже собран?')
  process.exit(1)
}

// Обычный скрипт не откладывается, как модуль, поэтому его место — в конце
// <body>, когда <div id="root"> уже разобран парсером.
html = html.replace(/([ \t]*)<\/body>/i, `${scripts}$1</body>`)

writeFileSync(htmlPath, html)

const kb = (n) => `${Math.round(n / 1024)} КБ`
console.log(`inline: в dist/index.html встроено скриптов ${count}, стилей ${styles} — ${kb(Buffer.byteLength(html))}`)
