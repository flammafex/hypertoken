export class EventBus {
  constructor();
  listeners: Record<string, Array<(payload: any) => void>>;
  on(type: string, fn: (payload: any) => void): () => void;
  off(type: string, fn: (payload: any) => void): void;
  emit(type: string, payload: any): void;
}
