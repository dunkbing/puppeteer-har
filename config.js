export const config = {
  nodeEnv: process.env.NODE_ENV,
  threadsNum: Number(process.env.THREADS_NUM || 3),
  agentId: process.env.AGENT_ID,
  redisHost: process.env.REDIS_HOST,
  redisPort: Number(process.env.REDIS_PORT),
  redisUser: process.env.REDIS_USER,
  redisPw: process.env.REDIS_PW,
  threadMemoryLimit: Number(process.env.THREAD_MEMORY_LIMIT || 1200)
}

export const taskQueueName = `scan-job-${config.agentId}`
