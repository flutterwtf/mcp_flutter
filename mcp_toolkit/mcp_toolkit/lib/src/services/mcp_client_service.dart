import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;
import 'dart:io';

import 'package:dart_mcp/client.dart';
import 'package:stream_channel/stream_channel.dart';

/// Configuration for MCP server connection
class MCPServerConfig {
  const MCPServerConfig({
    this.host = 'localhost',
    this.port = 3535,
    this.protocol = 'http',
  });

  final String host;
  final int port;
  final String protocol;

  String get baseUrl => '$protocol://$host:$port';
}

/// Tool definition for MCP registration
class MCPToolDefinition {
  const MCPToolDefinition({
    required this.name,
    required this.description,
    this.inputSchema,
  });

  final String name;
  final String description;
  final Map<String, dynamic>? inputSchema;

  Map<String, dynamic> toJson() => {
    'name': name,
    'description': description,
    if (inputSchema != null) 'inputSchema': inputSchema,
  };
}

/// Resource definition for MCP registration
class MCPResourceDefinition {
  const MCPResourceDefinition({
    required this.uri,
    required this.name,
    this.description,
    this.mimeType,
  });

  final String uri;
  final String name;
  final String? description;
  final String? mimeType;

  Map<String, dynamic> toJson() => {
    'uri': uri,
    'name': name,
    if (description != null) 'description': description,
    if (mimeType != null) 'mimeType': mimeType,
  };
}

/// HTTP transport implementation for MCP over HTTP
class HttpMCPTransport extends StreamChannelMixin<String> {
  HttpMCPTransport(this.baseUrl);

  final String baseUrl;
  final _httpClient = HttpClient();
  final StreamController<String> _controller = StreamController();
  final StreamController<String> _sink = StreamController();
  late final StreamSubscription _sinkSubscription;

  @override
  Stream<String> get stream => _controller.stream;

  @override
  StreamSink<String> get sink => _sink.sink;

  void initialize() {
    _sinkSubscription = _sink.stream.listen(_handleOutgoingMessage);
  }

  Future<void> _handleOutgoingMessage(final String message) async {
    try {
      final request = await _httpClient.postUrl(Uri.parse('$baseUrl/mcp/call'));

      request.headers.contentType = ContentType.json;
      request.write(message);

      final response = await request.close();
      final responseBody = await response.transform(utf8.decoder).join();

      if (response.statusCode == 200) {
        _controller.add(responseBody);
      } else {
        _controller.addError(
          HttpException(
            'HTTP ${response.statusCode}: $responseBody',
            uri: request.uri,
          ),
        );
      }
    } catch (e) {
      _controller.addError(e);
    }
  }

  Future<void> close() async {
    await _sinkSubscription.cancel();
    await _controller.close();
    await _sink.close();
    _httpClient.close();
  }
}

/// Service for communicating with MCP server using the official dart_mcp package
class MCPClientService {
  MCPClientService({final MCPServerConfig? config, final String? appId})
    : _config = config ?? const MCPServerConfig(),
      _appId = appId ?? _generateAppId();

  final MCPServerConfig _config;
  final String _appId;
  MCPClient? _client;
  ServerConnection? _serverConnection;
  HttpMCPTransport? _transport;
  var _isConnected = false;

  static String _generateAppId() {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final random = (timestamp % 10000).toString().padLeft(4, '0');
    return 'flutter_app_$random';
  }

  /// Check if the client is connected to the MCP server
  bool get isConnected => _isConnected && _serverConnection != null;

  /// Connect to the MCP server
  Future<bool> connect() async {
    try {
      developer.log('Connecting to MCP server at ${_config.baseUrl}');

      // Create MCP client
      _client = MCPClient(
        ClientImplementation(name: 'Flutter MCP Toolkit', version: '1.0.0'),
      );

      // Create HTTP transport
      _transport = HttpMCPTransport(_config.baseUrl);
      _transport!.initialize();

      // Connect to server using HTTP transport
      _serverConnection = _client!.connectServer(_transport!);

      // Initialize the connection
      final initResult = await _serverConnection!.initialize(
        InitializeRequest(
          protocolVersion: ProtocolVersion.latestSupported,
          capabilities: _client!.capabilities,
          clientInfo: _client!.implementation,
        ),
      );

      if (!initResult.protocolVersion!.isSupported) {
        throw StateError(
          'Protocol version mismatch: ${initResult.protocolVersion}',
        );
      }

      // Send initialized notification
      _serverConnection!.notifyInitialized(InitializedNotification());

      _isConnected = true;
      developer.log('Successfully connected to MCP server');
      return true;
    } catch (e, stackTrace) {
      developer.log(
        'Failed to connect to MCP server: $e',
        error: e,
        stackTrace: stackTrace,
      );
      _isConnected = false;
      await _cleanup();
      return false;
    }
  }

  /// Disconnect from the MCP server
  Future<void> disconnect() async {
    try {
      if (_serverConnection != null) {
        await _serverConnection!.shutdown();
        _serverConnection = null;
      }

      await _cleanup();
      _isConnected = false;
      developer.log('Disconnected from MCP server');
    } catch (e) {
      developer.log('Error during disconnect: $e');
    }
  }

  Future<void> _cleanup() async {
    if (_client != null) {
      await _client!.shutdown();
      _client = null;
    }

    if (_transport != null) {
      await _transport!.close();
      _transport = null;
    }
  }

  /// Register a tool with the MCP server
  Future<bool> registerTool(final MCPToolDefinition tool) async {
    if (!isConnected) {
      developer.log('Cannot register tool: not connected to MCP server');
      return false;
    }

    try {
      // Use the MCP client to call the installTool method
      final result = await _serverConnection!.callTool(
        CallToolRequest(
          name: 'installTool',
          arguments: {'appId': _appId, 'tool': tool.toJson()},
        ),
      );

      if (result.isError == true) {
        developer.log('Failed to register tool: ${result.content}');
        return false;
      }

      developer.log('Successfully registered tool: ${tool.name}');
      return true;
    } catch (e) {
      developer.log('Error registering tool: $e');
      return false;
    }
  }

  /// Register a resource with the MCP server
  Future<bool> registerResource(final MCPResourceDefinition resource) async {
    if (!isConnected) {
      developer.log('Cannot register resource: not connected to MCP server');
      return false;
    }

    try {
      // Use the MCP client to call the installResource method
      final result = await _serverConnection!.callTool(
        CallToolRequest(
          name: 'installResource',
          arguments: {'appId': _appId, 'resource': resource.toJson()},
        ),
      );

      if (result.isError == true) {
        developer.log('Failed to register resource: ${result.content}');
        return false;
      }

      developer.log('Successfully registered resource: ${resource.name}');
      return true;
    } catch (e) {
      developer.log('Error registering resource: $e');
      return false;
    }
  }

  /// Register multiple tools at once
  Future<bool> registerTools(final List<MCPToolDefinition> tools) async {
    if (!isConnected) {
      developer.log('Cannot register tools: not connected to MCP server');
      return false;
    }

    try {
      final result = await _serverConnection!.callTool(
        CallToolRequest(
          name: 'installTool',
          arguments: {
            'appId': _appId,
            'tools': tools.map((final tool) => tool.toJson()).toList(),
          },
        ),
      );

      if (result.isError == true) {
        developer.log('Failed to register tools: ${result.content}');
        return false;
      }

      developer.log('Successfully registered ${tools.length} tools');
      return true;
    } catch (e) {
      developer.log('Error registering tools: $e');
      return false;
    }
  }

  /// Register multiple resources at once
  Future<bool> registerResources(
    final List<MCPResourceDefinition> resources,
  ) async {
    if (!isConnected) {
      developer.log('Cannot register resources: not connected to MCP server');
      return false;
    }

    try {
      final result = await _serverConnection!.callTool(
        CallToolRequest(
          name: 'installResource',
          arguments: {
            'appId': _appId,
            'resources':
                resources.map((final resource) => resource.toJson()).toList(),
          },
        ),
      );

      if (result.isError == true) {
        developer.log('Failed to register resources: ${result.content}');
        return false;
      }

      developer.log('Successfully registered ${resources.length} resources');
      return true;
    } catch (e) {
      developer.log('Error registering resources: $e');
      return false;
    }
  }

  /// Get the app ID
  String get appId => _appId;

  /// Get the server configuration
  MCPServerConfig get config => _config;
}
