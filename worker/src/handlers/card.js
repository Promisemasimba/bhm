import { proxyToCoreAPI } from '../utils/proxy';
import { proxyResponse } from '../utils/response';

/**
 * Handle digital card request
 */
export async function handleCard(request, env, requestId, token) {
  const response = await proxyToCoreAPI(
    request,
    env,
    '/internal/v1/card',
    requestId,
    token
  );

  return proxyResponse(response, requestId);
}
