// Browser stand-ins for node modules used by the shared server code (only the parts it needs).
export const readdirSync = () => [];
export const readFileSync = () => '';
export const statSync = () => ({ isDirectory: () => false });
export const existsSync = () => false;
export default {};
