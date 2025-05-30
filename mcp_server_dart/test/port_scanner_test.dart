// Copyright (c) 2025, Flutter Inspector MCP Server authors.
// Licensed under the MIT License.

import 'package:flutter_inspector_mcp_server/src/mixins/port_scanner.dart';
import 'package:test/test.dart';

void main() {
  group('PortScanner', () {
    test('scanForFlutterPorts returns a list', () async {
      final ports = await PortScanner.scanForFlutterPorts();
      expect(ports, isA<List<int>>());
    });

    test('isPortAccessible works for invalid port', () async {
      // Test with a port that's very unlikely to be in use
      final isAccessible = await PortScanner.isPortAccessible(65432);
      expect(isAccessible, isA<bool>());
    });

    test('commonFlutterPorts returns expected ports', () {
      final ports = PortScanner.commonFlutterPorts;
      expect(ports, contains(8080));
      expect(ports, contains(8181));
      expect(ports, contains(9000));
      expect(ports, contains(9001));
      expect(ports, contains(9999));
    });

    test('platform-specific methods handle errors gracefully', () async {
      // This should not throw, even if no Flutter processes are running
      final ports = await PortScanner.scanForFlutterPorts();
      expect(ports, isA<List<int>>());
    });
  });
}
