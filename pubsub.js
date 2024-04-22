import Redis from 'ioredis'

import { config } from './config.js'

const cred = {
  host: config.redisHost,
  port: config.redisPort,
  username: config.redisUser,
  password: config.redisPw,
  db: 0,
  connectTimeout: 5000
}

export const publisher = new Redis(cred, { lazyConnect: true })

export const subscriber = new Redis(cred, { lazyConnect: true })

export async function connectAll () {
  await publisher.connect((e) => {
    if (e) return console.error('Error connecting to publisher', e)
    console.log('Publisher connected')
  })
  await subscriber.connect((e) => {
    if (e) return console.error('Error connecting to subscriber', e)
    console.log('Subscriber connected')
  })
}

export function closeAll () {
  publisher.disconnect()
  subscriber.disconnect()
}
