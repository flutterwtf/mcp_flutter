// Copyright (c) 2025, Flutter Inspector MCP Server authors.
// Licensed under the MIT License.

// ignore_for_file: avoid_catches_without_on_clauses

import 'dart:io';

import 'package:dart_mcp/server.dart';
import 'package:flutter_inspector_mcp_server/src/base_server.dart';
import 'package:from_json_to_json/from_json_to_json.dart';
import 'package:is_dart_empty_or_not/is_dart_empty_or_not.dart';

/// Cross-platform port scanner for detecting Flutter/Dart processes.
class PortScanner {
  const PortScanner({required this.server});

  final BaseMCPToolkitServer server;
  void log(final LoggingLevel level, final String message) =>
      server.log(level, message, logger: 'PortScanner');

  /// Scan for ports where Flutter/Dart processes are listening
  Future<List<int>> scanForFlutterPorts() async {
    try {
      if (Platform.isWindows) {
        log(LoggingLevel.info, 'Using Windows port scanning method');
        return await _scanForFlutterPortsWindows();
      } else if (Platform.isLinux || Platform.isMacOS) {
        log(
          LoggingLevel.info,
          'Using Unix port scanning method (${Platform.operatingSystem})',
        );
        return await _scanForFlutterPortsUnix();
      } else {
        log(
          LoggingLevel.warning,
          'Unsupported platform ${Platform.operatingSystem}, '
          'using fallback method',
        );
        return await _scanForFlutterPortsFallback();
      }
    } on Exception catch (e) {
      log(LoggingLevel.error, 'Platform-specific scanning failed: $e');
      try {
        log(LoggingLevel.info, 'Attempting fallback port scanning method');
        return await _scanForFlutterPortsFallback();
      } on Exception catch (fallbackError) {
        log(
          LoggingLevel.error,
          'Fallback port scanning also failed: $fallbackError',
        );
        return <int>[];
      }
    }
  }

  /// Unix-like systems port scanning using lsof
  Future<List<int>> _scanForFlutterPortsUnix() async {
    log(LoggingLevel.debug, 'Starting Unix port scan using lsof');

    final activePorts = <int>[];
    final result = await Process.run('lsof', ['-i', '-P', '-n']);

    if (result.exitCode != 0) {
      final errorMsg = 'lsof command failed with exit code ${result.exitCode}';
      log(LoggingLevel.error, errorMsg);
      throw ProcessException(
        'lsof',
        ['-i', '-P', '-n'],
        errorMsg,
        result.exitCode,
      );
    }

    final stdout = jsonDecodeString(result.stdout);
    final lines = stdout.split('\n');
    log(
      LoggingLevel.debug,
      'Processing ${lines.length} lines from lsof output',
    );

    var dartProcessCount = 0;
    for (final line in lines) {
      if (line.toLowerCase().contains('dart') ||
          line.toLowerCase().contains('flutter')) {
        dartProcessCount++;
        final parts = line.split(RegExp(r'\s+'));
        if (parts.length < 9) {
          log(
            LoggingLevel.debug,
            'Skipping malformed line: insufficient parts (${parts.length})',
          );
          continue;
        }
        final addressPart = parts[8];
        final portMatch = RegExp(r':(\d+)$').firstMatch(addressPart);
        if (portMatch == null) {
          log(LoggingLevel.debug, 'No port found in address: $addressPart');
          continue;
        }
        final port = jsonDecodeInt(portMatch.group(1));
        if (port.isZero) {
          log(LoggingLevel.debug, 'Invalid port number: ${portMatch.group(1)}');
          continue;
        }
        log(LoggingLevel.debug, 'Found Dart/Flutter process on port $port');
        activePorts.add(port);
      }
    }

    final uniquePorts = activePorts.toSet().toList();
    log(
      LoggingLevel.info,
      'Unix scan completed: found $dartProcessCount Dart/Flutter processes, ${uniquePorts.length} unique ports',
    );
    return uniquePorts;
  }

  /// Windows port scanning using netstat
  Future<List<int>> _scanForFlutterPortsWindows() async {
    log(LoggingLevel.debug, 'Starting Windows port scan using netstat');

    final activePorts = <int>[];
    final result = await Process.run('netstat', ['-ano']);

    if (result.exitCode != 0) {
      final errorMsg =
          'netstat command failed with exit code ${result.exitCode}';
      log(LoggingLevel.error, errorMsg);
      throw ProcessException('netstat', ['-ano'], errorMsg, result.exitCode);
    }

    final stdout = jsonDecodeString(result.stdout);
    final lines = stdout.split('\n');
    final dartProcessIds = <String>{};

    log(LoggingLevel.debug, 'Getting Dart/Flutter process IDs using tasklist');
    try {
      final tasklistResult = await Process.run('tasklist', ['/FO', 'CSV']);
      if (tasklistResult.exitCode == 0) {
        final tasklistOutput = jsonDecodeString(tasklistResult.stdout);
        final taskLines = tasklistOutput.split('\n');

        for (final line in taskLines) {
          if (line.toLowerCase().contains('dart') ||
              line.toLowerCase().contains('flutter')) {
            final csvMatch = RegExp(r'"[^"]*","(\d+)"').firstMatch(line);
            if (csvMatch != null) {
              dartProcessIds.add(csvMatch.group(1)!);
              log(
                LoggingLevel.debug,
                'Found Dart/Flutter process ID: ${csvMatch.group(1)}',
              );
            }
          }
        }
        log(
          LoggingLevel.debug,
          'Found ${dartProcessIds.length} Dart/Flutter process IDs',
        );
      } else {
        log(
          LoggingLevel.warning,
          'tasklist command failed with exit code ${tasklistResult.exitCode}',
        );
      }
    } on Exception catch (e) {
      log(
        LoggingLevel.warning,
        'tasklist failed, falling back to pattern matching: $e',
      );
    }

    log(
      LoggingLevel.debug,
      'Processing ${lines.length} lines from netstat output',
    );
    var listeningPortCount = 0;
    for (final line in lines) {
      if (!line.contains('LISTENING')) continue;
      listeningPortCount++;

      final parts = line.trim().split(RegExp(r'\s+'));
      if (parts.length < 5) {
        log(
          LoggingLevel.debug,
          'Skipping malformed netstat line: '
          'insufficient parts (${parts.length})',
        );
        continue;
      }

      final localAddress = parts[1];
      final processId = parts[4];

      if (dartProcessIds.isNotEmpty && !dartProcessIds.contains(processId)) {
        continue;
      }

      final portMatch = RegExp(r':(\d+)$').firstMatch(localAddress);
      if (portMatch == null) {
        log(LoggingLevel.debug, 'No port found in address: $localAddress');
        continue;
      }

      final port = jsonDecodeInt(portMatch.group(1));
      if (port.isZero) {
        log(LoggingLevel.debug, 'Invalid port number: ${portMatch.group(1)}');
        continue;
      }

      log(
        LoggingLevel.debug,
        'Found Dart/Flutter process (PID: $processId) on port $port',
      );
      activePorts.add(port);
    }

    final uniquePorts = activePorts.toSet().toList();
    log(
      LoggingLevel.info,
      'Windows scan completed: processed $listeningPortCount listening ports, found ${uniquePorts.length} Dart/Flutter ports',
    );
    return uniquePorts;
  }

  /// Fallback method for unsupported platforms or when other methods fail
  Future<List<int>> _scanForFlutterPortsFallback() async {
    log(LoggingLevel.debug, 'Starting fallback port scan');

    final commonFlutterPorts = [8080, 8181, 9000, 9001, 9999];
    final activePorts = <int>[];

    log(
      LoggingLevel.debug,
      'Testing ${commonFlutterPorts.length} common Flutter development ports',
    );
    for (final port in commonFlutterPorts) {
      try {
        log(LoggingLevel.debug, 'Testing port $port');
        final socket = await Socket.connect(
          'localhost',
          port,
          timeout: const Duration(milliseconds: 100),
        );
        await socket.close();
        log(LoggingLevel.debug, 'Port $port is accessible');
        activePorts.add(port);
      } on Exception catch (e) {
        log(LoggingLevel.debug, 'Port $port is not accessible: $e');
      }
    }

    log(
      LoggingLevel.info,
      'Fallback scan completed: found ${activePorts.length} accessible ports',
    );
    return activePorts;
  }

  /// Test if a specific port is accessible
  Future<bool> isPortAccessible(final int port) async {
    try {
      final socket = await Socket.connect(
        'localhost',
        port,
        timeout: const Duration(milliseconds: 100),
      );
      log(LoggingLevel.debug, 'Port $port is accessible');
      await socket.close();
      return true;
    } catch (e, stackTrace) {
      log(LoggingLevel.debug, 'Port $port is not accessible: $e\n$stackTrace');
      return false;
    }
  }

  /// Get common Flutter development ports
  List<int> get commonFlutterPorts {
    log(LoggingLevel.debug, 'Returning common Flutter development ports');
    return [8080, 8181, 9000, 9001, 9999];
  }
}
