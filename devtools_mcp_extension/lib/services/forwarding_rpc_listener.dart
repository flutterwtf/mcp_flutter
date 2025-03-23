import 'package:dart_forwarding_client/dart_forwarding_client.dart';
import 'package:devtools_mcp_extension/common_imports.dart';

class ForwardingRpcListener {
  ForwardingRpcListener({
    required this.forwardingClient,
    required this.serviceBridge,
  });

  final ForwardingClient forwardingClient;
  final DevtoolsService serviceBridge;
  void init() {
    forwardingClient.on(notifyListeners);
  }
}
