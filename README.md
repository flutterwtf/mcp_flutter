# Flutter Inspector MCP Server

This is a Model Context Protocol (MCP) server that allows you to inspect running Flutter applications.

## Features

- **`get_active_ports`**: Lists ports where Flutter/Dart processes are listening.
- **`get_widget_tree`**: Retrieves the widget tree from a Flutter app running on a specified port.

## Installation

### General Installation

1.  Clone this repository.
2.  Navigate to the repository directory: `cd flutter-inspector`
3.  Install dependencies: `npm install`
4.  Build the server: `npm run build`
5.  Link the server (optional, for global availability): `npm link`

### Cursor Installation

1.  Open Cursor.
2.  Go to Settings (File > Settings on Windows/Linux, Cursor > Preferences on macOS).
3.  Navigate to the "Claude" settings (it might be under "Extensions" or a similar category).
4.  Find the MCP server configuration section (likely a JSON file, `cline_mcp_settings.json`).
5.  Add a new entry to the `mcpServers` object:

    ```json
    {
      "mcpServers": {
        "flutter-inspector": {
          "command": "node",
          "args": ["/path/to/flutter-inspector/build/index.js"],
          "env": {},
          "disabled": false,
          "autoApprove": []
        }
      }
    }
    ```

    **Replace `/path/to/flutter-inspector/build/index.js` with the absolute path to the `index.js` file within the built MCP server directory.** You can find the absolute path by right-clicking on `index.js` in your file explorer and selecting "Copy Path".

6.  Restart Cursor for the changes to take effect.

## Usage

1.  Run your Flutter app with the VM Service enabled:

    ```bash
    flutter run --observatory-port=8181
    ```

2.  Use the tools via MCP in Cursor. You can now ask Claude questions like:
    - "What are the active Flutter ports?"
    - "Show me the widget tree for the app running on port 8181."

Example tool usage:

```typescript
// Get active Flutter ports
use_mcp_tool({
  server_name: "flutter-inspector",
  tool_name: "get_active_ports",
});

// Get widget tree for a specific port
use_mcp_tool({
  server_name: "flutter-inspector",
  tool_name: "get_widget_tree",
  arguments: {
    port: 8181,
  },
});
```

## Roadmap

- **State Inspection:** Add tools to inspect the state of the Flutter application.
- **Performance Monitoring:** Integrate performance profiling tools.
- **Network Inspection:** Add tools to monitor network requests and responses.
- **UI:** Create a user interface for easier interaction with the server.
- **Remote Device Support:** Allow connecting to apps running on remote devices.

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Add appropriate error handling
- Include tests for new features
- Update documentation as needed
- Follow the existing code style

## License

MIT License - see the [LICENSE](LICENSE) file for details
