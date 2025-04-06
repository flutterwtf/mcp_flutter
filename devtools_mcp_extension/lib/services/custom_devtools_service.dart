import 'package:devtools_mcp_extension/common_imports.dart';
import 'package:flutter/foundation.dart';

class CustomDevtoolsService {
  CustomDevtoolsService(this.devtoolsService);
  final DevtoolsService devtoolsService;

  /// Should return a list of visual errors in the Flutter application.
  ///
  /// It should contain nodeId, groupName and description of error
  ///
  /// todo: add correct return type
  Future<void> getVisualErrors(final Map<String, dynamic> params) async {
    /// todo: how to get remote diagnostics node with errors?
    /// we need to get remote diagnostics node with errors
    /// so we could properly inspect it
    final rootElement = WidgetsBinding.instance.rootElement;

    if (rootElement == null) {
      print('No root element found');
      return;
    }

    final delegate = InspectorSerializationDelegate(
      service: WidgetInspectorService.instance,
    );
    CustomInspector().inspect(rootElement);

    final rootWidgetNode = rootElement.toDiagnosticsNode(
      name: 'rootWidget',
      style: DiagnosticsTreeStyle.sparse,
    );
    final rootWidgetJson = rootWidgetNode.toJsonMapIterative(delegate);
    print('Root widget info with limited children: $rootWidgetJson');
  }
}

class CustomInspector with WidgetInspectorService {
  CustomInspector() : super();

  @override
  void inspect(final Object? object) {
    super.inspect(object);
  }
}
