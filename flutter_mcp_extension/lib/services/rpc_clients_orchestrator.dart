import 'package:flutter_mcp_extension/common_imports.dart';

/// {@template rpc_client_info}
/// Holds connection information for an RPC client
/// {@endtemplate}
class RpcClientInfo with ChangeNotifier {
  /// {@macro rpc_client_info}
  RpcClientInfo({
    required this.name,
    required this.host,
    required this.port,
    required this.path,
  });

  /// Name of the server (e.g., "Flutter" or "TypeScript")
  final String name;

  /// Current host value
  String host;

  /// Current port value
  int port;

  /// Current path value
  String path;

  /// The actual RPC client instance
  final client = RpcClient();

  /// Updates connection parameters and notifies listeners
  void updateConnection({
    final String? host,
    final int? port,
    final String? path,
  }) {
    if (host != null) this.host = host;
    if (port != null) this.port = port;
    if (path != null) this.path = path;
    notifyListeners();
  }

  /// Connect to the server using current parameters
  Future<void> connect() async {
    await client.connect(host: host, port: port, path: path);
  }

  /// Disconnect from the server
  Future<void> disconnect() async {
    await client.disconnect();
  }

  /// Restart the connection
  Future<void> restart() async {
    await disconnect();
    await connect();
  }
}

/// {@template rpc_clients_orchestrator}
/// Manages multiple RPC client connections
/// {@endtemplate}
class RpcClientsOrchestrator with ChangeNotifier {
  /// {@macro rpc_clients_orchestrator}
  RpcClientsOrchestrator() {
    // Initialize the clients from environment variables
    _flutterClient = RpcClientInfo(
      name: 'Flutter',
      host: Envs.flutterRpc.host,
      port: Envs.flutterRpc.port,
      path: Envs.flutterRpc.path,
    );

    _tsClient = RpcClientInfo(
      name: 'TypeScript',
      host: Envs.tsRpc.host,
      port: Envs.tsRpc.port,
      path: Envs.tsRpc.path,
    );

    // Listen to changes in the clients
    _flutterClient.addListener(notifyListeners);
    _tsClient.addListener(notifyListeners);
  }

  late final RpcClientInfo _flutterClient;
  late final RpcClientInfo _tsClient;

  /// Flutter RPC client information
  RpcClientInfo get flutterClient => _flutterClient;

  /// TypeScript RPC client information
  RpcClientInfo get tsClient => _tsClient;

  /// Initialize and connect all clients
  Future<void> initializeAll() async {
    await Future.wait([_flutterClient.connect(), _tsClient.connect()]);
  }

  @override
  void dispose() {
    _flutterClient.removeListener(notifyListeners);
    _tsClient.removeListener(notifyListeners);
    super.dispose();
  }
}
