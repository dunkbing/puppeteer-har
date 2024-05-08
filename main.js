import { Worker } from 'node:worker_threads'
import { Queue } from 'bullmq'

import { config, taskQueueName } from './config.js'
import { connectAll, subscriber, cred } from './pubsub.js'

const currentThreads = {}

const taskQueue = new Queue(taskQueueName, { connection: cred })

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
      const { agentId } = steps
      if (config.agentId !== agentId) {
        return
      }
      taskQueue.add(`start-monitoring-${config.agentId}`, steps, { removeOnComplete: true, removeOnFail: true })
    }
  })
}

const runService = () => {
  const worker = new Worker('./jobs.js')
  console.log('spawning new worker', worker.threadId)
  currentThreads[worker.threadId] = true

  worker.on('message', (val) => {
    console.log('message', val)
  })
  worker.on('error', (err) => {
    console.log('error', err)
  })
  worker.on('exit', (code) => {
    if (code !== 0) {
      console.log(`worker ${worker.threadId} stopped with ${code} exit code`)
      delete currentThreads[worker.threadId]
    }
  })
}

const run = async () => {
  startJobs()
  setInterval(() => {
    const currentThreadsNum = Object.keys(currentThreads)
    if (currentThreadsNum < config.threadsNum) {
      runService()
    }
  }, 2000)
}

run()
