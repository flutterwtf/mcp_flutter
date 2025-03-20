import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:logging/logging.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;
import 'package:shelf_web_socket/shelf_web_socket.dart';
import 'package:vm_service/vm_service.dart' as vm_service;
import 'package:web_socket_channel/web_socket_channel.dart';

final _logger = Logger('DartProxy');

class StdOutLogger extends vm_service.Log {
  @override
  void warning(String message) => print('Warning: $message');
  @override
  void severe(String message) => print('Severe: $message');
}

Future<String?> getVmServiceInfo(int port) async {
  try {
    final socket = await Socket.connect('127.0.0.1', port);
    final completer = Completer<String?>();

    socket.listen(
      (data) {
        final response = utf8.decode(data);
        if (response.contains('ws://')) {
          completer.complete(response);
        }
      },
      onDone: () {
        if (!completer.isCompleted) {
          completer.complete(null);
        }
        socket.destroy();
      },
      onError: (e) {
        if (!completer.isCompleted) {
          completer.complete(null);
        }
        socket.destroy();
      },
    );

    socket.write('\n');
    return await completer.future;
  } catch (e) {
    print('Error getting VM service info: $e');
    return null;
  }
}

void main() async {
  // Setup logging
  Logger.root.level = Level.ALL;
  Logger.root.onRecord.listen((record) {
    print('${record.level.name}: ${record.time}: ${record.message}');
  });

  final port = 8000;
  final handler = webSocketHandler((
    WebSocketChannel webSocket,
    String? protocol,
  ) async {
    print('Received WebSocket connection');

    try {
      await for (var message in webSocket.stream) {
        final data = jsonDecode(message as String);
        final targetPort = data['port'] as int;

        // Get VM service info including auth token
        final vmServiceInfo = await getVmServiceInfo(targetPort);
        if (vmServiceInfo == null) {
          webSocket.sink.add(
            jsonEncode({
              'error': 'Failed to get VM service info',
              'id': data['id'],
            }),
          );
          continue;
        }

        // Extract WebSocket URL from VM service info
        final wsUrlMatch = RegExp(r'ws://[^"\s]+/ws').firstMatch(vmServiceInfo);
        if (wsUrlMatch == null) {
          webSocket.sink.add(
            jsonEncode({
              'error': 'Invalid VM service info format',
              'id': data['id'],
            }),
          );
          continue;
        }

        final vmServiceUrl = wsUrlMatch.group(0)!;
        print('Connecting to VM service at: $vmServiceUrl');

        try {
          final vmSocket = WebSocketChannel.connect(Uri.parse(vmServiceUrl));

          // Forward the command to the VM service
          final command = {
            'id': data['id'],
            'method': data['command'],
            'params': data['args'] ?? {},
          };

          vmSocket.sink.add(jsonEncode(command));

          // Wait for the response
          final response = await vmSocket.stream.first;
          webSocket.sink.add(response as String);

          await vmSocket.sink.close();
        } catch (e) {
          webSocket.sink.add(
            jsonEncode({
              'error': 'Failed to connect to VM service: $e',
              'id': data['id'],
            }),
          );
        }
      }
    } catch (e) {
      print('Error processing message: $e');
      webSocket.sink.add(jsonEncode({'error': 'Internal server error: $e'}));
    }
  });

  final server = await shelf_io.serve(handler, 'localhost', port);
  print('Serving at ws://localhost:${server.port}');
}

Future<Map<String, dynamic>> getWidgetTree(
  vm_service.VmService vmService, {
  bool includeProperties = false,
  int subtreeDepth = 1000,
}) async {
  final vm = vmService;
  final isolateGroup = await vm.getVM();
  final isolates = isolateGroup.isolates ?? [];
  if (isolates.isEmpty) {
    throw Exception('No isolates found.');
  }
  final isolate = isolates.first;
  final isolateId = isolate.id!;

  final isWidgetTreeReady = await vmService.callServiceExtension(
    'ext.flutter.inspector.isWidgetTreeReady',
    isolateId: isolateId,
  );

  if (isWidgetTreeReady.json!['result'] != true) {
    throw Exception("Widget tree is not ready");
  }

  final summaryTree = await vmService.callServiceExtension(
    'ext.flutter.inspector.getRootWidgetSummaryTree',
    isolateId: isolateId,
  );

  return _processWidgetTree(
    vmService,
    isolateId,
    summaryTree.json!,
    subtreeDepth,
    includeProperties,
    {},
  );
}

Future<Map<String, dynamic>> _processWidgetTree(
  vm_service.VmService vmService,
  String isolateId,
  Map<String, dynamic> widgetData,
  int subtreeDepth,
  bool includeProperties,
  Map<String, dynamic> idToJson,
) async {
  final String? id = widgetData['id'];
  final String? creationLocation = widgetData['creationLocation'];

  Map<String, dynamic>? properties;
  if (includeProperties && id != null) {
    idToJson[id] = widgetData;
    try {
      final propertiesResponse = await vmService.callServiceExtension(
        'ext.flutter.inspector.getProperties',
        isolateId: isolateId,
        args: {'objectId': id},
      );
      properties = propertiesResponse.json!;
    } catch (e) {
      _logger.warning('Error fetching properties for $id: $e');
      properties = {'error': 'Failed to fetch properties'};
    }
  }

  final result = {
    'description': widgetData['description'],
    'type': widgetData['type'],
    'properties': properties,
    'creationLocation': creationLocation,
    'children': <Map<String, dynamic>>[],
  };

  if (id != null && subtreeDepth > 0) {
    try {
      final childrenResponse = await vmService.callServiceExtension(
        'ext.flutter.inspector.getChildrenDetailsSubtree',
        isolateId: isolateId,
        args: {'objectId': id, 'subtreeDepth': subtreeDepth - 1},
      );

      final children = childrenResponse.json!['children'] as List<dynamic>?;
      if (children != null) {
        for (final child in children) {
          result['children'].add(
            await _processWidgetTree(
              vmService,
              isolateId,
              child,
              subtreeDepth - 1,
              includeProperties,
              idToJson,
            ),
          );
        }
      }
    } catch (e) {
      _logger.warning('Error fetching children for $id: $e');
      result['children'].add({'error': 'Failed to fetch children'});
    } finally {
      await vmService.callServiceExtension(
        'ext.flutter.inspector.disposeId',
        isolateId: isolateId,
        args: {'id': id},
      );
    }
  }

  return result;
}
