// ignore_for_file: do_not_use_environment

class Envs {
  static const tsRpc = (
    host: String.fromEnvironment('TS_RPC_HOST', defaultValue: 'localhost'),
    port: int.fromEnvironment('TS_RPC_PORT', defaultValue: 3334),
    path: String.fromEnvironment('TS_RPC_PATH', defaultValue: 'ws'),
  );
  static const flutterRpc = (
    host: String.fromEnvironment('FLUTTER_RPC_HOST', defaultValue: 'localhost'),
    port: int.fromEnvironment('FLUTTER_RPC_PORT', defaultValue: 8141),
    path: String.fromEnvironment('FLUTTER_RPC_PATH', defaultValue: 'ws'),
  );
}
