<think>
Okay, let's break down how I approached the user's problem. The user presented a codebase with duplication in server logic and RPC handling, specifically between Dart VM and Flutter RPC connections. My goal was to create a plan to reduce this duplication and improve the architecture.

First, I recognized that both RpcUtilities and FlutterExtensionRpcClient had similar WebSocket connection logic. That's a clear sign to abstract this into a shared ConnectionManager. Using a strategy pattern here allows handling different connection types through a unified interface, which simplifies management and reduces code repetition.

Next, looking at the handler methods, I noticed repetitive boilerplate code in each RPC handler. Creating a base RpcHandler class with template methods (execute, preValidate, postProcess) would encapsulate common steps, letting individual handlers focus on their specific logic. This aligns with the SOLID principles, especially the Template Method pattern for code reuse.

The initialization duplication in setupToolHandlers suggested a need for a ServiceManager. By centralizing service registration and initialization, we can streamline setup processes and ensure consistency across different services. This also makes adding new services easier in the future.

The protocol layer duplication between Dart VM and Flutter RPC called for a Protocol Adapter. This adapter would route requests based on the transport strategy, eliminating the need for separate handling in each service. It's a classic use of the Adapter pattern to bridge different interfaces.

Connection pooling was another area for improvement. The existing setup used a simple Map, but introducing smart pooling with health checks and circuit breakers would enhance reliability and performance. This is crucial for maintaining high availability and efficient resource usage.

The code generation process was manually mapping handlers, so enhancing the generator to auto-detect patterns and create decorators would reduce manual work and potential errors. Automating this ensures consistency and saves development time.

Error handling was scattered, so centralizing it into an RpcErrorHandler class provides a single point for managing exceptions, improving maintainability and error reporting.

Throughout, I focused on type safety by suggesting Zod schemas to replace 'any' types, which enhances code reliability. Documentation and testing were also emphasized to ensure long-term maintainability and robustness.

Each solution step was chosen to address specific duplication points while adhering to best practices like DRY, SOLID, and design patterns. The phased implementation plan ensures manageable refactoring without disrupting existing functionality, prioritizing core infrastructure first before moving to higher-level components.
</think>

Here's a refined improvement plan with concrete implementation steps:

**1. Unified Connection Infrastructure (Critical Path)**

```typescript:src/core/connection/connection-manager.ts
type ConnectionType = 'dart-vm' | 'flutter-rpc';

class ConnectionManager {
  private pools = new Map<string, WebSocketPool>();
  private strategies = new Map<ConnectionType, ConnectionStrategy>();

  constructor(
    private readonly config: ConnectionConfig,
    private readonly logger: Logger
  ) {
    this.strategies.set('dart-vm', new DartVmStrategy());
    this.strategies.set('flutter-rpc', new FlutterRpcStrategy());
  }

  async acquire(type: ConnectionType, port: number): Promise<ManagedConnection> {
    const strategy = this.strategies.get(type);
    const poolKey = `${type}:${port}`;

    if (!this.pools.has(poolKey)) {
      this.pools.set(poolKey, new WebSocketPool(
        () => strategy.createConnection(port),
        this.config.poolSize
      ));
    }

    return this.pools.get(poolKey)!.acquire();
  }
}

class WebSocketPool {
  private active: WebSocket[] = [];
  private waitQueue: Array<(ws: WebSocket) => void> = [];

  constructor(
    private readonly factory: () => Promise<WebSocket>,
    private readonly maxSize: number
  ) {}

  async acquire(): Promise<ManagedConnection> {
    if (this.active.length < this.maxSize) {
      const ws = await this.factory();
      this.active.push(ws);
      return this.createManagedConnection(ws);
    }
    return new Promise(resolve => this.waitQueue.push(resolve));
  }
}
```

**2. Protocol Adapter Layer**

```typescript:src/core/protocol/protocol-adapter.ts
interface RpcRequest {
  method: string;
  params: Record<string, unknown>;
  transport: 'dart-vm' | 'flutter-rpc';
}

class ProtocolAdapter {
  constructor(
    private connectionManager: ConnectionManager,
    private errorHandler: RpcErrorHandler
  ) {}

  async execute(request: RpcRequest): Promise<unknown> {
    const connection = await this.connectionManager.acquire(
      request.transport,
      this.resolvePort(request)
    );

    try {
      const result = await this.sendRequest(connection, request);
      return this.normalizeResponse(result, request.transport);
    } catch (error) {
      return this.errorHandler.handle(error, request);
    }
  }

  private normalizeResponse(response: any, transport: string) {
    return transport === 'dart-vm'
      ? this.normalizeDartResponse(response)
      : this.normalizeFlutterResponse(response);
  }
}
```

**3. Handler Base Class with Code Generation**

```typescript:src/core/handlers/rpc-handler-base.ts
abstract class RpcHandler {
  abstract readonly method: string;
  abstract readonly transport: ConnectionType;
  abstract readonly validationSchema: z.ZodSchema;

  constructor(
    protected protocolAdapter: ProtocolAdapter,
    protected logger: Logger
  ) {}

  async handle(request: unknown): Promise<unknown> {
    const params = this.validateRequest(request);
    return this.protocolAdapter.execute({
      method: this.method,
      params,
      transport: this.transport
    });
  }

  private validateRequest(request: unknown) {
    return this.validationSchema.parse(request);
  }
}

// Generated handler example
class DebugDumpRenderTreeHandler extends RpcHandler {
  readonly method = 'debug_dump_render_tree';
  readonly transport = 'flutter-rpc';
  readonly validationSchema = z.object({
    port: z.number().int().positive()
  });
}
```

**4. Service Registry Pattern**

```typescript:src/core/services/service-registry.ts
class ServiceRegistry {
  private handlers = new Map<string, RpcHandler>();
  private services = new Map<string, ServiceConfig>();

  registerHandler(handler: RpcHandler) {
    this.handlers.set(handler.method, handler);
  }

  initialize(configs: ServiceConfig[]) {
    for (const config of configs) {
      this.initializeService(config);
    }
  }

  private initializeService(config: ServiceConfig) {
    const service = new FlutterService(
      config,
      this.protocolAdapter,
      this.logger
    );
    this.services.set(config.name, service);
  }
}
```

**Critical Improvements Needed Now:**

1. **Type Safety Implementation**

```typescript:src/core/schemas/rpc-schemas.ts
export const PortSchema = z.number().int().positive().brand<'Port'>();
export type Port = z.infer<typeof PortSchema>;

export const RpcRequestSchema = z.object({
  method: z.string().min(3),
  params: z.record(z.unknown()).optional(),
  transport: z.enum(['dart-vm', 'flutter-rpc'])
});
```

2. **Code Generator Enhancements**

```typescript:scripts/generate-rpc-handlers.ts
function generateHandlerClass(handlerDef: HandlerDefinition) {
  return `
@RpcHandler({
  method: '${handlerDef.name}',
  transport: '${handlerDef.needsDartProxy ? 'dart-vm' : 'flutter-rpc'}'
})
class ${pascalCase(handlerDef.name)}Handler extends RpcHandler {
  readonly validationSchema = ${generateZodSchema(handlerDef.parameters)};
}
  `;
}
```

**Implementation Roadmap:**

1. **Immediate Wins (1-2 days)**

- Implement ConnectionManager and ProtocolAdapter
- Add Zod validation schemas for core types
- Create base handler class

2. **Medium Term (1 week)**

- Migrate existing handlers to new pattern
- Implement service registry
- Add code generator improvements

3. **Long Term (2 weeks)**

- Implement circuit breaker pattern
- Add OpenTelemetry instrumentation
- Develop automated recovery system

**Key Metrics to Track:**

```typescript:src/core/telemetry/connection-metrics.ts
type ConnectionMetrics = {
  acquisitionTime: Histogram;
  waitQueueSize: Gauge;
  activeConnections: Gauge;
  errors: Counter<{ code: string }>;
};

type RpcMetrics = {
  callDuration: Histogram<{ method: string }>;
  successRate: Gauge<{ method: string }>;
  payloadSize: Histogram<{ direction: 'in'|'out' }>;
};
```

**Critical Code Changes Needed First:**

```typescript:src/servers/rpc_utilities.ts
// Replace existing connection logic with:
import { ConnectionManager } from '../core/connection/connection-manager';

export class RpcUtilities {
  private connectionManager = new ConnectionManager(config);

  // Replace all connectWebSocket calls with:
  async getConnection(type: ConnectionType, port: number) {
    return this.connectionManager.acquire(type, port);
  }
}
```

**Key Architecture Decision:**  
Implement a layered architecture with clear separation:

```
Presentation Layer (RPC Handlers)
  ↓
Business Logic (Protocol Adapter)
  ↓
Transport Layer (Connection Manager)
  ↓
Infrastructure (WebSocket Implementation)
```

Would you like me to provide specific diffs for any of these components or focus on a particular aspect of the implementation?
