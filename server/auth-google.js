/** Compatibility re-exports: the sign-in flow now lives in server/oauth/ (flow.js + one module per
 * provider). Google keeps its URLs (/api/v1/auth/google/start|callback) and behaviour. */
export {GOOGLE,validateClaims} from './oauth/google.js';
export {safeReturnPath,logout} from './oauth/flow.js';
