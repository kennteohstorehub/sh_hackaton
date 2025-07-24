// Temporary CSRF bypass for testing
const csrfTokenManager = (req, res, next) => {
  if (!res.locals) res.locals = {};
  res.locals.csrfToken = 'test-token';
  next();
};

const csrfValidation = (req, res, next) => {
  // Skip all CSRF validation temporarily
  next();
};

const csrfHelpers = (req, res, next) => {
  if (!res.locals) res.locals = {};
  if (typeof res.locals.csrfToken === 'undefined') {
    res.locals.csrfToken = 'test-token';
  }
  next();
};

module.exports = {
  csrfTokenManager,
  csrfValidation,
  csrfHelpers
};