// ignore_for_file: avoid_catches_without_on_clauses

import 'dart:convert';

import 'package:flutter_mcp_extension/common_imports.dart';
import 'package:universal_io/io.dart';

class RpcServer extends ChangeNotifier {
  HttpServer? _server;
  WebSocket? _client;
  final Map<String, Function> _methods = {};
  var _connected = false;

  bool get connected => _connected;

  /// Returns a list of registered method names
  List<String> get registeredMethods => _methods.keys.toList();

  // Register RPC methods that can be called by the TypeScript client
  void registerMethod(final String methodName, final Function handler) {
    _methods[methodName] = handler;
    notifyListeners();
  }

  Future<void> start({final int port = Envs.rpcPort}) async {
    _server = await HttpServer.bind(
      Envs.rpcHost,
      //  InternetAddress.anyIPv4,
      port,
    );
    print('RPC server listening on ws://${Envs.rpcHost}:$port');

    await for (final HttpRequest request in _server!) {
      if (WebSocketTransformer.isUpgradeRequest(request)) {
        print('Client trying to connect');
        final socket = await WebSocketTransformer.upgrade(request);
        _handleClientConnection(socket);
      }
    }
  }

  void _handleClientConnection(final WebSocket socket) {
    _client = socket;
    _connected = true;
    notifyListeners();
    print('TypeScript client connected');

    socket.listen(
      (final message) async {
        await _handleRpcCall(socket, message);
      },
      onDone: () {
        _client = null;
        _connected = false;
        notifyListeners();
        print('TypeScript client disconnected');
      },
      onError: (final error) {
        _client = null;
        _connected = false;
        notifyListeners();
        print('Error with TypeScript client: $error');
      },
    );
  }

  Future<void> _handleRpcCall(final WebSocket client, final rawMessage) async {
    try {
      final Map<String, dynamic> message = json.decode(rawMessage);
      final String id = message['id'];
      final String method = message['method'];
      final Map<String, dynamic> params = message['params'] ?? {};

      print('Received RPC call: $method (ID: $id)');

      if (_methods.containsKey(method)) {
        // Execute the method and get result
        await _executeRpcMethod(client, id, method, params);
      } else {
        // Method not found
        _sendResponse(client, id, null, {
          'code': -32601,
          'message': 'Method not found',
        });
      }
    } catch (e, stackTrace) {
      print('Error processing message: $e $stackTrace');
      // Parse error
      _sendResponse(client, '0', null, {
        'code': -32700,
        'message': 'Parse error',
      });
    }
  }

  Future<void> _executeRpcMethod(
    final WebSocket client,
    final String id,
    final String method,
    final Map<String, dynamic> params,
  ) async {
    try {
      final handler = _methods[method]!;

      // Execute handler and get result
      final result = await Function.apply(handler, [params]);

      // Send response back to client
      _sendResponse(client, id, result, null);
    } catch (e, stackTrace) {
      print('Error executing method $method: $e $stackTrace');
      _sendResponse(client, id, null, {
        'code': -32603,
        'message': 'Internal error: $e',
      });
    }
  }

  void _sendResponse(
    final WebSocket client,
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

    client.add(json.encode(response));
  }

  Future<void> stop() async {
    await _client?.close();
    await _server?.close();
  }
}
