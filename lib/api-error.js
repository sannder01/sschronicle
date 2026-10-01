export class ApiError extends Error {
  constructor(status, message, code = 'INVALID_REQUEST', details = {}) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}
