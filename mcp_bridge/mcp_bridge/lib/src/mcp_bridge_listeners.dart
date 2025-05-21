import 'package:flutter/cupertino.dart';

import 'services/error_monitor.dart';

/// An interface for all results returned by MCP Bridge.
extension type BridgeResult._(Map<String, dynamic> parameters)
    implements Map<String, dynamic> {}

/// {@template on_app_errors_result}
/// The result of the [onAppErrors] method.
/// {@endtemplate}
extension type OnAppErrorsResult._(Map<String, dynamic> parameters)
    implements BridgeResult {
  /// {@macro on_app_errors_result}
  factory OnAppErrorsResult({
    required final String message,
    required final List<Map<String, dynamic>> errors,
  }) => OnAppErrorsResult._({'message': message, 'errors': errors});
}

/// {@template on_view_screenshots_result}
/// The result of the [onViewScreenshots] method.
/// {@endtemplate}
extension type OnViewScreenshotsResult._(Map<String, dynamic> parameters)
    implements BridgeResult {
  /// {@macro on_view_screenshots_result}
  factory OnViewScreenshotsResult({
    required final String message,
    required final List<String> images,
  }) => OnViewScreenshotsResult._({'message': message, 'images': images});
}

/// {@template on_view_details_result}
/// The result of the [onViewDetails] method.
/// {@endtemplate}
extension type OnViewDetailsResult._(Map<String, dynamic> parameters)
    implements BridgeResult {
  /// {@macro on_view_details_result}
  factory OnViewDetailsResult({
    required final String message,
    required final List<Map<String, dynamic>> details,
  }) => OnViewDetailsResult._({'message': message, 'details': details});
}

/// {@template mcp_bridge_listeners}
/// The interface for the callbacks from MCP server.
/// {@endtemplate}
abstract class McpBridgeListeners {
  /// The error monitor.
  late ErrorMonitor errorMonitor;

  /// Attaches the error monitor.
  @mustCallSuper
  // ignore: use_setters_to_change_properties
  void attachErrorMonitor(final ErrorMonitor errorMonitor) =>
      this.errorMonitor = errorMonitor;

  /// The callback for the [onAppErrors] method.
  Future<OnAppErrorsResult> onAppErrors(final Map<String, String> parameters);

  /// The callback for the [onViewScreenshots] method.
  Future<OnViewScreenshotsResult> onViewScreenshots(
    final Map<String, String> parameters,
  );

  /// The callback for the [onViewDetails] method.
  Future<OnViewDetailsResult> onViewDetails(
    final Map<String, String> parameters,
  );
}
