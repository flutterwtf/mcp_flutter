import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { IsolateResponse, VMInfo } from "../rpc/flutter_rpc.js";
import { BaseDartServer, DartServerConfig } from "./base_dart_server.js";

export class VMServiceServer extends BaseDartServer {
  constructor(config: DartServerConfig) {
    super(config);
  }

  protected getWebSocketUrl(): string {
    return `ws://localhost:${this.config.port}/ws`;
  }

  /**
   * Get VM information including isolates
   */
  async getVM(): Promise<VMInfo> {
    return this.sendMessage("getVM") as Promise<VMInfo>;
  }

  /**
   * Get information about a specific isolate
   */
  async getIsolate(isolateId: string): Promise<IsolateResponse> {
    return this.sendMessage("getIsolate", {
      isolateId,
    }) as Promise<IsolateResponse>;
  }

  /**
   * Get the Flutter isolate by checking for Flutter extension RPCs
   */
  async getFlutterIsolate(): Promise<string> {
    const vmInfo = await this.getVM();

    for (const isolateRef of vmInfo.isolates) {
      const isolate = await this.getIsolate(isolateRef.id);

      // Check if this isolate has Flutter extensions
      const extensionRPCs = isolate.extensionRPCs || [];
      if (extensionRPCs.some((ext: string) => ext.startsWith("ext.flutter"))) {
        return isolateRef.id;
      }
    }

    throw new McpError(
      ErrorCode.InvalidRequest,
      "No Flutter isolate found in the application"
    );
  }

  /**
   * Invoke a Flutter extension method
   */
  async invokeExtension(
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    const isolateId = await this.getFlutterIsolate();
    return this.sendMessage(method, {
      ...params,
      isolateId,
    });
  }

  /**
   * Get list of supported protocols
   */
  async getSupportedProtocols(): Promise<string[]> {
    const response = await this.sendMessage("_getSupportedProtocols");
    return (response as { protocols: string[] }).protocols || [];
  }

  /**
   * Get list of extension RPCs available in the VM
   */
  async getExtensionRPCs(isolateId?: string): Promise<string[]> {
    if (!isolateId) {
      isolateId = await this.getFlutterIsolate();
    }

    const isolate = await this.getIsolate(isolateId);
    return isolate.extensionRPCs || [];
  }

  /**
   * Verify if the VM is running Flutter in debug mode
   */
  async verifyFlutterDebugMode(): Promise<void> {
    try {
      const isolateId = await this.getFlutterIsolate();
      const isolate = await this.getIsolate(isolateId);

      if (!isolate.extensionRPCs?.includes("ext.flutter.debugDumpRenderTree")) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "Flutter app must be running in debug mode to inspect the render tree"
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Failed to verify Flutter debug mode: ${message}`
      );
    }
  }
}
