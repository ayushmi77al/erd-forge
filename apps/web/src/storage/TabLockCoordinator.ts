export type StorageLockMessage =
  | { type: "WHO_IS_LEADER"; tabId: string }
  | { type: "LEADER_HEARTBEAT"; tabId: string; lastActive: number }
  | { type: "REQUEST_TAKEOVER"; requestingTabId: string }
  | { type: "RELEASE_LEASE"; tabId: string }
  | { type: "LEASE_GRANTED"; toTabId: string };

export type TabRole = "leader" | "follower" | "readonly" | "unlocked";

export interface TabLockCoordinatorOptions {
  channelName?: string;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  electionTimeoutMs?: number;
  onConflict?: (leaderId: string) => void;
  onLeaseRevoked?: () => void;
  onLeaseGranted?: () => void;
}

export class TabLockCoordinator {
  private channel: BroadcastChannel | null = null;
  private tabId: string;
  private role: TabRole = "unlocked";
  private activeLeaderId: string | null = null;
  private lastHeartbeatTimestamp = 0;
  private heartbeatTimer: any = null;
  private watchdogTimer: any = null;

  private channelName: string;
  private heartbeatIntervalMs: number;
  private heartbeatTimeoutMs: number;
  private electionTimeoutMs: number;

  private onConflictCb?: (leaderId: string) => void;
  private onLeaseRevokedCb?: () => void;
  private onLeaseGrantedCb?: () => void;

  constructor(options: TabLockCoordinatorOptions = {}) {
    this.channelName = options.channelName || "erd-forge-storage-lock";
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 2000;
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 5000;
    this.electionTimeoutMs = options.electionTimeoutMs ?? 350;

    this.onConflictCb = options.onConflict;
    this.onLeaseRevokedCb = options.onLeaseRevoked;
    this.onLeaseGrantedCb = options.onLeaseGranted;

    this.tabId = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.channel = new BroadcastChannel(this.channelName);
        this.channel.onmessage = this.handleMessage.bind(this);
      } catch (err) {
        console.warn("[TabLockCoordinator] BroadcastChannel not supported in this environment:", err);
      }
    }
  }

  setOnConflict(cb: (leaderId: string) => void): void {
    this.onConflictCb = cb;
  }

  setOnLeaseRevoked(cb: () => void): void {
    this.onLeaseRevokedCb = cb;
  }

  setOnLeaseGranted(cb: () => void): void {
    this.onLeaseGrantedCb = cb;
  }

  getTabId(): string {
    return this.tabId;
  }

  getRole(): TabRole {
    return this.role;
  }

  isLeader(): boolean {
    return this.role === "leader";
  }

  getActiveLeaderId(): string | null {
    return this.activeLeaderId;
  }

  /**
   * Attempts to acquire exclusive leader lease.
   * Broadcasts WHO_IS_LEADER and waits for an active leader heartbeat.
   * If no leader responds within election timeout, this tab claims leadership.
   */
  async acquireLease(): Promise<boolean> {
    if (!this.channel) {
      // If BroadcastChannel is unavailable, assume sole tab
      this.role = "leader";
      return true;
    }

    this.activeLeaderId = null;
    this.lastHeartbeatTimestamp = 0;

    // Ask if anyone is currently leader
    this.postMessage({ type: "WHO_IS_LEADER", tabId: this.tabId });

    // Wait for response
    await new Promise((resolve) => setTimeout(resolve, this.electionTimeoutMs));

    const now = Date.now();
    const hasActiveLeader = this.activeLeaderId !== null && now - this.lastHeartbeatTimestamp < this.heartbeatTimeoutMs;

    if (hasActiveLeader && this.activeLeaderId !== this.tabId) {
      this.role = "follower";
      this.startWatchdog();
      if (this.onConflictCb) {
        this.onConflictCb(this.activeLeaderId!);
      }
      return false;
    }

    // No active leader: claim lease!
    this.becomeLeader();
    return true;
  }

  /**
   * Requests active leader to surrender the lease to this tab.
   */
  async requestTakeover(): Promise<boolean> {
    if (!this.channel) {
      this.role = "leader";
      return true;
    }

    this.postMessage({ type: "REQUEST_TAKEOVER", requestingTabId: this.tabId });

    // Wait for grant response
    const granted = await new Promise<boolean>((resolve) => {
      const checkInterval = 50;
      let elapsed = 0;
      const timer = setInterval(() => {
        elapsed += checkInterval;
        if (this.role === "leader") {
          clearInterval(timer);
          resolve(true);
        } else if (elapsed >= 1500) {
          clearInterval(timer);
          // If active leader didn't respond or timed out, forcibly claim
          this.becomeLeader();
          resolve(true);
        }
      }, checkInterval);
    });

    return granted;
  }

  /**
   * Voluntarily surrenders leadership lease.
   */
  releaseLease(): void {
    if (this.role === "leader") {
      this.stopHeartbeat();
      this.postMessage({ type: "RELEASE_LEASE", tabId: this.tabId });
      this.role = "unlocked";
      this.activeLeaderId = null;
    }
  }

  /**
   * Sets tab into explicit read-only mode without storage write access.
   */
  setReadOnly(): void {
    this.releaseLease();
    this.role = "readonly";
  }

  dispose(): void {
    this.releaseLease();
    this.stopWatchdog();
    if (this.channel) {
      try {
        this.channel.close();
      } catch {
        // Ignore
      }
      this.channel = null;
    }
  }

  private becomeLeader(): void {
    this.stopWatchdog();
    this.role = "leader";
    this.activeLeaderId = this.tabId;
    this.lastHeartbeatTimestamp = Date.now();

    this.startHeartbeat();
    this.broadcastHeartbeat();

    if (this.onLeaseGrantedCb) {
      this.onLeaseGrantedCb();
    }
  }

  private handleMessage(event: MessageEvent<StorageLockMessage>): void {
    const msg = event.data;
    if (!msg || typeof msg !== "object") return;

    switch (msg.type) {
      case "WHO_IS_LEADER":
        if (this.role === "leader") {
          this.broadcastHeartbeat();
        }
        break;

      case "LEADER_HEARTBEAT":
        if (msg.tabId !== this.tabId) {
          this.activeLeaderId = msg.tabId;
          this.lastHeartbeatTimestamp = msg.lastActive || Date.now();
          if (this.role === "leader") {
            // Split-brain resolution: lowest tabId wins deterministically
            if (msg.tabId < this.tabId) {
              this.demoteToFollower();
            }
          }
        }
        break;

      case "REQUEST_TAKEOVER":
        if (this.role === "leader" && msg.requestingTabId !== this.tabId) {
          // Surrender leadership cleanly
          this.stopHeartbeat();
          this.role = "follower";
          this.activeLeaderId = msg.requestingTabId;
          this.postMessage({ type: "LEASE_GRANTED", toTabId: msg.requestingTabId });

          if (this.onLeaseRevokedCb) {
            this.onLeaseRevokedCb();
          }
          this.startWatchdog();
        }
        break;

      case "LEASE_GRANTED":
        if (msg.toTabId === this.tabId) {
          this.becomeLeader();
        }
        break;

      case "RELEASE_LEASE":
        if (msg.tabId === this.activeLeaderId) {
          this.activeLeaderId = null;
          this.lastHeartbeatTimestamp = 0;
          // Claim orphaned lease
          if (this.role === "follower") {
            this.becomeLeader();
          }
        }
        break;
    }
  }

  private demoteToFollower(): void {
    this.stopHeartbeat();
    this.role = "follower";
    if (this.onLeaseRevokedCb) {
      this.onLeaseRevokedCb();
    }
    this.startWatchdog();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.role === "leader") {
        this.broadcastHeartbeat();
      }
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private broadcastHeartbeat(): void {
    this.postMessage({
      type: "LEADER_HEARTBEAT",
      tabId: this.tabId,
      lastActive: Date.now(),
    });
  }

  private startWatchdog(): void {
    this.stopWatchdog();
    this.watchdogTimer = setInterval(() => {
      if (this.role === "follower") {
        const now = Date.now();
        // If leader went silent for longer than heartbeat timeout, claim lease
        if (now - this.lastHeartbeatTimestamp > this.heartbeatTimeoutMs) {
          console.warn("[TabLockCoordinator] Active leader heartbeat timed out. Claiming orphaned lease.");
          this.becomeLeader();
        }
      }
    }, this.heartbeatIntervalMs);
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private postMessage(msg: StorageLockMessage): void {
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (err) {
        console.warn("[TabLockCoordinator] Failed to post message:", err);
      }
    }
  }
}

export const tabLockCoordinator = new TabLockCoordinator();
