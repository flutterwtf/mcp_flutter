import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mcp_toolkit/mcp_toolkit.dart';

Future<void> main() async {
  runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();
      MCPToolkitBinding.instance
        ..initialize(
          enableAutoDiscovery: true,
          mcpServerConfig: const MCPServerConfig(
            host: 'localhost',
            port: 3535,
            protocol: 'http',
          ),
        )
        ..initializeFlutterToolkit(); // Adds Flutter related methods to the MCP server

      // Register custom tools dynamically
      await _registerCustomTools();

      runApp(const MyApp());
    },
    (error, stack) {
      // Optionally, you can also use the bridge's error handling for zone errors
      MCPToolkitBinding.instance.handleZoneError(error, stack);
    },
  );
}

/// Register custom tools with the MCP server
Future<void> _registerCustomTools() async {
  final binding = MCPToolkitBinding.instance;

  // Wait a bit for the connection to establish
  await Future.delayed(const Duration(seconds: 1));

  // Register a custom calculation tool
  final fibonacciRegistered = await binding.addEntries(
    entries: [
      MCPToolDefinition(
        name: 'calculate_fibonacci',
        description: 'Calculate the nth Fibonacci number',
        inputSchema: {
          'type': 'object',
          'properties': {
            'n': {
              'type': 'integer',
              'description': 'The position in the Fibonacci sequence',
              'minimum': 0,
              'maximum': 100,
            },
          },
          'required': ['n'],
        },
      ),
    ],
  );

  // Register a custom app state resource
  final resourceRegistered = await binding.addEntries(
    entries: [
      MCPResourceDefinition(
        uri: 'flutter://app/state',
        name: 'App State',
        description: 'Current application state and configuration',
        mimeType: 'application/json',
      ),
    ],
  );

  // Register a custom user preferences tool
  final preferencesRegistered = await binding.addEntries(
    entries: [
      MCPToolDefinition(
        name: 'get_user_preferences',
        description: 'Get user preferences and settings',
        inputSchema: {
          'type': 'object',
          'properties': {
            'category': {
              'type': 'string',
              'description': 'Preference category to retrieve',
              'enum': ['theme', 'notifications', 'privacy', 'all'],
            },
          },
        },
      ),
    ],
  );

  print('Custom tools and resources registration results:');
  print('  - Fibonacci tool: ${fibonacciRegistered ? 'SUCCESS' : 'FAILED'}');
  print('  - App state resource: ${resourceRegistered ? 'SUCCESS' : 'FAILED'}');
  print(
    '  - Preferences tool: ${preferencesRegistered ? 'SUCCESS' : 'FAILED'}',
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MCP Toolkit Demo',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const MyHomePage(title: 'MCP Dynamic Registration Demo'),
    );
  }
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key, required this.title});

  final String title;

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  int _counter = 0;
  bool _isConnected = false;
  Set<MCPCallEntry> _localEntries = {};

  @override
  void initState() {
    super.initState();
    _checkConnectionStatus();
    // Check connection status periodically
    Timer.periodic(const Duration(seconds: 5), (timer) {
      _checkConnectionStatus();
    });
  }

  void _incrementCounter() {
    setState(() {
      _counter++;
    });
  }

  void _checkConnectionStatus() {
    final binding = MCPToolkitBinding.instance;
    setState(() {
      _isConnected = binding.isConnectedToMCPServer;
      _localEntries = binding.localEntries;
    });
  }

  Future<void> _registerNewTool() async {
    final binding = MCPToolkitBinding.instance;

    final success = await binding.registerCustomTool(
      MCPToolDefinition(
        name: 'counter_value_${DateTime.now().millisecondsSinceEpoch}',
        description: 'Get the current counter value from the Flutter app',
        inputSchema: const {'type': 'object', 'properties': {}},
      ),
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            success
                ? 'Successfully registered new tool!'
                : 'Failed to register tool. Check connection.',
          ),
          backgroundColor: success ? Colors.green : Colors.red,
        ),
      );
    }

    _checkConnectionStatus();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        title: Text(widget.title),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            const Text(
              'This app demonstrates dynamic MCP tool registration using the official dart_mcp package.',
              style: TextStyle(fontSize: 16),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),

            // Connection Status
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color:
                    _isConnected ? Colors.green.shade100 : Colors.red.shade100,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: _isConnected ? Colors.green : Colors.red,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _isConnected ? Icons.check_circle : Icons.error,
                    color: _isConnected ? Colors.green : Colors.red,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _isConnected
                        ? 'Connected to MCP Server'
                        : 'Not connected to MCP Server',
                    style: TextStyle(
                      color:
                          _isConnected
                              ? Colors.green.shade800
                              : Colors.red.shade800,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),
            const Text('Counter value:'),
            Text(
              '$_counter',
              style: Theme.of(context).textTheme.headlineMedium,
            ),

            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _registerNewTool,
              child: const Text('Register New Tool'),
            ),

            const SizedBox(height: 20),
            Text(
              'Local Entries: ${_localEntries.length}',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),

            if (_localEntries.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Registered Service Extensions:',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    ..._localEntries.map(
                      (entry) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2),
                        child: Text(
                          '• ${entry.key}',
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _incrementCounter,
        tooltip: 'Increment',
        child: const Icon(Icons.add),
      ),
    );
  }
}
