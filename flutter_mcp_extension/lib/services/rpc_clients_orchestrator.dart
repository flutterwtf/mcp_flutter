import 'package:flutter_mcp_extension/common_imports.dart';

class RpcClientsOrchestrator {
  final tsRpcClient = RpcClient();
  final flutterRpcClient = RpcClient();
  Future<void> init() async {
    await Future.wait([
      tsRpcClient.connect(
        port: Envs.tsRpc.port,
        host: Envs.tsRpc.host,
        path: Envs.tsRpc.path,
      ),
      flutterRpcClient.connect(
        port: Envs.flutterRpc.port,
        host: Envs.flutterRpc.host,
        path: Envs.flutterRpc.path,
      ),
    ]);
  }
}
