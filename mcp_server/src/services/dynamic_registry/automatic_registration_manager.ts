import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Logger } from "../../logger.js";
import { RpcUtilities } from "../../servers/rpc_utilities.js";
import { DynamicToolRegistry } from "./dynamic_tool_registry.js";

/**
 * Manages automatic registration of Flutter app tools and resources
 * Handles registration at two key points:
 * 1. When server establishes connection to Dart VM
 * 2. When Dart VM sends event that Flutter application was reloaded
 */
export class AutomaticRegistrationManager {
  private isListeningForEvents = false;
  private registrationInProgress = false;
  private eventListenerCleanup: (() => void) | null = null;
  private processedIsolates = new Set<string>();

  constructor(
    private readonly logger: Logger,
    private readonly rpcUtils: RpcUtilities,
    private readonly dynamicRegistry: DynamicToolRegistry,
    private readonly server: Server
  ) {}

  /**
   * Send notification to clients that the tools list has changed
   */
  private async notifyToolsListChanged(): Promise<void> {
    try {
      await this.server.notification({
        method: "notifications/tools/list_changed",
      });
      this.logger.debug(
        "[AutoRegistration] Sent tools/list_changed notification"
      );
    } catch (error) {
      this.logger.warn(
        "[AutoRegistration] Failed to send tools/list_changed notification:",
        { error }
      );
    }
  }

  /**
   * Initialize automatic registration system
   * Sets up event listeners for hot reload detection
   */
  async initialize(): Promise<void> {
    this.logger.info(
      "[AutoRegistration] Initializing automatic registration system"
    );

    // Start listening for Flutter events
    await this.startEventListening();

    // Perform initial registration attempt
    await this.performInitialRegistration();
  }

  /**
   * Perform initial registration when server connects to Dart VM
   */
  private async performInitialRegistration(): Promise<void> {
    this.logger.info(
      "[AutoRegistration] Attempting initial registration on Dart VM connection"
    );

    try {
      // Wait a bit for Flutter app to be ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await this.attemptRegistration("initial_connection");
    } catch (error) {
      this.logger.warn(
        "[AutoRegistration] Initial registration failed, will retry on events:",
        { error }
      );
    }
  }

  /**
   * Start listening for Flutter events that indicate app reload
   */
  private async startEventListening(): Promise<void> {
    if (this.isListeningForEvents) {
      return;
    }

    try {
      const dartVmPort = this.rpcUtils.args.dartVMPort;

      // Subscribe to VM service events and establish WebSocket connection
      await this.subscribeToVmEvents(dartVmPort);

      this.isListeningForEvents = true;
      this.logger.info(
        "[AutoRegistration] Started listening for Flutter events"
      );
    } catch (error) {
      this.logger.error("[AutoRegistration] Failed to start event listening:", {
        error,
      });
    }
  }

  /**
   * Subscribe to VM service events to detect hot reloads and framework initialization
   */
  private async subscribeToVmEvents(dartVmPort: number): Promise<void> {
    try {
      // Listen for Extension events (includes Flutter.FrameworkInitialization)
      await this.rpcUtils.sendWebSocketRequest(dartVmPort, "streamListen", {
        streamId: "Extension",
      });

      // Listen for Debug events (includes hot reload completion)
      await this.rpcUtils.sendWebSocketRequest(dartVmPort, "streamListen", {
        streamId: "Debug",
      });

      // Listen for Isolate events (includes isolate start/reload)
      await this.rpcUtils.sendWebSocketRequest(dartVmPort, "streamListen", {
        streamId: "Isolate",
      });

      // Listen for custom MCPToolkit events
      await this.rpcUtils.sendWebSocketRequest(dartVmPort, "streamListen", {
        streamId: "Extension",
      });

      // Set up real-time event handling via WebSocket
      await this.setupEventHandling(dartVmPort);
    } catch (error) {
      this.logger.error(
        "[AutoRegistration] Failed to subscribe to VM events:",
        { error }
      );
    }
  }

  /**
   * Set up real-time event handling via WebSocket connection
   */
  private async setupEventHandling(dartVmPort: number): Promise<void> {
    try {
      // Try to establish WebSocket connection using existing RPC utilities
      await this.rpcUtils.connect(dartVmPort);

      // Note: For now, we'll use polling since the RpcUtilities doesn't expose
      // WebSocket events directly. In future, we can enhance RpcUtilities
      // to support event streaming.
      this.logger.info("[AutoRegistration] Using polling for event detection");
      this.startEventPolling(dartVmPort);
    } catch (error) {
      this.logger.warn(
        "[AutoRegistration] Failed to setup event handling, falling back to polling:",
        { error }
      );
      // Fallback to polling
      this.startEventPolling(dartVmPort);
    }
  }

  /**
   * Handle VM service events in real-time
   * Note: This will be implemented when RpcUtilities supports WebSocket events
   */
  private async handleVmServiceEvent(message: any): Promise<void> {
    try {
      if (message.method === "streamNotify") {
        const event = message.params?.event;

        if (!event) return;

        // Handle different types of events
        switch (event.kind) {
          case "Extension":
            await this.handleExtensionEvent(event);
            break;
          case "IsolateStart":
          case "IsolateRunnable":
            await this.handleIsolateEvent(event);
            break;
          case "Debug":
            await this.handleDebugEvent(event);
            break;
        }
      }
    } catch (error) {
      this.logger.debug("[AutoRegistration] Error handling VM service event:", {
        error,
      });
    }
  }

  /**
   * Handle extension events (Flutter framework initialization)
   */
  private async handleExtensionEvent(event: any): Promise<void> {
    if (event.extensionKind === "Flutter.FrameworkInitialization") {
      this.logger.info(
        "[AutoRegistration] Flutter framework initialized, attempting registration"
      );
      await this.attemptRegistration("flutter_framework_init");
    } else if (event.extensionKind === "MCPToolkit.ToolRegistration") {
      this.logger.info(
        "[AutoRegistration] Detected MCPToolkit tool registration event"
      );
      const eventData = event.extensionData;
      if (eventData) {
        this.logger.info(
          `[AutoRegistration] New tools registered: ${eventData.toolCount} tools, ${eventData.resourceCount} resources from ${eventData.appId}`
        );
        await this.attemptRegistration("tool_registration_event");
      }
    }
  }

  /**
   * Handle isolate events (new isolates starting)
   */
  private async handleIsolateEvent(event: any): Promise<void> {
    const isolateId = event.isolate?.id;
    if (!isolateId || this.processedIsolates.has(isolateId)) {
      return;
    }

    try {
      const dartVmPort = this.rpcUtils.args.dartVMPort;
      const isolate = await this.rpcUtils.getIsolate(dartVmPort, isolateId);

      // Check if isolate has Flutter extensions
      const hasFlutterExtensions = isolate.extensionRPCs?.some(
        (ext: string) =>
          ext.startsWith("ext.flutter") || ext.startsWith("ext.mcp.toolkit")
      );

      if (hasFlutterExtensions) {
        this.logger.info(
          `[AutoRegistration] Detected new Flutter isolate ${isolateId} with extensions`
        );
        this.processedIsolates.add(isolateId);
        await this.attemptRegistration("flutter_isolate_detected");
      }
    } catch (error) {
      this.logger.debug("[AutoRegistration] Error checking isolate:", {
        error,
      });
    }
  }

  /**
   * Handle debug events (hot reload completion)
   */
  private async handleDebugEvent(event: any): Promise<void> {
    if (event.kind === "Resume" && event.topFrame) {
      this.logger.info(
        "[AutoRegistration] Flutter app resumed after hot reload"
      );
      // Wait a moment for app to be ready after hot reload
      setTimeout(() => {
        this.attemptRegistration("hot_reload_completed").catch((error) => {
          this.logger.debug(
            "[AutoRegistration] Hot reload registration failed:",
            { error }
          );
        });
      }, 1000);
    }
  }

  /**
   * Attempt to register tools and resources from Flutter app
   */
  private async attemptRegistration(trigger: string): Promise<void> {
    if (this.registrationInProgress) {
      this.logger.debug(
        "[AutoRegistration] Registration already in progress, skipping"
      );
      return;
    }

    this.registrationInProgress = true;

    try {
      this.logger.info(
        `[AutoRegistration] Attempting registration (trigger: ${trigger})`
      );

      const dartVmPort = this.rpcUtils.args.dartVMPort;

      // Call the registerDynamics service extension
      const result = await this.rpcUtils.callDartVm({
        method: "ext.mcp.toolkit.registerDynamics",
        dartVmPort,
        params: {},
      });

      const {
        tools = [],
        resources = [],
        appId,
      } = result as {
        tools?: any[];
        resources?: any[];
        appId?: string;
      };

      if (!appId) {
        this.logger.warn(
          "[AutoRegistration] Flutter app did not provide appId, skipping registration"
        );
        return;
      }

      // Clear existing registrations for this app to avoid duplicates
      this.dynamicRegistry.clearAppRegistrations(appId);

      const registeredTools: string[] = [];
      const registeredResources: string[] = [];

      // Register all tools
      for (const tool of tools) {
        try {
          this.dynamicRegistry.registerTool(tool, appId, dartVmPort);
          registeredTools.push(tool.name);
        } catch (error) {
          this.logger.warn(
            `[AutoRegistration] Failed to register tool ${tool.name}:`,
            { error }
          );
        }
      }

      // Register all resources
      for (const resource of resources) {
        try {
          this.dynamicRegistry.registerResource(resource, appId, dartVmPort);
          registeredResources.push(resource.uri);
        } catch (error) {
          this.logger.warn(
            `[AutoRegistration] Failed to register resource ${resource.uri}:`,
            { error }
          );
        }
      }

      this.logger.info(
        `[AutoRegistration] Successfully registered ${tools.length} tools and ${resources.length} resources from ${appId} (trigger: ${trigger})`
      );

      // Post a custom event to notify about successful registration
      await this.postRegistrationEvent(
        appId,
        registeredTools,
        registeredResources,
        trigger
      );

      // Notify MCP clients that the tools list has changed
      await this.notifyToolsListChanged();
    } catch (error) {
      this.logger.warn(
        `[AutoRegistration] Registration attempt failed (trigger: ${trigger}):`,
        { error }
      );
    } finally {
      this.registrationInProgress = false;
    }
  }

  /**
   * Post a custom event to the Dart VM to notify about successful registration
   */
  private async postRegistrationEvent(
    appId: string,
    tools: string[],
    resources: string[],
    trigger: string
  ): Promise<void> {
    try {
      // This is a custom event that Flutter apps can listen for
      const eventData = {
        appId,
        toolCount: tools.length,
        resourceCount: resources.length,
        tools,
        resources,
        trigger,
        timestamp: new Date().toISOString(),
      };

      // We can't directly post events to the VM, but we can log this for debugging
      this.logger.debug(
        "[AutoRegistration] Registration completed:",
        eventData
      );
    } catch (error) {
      this.logger.debug(
        "[AutoRegistration] Failed to post registration event:",
        { error }
      );
    }
  }

  /**
   * Manually trigger registration (useful for testing or manual refresh)
   */
  async triggerManualRegistration(): Promise<void> {
    await this.attemptRegistration("manual_trigger");
  }

  /**
   * Stop automatic registration and cleanup resources
   */
  async stop(): Promise<void> {
    this.isListeningForEvents = false;

    if (this.eventListenerCleanup) {
      this.eventListenerCleanup();
      this.eventListenerCleanup = null;
    }

    this.logger.info(
      "[AutoRegistration] Stopped automatic registration system"
    );
  }

  /**
   * Get current status of automatic registration
   */
  getStatus(): {
    isListening: boolean;
    isRegistering: boolean;
    lastRegistrationAttempt?: string;
  } {
    return {
      isListening: this.isListeningForEvents,
      isRegistering: this.registrationInProgress,
    };
  }

  /**
   * Polling mechanism for event detection
   */
  private startEventPolling(dartVmPort: number): void {
    const pollInterval = 10000; // Poll every 10 seconds
    let lastEventTimestamp = Date.now();

    const poll = async () => {
      try {
        // Check for recent events that might indicate a reload
        const vmInfo = await this.rpcUtils.getVmInfo(dartVmPort);

        if (vmInfo) {
          // Check if there are new isolates or if isolates have been restarted
          await this.checkForReloadIndicators(dartVmPort, lastEventTimestamp);
          lastEventTimestamp = Date.now();
        }
      } catch (error) {
        // Silently handle polling errors to avoid spam
        this.logger.debug("[AutoRegistration] Event polling error:", { error });
      }

      // Continue polling if still listening
      if (this.isListeningForEvents) {
        setTimeout(poll, pollInterval);
      }
    };

    // Start polling
    setTimeout(poll, pollInterval);
  }

  /**
   * Check for indicators that suggest a Flutter app reload occurred
   */
  private async checkForReloadIndicators(
    dartVmPort: number,
    lastCheck: number
  ): Promise<void> {
    try {
      // Get current isolates
      const vmInfo = await this.rpcUtils.getVmInfo(dartVmPort);
      const isolates = vmInfo?.isolates || [];

      // Track current isolate IDs
      const currentIsolateIds = new Set(isolates.map((ref) => ref.id));

      // Check for new isolates that we haven't processed
      for (const isolateRef of isolates) {
        // Skip if we've already processed this isolate
        if (this.processedIsolates.has(isolateRef.id)) {
          continue;
        }

        try {
          const isolate = await this.rpcUtils.getIsolate(
            dartVmPort,
            isolateRef.id
          );

          // Check if isolate has Flutter extensions (indicates Flutter app)
          const hasFlutterExtensions = isolate.extensionRPCs?.some(
            (ext: string) =>
              ext.startsWith("ext.flutter") || ext.startsWith("ext.mcp.toolkit")
          );

          if (hasFlutterExtensions) {
            this.logger.info(
              `[AutoRegistration] Detected new Flutter isolate ${isolateRef.id} with extensions, attempting registration`
            );

            // Mark this isolate as processed
            this.processedIsolates.add(isolateRef.id);

            await this.attemptRegistration("flutter_isolate_detected");
            break;
          }
        } catch (error) {
          // Continue checking other isolates
          this.logger.debug("[AutoRegistration] Error checking isolate:", {
            error,
          });
        }
      }

      // Clean up processed isolates that no longer exist (garbage collection)
      for (const processedId of this.processedIsolates) {
        if (!currentIsolateIds.has(processedId)) {
          this.processedIsolates.delete(processedId);
          this.logger.debug(
            `[AutoRegistration] Cleaned up processed isolate ${processedId}`
          );
        }
      }
    } catch (error) {
      this.logger.debug(
        "[AutoRegistration] Error checking reload indicators:",
        { error }
      );
    }
  }
}
