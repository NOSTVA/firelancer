import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { getApiType } from 'src/common/get-api-type';

/**
 * @description
 * Resolver param decorator which returns which Api the request came though.
 * This is useful because sometimes the same resolver will have different behaviour
 * depending whether it is being called from the shop API or the admin API.
 *
 * Returns a string of type ApiType.
 *
 * @example
 * ```ts
 *  \@Get()
 *  getAdministrators(\@Api() apiType: ApiType) {
 *    if (apiType === 'admin') {
 *      // ...
 *    }
 *  }
 * ```
 */
export const Api = createParamDecorator((data, ctx: ExecutionContext) => {
  const info = ctx.getArgByIndex(3);
  return getApiType(info);
});
