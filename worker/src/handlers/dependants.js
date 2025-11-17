import { proxyToCoreAPI } from '../utils/proxy';
import { proxyResponse } from '../utils/response';

/**
 * Handle dependants request
 */
export async function handleDependants(request, env, requestId, token) {
  const response = await proxyToCoreAPI(
    request,
    env,
    '/internal/v1/dependants',
    requestId,
    token
  );

  return proxyResponse(response, requestId);
}
