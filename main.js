import { Worker } from 'worker_threads'
import { Queue } from 'bullmq'
import { config } from './config.js'

import { connectAll, subscriber, cred } from './pubsub.js'

let currentThreadsNum = 0

const taskQueue = new Queue('scan-job', { connection: cred })

async function startJobs () {
  await connectAll()
  console.log('Starting jobs')
  subscriber.subscribe('start', (err, count) => {
    if (err) {
      console.error('Failed to subscribe: %s', err.message)
    } else {
      console.log(
        `Subscribed successfully! This client is currently subscribed to ${count} channels.`
      )
    }
  })

  subscriber.on('message', async (channel, message) => {
    if (channel === 'start') {
      const steps = JSON.parse(message)
      taskQueue.add('start-monitoring', steps, { removeOnComplete: true, removeOnFail: true })
    }
  })
}

const runService = () => {
  currentThreadsNum++
  const worker = new Worker('./jobs.js')
  console.log('spawning new worker', worker.threadId)

  worker.on('message', (val) => {
    console.log('message', val)
  })
  worker.on('error', (err) => {
    console.log('error', err)
  })
  worker.on('exit', (code) => {
    if (code !== 0) {
      console.log(`worker ${worker.threadId} stopped with ${code} exit code`)
      currentThreadsNum--
    }
  })
}

const run = async () => {
  startJobs()
  setInterval(() => {
    if (currentThreadsNum < config.threadsNum) {
      runService()
    }
  }, 2000)
}

run()
