part of 'mcp_bridge_binding.dart';

mixin McpBridgeExtensions {
  void initializeServiceExtension() {
    registerExtension('ext.devtools.mcp.extension.apperrors', (
      method,
      params,
    ) async {
      try {
        final count = int.tryParse(params['count'] ?? '') ?? 10;
        final reversedErrors =
            ErrorMonitor.errors.reversed.take(count).toList();
        print(
          'reversedErrorsCount. method: $method, count: $count ${ErrorMonitor.errors.reversed.length}',
        );

        return ServiceExtensionResponse.result(
          jsonEncode({
            // 'type': '_extensionType',
            'method': method,
            'data': reversedErrors.map((e) => e.toJson()).toList(),
          }),
        );
      } catch (e, stack) {
        return ServiceExtensionResponse.error(
          ServiceExtensionResponse.extensionError,
          jsonEncode({
            // 'type': '_extensionType',
            'method': method,
            'error': e.toString(),
            'stack': stack.toString(),
          }),
        );
      }
    });
  }
}
