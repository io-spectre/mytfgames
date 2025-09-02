import { MessagePort, Transferable } from "node:worker_threads";

import { IpcEventArgs, IpcMessage, MessageTransport } from "$pure-base/ipc";

export class NodeMessagePortMessageTransport implements MessageTransport {
  constructor(
    readonly id: string,
    private readonly port: MessagePort,
  ) {}

  start(): void {
    this.port.start();
  }
  close(): void {
    this.port.close();
  }
  addEventListener(...[type, listener]: IpcEventArgs): void {
    if (type === "ipc-message") {
      const typedListener = listener;
      this.port.addListener("message", (data) =>
        typedListener({
          type: "ipc-message",
          data: data as IpcMessage,
          target: this,
        }),
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    else if (type === "ipc-closed") {
      const typedListener = listener;
      this.port.addListener("close", () =>
        typedListener({
          type: "ipc-closed",
          target: this,
        }),
      );
    } else {
      throw new Error(`Unknown event type: ${type as unknown as string}`);
    }
  }
  postMessage(message: IpcMessage, transfer: unknown[] = []): void {
    this.port.postMessage(message, transfer as Transferable[]);
  }
}
