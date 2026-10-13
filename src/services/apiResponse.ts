export class ApiResponseError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function readApiResponse<T>(response: Response, path: string): Promise<T> {
  const body = await response.text();
  let result: any;
  try {
    result = JSON.parse(body);
  } catch {
    if (response.status === 404 || response.headers.get('content-type')?.includes('text/html')) {
      throw new Error(`The server endpoint ${path} is unavailable. Restart the app server with npm run dev, or deploy the updated API if this is the live site.`);
    }
    throw new Error(`The server returned an invalid response for ${path} (HTTP ${response.status}). Please try again or check the server logs.`);
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error(`The server returned an unexpected response for ${path}.`);
  }
  if (!response.ok || result.success === false) {
    throw new ApiResponseError(typeof result.error === 'string' ? result.error : `Request failed (HTTP ${response.status}).`, response.status);
  }
  return result as T;
}
