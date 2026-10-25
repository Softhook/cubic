/**
 * Plays a self-play script's tasks in parallel: `jobs` worker processes (the script run again, with
 * POOL_WORKER set) each take the next task as they free up, so fast and slow cores both stay busy
 * to the end. Tasks and results travel as JSON, so they must be plain data. Each task should carry
 * its own seeds: the results are then the same with any number of jobs.
 *
 * Call `pool` once, after the script's setup and before its report. In a worker it serves tasks and
 * never returns (the worker exits when the main process is done with it). With jobs <= 1 the tasks
 * are played in this process, in order.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { availableParallelism } from 'node:os';

/** Set for a worker process. */
export const isWorker = !!process.env.POOL_WORKER;

/** The default number of jobs: all cores. */
export const allCores = String(availableParallelism());

const workers = new Set<ChildProcess>();
// Ctrl-C reaches the workers too, but not every way of stopping does.
process.on('exit', () => {
  for (const w of workers) w.kill();
});

export async function pool<T, R>(
  script: string,
  tasks: T[],
  jobs: number,
  play: (task: T) => R,
  done: (result: R, task: T) => void,
): Promise<void> {
  if (isWorker) {
    process.on('message', (task: T) => process.send!(play(task)));
    process.on('disconnect', () => process.exit(0));
    return new Promise(() => {});
  }
  if (jobs <= 1) {
    for (const t of tasks) done(play(t), t);
    return;
  }
  const queue = [...tasks];
  await Promise.all(
    Array.from(
      { length: Math.min(jobs, queue.length) },
      () =>
        new Promise<void>((resolve, reject) => {
          // Under vite-node, argv[1] is vite-node itself and the script's path is left out.
          const child = spawn(process.execPath, [process.argv[1], script, ...process.argv.slice(2)], {
            env: { ...process.env, POOL_WORKER: '1' },
            stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
          });
          workers.add(child);
          let task: T | undefined;
          const next = () => {
            task = queue.shift();
            if (task !== undefined) child.send(task as object);
            else child.disconnect();
          };
          child.on('message', (r: R) => {
            done(r, task!);
            next();
          });
          child.on('error', reject);
          child.on('exit', (code) => {
            workers.delete(child);
            if (task !== undefined) reject(new Error(`task ${JSON.stringify(task)} failed (exit ${code})`));
            else resolve();
          });
          next();
        }),
    ),
  );
}
