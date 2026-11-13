// The shared theme script handles accessible navigation and dark mode.
// Mount only independent tools; community islands and account requests are retired.
import {mountHardwareTools} from '../hardware/islands.js';
mountHardwareTools();
const bracket=document.querySelector('[data-island="bracket"]');
if(bracket)import('../bracket/app.js').then(m=>m.mountBracket(bracket));
