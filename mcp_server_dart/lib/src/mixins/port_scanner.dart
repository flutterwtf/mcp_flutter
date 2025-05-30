// Copyright (c) 2025, Flutter Inspector MCP Server authors.
// Licensed under the MIT License.

import 'dart:io';

import 'package:from_json_to_json/from_json_to_json.dart';
import 'package:is_dart_empty_or_not/is_dart_empty_or_not.dart';

/// Cross-platform port scanner for detecting Flutter/Dart processes.
mixin PortScanner {
  /// Scan for ports where Flutter/Dart processes are listening
  static Future<List<int>> scanForFlutterPorts() async {
    try {
      if (Platform.isWindows) {
        return await _scanForFlutterPortsWindows();
      } else if (Platform.isLinux || Platform.isMacOS) {
        return await _scanForFlutterPortsUnix();
      } else {
        // Fallback for unsupported platforms
        return await _scanForFlutterPortsFallback();
      }
    } catch (e) {
      // If platform-specific scanning fails, try fallback
      try {
        return await _scanForFlutterPortsFallback();
      } catch (fallbackError) {
        // Return empty list if all methods fail
        return <int>[];
      }
    }
  }

  /// Unix-like systems port scanning using lsof
  static Future<List<int>> _scanForFlutterPortsUnix() async {
    final activePorts = <int>[];
    final result = await Process.run('lsof', ['-i', '-P', '-n']);

    if (result.exitCode != 0) {
      throw ProcessException(
        'lsof',
        ['-i', '-P', '-n'],
        'lsof command failed with exit code ${result.exitCode}',
        result.exitCode,
      );
    }

    final stdout = jsonDecodeString(result.stdout);
    final lines = stdout.split('\n');

    for (final line in lines) {
      if (line.toLowerCase().contains('dart') ||
          line.toLowerCase().contains('flutter')) {
        final parts = line.split(RegExp(r'\s+'));
        if (parts.length < 9) continue;
        final addressPart = parts[8];
        final portMatch = RegExp(r':(\d+)$').firstMatch(addressPart);
        if (portMatch == null) continue;
        final port = jsonDecodeInt(portMatch.group(1));
        if (port.isZero) continue;
        activePorts.add(port);
      }
    }

    return activePorts.toSet().toList();
  }

  /// Windows port scanning using netstat
  static Future<List<int>> _scanForFlutterPortsWindows() async {
    final activePorts = <int>[];

    // Use netstat to get listening ports with process names
    final result = await Process.run('netstat', ['-ano']);

    if (result.exitCode != 0) {
      throw ProcessException(
        'netstat',
        ['-ano'],
        'netstat command failed with exit code ${result.exitCode}',
        result.exitCode,
      );
    }

    final stdout = jsonDecodeString(result.stdout);
    final lines = stdout.split('\n');
    final dartProcessIds = <String>{};

    // First, get all Dart/Flutter process IDs using tasklist
    try {
      final tasklistResult = await Process.run('tasklist', ['/FO', 'CSV']);
      if (tasklistResult.exitCode == 0) {
        final tasklistOutput = jsonDecodeString(tasklistResult.stdout);
        final taskLines = tasklistOutput.split('\n');

        for (final line in taskLines) {
          if (line.toLowerCase().contains('dart') ||
              line.toLowerCase().contains('flutter')) {
            // Parse CSV format: "Image Name","PID","Session Name","Session#","Mem Usage"
            final csvMatch = RegExp(r'"[^"]*","(\d+)"').firstMatch(line);
            if (csvMatch != null) {
              dartProcessIds.add(csvMatch.group(1)!);
            }
          }
        }
      }
    } catch (e) {
      // If tasklist fails, fall back to pattern matching in netstat output
    }

    // Parse netstat output to find ports used by Dart/Flutter processes
    for (final line in lines) {
      if (!line.contains('LISTENING')) continue;

      final parts = line.trim().split(RegExp(r'\s+'));
      if (parts.length < 5) continue;

      final localAddress = parts[1];
      final processId = parts[4];

      // Check if this process ID belongs to a Dart/Flutter process
      if (dartProcessIds.isNotEmpty && !dartProcessIds.contains(processId)) {
        continue;
      }

      // Extract port from local address (format: IP:PORT)
      final portMatch = RegExp(r':(\d+)$').firstMatch(localAddress);
      if (portMatch == null) continue;

      final port = jsonDecodeInt(portMatch.group(1));
      if (port.isZero) continue;

      activePorts.add(port);
    }

    return activePorts.toSet().toList();
  }

  /// Fallback method for unsupported platforms or when other methods fail
  static Future<List<int>> _scanForFlutterPortsFallback() async {
    final commonFlutterPorts = [8080, 8181, 9000, 9001, 9999];
    final activePorts = <int>[];

    // Test common Flutter development ports
    for (final port in commonFlutterPorts) {
      try {
        final socket = await Socket.connect(
          'localhost',
          port,
          timeout: const Duration(milliseconds: 100),
        );
        await socket.close();
        activePorts.add(port);
      } catch (e) {
        // Port is not accessible, continue
      }
    }

    return activePorts;
  }

  /// Test if a specific port is accessible
  static Future<bool> isPortAccessible(final int port) async {
    try {
      final socket = await Socket.connect(
        'localhost',
        port,
        timeout: const Duration(milliseconds: 100),
      );
      await socket.close();
      return true;
    } catch (e) {
      return false;
    }
  }

  /// Get common Flutter development ports
  static List<int> get commonFlutterPorts => [8080, 8181, 9000, 9001, 9999];
}
