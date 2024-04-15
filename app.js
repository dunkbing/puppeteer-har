import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { compress } from 'hono/compress'
import { cors } from 'hono/cors'
import fs from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'

import { harDir, openBrowser, runHar, runLh } from './scan.js'

const app = new Hono()
app.use(logger())
app.use(compress())
app.use(cors({ origin: '*' }))

app.post('/run', async (c) => {
  const body = await c.req.json()
  const browser = await openBrowser()

  const [{ size, file }, lh] = await Promise.all([
    runHar(browser, body),
    runLh(browser, body.url)
  ])

  void browser.close()

  return c.json({
    size: `${size} bytes`,
    file,
    lh
  })
})

app.get('/har-file', async (c) => {
  const query = c.req.query()
  const filename = query.filename

  const filepath = path.join(harDir, filename)
  if (!fs.existsSync(filepath)) {
    c.status(500)
    return c.json({ error: 'file not found' })
  }
  const data = await readFile(filepath)
  return c.json({ data: JSON.parse(data) })
})

export default app
