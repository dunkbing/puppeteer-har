import { startJobs } from './jobs.js'
import { closeAll as closePubsub } from './pubsub.js'

void startJobs()

const signals = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGTERM: 15
}

Object.keys(signals).forEach((signal) => {
  process.on(signal, () => {
    console.log(`process received a ${signal} signal`)
    closePubsub()
    process.exit(signals[signal])
  })
})
