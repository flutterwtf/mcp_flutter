# Flutter Inspector MCP Server

Give Cursor, Windsurf, Cline, and other AI-powered coding tools access to your Flutter app's widget tree and navigation state with this Model Context Protocol server.

When Cursor has access to Flutter's widget tree and navigation state, it can better understand your app's structure and provide more accurate code suggestions and implementations.

Get started quickly:

```bash
npx flutter-inspector --port=3334
```

## How it works

1. Start your Flutter app in debug mode
2. Run the Flutter Inspector MCP server
3. Open Cursor's composer in agent mode
4. Ask Cursor to analyze your Flutter app's widget tree or current route
5. Cursor will fetch the relevant metadata from your running Flutter app and use it to assist you

This MCP server is specifically designed for use with Cursor and other AI coding tools. It provides access to Flutter's widget tree and navigation state through a standardized interface.

## Installation

### Running the server quickly with NPM

You can run the server quickly without installing or building the repo using NPM:

```bash
npx flutter-inspector --port=3334

# or
pnpx flutter-inspector --port=3334

# or
yarn dlx flutter-inspector --port=3334

# or
bunx flutter-inspector --port=3334
```

### JSON config for tools that use configuration files

Many tools like Windsurf, Cline, and Claude Desktop use a configuration file to start the server.

The `flutter-inspector` server can be configured by adding the following to your configuration file:

```json
{
  "mcpServers": {
    "flutter-inspector": {
      "command": "npx",
      "args": ["-y", "flutter-inspector", "--stdio"],
      "env": {
        "PORT": "3334",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Running the server from local source

1. Clone the repository
2. Install dependencies with `npm install` or `pnpm install`
3. Copy `.env.example` to `.env` and configure as needed
4. Run the server with `npm run start` or `pnpm start`, along with any command-line arguments

## Configuration

The server can be configured using either environment variables (via `.env` file) or command-line arguments. Command-line arguments take precedence over environment variables.

### Environment Variables

- `PORT`: The port to run the server on (default: 3334)
- `LOG_LEVEL`: Logging level (error, warn, info, debug) (default: info)

### Command-line Arguments

- `--version`: Show version number
- `--port`, `-p`: The port to run the server on
- `--stdio`: Run the server in stdio mode (default: true)
- `--log-level`: Set logging level (error, warn, info, debug)
- `--help`: Show help menu

## Connecting to Cursor

### Start the server

```bash
npx flutter-inspector --port=3334
# Initializing Flutter Inspector MCP Server...
# Server running on port 3334
```

### Connect Cursor to the MCP server

Once the server is running, connect Cursor to the MCP server in Cursor's settings, under the features tab.

After the server has been connected, you can confirm Cursor has a valid connection before getting started. If you get a green dot and the tools show up, you're good to go!

### Start using Composer with your Flutter app

Once the MCP server is connected, you can start using the tools in Cursor's composer, as long as the composer is in agent mode.

First, make sure your Flutter app is running in debug mode. Then you can ask Cursor to analyze your app's widget tree or get the current route.

## Inspect Responses

To inspect responses from the MCP server more easily, you can run the `inspect` command, which launches the `@modelcontextprotocol/inspector` web UI for triggering tool calls and reviewing responses:

```bash
npm run inspector
# > flutter-inspector@0.1.0 inspector
# > npx @modelcontextprotocol/inspector
#
# Starting MCP inspector...
# Proxy server listening on port 3334
#
# 🔍 MCP Inspector is up and running at http://localhost:5173 🚀
```

## Available Tools

The server provides the following MCP tools:

### get_active_ports

Lists all ports where Flutter/Dart processes are currently listening.

Parameters: None

### get_widget_tree

Fetches the widget tree from a running Flutter application.

Parameters:

- `port` (number, required): The port number where the Flutter app is running

### get_current_route

Gets the current route/page from a running Flutter application.

Parameters:

- `port` (number, required): The port number where the Flutter app is running

## Documentation

- Dart VM RPC protocol: https://github.com/dart-lang/sdk/blob/main/runtime/vm/service/service.md
- Devtools: https://github.com/flutter/devtools/blob/master/packages/devtools_app/lib/src/shared/server/server_api_client.dart

## Contributing

We welcome contributions! Please feel free to submit a Pull Request.

## License

MIT

Dart VM and Flutter are trademarks of Google LLC.
