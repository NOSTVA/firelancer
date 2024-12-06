import { HttpException, HttpStatus } from '@nestjs/common';
import { ID } from '../shared-types';

/**
 * @description
 * This error should be thrown when some unexpected and exceptional case is encountered.
 */
export class InternalServerError extends HttpException {
  constructor(public description: string = 'INTERNAL_SERVER_ERROR') {
    super('INTERNAL_SERVER_ERROR', HttpStatus.INTERNAL_SERVER_ERROR, { cause: new Error(), description });
  }
}

/**
 * @description
 * This error should be thrown when user input is not as expected.
 */
export class UserInputError extends HttpException {
  constructor(public description: string = 'USER_INPUT_ERROR') {
    super('USER_INPUT_ERROR', HttpStatus.BAD_REQUEST, { description });
  }
}

/**
 * @description
 * This error should be thrown when an operation is attempted which is not allowed.
 */
export class IllegalOperationError extends HttpException {
  constructor(public description: string = 'ILLEGAL_OPERATION') {
    super('ILLEGAL_OPERATION', HttpStatus.BAD_REQUEST, { description });
  }
}

/**
 * @description
 * This error should be thrown when the user's authentication credentials do not match.
 */
export class UnauthorizedError extends HttpException {
  constructor(public description: string = 'error.unauthorized') {
    super('UNAUTHORIZED', HttpStatus.UNAUTHORIZED, { description });
  }
}

/**
 * @description
 * This error should be thrown when a user attempts to access a resource which is outside of
 * his or her privileges.
 */
export class ForbiddenError extends HttpException {
  constructor(public description: string = 'error.forbidden') {
    super('FORBIDDEN', HttpStatus.FORBIDDEN, { description });
  }
}

/**
 * @description
 * This error should be thrown when an entity cannot be found in the database, i.e. no entity of
 * the given entityName (Product, User etc.) exists with the provided id.
 */
export class EntityNotFoundError extends HttpException {
  constructor(
    public entityName: any | string,
    public id: ID,
    public description: string = 'error.entity-with-id-not-found',
  ) {
    super('ENTITY_NOT_FOUND', HttpStatus.NOT_FOUND, { description });
  }
}

export class InvalidCredentialsError extends HttpException {
  constructor(public description: string = 'INVALID_CREDENTIALS_ERROR') {
    super('INVALID_CREDENTIALS_ERROR', HttpStatus.BAD_REQUEST, { description });
  }
}

export class NotVerifiedError extends HttpException {
  constructor(public description: string = 'NOT_VERIFIED_ERROR') {
    super('NOT_VERIFIED_ERROR', HttpStatus.METHOD_NOT_ALLOWED, { description });
  }
}

export class PasswordValidationError extends HttpException {
  constructor(public description: string = 'PASSWORD_VALIDATION_ERROR') {
    super('PASSWORD_VALIDATION_ERROR', HttpStatus.BAD_REQUEST, { description });
  }
}

export class NativeAuthStrategyError extends HttpException {
  constructor(public description: string = 'NATIVE_AUTH_STRATEGY_ERROR') {
    super('NATIVE_AUTH_STRATEGY_ERROR', HttpStatus.INTERNAL_SERVER_ERROR, { description });
  }
}

export class EmailAddressConflictError extends HttpException {
  constructor(public description: string = 'EMAIL_ADDRESS_CONFLICT_ERROR') {
    super('EMAIL_ADDRESS_CONFLICT_ERROR', HttpStatus.BAD_REQUEST, { description });
  }
}

export class MissingPasswordError extends HttpException {
  constructor(public description: string = 'MISSING_PASSWORD_ERROR') {
    super('MISSING_PASSWORD_ERROR', HttpStatus.BAD_REQUEST, { description });
  }
}

export class PasswordAlreadySetError extends HttpException {
  constructor(public description: string = 'PASSWORD_ALREADY_SET_ERROR') {
    super('PASSWORD_ALREADY_SET_ERROR', HttpStatus.BAD_REQUEST, { description });
  }
}

export class VerificationTokenExpiredError extends HttpException {
  constructor(public description: string = 'VERIFICATION_TOKEN_EXPIRED_ERROR') {
    super('VERIFICATION_TOKEN_EXPIRED_ERROR', HttpStatus.BAD_REQUEST, { description });
  }
}

export class VerificationTokenInvalidError extends HttpException {
  constructor(public description: string = 'VERIFICATION_TOKEN_INVALID_ERROR') {
    super('VERIFICATION_TOKEN_INVALID_ERROR', HttpStatus.BAD_REQUEST, { description });
  }
}

export class PasswordResetTokenInvalidError extends HttpException {
  constructor(public description: string = 'PASSWORD_RESET_TOKEN_INVALID_ERROR') {
    super('PASSWORD_RESET_TOKEN_INVALID_ERROR', HttpStatus.BAD_REQUEST, { description });
  }
}

export class PasswordResetTokenExpiredError extends HttpException {
  constructor(public description: string = 'PASSWORD_RESET_TOKEN_EXPIRED_ERROR') {
    super('PASSWORD_RESET_TOKEN_EXPIRED_ERROR', HttpStatus.BAD_REQUEST, { description });
  }
}

export class IdentifierChangeTokenInvalidError extends HttpException {
  constructor(public description: string = 'IDENTIFIER_CHANGE_TOKEN_INVALID_ERROR') {
    super('IDENTIFIER_CHANGE_TOKEN_INVALID_ERROR', HttpStatus.BAD_REQUEST, { description });
  }
}

export class IdentifierChangeTokenExpiredError extends HttpException {
  constructor(public description: string = 'IDENTIFIER_CHANGE_TOKEN_EXPIRED_ERROR') {
    super('IDENTIFIER_CHANGE_TOKEN_EXPIRED_ERROR', HttpStatus.BAD_REQUEST, { description });
  }
}
