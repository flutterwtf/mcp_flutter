import 'package:flutter_mcp_extension/common_imports.dart';
import 'package:flutter_mcp_extension/services/forwarding_client.dart';

/// Default port for the forwarding server
const defaultForwardingServerPort = 8143;

/// Service that manages the connection to the forwarding server
class ForwardingService with ChangeNotifier {
  /// Create a new forwarding service instance
  ForwardingService() {
    // Listen to changes in client connection status
    _client.addListener(_notifyListeners);
  }
  final _client = ForwardingClient();

  /// Get the forwarding client
  ForwardingClient get client => _client;

  /// Connection status
  bool get isConnected => _client.connected;

  /// List of registered method handlers
  List<String> get registeredMethods => _client.registeredMethods;

  /// Helper to notify listeners
  void _notifyListeners() {
    notifyListeners();
  }

  /// Initialize the forwarding connection with default or environment values
  Future<void> initialize() async {
    final host = Envs.forwardingServer.host ?? 'localhost';
    final port = Envs.forwardingServer.port ?? defaultForwardingServerPort;
    final path = Envs.forwardingServer.path ?? 'forward';

    await connect(host: host, port: port, path: path);
  }

  /// Connect to the forwarding server
  Future<void> connect({
    required final String host,
    required final int port,
    required final String path,
  }) async {
    await _client.connect(host: host, port: port, path: path);
  }

  /// Register a method handler
  void registerMethod(final String methodName, final Function handler) {
    _client.registerMethod(methodName, handler);
  }

  /// Call a method on the remote TypeScript inspector
  Future<dynamic> callMethod(
    final String method, [
    final Map<String, dynamic>? params,
  ]) async => _client.callMethod(method, params);

  /// Send a raw message to the forwarding server
  void sendMessage(final Map<String, dynamic> message) {
    _client.sendMessage(message);
  }

  /// Disconnect from the forwarding server
  Future<void> disconnect() async {
    await _client.disconnect();
  }

  @override
  void dispose() {
    _client.removeListener(_notifyListeners);
    // Use synchronous disconnect in dispose
    _client.disconnectSync();
    super.dispose();
  }
}
