export const extname = (p) => { const m = String(p).match(/\.[^./\\]+$/); return m ? m[0] : ''; };
export const join = (...a) => a.join('/');
export const basename = (p) => String(p).split(/[\\/]/).pop();
export const dirname = (p) => String(p).split(/[\\/]/).slice(0, -1).join('/');
export default { extname, join, basename, dirname };
