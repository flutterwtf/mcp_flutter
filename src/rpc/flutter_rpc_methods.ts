import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import WebSocket from "ws";
import {
  IsolateResponse,
  RPCPrefix,
  VMInfo,
  WebSocketRequest,
  WebSocketResponse,
} from "../types/types.js";

export const execAsync = promisify(exec);

export function createRPCMethod(prefix: RPCPrefix, method: string): string {
  return `${prefix}.${method}`;
}
export async function invokeFlutterMethod(
  port: number,
  method: string,
  params: Record<string, unknown> = {},
  wsConnections: Map<number, WebSocket>,
  pendingRequests: Map<
    string,
    { resolve: Function; reject: Function; method: string }
  >
): Promise<unknown> {
  const generateId = (): string => {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };

  const connectWebSocket = async (port: number): Promise<WebSocket> => {
    if (wsConnections.has(port)) {
      const ws = wsConnections.get(port)!;
      if (ws.readyState === WebSocket.OPEN) {
        return ws;
      }
      wsConnections.delete(port);
    }

    return new Promise((resolve, reject) => {
      const wsUrl = `ws://localhost:${port}/ws`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.debug(`WebSocket connected to ${wsUrl}`);
        wsConnections.set(port, ws);
        resolve(ws);
      };

      ws.onerror = (error) => {
        console.error(`WebSocket error for ${wsUrl}:`, error);
        reject(error);
      };

      ws.onclose = () => {
        console.debug(`WebSocket closed for ${wsUrl}`);
        wsConnections.delete(port);
      };

      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(
            event.data.toString()
          ) as WebSocketResponse;

          if (response.id) {
            const request = pendingRequests.get(response.id);
            if (request) {
              if (response.error) {
                request.reject(new Error(response.error.message));
              } else {
                request.resolve(response.result);
              }
              pendingRequests.delete(response.id);
            }
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };
    });
  };

  const sendWebSocketRequest = async (
    port: number,
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<unknown> => {
    const ws = await connectWebSocket(port);
    const id = generateId();

    const request: WebSocketRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject, method });
      ws.send(JSON.stringify(request));
    });
  };

  try {
    const result = await sendWebSocketRequest(port, method, params);
    return result;
  } catch (error) {
    console.error(`Error invoking Flutter method ${method}:`, error);
    throw error;
  }
}

export async function getFlutterIsolate(
  port: number,
  invokeFlutterMethod: (
    port: number,
    method: string,
    params?: Record<string, unknown>
  ) => Promise<unknown>
): Promise<string> {
  const vmInfo = (await invokeFlutterMethod(port, "getVM")) as VMInfo;
  const isolates = vmInfo.isolates;

  // Find Flutter isolate by checking for Flutter extension RPCs
  for (const isolateRef of isolates) {
    const isolate = (await invokeFlutterMethod(port, "getIsolate", {
      isolateId: isolateRef.id,
    })) as IsolateResponse;

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

export async function invokeFlutterExtension(
  port: number,
  method: string,
  params: Record<string, unknown> | undefined,
  invokeFlutterMethod: (
    port: number,
    method: string,
    params?: Record<string, unknown>
  ) => Promise<unknown>
): Promise<unknown> {
  const isolateId = await getFlutterIsolate(port, invokeFlutterMethod);
  return invokeFlutterMethod(port, method, {
    ...params,
    isolateId,
  });
}

export async function verifyFlutterDebugMode(
  port: number,
  invokeFlutterMethod: (
    port: number,
    method: string,
    params?: Record<string, unknown>
  ) => Promise<unknown>,
  getFlutterIsolate: (
    port: number,
    invokeFlutterMethod: (
      port: number,
      method: string,
      params?: Record<string, unknown>
    ) => Promise<unknown>
  ) => Promise<string>
): Promise<void> {
  const vmInfo = (await invokeFlutterMethod(port, "getVM")) as VMInfo;
  const isolateId = await getFlutterIsolate(port, invokeFlutterMethod);
  const isolateInfo = (await invokeFlutterMethod(port, "getIsolate", {
    isolateId,
  })) as IsolateResponse;

  if (!isolateInfo.extensionRPCs?.includes("ext.flutter.debugDumpRenderTree")) {
    throw new McpError(
      ErrorCode.InternalError,
      "Flutter app must be running in debug mode to inspect the render tree"
    );
  }
}
