export interface TokenDetail {
  id: number;
  piece: string;
  text: string;
  bytes: number[];
  byteStart: number;
  byteEnd: number;
  special: boolean;
  partial: boolean;
}
export interface TokenizationResult {
  tokens: TokenDetail[];
  decoded: string;
  changed: boolean;
  elapsedMs: number;
}
export type WorkerRequest = { type: 'encode'; requestId: number; modelId: string; text: string };
export type WorkerResponse =
  | { type: 'progress'; requestId: number; loaded: number; total: number; phase: string }
  | { type: 'result'; requestId: number; result: TokenizationResult; persistent: boolean }
  | { type: 'error'; requestId: number; message: string };
