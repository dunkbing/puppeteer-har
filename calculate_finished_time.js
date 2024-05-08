export const formatTime = (time) => {
  if (time < 1000) {
    return `${Math.round(time)}ms`
  }
  if (time < 60000) {
    return `${Math.ceil(time / 10) / 100}s`
  }
  return `${(Math.ceil(time / 60000) * 100) / 100}m`
}

export const getTimings = ({ startedDateTime, timings }, firstEntryTime) => ({
  ...timings,
  startTime: new Date(startedDateTime).getTime() - new Date(firstEntryTime).getTime()
})

export const calculateFinishTime = (entries) => {
  const firstEntryTime = entries[0].startedDateTime
  const data = entries
    .filter((entry) => entry.response && getUrlInfo(entry.request.url).domain)
    .map((entry, index) => {
      return {
        index,
        status: entry.response.status,
        method: entry.request.method,
        startedDateTime: new Date(entry.startedDateTime).getTime(),
        timings: getTimings(entry, firstEntryTime),
        time: entry.time,
        serverIPAddress: entry.serverIPAddress || ':80',
        ...getUrlInfo(entry.request.url)
      }
    })
  const finishTimes = data.map(({ timings }) => (
    Object.values(timings).reduce((acc, durationInMS) => (
      acc + (durationInMS > -1 ? durationInMS : 0)
    ), 0)))
  return Math.max(...finishTimes)
}

export const getUrlInfo = (url) => {
  // If there's an invalid URL (resource identifier, etc) the constructor would throw an exception.
  // Return a 'placeholder' object with default values in the event the passed value cannot be
  // parsed.
  try {
    const urlInfo = new URL(url)
    const pathSplit = urlInfo.pathname.split('/')
    const fileName = (
      pathSplit[pathSplit.length - 1].trim()
        ? pathSplit[pathSplit.length - 1]
        : pathSplit[pathSplit.length - 2]
    ) + urlInfo.search

    return {
      domain: urlInfo.host,
      filename: fileName || urlInfo.href,
      url: urlInfo.href
    }
  } catch (er) {
    return {
      domain: 'N/A',
      filename: url ?? 'N/A',
      url
    }
  }
}
