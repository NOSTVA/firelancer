import { ArgumentsHost, ExecutionContext } from '@nestjs/common';
import { Request, Response } from 'express';
import { InternalServerError } from './error/errors';

export type RestContext = { req: Request; res: Response };

/**
 * Parses in the Nest ExecutionContext of the incoming request, accounting for REST requests.
 */
export function parseContext(context: ExecutionContext | ArgumentsHost): RestContext {
  if (context.getType() === 'http') {
    const httpContext = context.switchToHttp();
    return {
      req: httpContext.getRequest(),
      res: httpContext.getResponse(),
    };
  } else {
    throw new InternalServerError(`Context "${context.getType()}" is not supported.`);
  }
}
