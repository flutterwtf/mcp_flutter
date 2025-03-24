# Forwarding Server Troubleshooting Guide

## Flutter Client Connection Issues

If you're experiencing issues with the Flutter client not connecting to the forwarding server, try the following solutions:

### 1. Verify WebSocket URL Format

Ensure your Flutter client is using the correct WebSocket URL format:

```dart
final wsUrl = 'ws://localhost:8143/forward?clientType=flutter&clientId=your-client-id';
```

The `clientType=flutter` parameter is **required** and must match exactly (case-sensitive).

### 2. Connection Headers

If you cannot set query parameters, you can use the following HTTP headers in your WebSocket connection:

```dart
Map<String, dynamic> headers = {
  'X-Client-Type': 'flutter',
  'X-Client-Id': 'your-client-id'
};
```

### 3. Check for WebSocket Library Compatibility

The Flutter WebSocket implementation might handle connections differently. Try:

```dart
import 'package:web_socket_channel/io.dart';

final channel = IOWebSocketChannel.connect(
  Uri.parse('ws://localhost:8143/forward?clientType=flutter'),
  headers: {
    'X-Client-Type': 'flutter',
    'X-Client-Id': 'optional-custom-id'
  }
);
```

### 4. Message Format

Ensure your messages follow the JSON-RPC 2.0 format:

```dart
final message = {
  'id': 'unique-message-id',
  'method': 'methodName',
  'params': {
    // Method parameters
  },
  'jsonrpc': '2.0'
};

channel.sink.add(jsonEncode(message));
```

### 5. Verify Server is Running

Make sure the forwarding server is running and accessible. Try connecting with a test client first:

```bash
node test-flutter-client.js
```

### 6. Network/Firewall Issues

- Check if the server port (default: 8143) is open
- Verify there are no firewall rules blocking WebSocket connections
- If running in an emulator, make sure the emulator can access the host machine

### 7. Logging and Debugging

Enable verbose logging in your Flutter application:

```dart
void connectToServer() {
  print('Connecting to forwarding server...');
  try {
    // Connection code
  } catch (e) {
    print('Error connecting to server: $e');
  }

  channel.stream.listen(
    (message) {
      print('Received message: $message');
      // Handle message
    },
    onError: (error) {
      print('Error in WebSocket connection: $error');
    },
    onDone: () {
      print('WebSocket connection closed');
    }
  );
}
```

## Server-Side Debugging

If you need to debug the server-side:

1. Run the server with debugging enabled:

   ```bash
   DEBUG=ws,socket.io,engine node start-server.js
   ```

2. Check server logs for connection attempts:
   - Look for "New connection request" messages
   - Verify if clientType is being correctly identified
   - Check if messages are being received from clients

## Common Error Scenarios

### Connection Refused

This typically means the server is not running or not accessible on the specified port.

### Invalid Client Type

The server requires a valid clientType parameter ('flutter' or 'inspector'). Check the URL/headers you're using.

### Message Format Errors

If the connection is established but messages aren't flowing, check message format. All messages must be valid JSON and follow the JSON-RPC 2.0 format.

### WebSocket Protocol Errors

If you're seeing protocol errors, ensure you're using compatible WebSocket libraries and versions.

## Still Having Issues?

If you're still experiencing connection problems:

1. Try the test clients in this repository to verify server functionality
2. Enable additional debugging in the Flutter app to log all WebSocket traffic
3. Check browser developer tools Network tab for WebSocket errors
4. Consider network issues like VPNs, proxies, or firewalls that might interfere with WebSocket connections
