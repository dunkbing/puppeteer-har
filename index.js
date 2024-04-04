import { serve } from '@hono/node-server'
import app from './app.js'

const port = Number(process.env.PORT || 3000)

const server = serve({
  fetch: app.fetch
}).listen(port, () => {
  console.log(`Server listening on port ${port}`)
})

const shutdown = (signal, value) => {
  console.log('shutdown!')
  server.close(() => {
    console.log(`server stopped by ${signal} with value ${value}`)
  })
}

const signals = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGTERM: 15
}

Object.keys(signals).forEach((signal) => {
  process.on(signal, () => {
    console.log(`process received a ${signal} signal`)
    shutdown(signal, signals[signal])
  })
})
