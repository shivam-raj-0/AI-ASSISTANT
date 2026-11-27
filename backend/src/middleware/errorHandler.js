export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found.`
    }
  });
}

export function errorHandler(err, req, res, _next) {
  const status = Number.isInteger(err.status) ? err.status : 500;
  const isClientError = status >= 400 && status < 500;

  if (!isClientError) {
    // Log error details server-side without exposing internals to clients
    console.error('[SmartMate Error]', {
      path: req.originalUrl,
      method: req.method,
      message: err.message
    });
  }

  res.status(status).json({
    error: {
      code: err.code || (isClientError ? 'BAD_REQUEST' : 'INTERNAL_ERROR'),
      message: isClientError
        ? err.message
        : 'An unexpected server error occurred. Please try again.'
    }
  });
}
