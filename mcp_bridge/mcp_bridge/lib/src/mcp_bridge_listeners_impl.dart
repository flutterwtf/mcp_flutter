import 'package:from_json_to_json/from_json_to_json.dart';
import 'package:is_dart_empty_or_not/is_dart_empty_or_not.dart';

import 'mcp_bridge_listeners.dart';
import 'services/application_info.dart';
import 'services/screenshot_service.dart';

/// {@template mcp_bridge_listeners_impl}
/// The implementation of the [McpBridgeListeners] interface.
/// {@endtemplate}
class McpBridgeListenersImpl extends McpBridgeListeners {
  /// Creates an instance of [McpBridgeListenersImpl].
  McpBridgeListenersImpl();

  @override
  Future<OnAppErrorsResult> onAppErrors(
    final Map<String, String> parameters,
  ) async {
    final count = jsonDecodeInt(parameters['count'] ?? '').whenZeroUse(10);
    final reversedErrors = errorMonitor.errors.take(count).toList();
    final errors = reversedErrors.map((final e) => e.toJson()).toList();
    final message = () {
      if (errors.isEmpty) {
        return 'No errors found. Here are possible reasons: \n'
            '1) There were really no errors. \n'
            '2) Errors occurred before they were captured by MCP server. \n'
            'What you can do (choose wisely): \n'
            '1) Try to reproduce action, which expected to cause errors. \n'
            '2) If errors still not visible, try to navigate to another '
            'screen and back. \n'
            '3) If even then errors still not visible, try to restart app.';
      }

      return 'Errors found. \n'
          'Take a notice: the error message may have contain '
          'a path to file and line number. \n'
          'Use it to find the error in codebase.';
    }();

    return OnAppErrorsResult(message: message, errors: errors);
  }

  @override
  Future<OnViewScreenshotsResult> onViewScreenshots(
    final Map<String, String> parameters,
  ) async {
    final compress = jsonDecodeBool(parameters['compress']);
    final images = await ScreenshotService.takeScreenshots(compress: compress);
    return OnViewScreenshotsResult(
      message:
          'Screenshots taken for each view. '
          'If you find visual errors, you can try to request errors '
          'to get more information with stack trace',
      images: images,
    );
  }

  @override
  Future<OnViewDetailsResult> onViewDetails(
    final Map<String, String> parameters,
  ) async {
    final details = ApplicationInfo.getViewsInformation();
    final json = details.map((final e) => e.toJson()).toList();
    return OnViewDetailsResult(
      message: 'Information about each view. ',
      details: json,
    );
  }
}
