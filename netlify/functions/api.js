import serverless from 'serverless-http'
import app from '../../backend/index.js'

const expressHandler = serverless(app)
const functionPrefix = '/.netlify/functions/api'

export const handler = async (event, context) => {
  const url = new URL(event.rawUrl)
  const path = url.pathname.startsWith(functionPrefix)
    ? `/api${url.pathname.slice(functionPrefix.length)}`
    : url.pathname

  return expressHandler({
    version: '2.0',
    rawPath: path,
    rawQueryString: url.search.slice(1),
    headers: event.headers,
    body: event.body ?? '',
    isBase64Encoded: event.isBase64Encoded ?? false,
    requestContext: {
      http: {
        method: event.httpMethod,
        sourceIp: event.clientContext?.ip ?? '',
      },
    },
  }, context)
}
