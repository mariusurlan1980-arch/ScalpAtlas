import { createWorker, type Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng');
  }
  return workerPromise;
}

export async function recognizeText(uri: string) {
  const worker = await getWorker();
  const result = await worker.recognize(uri);
  return { text: result?.data?.text || '', blocks: [] };
}
