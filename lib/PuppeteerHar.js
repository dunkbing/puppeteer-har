import { writeFile } from 'fs'
import { promisify } from 'util'
import { harFromMessages } from 'chrome-har'

// event types to observe
const pageObserve = [
  'Page.loadEventFired',
  'Page.domContentEventFired',
  'Page.frameStartedLoading',
  'Page.frameAttached',
  'Page.frameScheduledNavigation'
]

const networkObserve = [
  'Network.requestWillBeSent',
  'Network.requestServedFromCache',
  'Network.dataReceived',
  'Network.responseReceived',
  'Network.resourceChangedPriority',
  'Network.loadingFinished',
  'Network.loadingFailed'
]

class PuppeteerHar {
  /**
   * @param {object} page
   */
  constructor (page) {
    this.page = page
    this.mainFrame = this.page.mainFrame()
    this.inProgress = false
    this.cleanUp()
  }

  /**
   * @returns {void}
   */
  cleanUp () {
    this.network_events = []
    this.page_events = []
    this.response_body_promises = []
  }

  /**
   * @param {{path: string}=} options
   * @return {Promise<void>}
   */
  async start ({ path, saveResponse, captureMimeTypes } = {}) {
    this.inProgress = true
    this.saveResponse = saveResponse || false
    this.captureMimeTypes = captureMimeTypes ||
      ['text/html', 'application/json']
    this.path = path
    this.client = await this.page.target().createCDPSession()
    await this.client.send('Page.enable')
    await this.client.send('Network.enable')
    pageObserve.forEach((method) => {
      this.client.on(method, (params) => {
        if (!this.inProgress) {
          return
        }
        this.page_events.push({ method, params })
      })
    })
    networkObserve.forEach((method) => {
      this.client.on(method, (params) => {
        if (!this.inProgress) {
          return
        }
        this.network_events.push({ method, params })

        if (this.saveResponse && method === 'Network.responseReceived') {
          const response = params.response
          const requestId = params.requestId

          // Response body is unavailable for redirects, no-content, image, audio and video responses
          if (
            response.status !== 204 &&
            response.headers.location == null &&
            this.captureMimeTypes.includes(response.mimeType)
          ) {
            const promise = this.client.send(
              'Network.getResponseBody',
              { requestId }
            ).then((responseBody) => {
              // Set the response so `chrome-har` can add it to the HAR
              params.response.body = Buffer.from(
                responseBody.body,
                responseBody.base64Encoded ? 'base64' : undefined
              ).toString()
            }, (reason) => {
              // Resources (i.e. response bodies) are flushed after page commits
              // navigation and we are no longer able to retrieve them. In this
              // case, fail soft so we still add the rest of the response to the
              // HAR. Possible option would be force wait before navigation...
            })
            this.response_body_promises.push(promise)
          }
        }
      })
    })
  }

  /**
   * @returns {Promise<void|object>}
   */
  async stop () {
    this.inProgress = false
    await Promise.all(this.response_body_promises)
    await this.client.detach()
    const har = harFromMessages(
      this.page_events.concat(this.network_events),
      { includeTextFromResponseBody: this.saveResponse }
    )
    this.cleanUp()
    if (this.path) {
      await promisify(writeFile)(this.path, JSON.stringify(har, null, 2))
    } else {
      return har
    }
  }
}

export default PuppeteerHar
