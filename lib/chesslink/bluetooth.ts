import { CHESSLINK_SERVICE, CHESSLINK_NOTIFY, CHESSLINK_WRITE, ChessLinkDecoder, queryBytes, ledBytes, clearLedBytes, type BoardMessage } from "./protocol";

// Local interfaces keep the experimental browser API out of the server type surface.
export interface LinkCharacteristic extends EventTarget {
  value?: DataView;
  startNotifications(): Promise<LinkCharacteristic>;
  writeValueWithResponse(value: Uint8Array<ArrayBuffer>): Promise<void>;
}
interface LinkService { getCharacteristic(uuid: string): Promise<LinkCharacteristic> }
interface LinkServer { connected: boolean; connect(): Promise<LinkServer>; disconnect(): void; getPrimaryService(uuid: string): Promise<LinkService> }
export interface LinkDevice extends EventTarget { name?: string; gatt?: LinkServer }
export interface BluetoothAccess {
  requestDevice(options: { filters: { namePrefix: string }[]; optionalServices: string[] }): Promise<LinkDevice>;
}

export function browserBluetooth(): BluetoothAccess | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { bluetooth?: BluetoothAccess }).bluetooth;
}

async function withDeadline<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("ChessLink Bluetooth operation timed out.")), 15_000);
    })]);
  } finally { clearTimeout(timer); }
}

export class ChessLinkConnection {
  private device?: LinkDevice;
  private notify?: LinkCharacteristic;
  private timer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private writes: Promise<void> = Promise.resolve();
  private ownsLeds = false;
  private decoder = new ChessLinkDecoder();
  constructor(private onMessage: (message: BoardMessage) => void,
    private onDisconnect: (message: string) => void,
    private onDiagnostic: (message: string) => void) {}

  private receive = (event: Event) => {
    const value = (event.target as LinkCharacteristic).value;
    if (!value) return;
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    this.onDiagnostic(`RX ${Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join(" ")}`);
    const rejected = this.decoder.rejectedFrames;
    for (const message of this.decoder.push(bytes)) this.onMessage(message);
    if (this.decoder.rejectedFrames > rejected) this.onDiagnostic("Discarded malformed or unsupported data.");
  };

  private disconnected = () => {
    this.close();
    this.onDisconnect("Board disconnected. Reconnect and synchronize before resuming.");
  };

  async connect(access: BluetoothAccess, listenOnly = true) {
    this.close();
    const generation = this.generation;
    // requestDevice is invoked before any await to preserve the button's user activation.
    const device = await access.requestDevice({ filters: [{ namePrefix: "MILLENNIUM" }], optionalServices: [CHESSLINK_SERVICE] });
    if (generation !== this.generation) return;
    this.device = device;
    device.addEventListener("gattserverdisconnected", this.disconnected);
    try {
      if (!device.gatt) throw new Error("Selected device has no BLE GATT connection.");
      const server = await withDeadline(device.gatt.connect().then(server => {
        if (generation !== this.generation) server.disconnect();
        return server;
      }));
      if (generation !== this.generation) { server.disconnect(); return; }
      const service = await withDeadline(server.getPrimaryService(CHESSLINK_SERVICE));
      const notify = await withDeadline(service.getCharacteristic(CHESSLINK_NOTIFY));
      if (generation !== this.generation) return;
      this.notify = notify;
      notify.addEventListener("characteristicvaluechanged", this.receive);
      await withDeadline(notify.startNotifications());
      if (generation !== this.generation) return;
      if (listenOnly) {
        this.onDiagnostic("Connected in listen-only mode. No ChessLink commands will be sent.");
        return;
      }
      this.onDiagnostic("Connected. Querying initial version and position, then listening passively.");
      this.onDiagnostic("TX V (version query)");
      await this.write(queryBytes("V"));
      const queryInitialPosition = async () => {
        if (generation !== this.generation) return;
        try {
          this.onDiagnostic("TX S (position query)");
          await this.write(queryBytes("S"));
        } catch { if (generation === this.generation) this.disconnected(); }
      };
      if (generation === this.generation) this.timer = setTimeout(queryInitialPosition, 200);
    } catch (error) {
      if (generation === this.generation) this.close();
      throw error;
    }
  }


  private write(bytes: Uint8Array<ArrayBuffer>) {
    const generation = this.generation;
    const operation = this.writes.then(() => withDeadline((async () => {
      if (generation !== this.generation) return;
      const server = this.device?.gatt;
      if (!server?.connected) throw new Error("Connect the board before requesting data.");
      const service = await server.getPrimaryService(CHESSLINK_SERVICE);
      if (generation !== this.generation) return;
      const write = await service.getCharacteristic(CHESSLINK_WRITE);
      // The transparent UART accepts fragmented commands; use conservative BLE payloads.
      for (let offset = 0; offset < bytes.length; offset += 20) {
        if (generation !== this.generation) return;
        await write.writeValueWithResponse(bytes.slice(offset, offset + 20));
      }
    })()));
    this.writes = operation.catch(() => { if (generation === this.generation) this.disconnected(); });
    return operation;
  }

  async queryOnce(command: "V" | "S") {
    this.onDiagnostic(`TX ${command} (manual one-shot ${command === "V" ? "version" : "position"} query)`);
    await this.write(queryBytes(command));
  }

  async showLedSquares(squares: string[], reversed = false) {
    const bytes = ledBytes(squares, reversed);
    this.ownsLeds = true;
    this.onDiagnostic(`TX L (LED squares: ${squares.join(" ")})`);
    try { await this.write(bytes); }
    catch (error) { this.onDiagnostic("LED output failed."); throw error; }
  }

  async clearLeds() {
    if (!this.ownsLeds) return;
    this.ownsLeds = false;
    this.onDiagnostic("TX X (clear app LED prompts)");
    await this.write(clearLedBytes());
  }

  async closeWithLeds() {
    const generation = this.generation;
    try { await this.clearLeds(); }
    finally { if (generation === this.generation) this.close(); }
  }

  close() {
    this.generation++;
    this.writes = Promise.resolve(); this.ownsLeds = false;
    clearTimeout(this.timer);
    this.notify?.removeEventListener("characteristicvaluechanged", this.receive);
    this.device?.removeEventListener("gattserverdisconnected", this.disconnected);
    this.device?.gatt?.disconnect();
    this.notify = undefined;
    this.device = undefined;
    this.decoder = new ChessLinkDecoder();
  }
}
