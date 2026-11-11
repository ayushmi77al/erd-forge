import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StorageService } from "../../src/storage/index";
import { TabLockCoordinator } from "../../src/storage/TabLockCoordinator";

describe("T3.3: Tab-Coordination Lock & Multi-Tab Protection", () => {
  const coordinators: TabLockCoordinator[] = [];

  const createCoordinator = (name = "test-tab-lock") => {
    const coord = new TabLockCoordinator({
      channelName: name,
      heartbeatIntervalMs: 60,
      heartbeatTimeoutMs: 180,
      electionTimeoutMs: 60,
    });
    coordinators.push(coord);
    return coord;
  };

  afterEach(() => {
    while (coordinators.length > 0) {
      const coord = coordinators.pop();
      coord?.dispose();
    }
  });

  it("single tab acquires leader lease when no other tab is active", async () => {
    const tab1 = createCoordinator("single-tab-test");
    const acquired = await tab1.acquireLease();

    expect(acquired).toBe(true);
    expect(tab1.getRole()).toBe("leader");
    expect(tab1.isLeader()).toBe(true);
    expect(tab1.getActiveLeaderId()).toBe(tab1.getTabId());
  });

  it("secondary tab detects active leader, enters follower mode, and triggers conflict callback", async () => {
    const channelName = "conflict-test";
    const tab1 = createCoordinator(channelName);
    const acquired1 = await tab1.acquireLease();
    expect(acquired1).toBe(true);

    const onConflictSpy = vi.fn();
    const tab2 = createCoordinator(channelName);
    tab2.setOnConflict(onConflictSpy);

    const acquired2 = await tab2.acquireLease();
    expect(acquired2).toBe(false);
    expect(tab2.getRole()).toBe("follower");
    expect(tab2.isLeader()).toBe(false);
    expect(tab2.getActiveLeaderId()).toBe(tab1.getTabId());
    expect(onConflictSpy).toHaveBeenCalledWith(tab1.getTabId());
  });

  it("handles graceful takeover: follower requests takeover, leader surrenders and follower becomes leader", async () => {
    const channelName = "takeover-test";
    const tab1 = createCoordinator(channelName);
    await tab1.acquireLease();
    expect(tab1.getRole()).toBe("leader");

    const onRevokedSpy = vi.fn();
    tab1.setOnLeaseRevoked(onRevokedSpy);

    const tab2 = createCoordinator(channelName);
    const onGrantedSpy = vi.fn();
    tab2.setOnLeaseGranted(onGrantedSpy);
    await tab2.acquireLease();
    expect(tab2.getRole()).toBe("follower");

    const takeoverGranted = await tab2.requestTakeover();
    expect(takeoverGranted).toBe(true);

    expect(tab2.getRole()).toBe("leader");
    expect(tab1.getRole()).toBe("follower");
    expect(onRevokedSpy).toHaveBeenCalled();
    expect(onGrantedSpy).toHaveBeenCalled();
  });

  it("sets tab to read-only mode and releases lease", async () => {
    const tab1 = createCoordinator("readonly-test");
    await tab1.acquireLease();
    expect(tab1.getRole()).toBe("leader");

    tab1.setReadOnly();
    expect(tab1.getRole()).toBe("readonly");
    expect(tab1.isLeader()).toBe(false);
  });

  it("recovers orphaned lease when leader releases lease voluntarily", async () => {
    const channelName = "release-orphan-test";
    const tab1 = createCoordinator(channelName);
    await tab1.acquireLease();

    const tab2 = createCoordinator(channelName);
    await tab2.acquireLease();
    expect(tab2.getRole()).toBe("follower");

    // Tab 1 voluntarily releases lease
    tab1.releaseLease();

    // Give broadcast channel time to deliver RELEASE_LEASE
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(tab2.getRole()).toBe("leader");
    expect(tab2.getActiveLeaderId()).toBe(tab2.getTabId());
  });

  it("watchdog automatically claims lease if active leader heartbeat goes silent", async () => {
    const channelName = "watchdog-timeout-test";
    const tab1 = new TabLockCoordinator({
      channelName,
      heartbeatIntervalMs: 50,
      heartbeatTimeoutMs: 120,
      electionTimeoutMs: 50,
    });
    coordinators.push(tab1);
    await tab1.acquireLease();

    const tab2 = new TabLockCoordinator({
      channelName,
      heartbeatIntervalMs: 50,
      heartbeatTimeoutMs: 120,
      electionTimeoutMs: 50,
    });
    coordinators.push(tab2);
    await tab2.acquireLease();
    expect(tab2.getRole()).toBe("follower");

    // Simulate leader crash / freeze without calling releaseLease: stop heartbeats
    (tab1 as any).stopHeartbeat();

    // Wait for watchdog interval and timeout
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(tab2.getRole()).toBe("leader");
  });

  it("StorageService strictly enforces tab leader lock and rejects writes from secondary tabs", async () => {
    const storage = new StorageService();
    const mockAdapter = {
      name: "MockStorage",
      initialize: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue(undefined),
      executeBatch: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
      close: vi.fn().mockResolvedValue(undefined),
      getEngineType: () => "opfs-sahpool" as const,
      isDurable: () => true,
    };

    await storage.initialize(mockAdapter as any);

    const coordinator = createCoordinator("storage-lock-test");
    storage.setLockCoordinator(coordinator);

    // Initial state: unlocked or follower (not leader)
    coordinator.setReadOnly();
    expect(coordinator.isLeader()).toBe(false);

    // Queries should be permitted in read-only mode
    await expect(storage.query("SELECT * FROM projects")).resolves.toEqual([]);

    // Writes must be strictly rejected
    await expect(storage.execute("INSERT INTO projects (id) VALUES ('p1')")).rejects.toThrow(
      "Write rejected: Tab role is 'readonly'",
    );

    await expect(storage.executeBatch([{ sql: "INSERT INTO projects (id) VALUES ('p2')" }])).rejects.toThrow(
      "Write rejected: Tab role is 'readonly'",
    );

    // When tab acquires leader lease, writes succeed!
    await coordinator.acquireLease();
    expect(coordinator.isLeader()).toBe(true);

    await expect(storage.execute("INSERT INTO projects (id) VALUES ('p1')")).resolves.toBeUndefined();
    expect(mockAdapter.execute).toHaveBeenCalled();
  });
});
