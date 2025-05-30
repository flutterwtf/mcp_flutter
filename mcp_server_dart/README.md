# MCP Toolkit Server (Dart) (beta)

This is a beta version of MCP Toolkit Server (Dart) that will replace the deprecated [mcp_server](../mcp_server/README.md) server.

## Installation

### Prerequisites

- Dart SDK 3.7.0 or higher
- A running Flutter application in debug mode

### Build from Source

```bash
make compile
```

## Usage

### Command Line Options

```bash
./flutter_inspector_mcp_server [options]

Options:
  --dart-vm-host                Host for Dart VM connection (default: localhost)
  --dart-vm-port                Port for Dart VM connection (default: 8181)
  --resources                   Enable resources support (default: true)
  --images                      Enable images support (default: true)
  --dumps                       Enable dumps support (default: false)
  --log-level                   Logging level (default: critical)
  --environment                 Environment (default: production)
  -h, --help                    Show usage text
```

### Basic Usage

1. Start your Flutter app in debug mode:

   ```bash
   flutter run --debug --dart-vm-host=localhost --dart-vm-port=8181
   ```

2. Run the MCP server:

   ```bash
   ./build/flutter_inspector_mcp_server
   ```
