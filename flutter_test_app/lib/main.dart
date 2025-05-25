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

  // Register a custom calculation tool
  await binding.registerCustomTool(
    const MCPToolDefinition(
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
  );

  // Register a custom app state resource
  await binding.registerCustomResource(
    const MCPResourceDefinition(
      uri: 'flutter://app/state',
      name: 'App State',
      description: 'Current application state and configuration',
      mimeType: 'application/json',
    ),
  );

  // Register a custom user preferences tool
  await binding.registerCustomTool(
    const MCPToolDefinition(
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
  );

  print('Custom tools and resources registered with MCP server');
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
  Map<String, dynamic>? _registrations;

  void _incrementCounter() {
    setState(() {
      _counter++;
    });
  }

  Future<void> _checkRegistrations() async {
    final registrations =
        await MCPToolkitBinding.instance.getServerRegistrations();
    setState(() {
      _registrations = registrations;
    });
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
              'This app demonstrates dynamic MCP tool registration.',
              style: TextStyle(fontSize: 16),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            const Text('Counter value:'),
            Text(
              '$_counter',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _checkRegistrations,
              child: const Text('Check MCP Registrations'),
            ),
            if (_registrations != null) ...[
              const SizedBox(height: 20),
              const Text(
                'MCP Server Registrations:',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              Container(
                margin: const EdgeInsets.all(16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _registrations.toString(),
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
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
