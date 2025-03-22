import 'package:flutter_mcp_extension/common_imports.dart';

/// {@template rpc_connection_status}
/// Displays real-time RPC connection status with animated indicators
/// {@endtemplate}
class RpcConnectionStatus extends StatelessWidget {
  const RpcConnectionStatus({super.key});

  @override
  Widget build(final BuildContext context) => Consumer<RpcServer>(
    builder:
        (final context, final rpc, _) => Row(
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
        ),
  );
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
    body: const Padding(
      padding: EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start),
    ),
  );
}
