/** Erro HTTP com status e código legível. */
export class HttpError extends Error {
  constructor(status, message, code = 'error') {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export function assert(condition, status, message, code) {
  if (!condition) throw new HttpError(status, message, code);
}
