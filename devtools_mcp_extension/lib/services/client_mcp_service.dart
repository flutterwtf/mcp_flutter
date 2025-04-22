import 'package:devtools_mcp_extension/common_imports.dart';

class ClientMcpService {
  var _initialized = false;
  Future<void> init() async {
    if (!_initialized) {}
    _initialized = true;
  }
}
