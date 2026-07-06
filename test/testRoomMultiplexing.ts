/**
 * test/testRoomMultiplexing.ts
 *
 * Tests room multiplexing on UniversalRelayServer.
 * Verifies that peers in the same room can communicate,
 * and peers in different rooms are isolated.
 */

import { UniversalRelayServer } from "../network/UniversalRelayServer.js";
import { WebSocket } from "ws";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let testsPassed = 0;
let testsFailed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  console.log(`  ${name}`);
  try {
    await fn();
    testsPassed++;
    console.log("    ✓ passed");
  } catch (err) {
    testsFailed++;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`    ✗ FAIL: ${message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

/**
 * A test WebSocket client that buffers all messages from connection start,
 * so no messages are missed between "open" and handler registration.
 */
class TestClient {
  ws: WebSocket;
  private messages: any[] = [];

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.on("message", (data: any) => {
      try {
        this.messages.push(JSON.parse(data.toString()));
      } catch { /* ignore */ }
    });
  }

  async waitForOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.on("open", () => resolve());
      this.ws.on("error", reject);
    });
  }

  /** Wait for a message matching the filter, checking buffered messages first. */
  async waitFor(filter: (msg: any) => boolean, timeoutMs = 3000): Promise<any> {
    // Check buffered messages
    for (let i = 0; i < this.messages.length; i++) {
      if (filter(this.messages[i])) {
        return this.messages.splice(i, 1)[0];
      }
    }

    // Wait for future message
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Timeout waiting for message"));
      }, timeoutMs);

      const interval = setInterval(() => {
        for (let i = 0; i < this.messages.length; i++) {
          if (filter(this.messages[i])) {
            clearTimeout(timer);
            clearInterval(interval);
            resolve(this.messages.splice(i, 1)[0]);
            return;
          }
        }
      }, 10);
    });
  }

  /** Collect all messages for a duration, then return them. */
  async collect(durationMs: number): Promise<any[]> {
    await sleep(durationMs);
    const msgs = [...this.messages];
    this.messages = [];
    return msgs;
  }

  send(msg: any): void {
    this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.ws.close();
  }
}

async function main(): Promise<void> {
  console.log("🏠 Room Multiplexing Tests\n");

  // Test 1: Room creation returns valid code
  await test("Room creation returns room code", async () => {
    const server = new UniversalRelayServer({ port: 9301, verbose: false });
    await server.start();

    const client = new TestClient("ws://localhost:9301");
    await client.waitForOpen();
    await client.waitFor((m) => m.type === "welcome");

    client.send({ type: "room:create" });
    const response = await client.waitFor((m) => m.type === "room:created");
    assert(response.roomCode !== undefined, "Should have roomCode");
    assert(response.roomCode.length === 9, `Code should be 9 chars, got ${response.roomCode.length}`);
    assert(response.roomCode.includes("-"), "Should contain hyphen");

    client.close();
    server.stop();
  });

  await sleep(300);

  // Test 2: Same-room peers receive each other's broadcasts
  await test("Two peers in same room receive each other's broadcasts", async () => {
    const server = new UniversalRelayServer({ port: 9302, verbose: false });
    await server.start();

    const c1 = new TestClient("ws://localhost:9302");
    const c2 = new TestClient("ws://localhost:9302");
    await c1.waitForOpen();
    await c2.waitForOpen();
    await c1.waitFor((m) => m.type === "welcome");
    await c2.waitFor((m) => m.type === "welcome");

    // Clear peer:joined notifications
    await c1.collect(100);
    await c2.collect(100);

    // Peer 1 creates a room
    c1.send({ type: "room:create" });
    const created = await c1.waitFor((m) => m.type === "room:created");
    const roomCode = created.roomCode;

    // Peer 2 joins
    c2.send({ type: "room:join", payload: { roomCode } });
    const joined = await c2.waitFor((m) => m.type === "room:joined");
    assert(joined.roomCode === roomCode, "Should join same room");

    // Let peer:joined notifications settle
    await c1.collect(200);
    await c2.collect(200);

    // Peer 1 broadcasts
    c1.send({ type: "test-broadcast", data: "hello" });

    // Peer 2 should receive it
    const received = await c2.waitFor((m) => m.type === "test-broadcast", 2000);
    assert(received.data === "hello", "Should receive broadcast data");
    assert(received.fromPeerId !== undefined, "Should have fromPeerId");

    c1.close();
    c2.close();
    server.stop();
  });

  await sleep(300);

  // Test 3: Peers in different rooms are isolated
  await test("Peers in different rooms are isolated", async () => {
    const server = new UniversalRelayServer({ port: 9303, verbose: false });
    await server.start();

    const c1 = new TestClient("ws://localhost:9303");
    const c2 = new TestClient("ws://localhost:9303");
    const c3 = new TestClient("ws://localhost:9303");
    await c1.waitForOpen();
    await c2.waitForOpen();
    await c3.waitForOpen();
    await c1.waitFor((m) => m.type === "welcome");
    await c2.waitFor((m) => m.type === "welcome");
    await c3.waitFor((m) => m.type === "welcome");

    await c1.collect(100);
    await c2.collect(100);
    await c3.collect(100);

    // Peer 1 creates room A
    c1.send({ type: "room:create" });
    const createdA = await c1.waitFor((m) => m.type === "room:created");
    const roomA = createdA.roomCode;

    // Peer 2 joins room A
    c2.send({ type: "room:join", payload: { roomCode: roomA } });
    await c2.waitFor((m) => m.type === "room:joined");

    // Peer 3 creates room B
    c3.send({ type: "room:create" });
    const createdB = await c3.waitFor((m) => m.type === "room:created");
    assert(roomA !== createdB.roomCode, "Room codes should differ");

    await c1.collect(200);
    await c2.collect(200);
    await c3.collect(200);

    // Peer 1 broadcasts in room A
    c1.send({ type: "room-a-message", data: "secret" });

    // Peer 2 (same room) should receive it
    const received2 = await c2.waitFor((m) => m.type === "room-a-message", 2000);
    assert(received2.data === "secret", "Same-room peer should receive");

    // Peer 3 (different room) should NOT receive it
    const msgs3 = await c3.collect(500);
    const leaked = msgs3.find((m) => m.type === "room-a-message");
    assert(leaked === undefined, "Different-room peer should NOT receive");

    c1.close();
    c2.close();
    c3.close();
    server.stop();
  });

  await sleep(300);

  // Test 4: Non-room peers don't receive room broadcasts
  await test("Non-room peers don't receive room-scoped broadcasts", async () => {
    const server = new UniversalRelayServer({ port: 9304, verbose: false });
    await server.start();

    const c1 = new TestClient("ws://localhost:9304");
    const c2 = new TestClient("ws://localhost:9304");
    await c1.waitForOpen();
    await c2.waitForOpen();
    await c1.waitFor((m) => m.type === "welcome");
    await c2.waitFor((m) => m.type === "welcome");

    await c1.collect(100);
    await c2.collect(100);

    // Peer 1 creates a room
    c1.send({ type: "room:create" });
    await c1.waitFor((m) => m.type === "room:created");

    // Peer 2 stays outside any room
    await c1.collect(200);
    await c2.collect(200);

    // Peer 1 broadcasts in the room
    c1.send({ type: "room-only-message", data: "hidden" });

    // Peer 2 (not in any room) should NOT receive it
    const msgs2 = await c2.collect(500);
    const leaked = msgs2.find((m) => m.type === "room-only-message");
    assert(leaked === undefined, "Non-room peer should NOT receive room broadcast");

    c1.close();
    c2.close();
    server.stop();
  });

  await sleep(300);

  // Test 5: Room cleanup on disconnect
  await test("Room cleanup on disconnect notifies remaining peer", async () => {
    const server = new UniversalRelayServer({ port: 9305, verbose: false });
    await server.start();

    const c1 = new TestClient("ws://localhost:9305");
    const c2 = new TestClient("ws://localhost:9305");
    await c1.waitForOpen();
    await c2.waitForOpen();
    await c1.waitFor((m) => m.type === "welcome");
    await c2.waitFor((m) => m.type === "welcome");

    await c1.collect(100);
    await c2.collect(100);

    // Create room
    c1.send({ type: "room:create" });
    const created = await c1.waitFor((m) => m.type === "room:created");
    const roomCode = created.roomCode;

    // Peer 2 joins
    c2.send({ type: "room:join", payload: { roomCode } });
    await c2.waitFor((m) => m.type === "room:joined");

    await c1.collect(200);
    await c2.collect(200);

    // Peer 1 disconnects
    c1.close();
    await sleep(300);

    // Peer 2 should receive peer:left notification
    const msgs2 = await c2.collect(500);
    const leftNotification = msgs2.find((m) => m.type === "peer:left");
    assert(leftNotification !== undefined, "Remaining peer should be notified of disconnect");

    c2.close();
    server.stop();
  });

  await sleep(300);

  // Test 6: Join non-existent room returns error
  await test("Joining non-existent room returns error", async () => {
    const server = new UniversalRelayServer({ port: 9306, verbose: false });
    await server.start();

    const client = new TestClient("ws://localhost:9306");
    await client.waitForOpen();
    await client.waitFor((m) => m.type === "welcome");

    client.send({ type: "room:join", payload: { roomCode: "NOPE-0000" } });
    const response = await client.waitFor((m) => m.type === "room:error", 2000);
    assert(response.message !== undefined, "Should have error message");
    assert(response.message.includes("not found") || response.message.includes("Room"), "Should mention room not found");

    client.close();
    server.stop();
  });

  await sleep(500);

  console.log(`\n${testsPassed} passed, ${testsFailed} failed`);
  if (testsFailed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
