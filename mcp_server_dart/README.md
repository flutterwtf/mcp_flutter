# Flutter Inspector MCP Server (Dart)

A Model Context Protocol (MCP) server implementation in Dart that provides Flutter debugging and inspection capabilities to AI models.

## Features

- **Hot Reload**: Trigger hot reload for Flutter applications
- **VM Inspection**: Get Dart VM information and status
- **Extension RPCs**: List and interact with available service extensions
- **App Errors**: Retrieve application errors from the Dart VM
- **Screenshots**: Capture screenshots of Flutter app views (optional)
- **View Details**: Get detailed information about Flutter views

## Installation

### Prerequisites

- Dart SDK 3.7.0 or higher
- A running Flutter application in debug mode

### Build from Source

```bash
cd mcp_server_dart
dart pub get
dart compile exe bin/main.dart -o flutter_inspector_mcp_server
```

## Usage

### Command Line Options

```bash
./flutter_inspector_mcp_server [options]

Options:
  --dart-vm-host                Host for Dart VM connection (default: localhost)
  --dart-vm-port                Port for Dart VM connection (default: 8181)
  --[no-]resources-supported    Enable resources support (default: true)
  --[no-]images-supported       Enable images support (default: true)
  -h, --help                    Show usage text
```

### Basic Usage

1. Start your Flutter app in debug mode:

   ```bash
   flutter run --debug
   ```

2. Run the MCP server:

   ```bash
   ./flutter_inspector_mcp_server
   ```

3. The server will connect to your Flutter app via the Dart VM service and provide MCP tools and resources.

## Available Tools

### `hot_reload_flutter`

Hot reloads the Flutter application.

**Parameters:**

- `port` (optional): Custom port number if not using default Flutter debug port 8181
- `force` (optional): Force hot reload even if no changes detected

### `get_vm`

Get VM information from the Flutter app.

**Parameters:**

- `port` (optional): Custom port number if not using default Flutter debug port 8181

### `get_extension_rpcs`

List all available extension RPCs in the Flutter app.

**Parameters:**

- `port` (optional): Custom port number if not using default Flutter debug port 8181
- `isolateId` (optional): Specific isolate ID to check
- `isRawResponse` (optional): Return raw response without processing

### `test_custom_ext`

Test the custom extension functionality.

**Parameters:**

- `port` (optional): Custom port number if not using default Flutter debug port 8181

## Available Resources

### `visual://localhost/app/errors/latest`

Get the most recent application errors from the Dart VM.

### `visual://localhost/view/details`

Get details for all views in the application.

### `visual://localhost/view/screenshots` (if images enabled)

Get screenshots of all views in the application. Returns base64 encoded images.

## Architecture

The server is built using a modular architecture with mixins:

- **`VMServiceSupport`**: Handles connection to the Dart VM service
- **`FlutterInspector`**: Provides Flutter-specific debugging tools and resources
- **`ToolsSupport`**: MCP tools registration and handling
- **`ResourcesSupport`**: MCP resources registration and handling

## Development

### Project Structure

```
lib/
├── src/
│   ├── mixins/
│   │   ├── flutter_inspector.dart    # Flutter debugging tools
│   │   └── vm_service_support.dart   # VM service connection
│   └── server.dart                   # Main server class
└── flutter_inspector_mcp_server.dart # Library exports

bin/
└── main.dart                         # Executable entry point
```

### Running Tests

```bash
dart test
```

### Code Analysis

```bash
dart analyze
```

## Troubleshooting

### Connection Issues

1. **VM Service not connected**: Ensure your Flutter app is running in debug mode and the VM service port (default 8181) is accessible.

2. **Port conflicts**: If port 8181 is in use, specify a different port when starting your Flutter app:
   ```bash
   flutter run --debug --vm-service-port=8182
   ```
   Then start the MCP server with:
   ```bash
   ./flutter_inspector_mcp_server --dart-vm-port=8182
   ```

### Extension Errors

If custom extensions are not working:

1. Verify your Flutter app has the required MCP toolkit extensions
2. Check that the extension names match the expected format
3. Use `get_extension_rpcs` tool to list available extensions

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run `dart analyze` and `dart test`
6. Submit a pull request
