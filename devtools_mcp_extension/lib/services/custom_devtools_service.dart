import 'package:devtools_mcp_extension/common_imports.dart';
import 'package:flutter/foundation.dart';

class CustomDevtoolsService {
  CustomDevtoolsService(this.devtoolsService);
  final DevtoolsService devtoolsService;

  Future<void> customMethod(final Map<String, dynamic> params) async {
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
