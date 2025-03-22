// ignore_for_file: do_not_use_environment

class Envs {
  static const rpcPort = int.fromEnvironment('RPC_PORT', defaultValue: 8141);

  static const rpcHost = String.fromEnvironment(
    'RPC_HOST',
    defaultValue: 'localhost',
  );
}
