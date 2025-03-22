import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import fs from "fs";
import yaml from "js-yaml";
import { promisify } from "util";
import { IsolateResponse, VMInfo } from "../types/types.js";
import { defaultDartVMPort } from "./flutter_inspector_server.js";
import { Logger } from "./logger.js";
import { RpcClient } from "./rpc_client.js";
type ConnectionDestination = "dart-vm" | "flutter-extension";
export const execAsync = promisify(exec);

/**
 * Utilities for handling RPC communication with Flutter applications
 */
export class RpcUtilities {
  private dartVmClient: RpcClient;
  private flutterExtensionClient: RpcClient;

  constructor(
    private readonly host: string = "localhost",
    private readonly logger: Logger
  ) {
    this.dartVmClient = new RpcClient();
    this.flutterExtensionClient = new RpcClient();
  }

  /**
   * Connect to the Dart VM
   */
  async connect(
    port: number,
    connectionDestination: ConnectionDestination
  ): Promise<void> {
    if (connectionDestination === "dart-vm") {
      await this.dartVmClient.connect(this.host, port, "/ws");
    } else {
      await this.flutterExtensionClient.connect(this.host, port, "/");
    }
  }

  /**
   * Send a WebSocket request to the specified port
   */
  async sendWebSocketRequest(
    port: number,
    method: string,
    params: Record<string, unknown> = {},
    connectionDestination: ConnectionDestination = "dart-vm"
  ): Promise<unknown> {
    await this.connect(port, connectionDestination);
    switch (connectionDestination) {
      case "dart-vm":
        return this.dartVmClient.callMethod(method, params);
      case "flutter-extension":
        return this.flutterExtensionClient.callMethod(method, params);
    }
  }

  /**
   * Close all WebSocket connections
   */
  async closeAllConnections(): Promise<void> {
    this.dartVmClient.disconnect();
    this.flutterExtensionClient.disconnect();
  }

  /**
   * Forwards a request to the Dart VM
   */
  async callDartVm(
    method: string,
    port: number,
    params: Record<string, unknown> = {}
  ): Promise<unknown> {
    try {
      const result = await this.sendWebSocketRequest(
        port,
        method,
        params,
        "dart-vm"
      );
      return result;
    } catch (error) {
      this.logger.error(`Error invoking Flutter method ${method}:`, error);
      throw error;
    }
  }

  /**
   * Forwards a request to the Flutter extension
   */
  async callFlutterExtension(
    method: string,
    port: number,
    params: Record<string, unknown> = {}
  ): Promise<unknown> {
    try {
      const result = await this.sendWebSocketRequest(
        port,
        method,
        params,
        "flutter-extension"
      );
      return result;
    } catch (error) {
      this.logger.error(`Error invoking Flutter method ${method}:`, error);
      throw error;
    }
  }

  /**
   * Get the Flutter isolate ID from the VM
   */
  async getFlutterIsolate(port: number): Promise<string> {
    const vmInfo = await this.getVmInfo(port);
    const isolates = vmInfo.isolates;

    // Find Flutter isolate by checking for Flutter extension RPCs
    for (const isolateRef of isolates) {
      const isolate = await this.getIsolate(port, isolateRef.id);

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

  async getVmInfo(port: number): Promise<VMInfo> {
    const vmInfo = await this.callDartVm("getVM", port);
    return vmInfo as VMInfo;
  }

  async getIsolate(port: number, isolateId: string): Promise<IsolateResponse> {
    const isolate = await this.callDartVm("getIsolate", port, {
      isolateId,
    });
    return isolate as IsolateResponse;
  }

  /**
   * Verify that the Flutter app is running in debug mode
   */
  async verifyFlutterDebugMode(port: number): Promise<void> {
    const vmInfo = await this.getVmInfo(port);
    if (!vmInfo) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get VM info from Flutter app on port ${port}`
      );
    }
  }

  /**
   * Wrap a promise response for MCP
   */
  async wrapResponse(promise: Promise<unknown>) {
    try {
      const result = await promise;
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error: ${error?.message}` }],
        isError: true,
      };
    }
  }

  /**
   * Load YAML tool configuration from a file path
   */
  loadYamlConfig(filePath: string): any {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Cannot find YAML configuration at ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf8");
    return yaml.load(content);
  }

  /**
   * Helper to extract port parameter from a request
   */
  handlePortParam(
    request: any,
    defaultPort: number = defaultDartVMPort
  ): number {
    const port = request.params.arguments?.port as number | undefined;
    return port || defaultPort;
  }
}
