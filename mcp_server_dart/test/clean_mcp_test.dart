#!/usr/bin/env dart

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:test/test.dart';

void main() {
  group('MCP Server Integration Tests', () {
    test('should initialize successfully', () async {
      final result = await _runServerTest((
        final requestSink,
        final responseStream,
      ) async {
        final initRequest = {
          'jsonrpc': '2.0',
          'id': 1,
          'method': 'initialize',
          'params': {
            'protocolVersion': '2024-11-05',
            'capabilities': {
              'roots': {'listChanged': true},
              'sampling': {},
            },
            'clientInfo': {'name': 'test-client', 'version': '1.0.0'},
          },
        };

        requestSink.add(jsonEncode(initRequest));

        final response = await responseStream.first.timeout(
          const Duration(seconds: 5),
          onTimeout: () => throw TimeoutException('No response received'),
        );

        expect(response['jsonrpc'], equals('2.0'));
        expect(
          response['id'],
          anyOf(equals(1), isNull),
        ); // Some servers may not return ID
        expect(response['result'], isNotNull);
        final result = response['result'] as Map<String, dynamic>;
        expect(result['protocolVersion'], isNotNull);
        expect(result['capabilities'], isNotNull);
      });

      expect(result, isTrue);
    });

    test('should list tools after initialization', () async {
      final result = await _runServerTest((
        final requestSink,
        final responseStream,
      ) async {
        final responses = <Map<String, dynamic>>[];
        final responseSubscription = responseStream.listen(responses.add);

        try {
          // First initialize
          final initRequest = {
            'jsonrpc': '2.0',
            'id': 1,
            'method': 'initialize',
            'params': {
              'protocolVersion': '2024-11-05',
              'capabilities': {
                'roots': {'listChanged': true},
                'sampling': {},
              },
              'clientInfo': {'name': 'test-client', 'version': '1.0.0'},
            },
          };

          requestSink.add(jsonEncode(initRequest));

          // Wait for init response
          await _waitForResponse(
            responses,
            (final r) => r['id'] == 1 || r['method'] == 'initialize',
          );

          // Then request tools list
          final toolsRequest = {
            'jsonrpc': '2.0',
            'id': 2,
            'method': 'tools/list',
            'params': {},
          };

          requestSink.add(jsonEncode(toolsRequest));

          // Wait for tools response
          final response = await _waitForResponse(
            responses,
            (final r) =>
                r['id'] == 2 ||
                (r.containsKey('result') &&
                    r['result'] is Map &&
                    (r['result'] as Map).containsKey('tools')),
          );

          expect(response['jsonrpc'], equals('2.0'));
          expect(response['result'], isNotNull);
          final result = response['result'] as Map<String, dynamic>;
          expect(result['tools'], isList);
        } finally {
          await responseSubscription.cancel();
        }
      });

      expect(result, isTrue);
    });

    test('should list resources after initialization', () async {
      final result = await _runServerTest((
        final requestSink,
        final responseStream,
      ) async {
        final responses = <Map<String, dynamic>>[];
        final responseSubscription = responseStream.listen(responses.add);

        try {
          // First initialize
          final initRequest = {
            'jsonrpc': '2.0',
            'id': 1,
            'method': 'initialize',
            'params': {
              'protocolVersion': '2024-11-05',
              'capabilities': {
                'roots': {'listChanged': true},
                'sampling': {},
              },
              'clientInfo': {'name': 'test-client', 'version': '1.0.0'},
            },
          };

          requestSink.add(jsonEncode(initRequest));

          // Wait for init response
          await _waitForResponse(
            responses,
            (final r) => r['id'] == 1 || r['method'] == 'initialize',
          );

          // Then request resources list
          final resourcesRequest = {
            'jsonrpc': '2.0',
            'id': 3,
            'method': 'resources/list',
            'params': {},
          };

          requestSink.add(jsonEncode(resourcesRequest));

          // Wait for resources response
          final response = await _waitForResponse(
            responses,
            (final r) =>
                r['id'] == 3 ||
                (r.containsKey('result') &&
                    r['result'] is Map &&
                    (r['result'] as Map).containsKey('resources')),
          );

          expect(response['jsonrpc'], equals('2.0'));
          expect(response['result'], isNotNull);
          final result = response['result'] as Map<String, dynamic>;
          expect(result['resources'], isList);
        } finally {
          await responseSubscription.cancel();
        }
      });

      expect(result, isTrue);
    });

    test('should handle invalid JSON-RPC requests', () async {
      final result = await _runServerTest((
        final requestSink,
        final responseStream,
      ) async {
        final invalidRequest = {
          'jsonrpc': '2.0',
          'id': 4,
          'method': 'invalid/method',
          'params': {},
        };

        requestSink.add(jsonEncode(invalidRequest));

        final response = await responseStream.first.timeout(
          const Duration(seconds: 5),
          onTimeout: () => throw TimeoutException('No error response'),
        );

        expect(response['jsonrpc'], equals('2.0'));
        expect(response['id'], anyOf(equals(4), isNull));
        expect(response['error'], isNotNull);
        final error = response['error'] as Map<String, dynamic>;
        expect(error['code'], isA<int>());
        expect(error['message'], isA<String>());
      });

      expect(result, isTrue);
    });

    test('should handle malformed JSON requests gracefully', () async {
      final result = await _runServerTest((
        final requestSink,
        final responseStream,
      ) async {
        const malformedJson =
            '{"jsonrpc": "2.0", "id": 5, "method": "test"'; // Missing closing brace

        requestSink.add(malformedJson);

        // Server should either respond with a parse error or ignore malformed JSON
        // We'll wait a short time to see if there's a response
        try {
          final response = await responseStream.first.timeout(
            const Duration(seconds: 2),
          );

          // If we get a response, it should be an error
          expect(response['jsonrpc'], equals('2.0'));
          expect(response['error'], isNotNull);
          final error = response['error'] as Map<String, dynamic>;
          expect(error['code'], equals(-32700)); // Parse error
        } on TimeoutException {
          // It's also acceptable for the server to ignore malformed JSON
          // This is valid behavior according to JSON-RPC spec
        }
      });

      expect(result, isTrue);
    });

    test('should handle requests without initialization', () async {
      final result = await _runServerTest((
        final requestSink,
        final responseStream,
      ) async {
        final toolsRequest = {
          'jsonrpc': '2.0',
          'id': 6,
          'method': 'tools/list',
          'params': {},
        };

        requestSink.add(jsonEncode(toolsRequest));

        final response = await responseStream.first.timeout(
          const Duration(seconds: 5),
          onTimeout:
              () =>
                  throw TimeoutException(
                    'No response to uninitialized request',
                  ),
        );

        expect(response['jsonrpc'], equals('2.0'));
        expect(response['id'], anyOf(equals(6), isNull));
        // Should either return an error or handle gracefully
        expect(
          response.containsKey('result') || response.containsKey('error'),
          isTrue,
        );
      });

      expect(result, isTrue);
    });
  });
}

/// Helper function to run a test with a fresh server process
Future<bool> _runServerTest(
  final Future<void> Function(
    StreamSink<String> requestSink,
    Stream<Map<String, dynamic>> responseStream,
  )
  testFunction,
) async {
  Process? serverProcess;
  StreamController<String>? requestController;

  try {
    // Start the MCP server process
    serverProcess = await Process.start('dart', [
      'run',
      'bin/main.dart',
    ], workingDirectory: Directory.current.path);

    // Set up request controller for sending to server's stdin
    requestController = StreamController<String>();
    requestController.stream
        .map((final request) => '$request\n')
        .listen(
          serverProcess.stdin.writeln,
          onError: (final error) => print('Request error: $error'),
        );

    // Set up response stream from server's stdout as a broadcast stream
    final responseStream =
        serverProcess.stdout
            .transform(utf8.decoder)
            .transform(const LineSplitter())
            .where((final line) => line.trim().isNotEmpty)
            .map((final line) {
              try {
                return jsonDecode(line) as Map<String, dynamic>;
              } catch (e) {
                throw FormatException('Invalid JSON response: $line');
              }
            })
            .asBroadcastStream();

    // Handle server errors (but don't fail the test)
    serverProcess.stderr
        .transform(utf8.decoder)
        .listen((final error) => print('Server stderr: $error'));

    // Give the server a moment to start up
    await Future.delayed(const Duration(milliseconds: 500));

    // Run the actual test
    await testFunction(requestController.sink, responseStream);

    return true;
  } catch (e) {
    print('Test failed with error: $e');
    return false;
  } finally {
    // Clean up
    await requestController?.close();
    serverProcess?.kill();
    if (serverProcess != null) {
      try {
        await serverProcess.exitCode.timeout(const Duration(seconds: 2));
      } catch (e) {
        serverProcess.kill(ProcessSignal.sigkill);
      }
    }
  }
}

/// Helper function to wait for a specific response
Future<Map<String, dynamic>> _waitForResponse(
  final List<Map<String, dynamic>> responses,
  final bool Function(Map<String, dynamic>) condition,
) async {
  const maxWaitTime = Duration(seconds: 10);
  const checkInterval = Duration(milliseconds: 100);
  final startTime = DateTime.now();

  while (DateTime.now().difference(startTime) < maxWaitTime) {
    for (int i = 0; i < responses.length; i++) {
      if (condition(responses[i])) {
        return responses.removeAt(i); // Remove and return the matching response
      }
    }
    await Future.delayed(checkInterval);
  }

  throw TimeoutException('No matching response found within timeout period');
}
