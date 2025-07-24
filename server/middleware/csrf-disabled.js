// COMPLETELY DISABLED CSRF FOR TESTING
console.log('[CSRF-DISABLED] Loading disabled CSRF middleware');

const csrfTokenManager = (req, res, next) => {
  console.log('[CSRF-DISABLED] Token manager - doing nothing');
  if (!res.locals) res.locals = {};
  res.locals.csrfToken = '';
  next();
};

const csrfValidation = (req, res, next) => {
  console.log('[CSRF-DISABLED] Validation - doing nothing');
  next();
};

const csrfHelpers = (req, res, next) => {
  console.log('[CSRF-DISABLED] Helpers - doing nothing');
  if (!res.locals) res.locals = {};
  res.locals.csrfToken = '';
  next();
};

module.exports = {
  csrfTokenManager,
  csrfValidation,
  csrfHelpers
};