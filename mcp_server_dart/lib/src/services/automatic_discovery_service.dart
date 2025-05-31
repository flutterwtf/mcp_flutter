// Copyright (c) 2025, Flutter Inspector MCP Server authors.
// Licensed under the MIT License.

import 'dart:async';
import 'dart:convert';

import 'package:dart_mcp/server.dart';
import 'package:flutter_inspector_mcp_server/src/base_server.dart';
import 'package:flutter_inspector_mcp_server/src/dynamic_registry/dynamic_registry.dart';
import 'package:from_json_to_json/from_json_to_json.dart';
import 'package:meta/meta.dart';
import 'package:vm_service/vm_service.dart';

/// Service for automatically discovering and registering Flutter app tools
/// Monitors VM service for Flutter isolates with MCP toolkit extensions
@immutable
final class AutomaticDiscoveryService {
  const AutomaticDiscoveryService({
    required this.dynamicRegistry,
    required this.logger,
    required this.vmServiceGetter,
  });

  final DynamicRegistry dynamicRegistry;
  final LoggingSupport logger;
  final VmService? Function() vmServiceGetter;

  /// Start automatic discovery of Flutter apps
  /// Returns a stream subscription that should be cancelled when done
  StreamSubscription<void>? startDiscovery() {
    logger.log(
      LoggingLevel.info,
      'Starting automatic Flutter app discovery',
      logger: 'AutomaticDiscovery',
    );

    // Start periodic discovery
    return Stream.periodic(const Duration(seconds: 10))
        .asyncMap((_) => _performDiscovery())
        .listen(
          (_) {},
          onError: (final error, final stackTrace) => logger.log(
            LoggingLevel.warning,
            'Error during automatic discovery: $error',
            logger: 'AutomaticDiscovery',
          ),
        );
  }

  /// Perform a single discovery pass
  Future<void> _performDiscovery() async {
    final vmService = vmServiceGetter();
    if (vmService == null) {
      logger.log(
        LoggingLevel.debug,
        'VM service not available for discovery',
        logger: 'AutomaticDiscovery',
      );
      return;
    }

    try {
      logger.log(
        LoggingLevel.debug,
        'Performing Flutter app discovery scan',
        logger: 'AutomaticDiscovery',
      );

      final vm = await vmService.getVM();
      final isolates = vm.isolates ?? [];

      for (final isolateRef in isolates) {
        await _checkIsolateForMCPToolkit(vmService, isolateRef);
      }
    } on Exception catch (e, stackTrace) {
      logger.log(
        LoggingLevel.warning,
        'Discovery scan failed: $e',
        logger: 'AutomaticDiscovery',
      );
      logger.log(
        LoggingLevel.debug,
        'Stack trace: $stackTrace',
        logger: 'AutomaticDiscovery',
      );
    }
  }

  /// Check if an isolate has MCP toolkit extensions and register its tools
  Future<void> _checkIsolateForMCPToolkit(
    final VmService vmService,
    final IsolateRef isolateRef,
  ) async {
    try {
      final isolateId = isolateRef.id;
      if (isolateId == null) return;

      final isolate = await vmService.getIsolate(isolateId);
      final extensions = isolate.extensionRPCs ?? [];

      // Check if this isolate has MCP toolkit extensions
      final hasMCPToolkit = extensions.any(
        (final ext) =>
            ext.startsWith('ext.mcp.toolkit') || ext.contains('registerDynamics'),
      );

      if (!hasMCPToolkit) return;

      logger.log(
        LoggingLevel.info,
        'Found Flutter app with MCP toolkit in isolate $isolateId',
        logger: 'AutomaticDiscovery',
      );

      // Call the registerDynamics service extension
      await _registerAppTools(vmService, isolateId);
    } on Exception catch (e) {
      logger.log(
        LoggingLevel.warning,
        'Error checking isolate ${isolateRef.id}: $e',
        logger: 'AutomaticDiscovery',
      );
    }
  }

  /// Register tools from a Flutter app by calling its registerDynamics extension
  Future<void> _registerAppTools(
    final VmService vmService,
    final String isolateId,
  ) async {
    try {
      logger.log(
        LoggingLevel.info,
        'Calling registerDynamics on isolate $isolateId',
        logger: 'AutomaticDiscovery',
      );

      final response = await vmService.callServiceExtension(
        'ext.mcp.toolkit.registerDynamics',
        isolateId: isolateId,
      );

      final data = jsonDecodeMap(response.json);
      await _processRegistrationResponse(data, isolateId);
    } on Exception catch (e, stackTrace) {
      logger.log(
        LoggingLevel.error,
        'Failed to call registerDynamics on isolate $isolateId: $e',
        logger: 'AutomaticDiscovery',
      );
      logger.log(
        LoggingLevel.debug,
        'Stack trace: $stackTrace',
        logger: 'AutomaticDiscovery',
      );
    }
  }

  /// Process the response from registerDynamics and register tools/resources
  Future<void> _processRegistrationResponse(
    final Map<String, dynamic> data,
    final String isolateId,
  ) async {
    try {
      final appId = jsonDecodeString(data['appId'], fallback: 'flutter_app');
      final tools = jsonDecodeListAs<Map<String, dynamic>>(data['tools']);
      final resources = jsonDecodeListAs<Map<String, dynamic>>(data['resources']);

      logger.log(
        LoggingLevel.info,
        'Registering ${tools.length} tools and ${resources.length} resources from $appId',
        logger: 'AutomaticDiscovery',
      );

      // Clear existing registrations for this app
      dynamicRegistry.clearAppRegistrations(appId);

      // Register tools
      for (final toolData in tools) {
        try {
          final tool = _createToolFromData(toolData);
          dynamicRegistry.registerTool(
            tool,
            appId,
            0, // Port not available from VM service call
            metadata: {'isolateId': isolateId},
          );

          logger.log(
            LoggingLevel.debug,
            'Registered tool: ${tool.name}',
            logger: 'AutomaticDiscovery',
          );
        } on Exception catch (e) {
          logger.log(
            LoggingLevel.warning,
            'Failed to register tool ${toolData['name']}: $e',
            logger: 'AutomaticDiscovery',
          );
        }
      }

      // Register resources
      for (final resourceData in resources) {
        try {
          final resource = _createResourceFromData(resourceData);
          dynamicRegistry.registerResource(
            resource,
            appId,
            0, // Port not available from VM service call
            metadata: {'isolateId': isolateId},
          );

          logger.log(
            LoggingLevel.debug,
            'Registered resource: ${resource.uri}',
            logger: 'AutomaticDiscovery',
          );
        } on Exception catch (e) {
          logger.log(
            LoggingLevel.warning,
            'Failed to register resource ${resourceData['uri']}: $e',
            logger: 'AutomaticDiscovery',
          );
        }
      }

      logger.log(
        LoggingLevel.info,
        'Successfully registered $appId with ${tools.length} tools and ${resources.length} resources',
        logger: 'AutomaticDiscovery',
      );
    } on Exception catch (e, stackTrace) {
      logger.log(
        LoggingLevel.error,
        'Failed to process registration response: $e',
        logger: 'AutomaticDiscovery',
      );
      logger.log(
        LoggingLevel.debug,
        'Stack trace: $stackTrace',
        logger: 'AutomaticDiscovery',
      );
    }
  }

  /// Create a Tool from registration data
  Tool _createToolFromData(final Map<String, dynamic> data) {
    final name = jsonDecodeString(data['name']);
    final description = jsonDecodeString(data['description']);
    final inputSchema = jsonDecodeMap(data['inputSchema']);

    return Tool(
      name: name,
      description: description,
      inputSchema: ObjectSchema.fromJson(inputSchema),
    );
  }

  /// Create a Resource from registration data
  Resource _createResourceFromData(final Map<String, dynamic> data) {
    final name = jsonDecodeString(data['name']);
    final description = jsonDecodeString(data['description']);
    final uri = jsonDecodeString(data['uri']);
    final mimeType = jsonDecodeString(data['mimeType'], fallback: 'text/plain');

    return Resource(
      uri: uri,
      name: name,
      description: description,
      mimeType: mimeType,
    );
  }
}