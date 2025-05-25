import 'dart:convert';
import 'dart:developer' as developer;
import 'dart:io';

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

/// Service for registering tools and resources with MCP server
class MCPClientService {
  MCPClientService({this.config = const MCPServerConfig(), final String? appId})
    : _appId = appId ?? _generateAppId();

  final MCPServerConfig config;
  final String _appId;
  final _httpClient = HttpClient();

  static String _generateAppId() {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    return 'flutter_app_$timestamp';
  }

  /// Register a tool with the MCP server
  Future<bool> registerTool(final MCPToolDefinition tool) async {
    try {
      final dartVmPort = _getCurrentDartVmPort();

      final response = await _makeRequest('installTool', {
        'tool': tool.toJson(),
        'sourceApp': _appId,
        'dartVmPort': dartVmPort,
      });

      if (response['success'] == true) {
        developer.log(
          '[MCPClient] Successfully registered tool: ${tool.name}',
          name: 'mcp_toolkit',
        );
        return true;
      } else {
        developer.log(
          '[MCPClient] Failed to register tool: ${response['error'] ?? 'Unknown error'}',
          name: 'mcp_toolkit',
          level: 900,
        );
        return false;
      }
    } catch (e, stackTrace) {
      developer.log(
        '[MCPClient] Error registering tool: $e',
        name: 'mcp_toolkit',
        error: e,
        stackTrace: stackTrace,
        level: 1000,
      );
      return false;
    }
  }

  /// Register a resource with the MCP server
  Future<bool> registerResource(final MCPResourceDefinition resource) async {
    try {
      final dartVmPort = _getCurrentDartVmPort();

      final response = await _makeRequest('installResource', {
        'resource': resource.toJson(),
        'sourceApp': _appId,
        'dartVmPort': dartVmPort,
      });

      if (response['success'] == true) {
        developer.log(
          '[MCPClient] Successfully registered resource: ${resource.uri}',
          name: 'mcp_toolkit',
        );
        return true;
      } else {
        developer.log(
          '[MCPClient] Failed to register resource: ${response['error'] ?? 'Unknown error'}',
          name: 'mcp_toolkit',
          level: 900,
        );
        return false;
      }
    } catch (e, stackTrace) {
      developer.log(
        '[MCPClient] Error registering resource: $e',
        name: 'mcp_toolkit',
        error: e,
        stackTrace: stackTrace,
        level: 1000,
      );
      return false;
    }
  }

  /// Register multiple tools at once
  Future<List<bool>> registerTools(final List<MCPToolDefinition> tools) async {
    final results = <bool>[];
    for (final tool in tools) {
      final success = await registerTool(tool);
      results.add(success);
    }
    return results;
  }

  /// Register multiple resources at once
  Future<List<bool>> registerResources(
    final List<MCPResourceDefinition> resources,
  ) async {
    final results = <bool>[];
    for (final resource in resources) {
      final success = await registerResource(resource);
      results.add(success);
    }
    return results;
  }

  /// Get current registrations from the MCP server
  Future<Map<String, dynamic>?> getRegistrations() async {
    try {
      final response = await _makeRequest('listDynamicRegistrations', {
        'type': 'all',
      });
      return response;
    } catch (e) {
      developer.log(
        '[MCPClient] Error getting registrations: $e',
        name: 'mcp_toolkit',
        error: e,
        level: 1000,
      );
      return null;
    }
  }

  /// Make HTTP request to MCP server
  Future<Map<String, dynamic>> _makeRequest(
    final String toolName,
    final Map<String, dynamic> arguments,
  ) async {
    final request = await _httpClient.postUrl(
      Uri.parse('${config.baseUrl}/mcp/call'),
    );

    request.headers.contentType = ContentType.json;

    final body = jsonEncode({
      'method': 'tools/call',
      'params': {'name': toolName, 'arguments': arguments},
    });

    request.write(body);

    final response = await request.close();
    final responseBody = await response.transform(utf8.decoder).join();

    if (response.statusCode == 200) {
      final jsonResponse = jsonDecode(responseBody) as Map<String, dynamic>;

      // Extract the actual result from MCP response format
      if (jsonResponse['result'] != null) {
        final content = jsonResponse['result']['content'];
        if (content is List && content.isNotEmpty) {
          final textContent = content.first['text'] as String?;
          if (textContent != null) {
            return jsonDecode(textContent) as Map<String, dynamic>;
          }
        }
      }

      return jsonResponse;
    } else {
      throw HttpException(
        'HTTP ${response.statusCode}: $responseBody',
        uri: request.uri,
      );
    }
  }

  /// Get the current Dart VM port (default to 8181 if not detectable)
  int _getCurrentDartVmPort() {
    // In a real implementation, you might want to detect this dynamically
    // For now, we'll use the standard Flutter debug port
    return 8181;
  }

  /// Dispose of resources
  void dispose() {
    _httpClient.close();
  }
}
