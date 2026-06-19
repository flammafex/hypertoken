/**
 * Empty shim for node:worker_threads — not used in browser (disableWasm: true)
 */
export class Worker {
  constructor() { throw new Error('Worker not available in browser'); }
}
export default { Worker };
