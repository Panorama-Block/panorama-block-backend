export interface QueueMessage {
  id: string;
  payload: unknown;
}

export interface QueuePort {
  enqueue(message: QueueMessage): Promise<void>;
}
