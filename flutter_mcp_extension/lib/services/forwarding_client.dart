import 'dart:async';
import 'dart:convert';

import 'package:flutter_mcp_extension/common_imports.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

/// Handles communication with the forwarding server that bridges between
/// flutter_inspector and flutter_mcp_extension
class ForwardingClient with ChangeNotifier {
  /// Create a new forwarding client
  ForwardingClient();
  WebSocketChannel? _channel;
  final Map<String, Function> _methods = {};
  final Map<String, Completer<dynamic>> _pendingRequests = {};
  var _connected = false;
  var _messageId = 0;
  Timer? _reconnectTimer;

  // Connection details
  String? _host;
  int? _port;
  String? _path;

  /// Connection status
  bool get connected => _connected;

  /// Registered method handlers
  List<String> get registeredMethods => _methods.keys.toList();

  /// Register a method handler
  void registerMethod(final String methodName, final Function handler) {
    _methods[methodName] = handler;
    notifyListeners();
  }

  /// Connect to the forwarding server
  Future<void> connect({
    required final int port,
    required final String host,
    required final String path,
  }) async {
    _host = host;
    _port = port;
    _path = path;
    await _startClient();
  }

  /// Generate a unique ID for requests
  String _generateId() =>
      '${DateTime.now().millisecondsSinceEpoch}_${_messageId++}';

  /// Start the WebSocket client connection
  Future<void> _startClient() async {
    if (_host == null || _port == null || _path == null) {
      throw Exception('Connection details not set');
    }

    try {
      // Add clientType parameter to identify this as a Flutter client
      final wsUrl = 'ws://$_host:$_port/$_path?clientType=flutter';
      print('Connecting to forwarding server at $wsUrl');

      // Connect to the server
      final channel = WebSocketChannel.connect(Uri.parse(wsUrl));

      // Listen for incoming messages
      channel.stream.listen(
        (final message) async {
          await _handleMessage(channel, message);
        },
        onDone: () {
          _channel = null;
          _connected = false;
          notifyListeners();
          print('Disconnected from forwarding server');
          _scheduleReconnect();
        },
        onError: (final error) {
          _channel = null;
          _connected = false;
          notifyListeners();
          print('Error with WebSocket connection: $error');
          _scheduleReconnect();
        },
      );

      _channel = channel;
      _connected = true;
      notifyListeners();
      print('Connected to forwarding server');
    } catch (e) {
      print('Failed to connect to forwarding server: $e');
      _scheduleReconnect();
    }
  }

  /// Schedule reconnection attempts
  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 2), () async {
      if (!_connected) {
        print('Attempting to reconnect to forwarding server...');
        await _startClient();
      }
    });
  }

  /// Handle incoming messages from the forwarding server
  Future<void> _handleMessage(
    final WebSocketChannel channel,
    final rawMessage,
  ) async {
    try {
      final Map<String, dynamic> message = json.decode(rawMessage.toString());

      // If this is a method call with an ID
      if (message.containsKey('method') && message.containsKey('id')) {
        final String id = message['id'] as String;
        final String method = message['method'] as String;
        final Map<String, dynamic> params =
            message['params'] as Map<String, dynamic>? ?? {};

        print('Received RPC call: $method (ID: $id)');

        if (_methods.containsKey(method)) {
          // Execute the method and send response
          try {
            final result = await Function.apply(_methods[method]!, [params]);
            _sendResponse(channel, id, result, null);
          } catch (e) {
            _sendResponse(channel, id, null, {
              'code': -32603,
              'message': 'Internal error: $e',
            });
          }
        } else {
          // Method not found
          _sendResponse(channel, id, null, {
            'code': -32601,
            'message': 'Method not found',
          });
        }
      }
      // If this is a response to a previous request
      else if (message.containsKey('id') &&
          (_pendingRequests.containsKey(message['id']))) {
        final String id = message['id'] as String;
        final completer = _pendingRequests[id];

        if (completer != null) {
          if (message.containsKey('error')) {
            final error = message['error'];
            String errorMessage = 'Unknown error';
            if (error is Map && error.containsKey('message')) {
              errorMessage = error['message'].toString();
            }
            completer.completeError(Exception(errorMessage));
          } else {
            completer.complete(message['result']);
          }

          _pendingRequests.remove(id);
        }
      }
      // Emit any message as a notification
      notifyListeners();
    } catch (e) {
      print('Error processing message: $e');
    }
  }

  /// Send a JSON-RPC response message
  void _sendResponse(
    final WebSocketChannel channel,
    final String id,
    final result,
    final error,
  ) {
    final response = {
      'jsonrpc': '2.0',
      'id': id,
      if (result != null) 'result': result,
      if (error != null) 'error': error,
    };

    channel.sink.add(json.encode(response));
  }

  /// Call a method on the remote inspector client
  Future<dynamic> callMethod(
    final String method, [
    final Map<String, dynamic>? params,
  ]) async {
    if (_channel == null || !_connected) {
      throw Exception('Not connected to forwarding server');
    }

    final id = _generateId();
    final request = {
      'jsonrpc': '2.0',
      'id': id,
      'method': method,
      'params': params ?? {},
    };

    final completer = Completer<dynamic>();
    _pendingRequests[id] = completer;

    _channel!.sink.add(json.encode(request));
    return completer.future;
  }

  /// Send a raw message through the forwarding server
  void sendMessage(final Map<String, dynamic> message) {
    if (_channel == null || !_connected) {
      throw Exception('Not connected to forwarding server');
    }

    _channel!.sink.add(json.encode(message));
  }

  /// Disconnect from the forwarding server
  Future<void> disconnect() async {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;

    await _channel?.sink.close();
    _channel = null;
    _connected = false;
    notifyListeners();
  }

  /// Synchronous disconnect from the forwarding server
  /// Use this when you need to disconnect in a synchronous context like dispose()
  void disconnectSync() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;

    unawaited(_channel?.sink.close());
    _channel = null;
    _connected = false;
    notifyListeners();
  }
}
