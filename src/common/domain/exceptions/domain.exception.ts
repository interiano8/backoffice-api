export abstract class DomainException extends Error {
  public abstract readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EntityNotFoundException extends DomainException {
  public readonly statusCode = 404;

  constructor(entity: string, identifier: string | number) {
    super(`${entity} with identifier '${identifier}' was not found.`, { entity, identifier });
  }
}

export class ValidationException extends DomainException {
  public readonly statusCode = 400;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class ConcurrencyLockException extends DomainException {
  public readonly statusCode = 409;

  constructor(resource: string, message: string = 'Resource is currently locked by another process.') {
    super(message, { resource });
  }
}

export class UnauthorizedDomainException extends DomainException {
  public readonly statusCode = 403;

  constructor(message: string = 'Action not permitted by domain policy.') {
    super(message);
  }
}
