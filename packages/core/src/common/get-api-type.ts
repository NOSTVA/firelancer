import { Request } from 'express';
import { getConfig } from 'src/config/config-helpers';

/**
 * @description
 * Which of the APIs the current request came via.
 */
export type ApiType = 'admin' | 'shop' | 'custom';

/**
 * Determines which API the request came through based on the path.
 */
export function getApiType(req: Request): ApiType {
  const { apiOptions } = getConfig();
  const apiType = req.path.split('/').filter(Boolean)[0];
  if (apiType == apiOptions.adminApiPath) {
    return 'admin';
  } else if (apiType == apiOptions.shopApiPath) {
    return 'shop';
  }
  return 'custom';
}
