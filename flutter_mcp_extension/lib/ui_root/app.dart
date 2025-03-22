import 'dart:async';

import 'package:flutter_mcp_extension/common_imports.dart';

/// {@template inspector_app}
/// Root application widget for the Flutter Inspector
/// {@endtemplate}
class InspectorApp extends StatelessWidget {
  /// {@macro inspector_app}
  const InspectorApp({super.key});

  @override
  Widget build(final BuildContext context) => MaterialApp(
    title: 'Flutter Inspector',
    theme: ThemeData(
      colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
      useMaterial3: true,
    ),
    darkTheme: ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: Colors.blue,
        brightness: Brightness.dark,
      ),
      useMaterial3: true,
    ),
    home: FutureBuilder(
      // ignore: discarded_futures
      future: _initRpcClient(),
      builder: (final context, final snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (snapshot.hasError) {
          return Scaffold(
            body: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: Colors.red),
                  const SizedBox(height: 16),
                  Text('Error initializing RPC server: ${snapshot.error}'),
                ],
              ),
            ),
          );
        }

        final rpcClient = snapshot.data!;

        return ChangeNotifierProvider.value(
          value: rpcClient,
          child: const ServerDashboard(),
        );
      },
    ),
  );

  Future<RpcClient> _initRpcClient() async {
    final rpcClient = RpcClient();
    try {
      await rpcClient.connect(port: Envs.tsRpc.port, host: Envs.tsRpc.host);
      return rpcClient;
    } catch (e) {
      print('Error starting RPC server: $e');
      // Still return the server even if there was an error,
      // so we can display connection status in the UI
      return rpcClient;
    }
  }
}
