import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { FlutterRPC, IsolateResponse, VMInfo } from "../rpc/flutter_rpc.js";
import { BaseDartServer, DartServerConfig } from "./base_dart_server.js";

export class VMServiceServer extends BaseDartServer {
  constructor(config: DartServerConfig) {
    super(config);
  }

  protected getWebSocketUrl(): string {
    return `ws://localhost:${this.config.port}/ws`;
  }

  /**
   * Get VM information
   */
  async getVM(): Promise<VMInfo> {
    return this.sendMessage("getVM", {}) as Promise<VMInfo>;
  }

  /**
   * Get isolate information
   */
  async getIsolate(isolateId: string): Promise<IsolateResponse> {
    return this.sendMessage("getIsolate", {
      isolateId,
    }) as Promise<IsolateResponse>;
  }

  /**
   * Get Flutter isolate
   */
  async getFlutterIsolate(): Promise<string> {
    const vmInfo = await this.getVM();
    const isolates = vmInfo.isolates;

    // Find Flutter isolate by checking for Flutter extension RPCs
    for (const isolateRef of isolates) {
      const isolate = await this.getIsolate(isolateRef.id);

      // Check if this isolate has Flutter extensions
      const extensionRPCs = isolate.extensionRPCs || [];
      if (extensionRPCs.some((ext: string) => ext.startsWith("ext.flutter"))) {
        return isolateRef.id;
      }
    }

    throw new McpError(
      ErrorCode.InternalError,
      "No Flutter isolate found in the application"
    );
  }

  /**
   * Verify Flutter debug mode
   */
  async verifyFlutterDebugMode(): Promise<void> {
    try {
      await this.getFlutterIsolate();
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Port ${this.config.port} is not running Flutter in debug mode`
      );
    }
  }

  /**
   * Invoke Flutter extension method
   */
  private async invokeFlutterExtension(
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    const isolateId = await this.getFlutterIsolate();
    return this.sendMessage(method, {
      ...params,
      isolateId,
    });
  }

  // Debug Methods
  async dumpRenderTree(): Promise<string> {
    await this.verifyFlutterDebugMode();
    return this.invokeFlutterExtension(
      FlutterRPC.Debug.DUMP_RENDER_TREE
    ) as Promise<string>;
  }

  async dumpLayerTree(): Promise<string> {
    await this.verifyFlutterDebugMode();
    return this.invokeFlutterExtension(
      FlutterRPC.Debug.DUMP_LAYER_TREE
    ) as Promise<string>;
  }

  async dumpSemanticsTree(): Promise<string> {
    await this.verifyFlutterDebugMode();
    return this.invokeFlutterExtension(
      FlutterRPC.Debug.DUMP_SEMANTICS
    ) as Promise<string>;
  }

  async dumpSemanticsTreeInverse(): Promise<string> {
    await this.verifyFlutterDebugMode();
    return this.invokeFlutterExtension(
      FlutterRPC.Debug.DUMP_SEMANTICS_INVERSE
    ) as Promise<string>;
  }

  async dumpFocusTree(): Promise<string> {
    await this.verifyFlutterDebugMode();
    return this.invokeFlutterExtension(
      FlutterRPC.Debug.DUMP_FOCUS_TREE
    ) as Promise<string>;
  }

  async setDebugPaintEnabled(enabled: boolean): Promise<void> {
    await this.verifyFlutterDebugMode();
    await this.invokeFlutterExtension(FlutterRPC.Debug.DEBUG_PAINT, {
      enabled,
    });
  }

  async setDebugPaintBaselinesEnabled(enabled: boolean): Promise<void> {
    await this.verifyFlutterDebugMode();
    await this.invokeFlutterExtension(FlutterRPC.Debug.DEBUG_PAINT_BASELINES, {
      enabled,
    });
  }

  async setRepaintRainbowEnabled(enabled: boolean): Promise<void> {
    await this.verifyFlutterDebugMode();
    await this.invokeFlutterExtension(FlutterRPC.Debug.REPAINT_RAINBOW, {
      enabled,
    });
  }

  // Inspector Methods
  async isWidgetCreationTracked(): Promise<boolean> {
    await this.verifyFlutterDebugMode();
    return this.invokeFlutterExtension(
      FlutterRPC.Inspector.IS_WIDGET_CREATION_TRACKED
    ) as Promise<boolean>;
  }

  async getSelectedWidget(): Promise<unknown> {
    await this.verifyFlutterDebugMode();
    return this.invokeFlutterExtension(
      FlutterRPC.Inspector.GET_SELECTED_WIDGET
    );
  }

  async getSelectedSummaryWidget(): Promise<unknown> {
    await this.verifyFlutterDebugMode();
    return this.invokeFlutterExtension(
      FlutterRPC.Inspector.GET_SELECTED_SUMMARY_WIDGET
    );
  }

  async getWidgetTree(params?: { subtreeDepth?: number }): Promise<unknown> {
    await this.verifyFlutterDebugMode();
    return this.invokeFlutterExtension(
      FlutterRPC.Inspector.GET_WIDGET_TREE,
      params
    );
  }

  async getWidgetDetails(objectId: string): Promise<unknown> {
    await this.verifyFlutterDebugMode();
    return this.invokeFlutterExtension(
      FlutterRPC.Inspector.GET_DETAILS_SUBTREE,
      { objectId }
    );
  }

  async setSelectionById(selectionId: string): Promise<void> {
    await this.verifyFlutterDebugMode();
    await this.invokeFlutterExtension(
      FlutterRPC.Inspector.SET_SELECTION_BY_ID,
      { selectionId }
    );
  }

  async getParentChain(objectId: string): Promise<unknown> {
    await this.verifyFlutterDebugMode();
    return this.invokeFlutterExtension(FlutterRPC.Inspector.GET_PARENT_CHAIN, {
      objectId,
    });
  }

  async getChildrenSummaryTree(objectId: string): Promise<unknown> {
    await this.verifyFlutterDebugMode();
    return this.invokeFlutterExtension(
      FlutterRPC.Inspector.GET_CHILDREN_SUMMARY_TREE,
      { objectId }
    );
  }

  async getLayoutExplorerNode(objectId: string): Promise<unknown> {
    await this.verifyFlutterDebugMode();
    return this.invokeFlutterExtension(FlutterRPC.Layout.GET_EXPLORER_NODE, {
      objectId,
    });
  }

  async trackRebuildDirtyWidgets(enabled: boolean): Promise<void> {
    await this.verifyFlutterDebugMode();
    await this.invokeFlutterExtension(FlutterRPC.Inspector.TRACK_REBUILDS, {
      enabled,
    });
  }

  async setStructuredErrors(enabled: boolean): Promise<void> {
    await this.verifyFlutterDebugMode();
    await this.invokeFlutterExtension(FlutterRPC.Inspector.STRUCTURED_ERRORS, {
      enabled,
    });
  }

  // Core Methods
  async setPlatformOverride(platform: string | null): Promise<void> {
    await this.verifyFlutterDebugMode();
    await this.invokeFlutterExtension(FlutterRPC.Core.PLATFORM_OVERRIDE, {
      platform,
    });
  }

  async setBrightnessOverride(brightness: string | null): Promise<void> {
    await this.verifyFlutterDebugMode();
    await this.invokeFlutterExtension(FlutterRPC.Core.BRIGHTNESS_OVERRIDE, {
      brightness,
    });
  }

  async setTimeDilation(dilation: number): Promise<void> {
    await this.verifyFlutterDebugMode();
    await this.invokeFlutterExtension(FlutterRPC.Core.TIME_DILATION, {
      timeDilation: dilation,
    });
  }

  async evictAsset(asset: string): Promise<void> {
    await this.verifyFlutterDebugMode();
    await this.invokeFlutterExtension(FlutterRPC.Core.EVICT, { asset });
  }

  // Performance Methods
  async setShowPerformanceOverlay(enabled: boolean): Promise<void> {
    await this.verifyFlutterDebugMode();
    await this.invokeFlutterExtension(FlutterRPC.Performance.SHOW_OVERLAY, {
      enabled,
    });
  }
}
