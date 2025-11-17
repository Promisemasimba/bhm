import { proxyToCoreAPI } from '../utils/proxy';
import { proxyResponse } from '../utils/response';

/**
 * Handle membership certificate request
 */
export async function handleCertificate(request, env, requestId, token) {
  const response = await proxyToCoreAPI(
    request,
    env,
    '/internal/v1/membership-certificate',
    requestId,
    token
  );

  return proxyResponse(response, requestId);
}
