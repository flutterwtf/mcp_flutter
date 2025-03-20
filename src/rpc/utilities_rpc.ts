import { exec } from "child_process";
import { promisify } from "util";
import WebSocket from "ws";

const execAsync = promisify(exec);

export interface FlutterPort {
  port: number;
  pid: string;
  command: string;
}

export type LogLevel = "error" | "warn" | "info" | "debug";

export class UtilitiesRPC {
  constructor(private logLevel: string = "info") {}

  /**
   * Get list of active Flutter debug ports
   */
  async getActivePorts(): Promise<FlutterPort[]> {
    try {
      // Get list of processes
      const { stdout } = await execAsync(
        'ps aux | grep -i "flutter run" | grep -v grep'
      );

      // Parse process list
      const ports: FlutterPort[] = [];
      const lines = stdout.split("\n");

      for (const line of lines) {
        if (!line.trim()) continue;

        // Extract PID
        const parts = line.split(/\s+/);
        const pid = parts[1];

        // Look for observatory port
        const observatoryMatch = line.match(/observatory-port=(\d+)/);
        if (!observatoryMatch) continue;

        const port = parseInt(observatoryMatch[1], 10);
        if (isNaN(port)) continue;

        ports.push({
          port,
          pid,
          command: line.trim(),
        });
      }

      return ports;
    } catch (error) {
      console.error("Error getting active ports:", error);
      return [];
    }
  }

  /**
   * Verify if a port is running Flutter in debug mode
   */
  async verifyFlutterDebugMode(port: number): Promise<void> {
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => {
          ws.close();
          resolve();
        });

        ws.on("error", (error) => {
          reject(
            new Error(
              `Failed to connect to Flutter debug port ${port}: ${error.message}`
            )
          );
        });
      });
    } catch (error) {
      throw new Error(`Port ${port} is not running Flutter in debug mode`);
    }
  }

  /**
   * Get supported protocols from a Flutter app
   */
  async getSupportedProtocols(port: number): Promise<string[]> {
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

      const response = await new Promise<string[]>((resolve, reject) => {
        ws.on("open", () => {
          ws.send(
            JSON.stringify({
              jsonrpc: "2.0",
              id: "1",
              method: "_getSupportedProtocols",
            })
          );
        });

        ws.on("message", (data) => {
          const response = JSON.parse(data.toString());
          ws.close();
          resolve(response.result?.protocols || []);
        });

        ws.on("error", reject);
      });

      return response;
    } catch (error) {
      console.error("Error getting supported protocols:", error);
      return [];
    }
  }

  /**
   * Get VM information from a Flutter app
   */
  async getVMInfo(port: number): Promise<any> {
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

      const response = await new Promise((resolve, reject) => {
        ws.on("open", () => {
          ws.send(
            JSON.stringify({
              jsonrpc: "2.0",
              id: "1",
              method: "getVM",
            })
          );
        });

        ws.on("message", (data) => {
          const response = JSON.parse(data.toString());
          ws.close();
          resolve(response.result);
        });

        ws.on("error", reject);
      });

      return response;
    } catch (error) {
      console.error("Error getting VM info:", error);
      return null;
    }
  }
}
