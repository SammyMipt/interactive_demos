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
// Тот же файл кладётся в docs/ — оттуда его публикует GitHub Pages
// (Settings → Pages → Deploy from a branch, ветка main, папка /docs).
//
// Зависимостей нет: скрипт запускается голым node, без npm install.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const docs = join(root, 'docs')
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

// Что и в каком виде уехало в страницу — по этому списку в конце
// проверяем, что ничего не исказилось.
const inlined = []

let styles = 0
html = html.replace(
  /[ \t]*<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>\n?/gi,
  (_, href) => {
    styles++
    const code = escape(read(href))
    inlined.push([href, code])
    return `    <style>${code}</style>\n`
  },
)

let scripts = ''
let count = 0
html = html.replace(
  /[ \t]*<script[^>]*\bsrc="([^"]+)"[^>]*><\/script>\n?/gi,
  (_, src) => {
    count++
    const code = escape(read(src))
    inlined.push([src, code])
    scripts += `    <script>(function(){"use strict";\n${code}\n})();</script>\n`
    return ''
  },
)

if (!count) {
  console.error('inline: в dist/index.html нет внешних скриптов — уже собран?')
  process.exit(1)
}

// Обычный скрипт не откладывается, как модуль, поэтому его место — в конце
// <body>, когда <div id="root"> уже разобран парсером.
//
// Подставляем через функцию, а не через строку замены: в строке замены
// $&, $1 и $$ имеют особый смысл и заменяются кусками совпадения. В
// минифицированном бандле такие последовательности встречаются (у KaTeX
// $ — разделитель формул), и код молча ломался.
html = html.replace(/([ \t]*)<\/body>/i, (_, indent) => scripts + indent + '</body>')

// Страховка: бандл должен лежать в странице слово в слово. Однажды он
// молча испортился на подстановке ($& и $1 в строке замены), страница
// осталась пустой, и заметно это стало только в браузере.
for (const [src, code] of inlined) {
  if (!html.includes(code)) {
    console.error(`inline: ${src} попал в страницу искажённым — сборка остановлена`)
    process.exit(1)
  }
}

writeFileSync(htmlPath, html)

// Копия для GitHub Pages. Пустой .nojekyll выключает обработку Jekyll:
// она сайту не нужна и только замедляет публикацию.
mkdirSync(docs, { recursive: true })
writeFileSync(join(docs, 'index.html'), html)
writeFileSync(join(docs, '.nojekyll'), '')

const kb = (n) => `${Math.round(n / 1024)} КБ`
console.log(
  `inline: встроено скриптов ${count}, стилей ${styles} — ${kb(Buffer.byteLength(html))}\n` +
    'inline: записаны dist/index.html и docs/index.html',
)
