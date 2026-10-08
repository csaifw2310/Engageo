import { SEND_CONCURRENCY } from '../modules/message/message.constants.js';

/**
 * Queue abstraction for message dispatch.
 *
 * WHY THIS EXISTS
 * ---------------
 * Sending a campaign means dispatching potentially thousands of messages. We
 * must NOT fire them all at once (Meta rate limits, socket exhaustion), and we
 * want a single seam where a real broker (BullMQ / SQS / RabbitMQ) can be
 * dropped in later WITHOUT touching the service.
 *
 * Today this is an in-process, concurrency-bounded runner: it pulls items off a
 * list and runs a worker over them `concurrency` at a time, resolving once every
 * item has settled. That is enough to honour rate limits and to make
 * sendCampaign's HTTP response reflect the real per-message outcome (which is
 * exactly what the mock-mode test flow needs).
 *
 * TO GO DISTRIBUTED LATER
 * -----------------------
 * Reimplement `runQueue` to push one job per item onto BullMQ and await their
 * completion (or return job ids for a fire-and-forget API). The service calls
 * only `runQueue(items, worker, { concurrency })` and treats the returned
 * results array as the source of truth — nothing else changes.
 */

/**
 * Run `worker` over every item in `items`, at most `concurrency` in flight at a
 * time. Never rejects: each item's outcome is captured so one failure can't sink
 * the batch.
 *
 * @template T, R
 * @param {T[]} items
 * @param {(item: T, index: number) => Promise<R>} worker
 * @param {{ concurrency?: number }} [options]
 * @returns {Promise<Array<{ item: T, status: 'fulfilled'|'rejected', value?: R, reason?: Error }>>}
 */
export const runQueue = async (items, worker, options = {}) => {
  const list = Array.isArray(items) ? items : [];
  const concurrency = Math.max(1, options.concurrency || SEND_CONCURRENCY);
  const results = new Array(list.length);

  let cursor = 0;

  // A pool of `concurrency` workers, each repeatedly claiming the next index
  // until the list is drained.
  const runner = async () => {
    while (cursor < list.length) {
      const index = cursor++;
      const item = list[index];
      try {
        const value = await worker(item, index);
        results[index] = { item, status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { item, status: 'rejected', reason };
      }
    }
  };

  const size = Math.min(concurrency, list.length);
  await Promise.all(Array.from({ length: size }, () => runner()));

  return results;
};

export default { runQueue };
