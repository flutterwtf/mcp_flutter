#!/usr/bin/env dart

import 'dart:convert';
import 'dart:io';

void main() async {
  print('🧪 Testing MCP Server Protocol');
  print('================================');

  // Test 1: Send initialization request
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

  print('Sending initialize request...');
  stdout.writeln(jsonEncode(initRequest));
  await stdout.flush();

  // Wait a moment
  await Future.delayed(Duration(milliseconds: 500));

  // Test 2: Send tools/list request
  final toolsRequest = {
    'jsonrpc': '2.0',
    'id': 2,
    'method': 'tools/list',
    'params': {},
  };

  print('Sending tools/list request...');
  stdout.writeln(jsonEncode(toolsRequest));
  await stdout.flush();

  // Wait for responses
  await Future.delayed(Duration(milliseconds: 500));

  // Test 3: Send resources/list request
  final resourcesRequest = {
    'jsonrpc': '2.0',
    'id': 3,
    'method': 'resources/list',
    'params': {},
  };

  print('Sending resources/list request...');
  stdout.writeln(jsonEncode(resourcesRequest));
  await stdout.flush();

  await Future.delayed(Duration(milliseconds: 500));

  print('Test requests sent. Check server responses above.');
  exit(0);
}
