// Copyright (c) 2025, Flutter Inspector MCP Server authors.
// Licensed under the MIT License.

import 'dart:async';
import 'dart:convert';

import 'package:dart_mcp/server.dart';
import 'package:dtd/dtd.dart';
import 'package:flutter_inspector_mcp_server/src/base_server.dart';
import 'package:flutter_inspector_mcp_server/src/dynamic_registry/dynamic_registry.dart';
import 'package:from_json_to_json/from_json_to_json.dart';
import 'package:meta/meta.dart';
import 'package:vm_service/vm_service.dart';

/// Simplified discovery service that leverages DTD events and direct VM connection
/// Uses the insight that when VM service connects, we're already connected to the Flutter isolate
@immutable
final class SimplifiedDiscoveryService {
  const SimplifiedDiscoveryService({
    required this.dynamicRegistry,
    required this.logger,
    required this.vmServiceGetter,
    required this.dtdGetter,
  });

  final DynamicRegistry dynamicRegistry;
  final LoggingSupport logger;
  final VmService? Function() vmServiceGetter;
  final DartToolingDaemon? Function() dtdGetter;

  /// Start simplified discovery - immediately register and listen for changes
  Future<StreamSubscription<DTDEvent>?> startDiscovery() async {
    logger.log(
      LoggingLevel.info,
      'Starting simplified Flutter app discovery',
      logger: 'SimplifiedDiscovery',
    );

    // Immediate registration when connected
    await _performInitialRegistration();

    // Listen for DTD events for re-registration
    return _listenForToolChanges();
  }

  /// Perform initial registration when VM service connects
  Future<void> _performInitialRegistration() async {
    final vmService = vmServiceGetter();
    if (vmService == null) {
      logger.log(
        LoggingLevel.warning,
        'VM service not available for initial registration',
        logger: 'SimplifiedDiscovery',
      );
      return;
    }

    try {
      logger.log(
        LoggingLevel.info,
        'Performing initial tool registration',
        logger: 'SimplifiedDiscovery',
      );

      // Get the main (and typically only) isolate
      final isolate = await _getMainIsolate(vmService);
      if (isolate == null) {
        logger.log(
          LoggingLevel.warning,
          'No Flutter isolate found for initial registration',
          logger: 'SimplifiedDiscovery',
        );
        return;
      }

      await _registerToolsFromIsolate(vmService, isolate.id!);
    } on Exception catch (e, stackTrace) {
      logger.log(
        LoggingLevel.error,
        'Initial registration failed: $e',
        logger: 'SimplifiedDiscovery',
      );
      logger.log(
        LoggingLevel.debug,
        'Stack trace: $stackTrace',
        logger: 'SimplifiedDiscovery',
      );
    }
  }

  /// Listen for DTD events that indicate tool changes
  StreamSubscription<DTDEvent>? _listenForToolChanges() {
    final dtd = dtdGetter();
    if (dtd == null) {
      logger.log(
        LoggingLevel.warning,
        'DTD not available for event listening',
        logger: 'SimplifiedDiscovery',
      );
      return null;
    }

    logger.log(
      LoggingLevel.info,
      'Setting up DTD event listener for tool changes',
      logger: 'SimplifiedDiscovery',
    );

    try {
      // Listen to the MCPToolkit stream for tool registration events
      return dtd.onEvent('MCPToolkit').listen(
        (final event) => _handleMCPToolkitEvent(event),
        onError: (final error, final stackTrace) => logger.log(
          LoggingLevel.warning,
          'Error in DTD event listener: $error',
          logger: 'SimplifiedDiscovery',
        ),
      );
    } on Exception catch (e) {
      logger.log(
        LoggingLevel.warning,
        'Failed to set up DTD event listener: $e',
        logger: 'SimplifiedDiscovery',
      );
      return null;
    }
  }

  /// Handle MCP Toolkit events from DTD
  Future<void> _handleMCPToolkitEvent(final DTDEvent event) async {
    try {
      final eventData = event.data;
      final eventKind = jsonDecodeString(eventData['kind']);

      logger.log(
        LoggingLevel.debug,
        'Received MCP Toolkit event: $eventKind',
        logger: 'SimplifiedDiscovery',
      );

      switch (eventKind) {
        case 'ToolRegistration':
          // Flutter app has registered new tools - re-register everything
          await _performInitialRegistration();
          break;
        case 'ServiceExtensionStateChanged':
          // Tool state changed - might need re-registration
          final extensionName = jsonDecodeString(eventData['extension']);
          if (extensionName.contains('registerDynamics')) {
            await _performInitialRegistration();
          }
          break;
        default:
          logger.log(
            LoggingLevel.debug,
            'Ignoring MCP Toolkit event: $eventKind',
            logger: 'SimplifiedDiscovery',
          );
      }
    } on Exception catch (e, stackTrace) {
      logger.log(
        LoggingLevel.warning,
        'Error handling MCP Toolkit event: $e',
        logger: 'SimplifiedDiscovery',
      );
      logger.log(
        LoggingLevel.debug,
        'Stack trace: $stackTrace',
        logger: 'SimplifiedDiscovery',
      );
    }
  }

  /// Get the main Flutter isolate (simplified since we expect only one)
  Future<IsolateRef?> _getMainIsolate(final VmService vmService) async {
    try {
      final vm = await vmService.getVM();
      final isolates = vm.isolates ?? [];

      if (isolates.isEmpty) {
        logger.log(
          LoggingLevel.warning,
          'No isolates found',
          logger: 'SimplifiedDiscovery',
        );
        return null;
      }

      // For most Flutter apps, there's typically one main isolate
      // Check for MCP toolkit extensions
      for (final isolateRef in isolates) {
        final isolateId = isolateRef.id;
        if (isolateId == null) continue;

        final isolate = await vmService.getIsolate(isolateId);
        final extensions = isolate.extensionRPCs ?? [];

        final hasMCPToolkit = extensions.any(
          (final ext) =>
              ext.startsWith('ext.mcp.toolkit') || 
              ext.contains('registerDynamics'),
        );

        if (hasMCPToolkit) {
          logger.log(
            LoggingLevel.info,
            'Found main Flutter isolate with MCP toolkit: $isolateId',
            logger: 'SimplifiedDiscovery',
          );
          return isolateRef;
        }
      }

      // Fallback to first isolate if no MCP toolkit found
      logger.log(
        LoggingLevel.info,
        'No MCP toolkit found, using first isolate: ${isolates.first.id}',
        logger: 'SimplifiedDiscovery',
      );
      return isolates.first;
    } on Exception catch (e) {
      logger.log(
        LoggingLevel.error,
        'Error getting main isolate: $e',
        logger: 'SimplifiedDiscovery',
      );
      return null;
    }
  }

  /// Register tools from the Flutter isolate
  Future<void> _registerToolsFromIsolate(
    final VmService vmService,
    final String isolateId,
  ) async {
    try {
      logger.log(
        LoggingLevel.info,
        'Calling registerDynamics on isolate $isolateId',
        logger: 'SimplifiedDiscovery',
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
        'Failed to call registerDynamics: $e',
        logger: 'SimplifiedDiscovery',
      );
      logger.log(
        LoggingLevel.debug,
        'Stack trace: $stackTrace',
        logger: 'SimplifiedDiscovery',
      );
    }
  }

  /// Process the response from registerDynamics
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
        'Processing registration: ${tools.length} tools, ${resources.length} resources from $appId',
        logger: 'SimplifiedDiscovery',
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
            0, // Port not needed since we use isolateId
            metadata: {'isolateId': isolateId},
          );
        } on Exception catch (e) {
          logger.log(
            LoggingLevel.warning,
            'Failed to register tool ${toolData['name']}: $e',
            logger: 'SimplifiedDiscovery',
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
            0, // Port not needed since we use isolateId
            metadata: {'isolateId': isolateId},
          );
        } on Exception catch (e) {
          logger.log(
            LoggingLevel.warning,
            'Failed to register resource ${resourceData['uri']}: $e',
            logger: 'SimplifiedDiscovery',
          );
        }
      }

      logger.log(
        LoggingLevel.info,
        'Successfully registered $appId with ${tools.length} tools and ${resources.length} resources',
        logger: 'SimplifiedDiscovery',
      );
    } on Exception catch (e, stackTrace) {
      logger.log(
        LoggingLevel.error,
        'Failed to process registration response: $e',
        logger: 'SimplifiedDiscovery',
      );
      logger.log(
        LoggingLevel.debug,
        'Stack trace: $stackTrace',
        logger: 'SimplifiedDiscovery',
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