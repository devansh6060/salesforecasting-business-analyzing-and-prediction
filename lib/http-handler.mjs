// Support both Vercel's Node request/response signature and the local Web adapter.
export function httpHandler(handle) {
  return async function handler(request, response) {
    let result;
    try {
      const webRequest = request instanceof Request ? request : new Request(
        new URL(request.url, 'http://localhost'), { method: request.method || 'GET' }
      );
      result = await handle(webRequest);
    } catch {
      result = Response.json({ error: 'The market service could not complete this request. Please retry.' }, {
        status: 500, headers: { 'Cache-Control': 'no-store' }
      });
    }
    if (!response) return result;
    response.statusCode = result.status;
    result.headers.forEach((value, name) => response.setHeader(name, value));
    response.end(Buffer.from(await result.arrayBuffer()));
  };
}
