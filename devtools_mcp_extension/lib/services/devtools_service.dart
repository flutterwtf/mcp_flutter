// Import necessary packages
// ignore_for_file: avoid_catches_without_on_clauses

import 'dart:async';
import 'dart:developer';

import 'package:devtools_app_shared/service.dart';
import 'package:devtools_app_shared/utils.dart';
import 'package:devtools_mcp_extension/common_imports.dart';
import 'package:devtools_mcp_extension/services/forwarding_rpc_listener.dart';
import 'package:devtools_shared/service.dart' as devtools_shared;
import 'package:vm_service/vm_service.dart';

const freelyForwardingExtensions = [
  'ext.flutter.inspector.structuredErrors',
  'ext.flutter.inspector.show',
  'ext.flutter.inspector.trackRebuildDirtyWidgets',
  'ext.flutter.inspector.widgetLocationIdMap',
  'ext.flutter.inspector.trackRepaintWidgets',
  'ext.flutter.inspector.disposeAllGroups',
  'ext.flutter.inspector.disposeGroup',
  'ext.flutter.inspector.isWidgetTreeReady',
  'ext.flutter.inspector.disposeId',
  'ext.flutter.inspector.setPubRootDirectories',
  'ext.flutter.inspector.addPubRootDirectories',
  'ext.flutter.inspector.removePubRootDirectories',
  'ext.flutter.inspector.getPubRootDirectories',
  'ext.flutter.inspector.setSelectionById',
  'ext.flutter.inspector.getParentChain',
  'ext.flutter.inspector.getProperties',
  'ext.flutter.inspector.getChildren',
  'ext.flutter.inspector.getChildrenSummaryTree',
  'ext.flutter.inspector.getChildrenDetailsSubtree',
  // 'ext.flutter.inspector.getRootWidget', // replaced with custom method
  'ext.flutter.inspector.getRootWidgetSummaryTree',
  'ext.flutter.inspector.getRootWidgetSummaryTreeWithPreviews',
  'ext.flutter.inspector.getRootWidgetTree',
  'ext.flutter.inspector.getDetailsSubtree',
  'ext.flutter.inspector.getSelectedWidget',
  'ext.flutter.inspector.getSelectedSummaryWidget',
  'ext.flutter.inspector.isWidgetCreationTracked',
  // 'ext.flutter.inspector.screenshot', // replaced with _flutter.screenshot
  'ext.flutter.inspector.getLayoutExplorerNode',
  'ext.flutter.inspector.setFlexFit',
  'ext.flutter.inspector.setFlexFactor',
  'ext.flutter.inspector.setFlexProperties',
];

/// analogue of [ServiceExtensionResponse]
class RPCResponse {
  RPCResponse._({
    required this.data,
    required this.success,
    required this.error,
  });

  factory RPCResponse.successMap(final Map<String, dynamic> data) =>
      RPCResponse._(data: data, success: true, error: null);
  factory RPCResponse.successString(final String data) =>
      RPCResponse._(data: data, success: true, error: null);

  factory RPCResponse.error(
    final String error, [
    final StackTrace? stackTrace,
  ]) => RPCResponse._(data: {}, success: false, error: '$error\n$stackTrace');

  final dynamic data;
  final bool success;
  final String? error;

  Map<String, dynamic> toJson() => {
    'success': success,
    'data': data,
    'error': error,
  };

  @override
  String toString() => 'RPCResponse(success: $success,  error: $error)';
}

/// {@template service_extension_bridge}
/// Bridges RPC calls from TypeScript server to Flutter's ServiceManager
/// and ServiceExtensionManager.
///
/// This simplified version focuses only on VM service initialization
/// and handling basic service functions.
/// {@endtemplate}
class DevtoolsService with ChangeNotifier {
  /// {@macro service_extension_bridge}
  DevtoolsService();

  /// The service manager instance
  final _serviceManager = ServiceManager();

  /// Stores the VM service URI when connected
  Uri? _vmServiceUri;

  /// Gets the current service manager
  ServiceManager get serviceManager => _serviceManager;

  /// Gets the current connection state
  (bool connected, String? vmServiceUri) getVmConnectedState(
    final Map<String, dynamic> params,
  ) {
    final connectedState = _serviceManager.connectedState.value;

    return (connectedState.connected, _vmServiceUri?.toString());
  }

  /// Connect to a VM service
  Future<bool> connectToVmService([final Uri? uri]) async {
    // Store the URI for later use
    _vmServiceUri =
        uri ??
        Uri(
          host: Envs.flutterRpc.host,
          port: Envs.flutterRpc.port,
          path: Envs.flutterRpc.path,
        );

    // Use the [connectedState] notifier to listen for connection updates.
    serviceManager.connectedState.addListener(() {
      if (serviceManager.connectedState.value.connected) {
        print('Manager connected to VM service');
      } else {
        print('Manager not connected to VM service');
      }
    });
    try {
      final finishedCompleter = Completer<void>();

      // Use package:devtools_shared to connect to the VM
      final vmService = await devtools_shared.connect<VmService>(
        uri: _vmServiceUri!,
        finishedCompleter: finishedCompleter,
        serviceFactory: VmService.defaultFactory,
      );
      setGlobal(ServiceManager, _serviceManager);

      // Open the VM service connection in the service manager
      await _serviceManager.vmServiceOpened(
        vmService,
        onClosed: finishedCompleter.future,
      );

      notifyListeners();
      return true;
    } catch (e, stackTrace) {
      // Clear the URI if connection fails
      _vmServiceUri = null;
      print('Error connecting to VM service: $e');
      print('Stack trace: $stackTrace');
      return false;
    }
  }

  /// Disconnect from the VM service
  Future<void> disconnectFromVmService() async {
    await _serviceManager.vmServiceClosed();
    _vmServiceUri = null;
    notifyListeners();
  }

  Future<RPCResponse> callServiceExtension(
    final String extension,
    final Map<String, dynamic> params,
  ) async {
    try {
      final result = await serviceManager.callServiceExtensionOnMainIsolate(
        extension,
        args: params,
      );
      return RPCResponse.successMap(result.toJson());
    } catch (e, stackTrace) {
      return RPCResponse.error(
        'Error calling service extension: $e',
        stackTrace,
      );
    }
  }
}

extension DevtoolsServiceExtension on DevtoolsService {
  /// Take a screenshot of the current UI
  Future<RPCResponse> takeScreenshot(final Map<String, dynamic> params) async {
    try {
      print('Take screenshot');
      if (!_serviceManager.connectedState.value.connected) {
        return RPCResponse.error('Not connected to VM service');
      }
      print('Take screenshot: connected');
      final isolateId = _serviceManager.isolateManager.mainIsolate.value?.id;
      if (isolateId == null) {
        print('Take screenshot: no isolateId');
        return RPCResponse.error('No main isolate available');
      }
      print('Take screenshot: isolateId: $isolateId');
      // Call the VM service to take a screenshot using the private Flutter API
      final result = await _serviceManager.service!.callServiceExtension(
        '_flutter.screenshot',
      );
      print('Take screenshot: has result');
      final screenshotData = result.json?['screenshot'] as String?;
      print(
        'Take screenshot: is screenshotData exists: ${screenshotData != null}',
      );
      if (screenshotData != null) {
        return RPCResponse.successString(screenshotData);
      } else {
        return RPCResponse.error('Screenshot data not available');
      }
    } catch (e, stackTrace) {
      return RPCResponse.error(
        'Error taking screenshot: $e, stackTrace: $stackTrace',
      );
    }
  }

  Future<RPCResponse> getRootWidget() async {
    try {
      final callMethodName =
          '$flutterInspectorName.'
          '${WidgetInspectorServiceExtensions.getRootWidgetTree.name}';
      final rootWidgetTree = await serviceManager
          .callServiceExtensionOnMainIsolate(
            callMethodName,
            args: {
              'groupName': 'root',
              'isSummaryTree': 'true',
              'withPreviews': 'false',
              'fullDetails': 'false',
            },
          );
      print('Root widget tree: $rootWidgetTree');
      if (rootWidgetTree.json == null) {
        return RPCResponse.error(
          'Root widget tree not available, '
          'rootWidgetTree: ${rootWidgetTree.toJson()}',
        );
      }
      return RPCResponse.successMap(rootWidgetTree.json!);
    } catch (e, stackTrace) {
      print('Error getting root widget tree: $e');
      print('Stack trace: $stackTrace');
      return RPCResponse.error(
        'Error getting root widget tree: $e',
        stackTrace,
      );
    }
  }
}
