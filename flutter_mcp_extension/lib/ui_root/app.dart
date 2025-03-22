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
    home: ChangeNotifierProvider(
      create: (final context) {
        final rpcServer = RpcServer();
        unawaited(rpcServer.start());
        return rpcServer;
      },
      child: const ServerDashboard(),
    ),
  );
}
