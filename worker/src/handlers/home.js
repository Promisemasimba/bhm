import { proxyToCoreAPI } from '../utils/proxy';
import { proxyResponse } from '../utils/response';

/**
 * Handle home dashboard request
 */
export async function handleHome(request, env, requestId, token) {
  const response = await proxyToCoreAPI(
    request,
    env,
    '/internal/v1/home',
    requestId,
    token
  );

  return proxyResponse(response, requestId);
}
