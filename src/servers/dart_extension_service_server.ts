import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { FlutterRPC } from "../rpc/flutter_rpc.js";
import { BaseDartServer, DartServerConfig } from "./base_dart_server.js";
import { VMServiceServer } from "./vm_service_server.js";

export interface ProxyRequest {
  command: string;
  port: number;
  authToken?: string;
  args?: Record<string, any>;
}

export interface ProxyResponse {
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class DartExtensionServiceServer extends BaseDartServer {
  private vmService: VMServiceServer | null = null;

  constructor(config: DartServerConfig) {
    super(config);
  }

  protected getWebSocketUrl(): string {
    return `ws://localhost:${this.config.port}`;
  }

  /**
   * Initialize VM service connection
   */
  private async initVMService(port: number): Promise<void> {
    if (!this.vmService) {
      this.vmService = new VMServiceServer({
        port,
        logLevel: this.config.logLevel,
      });
    }
    await this.vmService.connect();
  }

  /**
   * Send a request to the Dart proxy
   */
  private async sendProxyRequest(request: ProxyRequest): Promise<unknown> {
    try {
      // Initialize VM service if needed
      await this.initVMService(request.port);

      // Get auth token from VM service if not provided
      if (!request.authToken) {
        const vmInfo = await this.vmService!.getVM();
        request.authToken =
          (vmInfo as any)?.uri?.split("/")?.at(-2) || "0yEC3VaHaUk=";
      }

      // Send the request
      const id = this.generateId();
      const message = {
        id,
        ...request,
      };

      return this.sendMessage("proxy", message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to send proxy request: ${message}`
      );
    }
  }

  // Inspector Methods
  async isWidgetCreationTracked(port: number): Promise<boolean> {
    return this.sendProxyRequest({
      command: FlutterRPC.Inspector.IS_WIDGET_CREATION_TRACKED,
      port,
    }) as Promise<boolean>;
  }

  async getSelectedWidget(port: number): Promise<unknown> {
    return this.sendProxyRequest({
      command: FlutterRPC.Inspector.GET_SELECTED_WIDGET,
      port,
    });
  }

  async getSelectedSummaryWidget(port: number): Promise<unknown> {
    return this.sendProxyRequest({
      command: FlutterRPC.Inspector.GET_SELECTED_SUMMARY_WIDGET,
      port,
    });
  }

  async getWidgetTree(
    port: number,
    options: { subtreeDepth?: number } = {}
  ): Promise<unknown> {
    return this.sendProxyRequest({
      command: FlutterRPC.Inspector.GET_WIDGET_TREE,
      port,
      args: options,
    });
  }

  async getWidgetDetails(port: number, objectId: string): Promise<unknown> {
    return this.sendProxyRequest({
      command: FlutterRPC.Inspector.GET_DETAILS_SUBTREE,
      port,
      args: { objectId },
    });
  }

  async setSelectionById(port: number, selectionId: string): Promise<void> {
    await this.sendProxyRequest({
      command: FlutterRPC.Inspector.SET_SELECTION_BY_ID,
      port,
      args: { selectionId },
    });
  }

  async getParentChain(port: number, objectId: string): Promise<unknown> {
    return this.sendProxyRequest({
      command: FlutterRPC.Inspector.GET_PARENT_CHAIN,
      port,
      args: { objectId },
    });
  }

  async getChildrenSummaryTree(
    port: number,
    objectId: string
  ): Promise<unknown> {
    return this.sendProxyRequest({
      command: FlutterRPC.Inspector.GET_CHILDREN_SUMMARY_TREE,
      port,
      args: { objectId },
    });
  }

  async getLayoutExplorerNode(
    port: number,
    objectId: string
  ): Promise<unknown> {
    return this.sendProxyRequest({
      command: FlutterRPC.Layout.GET_EXPLORER_NODE,
      port,
      args: { objectId },
    });
  }

  async trackRebuildDirtyWidgets(
    port: number,
    enabled: boolean
  ): Promise<void> {
    await this.sendProxyRequest({
      command: FlutterRPC.Inspector.TRACK_REBUILDS,
      port,
      args: { enabled },
    });
  }

  async setStructuredErrors(port: number, enabled: boolean): Promise<void> {
    await this.sendProxyRequest({
      command: FlutterRPC.Inspector.STRUCTURED_ERRORS,
      port,
      args: { enabled },
    });
  }

  // Core Methods
  async setPlatformOverride(
    port: number,
    platform: string | null
  ): Promise<void> {
    await this.sendProxyRequest({
      command: FlutterRPC.Core.PLATFORM_OVERRIDE,
      port,
      args: { platform },
    });
  }

  async setBrightnessOverride(
    port: number,
    brightness: string | null
  ): Promise<void> {
    await this.sendProxyRequest({
      command: FlutterRPC.Core.BRIGHTNESS_OVERRIDE,
      port,
      args: { brightness },
    });
  }

  async setTimeDilation(port: number, dilation: number): Promise<void> {
    await this.sendProxyRequest({
      command: FlutterRPC.Core.TIME_DILATION,
      port,
      args: { timeDilation: dilation },
    });
  }

  async evictAsset(port: number, asset: string): Promise<void> {
    await this.sendProxyRequest({
      command: FlutterRPC.Core.EVICT,
      port,
      args: { asset },
    });
  }

  // Performance Methods
  async setShowPerformanceOverlay(
    port: number,
    enabled: boolean
  ): Promise<void> {
    await this.sendProxyRequest({
      command: FlutterRPC.Performance.SHOW_OVERLAY,
      port,
      args: { enabled },
    });
  }

  /**
   * Clean up resources
   */
  async disconnect(): Promise<void> {
    await super.disconnect();
    if (this.vmService) {
      await this.vmService.disconnect();
      this.vmService = null;
    }
  }
}
