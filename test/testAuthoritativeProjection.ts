/** Focused tests for the authoritative servers' final outbound projection lane. */

import { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { Engine } from "../engine/Engine.js";
import {
  AuthoritativeServer,
  OutboundMessageCategory,
  OutboundPrincipal,
} from "../network/AuthoritativeServer.js";
import { RoomAuthoritativeServer } from "../network/RoomAuthoritativeServer.js";

const SECRET = "SECRET-CANARY-authoritative-projection";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class TestClient {
  readonly ws: WebSocket;
  private messages: any[] = [];

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.on("message", (data) => {
      this.messages.push(JSON.parse(data.toString()));
    });
  }

  async open(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise<void>((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });
  }

  send(message: any): void {
    this.ws.send(JSON.stringify(message));
  }

  async waitFor(predicate: (message: any) => boolean, timeoutMs = 2000): Promise<any> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const index = this.messages.findIndex(predicate);
      if (index >= 0) return this.messages.splice(index, 1)[0];
      await sleep(10);
    }
    throw new Error("Timed out waiting for projected message");
  }

  async expectNo(predicate: (message: any) => boolean, durationMs = 150): Promise<void> {
    await sleep(durationMs);
    assert(!this.messages.some(predicate), "Unexpected outbound message");
  }

  drain(): any[] {
    const result = this.messages;
    this.messages = [];
    return result;
  }

  close(): void {
    this.ws.close();
  }
}

class ProjectionServer extends AuthoritativeServer {
  historyEnabled = false;
  deniedClient?: string;
  afterDispatchCount = 0;
  throwAfterDispatch = false;

  protected override getStateForClient(clientId: string): any {
    return { public: true, viewer: clientId };
  }

  protected override projectHistory(
    _principal: OutboundPrincipal,
    entry: any,
    index: number
  ): any | null {
    return this.historyEnabled ? { index, type: entry.type } : null;
  }

  protected override projectOutbound(
    principal: OutboundPrincipal,
    category: OutboundMessageCategory,
    payload: any
  ): any | null {
    if (principal.clientId === this.deniedClient && category === "state:describe") {
      throw new Error(SECRET);
    }
    if (principal.clientId === this.deniedClient && category === "state:broadcast") {
      return null;
    }
    return super.projectOutbound(principal, category, payload);
  }

  protected override afterDispatch(): void {
    this.afterDispatchCount++;
    if (this.throwAfterDispatch) throw new Error("post-commit hook exploded");
  }

  protected override onDispatchError(): void {
    // Expected in strict-outcome tests; suppress test noise.
  }
}

class ProjectionRoomServer extends RoomAuthoritativeServer {
  denyRoomListFor?: string;
  throwRoomLeftFor?: string;
  seenPrincipals: Array<{ category: string; principal: OutboundPrincipal }> = [];

  constructor() {
    super({ port: 0, verbose: false });
    this.createRoomEngine = () => new Engine({ disableWasm: true });
    this.initializeRoom = async (engine) => {
      await engine.dispatch("game:setProperty", { key: "privateRoomValue", value: SECRET });
    };
  }

  protected override getStateForRoom(roomCode: string, clientId: string): any {
    return { public: true, roomCode, viewer: clientId };
  }

  protected override projectOutbound(
    principal: OutboundPrincipal,
    category: OutboundMessageCategory,
    payload: any
  ): any | null {
    this.seenPrincipals.push({ category, principal });
    if (principal.clientId === this.denyRoomListFor && category === "room:list") return null;
    if (principal.clientId === this.throwRoomLeftFor && category === "room:left") {
      throw new Error(SECRET);
    }
    return super.projectOutbound(principal, category, payload);
  }
}

function urlFor(server: AuthoritativeServer): string {
  const address = server.wss?.address() as AddressInfo;
  return `ws://127.0.0.1:${address.port}`;
}

function assertNoCanary(messages: any[], label: string): void {
  assert(!JSON.stringify(messages).includes(SECRET), `${label} leaked the secret canary`);
}

let passed = 0;
let failed = 0;

async function test(name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    console.error(`  ✗ ${name}:`, error instanceof Error ? error.message : error);
  }
}

async function main(): Promise<void> {
  console.log("Authoritative outbound projection tests");

  await test("projects welcome, describe, live state, history, and dispatch outcomes", async () => {
    const engine = new Engine({ disableWasm: true });
    await engine.dispatch("game:setProperty", { key: "privateValue", value: SECRET });
    const server = new ProjectionServer(engine, { port: 0, verbose: false });
    await server.start();
    const first = new TestClient(urlFor(server));
    const second = new TestClient(urlFor(server));

    try {
      await Promise.all([first.open(), second.open()]);
      const welcome1 = await first.waitFor((message) => message.cmd === "welcome");
      const welcome2 = await second.waitFor((message) => message.cmd === "welcome");
      assert(welcome1.state.viewer === welcome1.clientId, "first welcome used wrong client view");
      assert(welcome2.state.viewer === welcome2.clientId, "second welcome used wrong client view");
      assert(welcome1.state.viewer !== welcome2.state.viewer, "client projections were not distinct");
      assertNoCanary([welcome1, welcome2], "welcome");

      first.send({ cmd: "describe" });
      const described = await first.waitFor((message) => message.cmd === "state");
      assert(described.state.viewer === welcome1.clientId, "describe used wrong client projection");
      assertNoCanary([described], "describe");

      first.send({ cmd: "history", fromIndex: 0 });
      const deniedHistory = await first.waitFor((message) => message.cmd === "history");
      assert(deniedHistory.actions.length === 0, "history was not denied by default");

      server.historyEnabled = true;
      first.send({ cmd: "history", fromIndex: 0 });
      const projectedHistory = await first.waitFor((message) => message.cmd === "history");
      assert(
        projectedHistory.actions.length >= 1,
        `individual history entry was not projected: ${JSON.stringify(projectedHistory.actions)}`
      );
      assert(
        projectedHistory.actions.some((entry: any) => entry.type === "game:setProperty"),
        "safe history type missing"
      );
      assertNoCanary([projectedHistory], "history");

      first.send({
        cmd: "dispatch",
        type: "game:setProperty",
        payload: { key: "anotherPrivateValue", value: SECRET },
        requestId: "dispatch-1",
      });
      const acknowledgement = await first.waitFor((message) => message.cmd === "dispatch:result");
      const liveState = await first.waitFor((message) => message.cmd === "state");
      assert(acknowledgement.requestId === "dispatch-1", "dispatch correlation was not preserved");
      assert(acknowledgement.result === undefined, "handler result was exposed");
      assert(acknowledgement.payload === undefined, "action payload was exposed");
      assertNoCanary([acknowledgement, liveState], "dispatch/live state");

      const dispatchesBeforeFailure = server.afterDispatchCount;
      (engine as any).dispatchChecked = async () => {
        // A premature engine event must not broadcast before the strict outcome.
        engine.emit("engine:action", { payload: { secret: SECRET } });
        return {
          ok: false,
          success: true,
          error: new Error(SECRET),
          result: { secret: SECRET },
        };
      };
      first.send({
        cmd: "dispatch",
        type: "game:setProperty",
        payload: { secret: SECRET },
        requestId: "dispatch-2",
      });
      const failure = await first.waitFor(
        (message) => message.cmd === "error" && message.requestId === "dispatch-2"
      );
      assert(failure.message === "Action failed", "dispatch error was not sanitized");
      assert(server.afterDispatchCount === dispatchesBeforeFailure, "afterDispatch ran for strict failure");
      assertNoCanary([failure], "dispatch failure");
      await first.expectNo((message) => message.cmd === "state");

      const dispatchesBeforeMissingStrict = server.afterDispatchCount;
      let legacyDispatchCalls = 0;
      (engine as any).dispatchChecked = undefined;
      (engine as any).dispatch = async () => { legacyDispatchCalls++; };
      first.send({
        cmd: "dispatch",
        type: "game:setProperty",
        payload: { secret: SECRET },
        requestId: "dispatch-no-strict",
      });
      const missingStrict = await first.waitFor(
        (message) => message.cmd === "error" && message.requestId === "dispatch-no-strict"
      );
      assert(missingStrict.message === "Action failed", "missing strict dispatch was not fail-closed");
      assert(legacyDispatchCalls === 0, "legacy dispatch fallback was used");
      assert(server.afterDispatchCount === dispatchesBeforeMissingStrict, "afterDispatch ran without strict success");
      await first.expectNo((message) => message.cmd === "state");

      (engine as any).dispatchChecked = async () => ({ ok: true, result: "committed" });
      server.throwAfterDispatch = true;
      first.send({
        cmd: "dispatch",
        type: "game:setProperty",
        payload: {},
        requestId: "dispatch-post-commit-hook",
      });
      const hookSuccess = await first.waitFor(
        (message) => message.cmd === "dispatch:result" && message.requestId === "dispatch-post-commit-hook"
      );
      assert(hookSuccess.ok === true, "throwing afterDispatch reversed committed success");
      await first.waitFor((message) => message.cmd === "state");
      await first.expectNo(
        (message) => message.cmd === "error" && message.requestId === "dispatch-post-commit-hook"
      );
      server.throwAfterDispatch = false;

      let checkedCalls = 0;
      let resolveFirst!: (outcome: any) => void;
      let resolveSecond!: (outcome: any) => void;
      const getCheckedCalls = () => checkedCalls;
      const firstOutcome = new Promise<any>((resolve) => { resolveFirst = resolve; });
      const secondOutcome = new Promise<any>((resolve) => { resolveSecond = resolve; });
      (engine as any).dispatchChecked = async () => {
        checkedCalls++;
        return checkedCalls === 1 ? firstOutcome : secondOutcome;
      };
      first.drain();
      first.send({ cmd: "dispatch", type: "test:first", payload: {}, requestId: "serial-1" });
      first.send({ cmd: "dispatch", type: "test:second", payload: {}, requestId: "serial-2" });
      await sleep(30);
      assert(getCheckedCalls() === 1, "authoritative checked dispatches were not serialized");
      resolveFirst({ ok: true, result: "first" });
      await first.waitFor((message) => message.cmd === "dispatch:result" && message.requestId === "serial-1");
      await first.waitFor((message) => message.cmd === "state");
      const secondStartedDeadline = Date.now() + 1000;
      while (getCheckedCalls() < 2 && Date.now() < secondStartedDeadline) await sleep(5);
      assert(getCheckedCalls() === 2, "second serialized dispatch did not start");
      resolveSecond({ ok: false, success: true, error: new Error("second failed") });
      await first.waitFor((message) => message.cmd === "error" && message.requestId === "serial-2");
      await first.expectNo((message) => message.cmd === "state");

      server.deniedClient = welcome1.clientId;
      first.drain();
      first.send({ cmd: "describe" });
      await first.expectNo((message) => message.cmd === "state");
      server.broadcast();
      await first.expectNo((message) => message.cmd === "state");
      const secondState = await second.waitFor((message) => message.cmd === "state");
      assert(secondState.state.viewer === welcome2.clientId, "policy denial affected another client");

      server.sendToClient(welcome1.clientId, { cmd: "custom", secret: SECRET });
      await first.expectNo(() => true);
    } finally {
      first.close();
      second.close();
      server.stop();
    }
  });

  await test("projects and fail-closes room create/join/left/list/errors", async () => {
    const server = new ProjectionRoomServer();
    await server.start();
    const creator = new TestClient(urlFor(server));
    const joiner = new TestClient(urlFor(server));

    try {
      await Promise.all([creator.open(), joiner.open()]);
      const creatorWelcome = await creator.waitFor((message) => message.cmd === "welcome");
      const joinerWelcome = await joiner.waitFor((message) => message.cmd === "welcome");
      assertNoCanary([creatorWelcome, joinerWelcome], "room welcome");

      creator.send({ cmd: "room:create", password: SECRET, variant: "public-variant" });
      const created = await creator.waitFor((message) => message.cmd === "room:created");
      assert(typeof created.roomCode === "string", "room code missing");
      assertNoCanary([created], "room created");

      joiner.send({ cmd: "room:join", roomCode: { malformed: true }, requestId: "bad-room" });
      const malformedJoin = await joiner.waitFor(
        (message) => message.cmd === "room:error" && message.requestId === "bad-room"
      );
      assert(malformedJoin.message === "Room request failed", "malformed room join was not sanitized");
      joiner.send({ cmd: "room:list" });
      await joiner.waitFor((message) => message.cmd === "room:list");

      creator.send({ cmd: "history", fromIndex: 0 });
      const roomHistory = await creator.waitFor((message) => message.cmd === "history");
      assert(roomHistory.actions.length === 0, "raw room history was exposed");
      assertNoCanary([roomHistory], "room history");

      joiner.send({ cmd: "room:join", roomCode: created.roomCode, password: `${SECRET}-wrong` });
      const roomError = await joiner.waitFor((message) => message.cmd === "room:error");
      assert(roomError.message === "Invalid password", "safe room error was not preserved");
      assertNoCanary([roomError], "room error");

      joiner.send({ cmd: "room:join", roomCode: created.roomCode, password: SECRET });
      const joined = await joiner.waitFor((message) => message.cmd === "room:joined");
      const creatorState = await creator.waitFor((message) => message.cmd === "state");
      assert(joined.state.viewer === joinerWelcome.clientId, "room join used wrong client view");
      assert(creatorState.state.viewer === creatorWelcome.clientId, "room broadcast used wrong client view");
      assertNoCanary([joined, creatorState], "room join/state");

      creator.send({ cmd: "room:list" });
      const roomList = await creator.waitFor((message) => message.cmd === "room:list");
      assert(roomList.rooms.length === 1, "public room missing from list");
      assert(roomList.rooms[0].password === undefined, "room password was exposed");
      assertNoCanary([roomList], "room list");

      const joinedPrincipal = server.seenPrincipals.find(
        (seen) => seen.category === "room:joined" && seen.principal.clientId === joinerWelcome.clientId
      );
      assert(joinedPrincipal?.principal.roomCode === created.roomCode, "room context missing from principal");

      server.denyRoomListFor = creatorWelcome.clientId;
      creator.drain();
      creator.send({ cmd: "room:list" });
      await creator.expectNo((message) => message.cmd === "room:list");

      server.throwRoomLeftFor = joinerWelcome.clientId;
      joiner.drain();
      joiner.send({ cmd: "room:leave" });
      await joiner.expectNo((message) => message.cmd === "room:left");

      server.throwRoomLeftFor = undefined;
      creator.send({ cmd: "room:leave" });
      const left = await creator.waitFor((message) => message.cmd === "room:left");
      assertNoCanary([left], "room left");
    } finally {
      creator.close();
      joiner.close();
      server.stop();
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
