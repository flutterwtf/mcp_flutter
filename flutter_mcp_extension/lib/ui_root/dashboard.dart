import 'package:flutter_mcp_extension/common_imports.dart';

/// {@template rpc_connection_status}
/// Displays real-time RPC connection status with animated indicators
/// {@endtemplate}
class RpcConnectionStatus extends StatelessWidget {
  const RpcConnectionStatus({super.key});

  @override
  Widget build(final BuildContext context) {
    final rpc = context.watch<RpcServer>();
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          rpc.connected ? Icons.cloud_done : Icons.cloud_off,
          color: rpc.connected ? Colors.green : Colors.red,
          size: 28,
        ),
        const SizedBox(width: 8),
        Text(
          rpc.connected ? 'Connected' : 'Disconnected',
          style: TextStyle(
            color: rpc.connected ? Colors.green : Colors.red,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

/// {@template server_dashboard}
/// Main server dashboard screen showing connection status and controls
/// {@endtemplate}
class ServerDashboard extends StatelessWidget {
  const ServerDashboard({super.key});

  @override
  Widget build(final BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('RPC Server Dashboard'),
      actions: const [RpcConnectionStatus()],
    ),
    body: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Status card
          Card(
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Server Status',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  const _ServerStatusItem(
                    icon: Icons.public,
                    label: 'Host',
                    value: Envs.rpcHost,
                  ),
                  const SizedBox(height: 8),
                  _ServerStatusItem(
                    icon: Icons.numbers,
                    label: 'Port',
                    value: Envs.rpcPort.toString(),
                  ),
                  const SizedBox(height: 8),
                  const _ServerStatusItem(
                    icon: Icons.api,
                    label: 'Protocol',
                    value: 'WebSocket JSON-RPC 2.0',
                  ),
                  const SizedBox(height: 16),
                  const RpcConnectionStatus(),
                ],
              ),
            ),
          ),

          const SizedBox(height: 24),

          // Actions section
          const Text(
            'Actions',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          Builder(
            builder: (final context) {
              final rpc = context.read<RpcServer>();
              return Row(
                children: [
                  ElevatedButton.icon(
                    icon: const Icon(Icons.restart_alt),
                    label: const Text('Restart Server'),
                    onPressed: () async {
                      await rpc.stop();
                      await rpc.start();
                    },
                  ),
                  const SizedBox(width: 16),
                  OutlinedButton.icon(
                    icon: const Icon(Icons.stop),
                    label: const Text('Stop Server'),
                    onPressed: rpc.stop,
                  ),
                ],
              );
            },
          ),

          const SizedBox(height: 24),

          // Registered methods section
          const Text(
            'Registered Methods',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          const _MethodsList(),
        ],
      ),
    ),
  );
}

/// Server status item with icon, label and value
class _ServerStatusItem extends StatelessWidget {
  const _ServerStatusItem({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(final BuildContext context) => Row(
    children: [
      Icon(icon, size: 20, color: Colors.blueGrey),
      const SizedBox(width: 8),
      Text('$label:', style: const TextStyle(fontWeight: FontWeight.w500)),
      const SizedBox(width: 8),
      Text(value),
    ],
  );
}

/// Displays registered RPC methods
class _MethodsList extends StatelessWidget {
  const _MethodsList();

  @override
  Widget build(final BuildContext context) {
    final methods = context.watch<RpcServer>().registeredMethods;

    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child:
            methods.isEmpty
                ? const Text(
                  'No methods registered yet',
                  style: TextStyle(fontStyle: FontStyle.italic),
                )
                : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final method in methods)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.api,
                              size: 18,
                              color: Colors.blueGrey,
                            ),
                            const SizedBox(width: 8),
                            Text(method),
                          ],
                        ),
                      ),
                  ],
                ),
      ),
    );
  }
}
