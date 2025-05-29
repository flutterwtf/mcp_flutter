// Copyright (c) 2025, Flutter Inspector MCP Server authors.
// Licensed under the MIT License.

// ignore_for_file: avoid_catches_without_on_clauses

import 'dart:async';

import 'package:dart_mcp/server.dart';
import 'package:dtd/dtd.dart';
import 'package:from_json_to_json/from_json_to_json.dart';
import 'package:vm_service/vm_service.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

/// Mixin providing VM service connection and management capabilities
base mixin VMServiceSupport on MCPServer {
  VmService? _vmService;
  WebSocketChannel? _vmChannel;
  DartToolingDaemon? _dartToolingDaemon;

  late String vmHost;
  late int vmPort;

  /// Get the current VM service instance
  VmService? get vmService => _vmService;
  DartToolingDaemon? get dartToolingDaemon => _dartToolingDaemon;

  /// Check if VM service is connected
  bool get isVMServiceConnected => _vmService != null;

  /// Initialize VM service connection
  Future<void> initializeVMService() async {
    try {
      final url = 'ws://$vmHost:$vmPort/ws';
      final uri = Uri.parse(url);
      _vmChannel = WebSocketChannel.connect(uri);
      _dartToolingDaemon = await DartToolingDaemon.connect(uri);

      _vmService = VmService(
        _vmChannel!.stream.cast<String>(),
        (final message) => _vmChannel!.sink.add(message),
      );

      // Test connection
      await _vmService!.getVM();
    } catch (e, s) {
      print('Failed to connect to VM service at $vmHost:$vmPort: $e $s');
      await disconnectVMService();
    }
  }

  /// Disconnect from VM service
  Future<void> disconnectVMService() async {
    await _vmService?.dispose();
    await _vmChannel?.sink.close();
    _vmService = null;
    _vmChannel = null;
  }

  /// Call a service extension method
  Future<Response?> callServiceExtension(
    final String method, {
    final String? isolateId,
    final Map<String, dynamic>? args,
  }) async {
    if (_vmService == null) {
      throw StateError('VM service not connected');
    }

    try {
      return await _vmService!.callServiceExtension(
        method,
        isolateId: isolateId,
        args: args,
      );
    } catch (e, s) {
      print('Failed to call service extension $method: $e $s');
      return null;
    }
  }

  /// Get all isolates
  Future<List<IsolateRef>> getIsolates() async {
    if (_vmService == null) {
      throw StateError('VM service not connected');
    }

    try {
      final vm = await _vmService!.getVM();
      return vm.isolates ?? [];
    } catch (e, s) {
      print('Failed to get isolates: $e $s');
      return [];
    }
  }

  /// Get the main isolate (Flutter app isolate)
  Future<IsolateRef?> getMainIsolate() async {
    final isolates = await getIsolates();
    // Find isolate with Flutter extension RPCs
    for (final isolate in isolates) {
      final isolateInfo = await _vmService!.getIsolate(isolate.id!);
      final extensionRPCs = isolateInfo.extensionRPCs ?? [];
      if (extensionRPCs.any((final ext) => ext.startsWith('ext.flutter'))) {
        return isolate;
      }
    }
    return null;
  }

  /// Hot reload the Flutter app
  ///
  /// Hard copy from [https://github.com/dart-lang/ai/blob/e04e501de6441528dc530e97ed79400dd201762f/pkgs/dart_mcp_server/lib/src/mixins/dtd.dart#L292]
  Future<Map<String, dynamic>?> hotReload({final bool force = false}) async {
    final vmService = this.vmService;
    if (vmService == null) {
      return {'error': 'VM service not connected'};
    }
    final vm = await vmService.getVM();
    ReloadReport? report;
    StreamSubscription<Event>? serviceStreamSubscription;
    try {
      final hotReloadMethodNameCompleter = Completer<String?>();
      serviceStreamSubscription = vmService
          .onEvent(EventStreams.kService)
          .listen((final e) {
            if (e.kind == EventKind.kServiceRegistered) {
              final serviceName = e.service!;
              if (serviceName == 'reloadSources') {
                // This may look something like 's0.reloadSources'.
                hotReloadMethodNameCompleter.complete(e.method);
              }
            }
          });

      await vmService.streamListen(EventStreams.kService);

      final hotReloadMethodName = await hotReloadMethodNameCompleter.future
          .timeout(const Duration(milliseconds: 1000), onTimeout: () => null);

      /// If we haven't seen a specific one, we just call the default one.
      if (hotReloadMethodName == null) {
        report = await vmService.reloadSources(
          vm.isolates!.first.id!,
          force: force,
        );
      } else {
        final result = await callServiceExtension(
          hotReloadMethodName,
          isolateId: vm.isolates!.first.id,
          args: {'force': force},
        );
        final jsonMap = jsonDecodeMap(result?.json);
        final resultType = jsonDecodeString(jsonMap['type']);
        final success = jsonDecodeBool(jsonMap['success']);
        if (resultType == 'Success' ||
            (resultType == 'ReloadReport' && success)) {
          report = ReloadReport(success: true);
        } else {
          report = ReloadReport(success: false);
        }
      }
    } finally {
      await serviceStreamSubscription?.cancel();
      await vmService.streamCancel(EventStreams.kService);
    }
    final isolate = await getMainIsolate();
    if (isolate?.id == null) {
      return {'error': 'No isolate found'};
    }

    try {
      return {'report': report.toJson()};
    } catch (e, s) {
      return {'error': 'Hot reload failed: $e $s'};
    }
  }

  /// Get VM information
  Future<Map<String, dynamic>?> getVMInfo() async {
    if (_vmService == null) {
      return {'error': 'VM service not connected'};
    }

    try {
      final vm = await _vmService!.getVM();
      return {
        'name': vm.name,
        'version': vm.version,
        'pid': vm.pid,
        'startTime': vm.startTime,
        'isolates':
            vm.isolates
                ?.map(
                  (final i) => {'id': i.id, 'name': i.name, 'number': i.number},
                )
                .toList(),
      };
    } catch (e, s) {
      return {'error': 'Failed to get VM info: $e $s'};
    }
  }

  /// Get available extension RPCs
  Future<Map<String, dynamic>?> getExtensionRPCs() async {
    final isolate = await getMainIsolate();
    if (isolate?.id == null) {
      return {'error': 'No isolate found'};
    }

    try {
      final isolateInfo = await _vmService!.getIsolate(isolate!.id!);
      return {'extensions': isolateInfo.extensionRPCs};
    } catch (e, s) {
      return {'error': 'Failed to get extension RPCs: $e $s'};
    }
  }

  /// Ensure VM service is connected; try to connect if not.
  Future<bool> ensureVMServiceConnected({
    final Duration timeout = const Duration(seconds: 2),
  }) async {
    if (isVMServiceConnected) return true;
    try {
      final connectFuture = initializeVMService();
      if (timeout != Duration.zero) {
        await connectFuture.timeout(timeout);
      } else {
        await connectFuture;
      }
      return isVMServiceConnected;
    } catch (_) {
      return false;
    }
  }
}
