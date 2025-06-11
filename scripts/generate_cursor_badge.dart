import 'dart:convert';
import 'dart:io';

import 'package:args/args.dart';

void main(List<String> arguments) {
  final parser =
      ArgParser()
        ..addOption(
          'name',
          abbr: 'n',
          help: 'The server name for the Cursor deeplink',
          mandatory: false,
        )
        ..addOption(
          'config',
          abbr: 'c',
          help: 'The JSON configuration string for the MCP server',
          mandatory: false,
        );

  ArgResults argResults;
  try {
    argResults = parser.parse(arguments);
  } on ArgParserException catch (e) {
    print('Error parsing arguments: ${e.message}');
    print(parser.usage);
    exit(64); // Command line usage error
  }

  final serverName = argResults['name'] as String? ?? 'flutter-inspector';
  final configStr =
      argResults['config'] as String? ??
      '''
{
  "${serverName}": {
    "command": "/path/to/your/cloned/mcp_flutter/mcp_server_dart/build/flutter_inspector_mcp",
    "args": [
      "--dart-vm-host=localhost",
      "--dart-vm-port=8181",
      "--no-resources",
      "--images"
    ],
    "env": {},
    "disabled": false
  }
}
''';

  dynamic parsedJson;
  try {
    parsedJson = jsonDecode(configStr);
  } on FormatException catch (e) {
    print(
      'Error: Invalid JSON configuration string provided for --config: ${e.message}',
    );
    exit(1);
  }

  // Re-encode to ensure compact and valid JSON, then base64 encode
  // dart:convert's jsonEncode is generally compact.
  final compactJsonStr = jsonEncode(parsedJson);
  final base64Config = base64.encode(utf8.encode(compactJsonStr));

  final markdownTemplate =
      "[![Add to Cursor](https://img.shields.io/badge/Add%20to-Cursor-blue?style=for-the-badge&logo=cursor)](cursor://anysphere.cursor-deeplink/mcp/install?name=${serverName}&config=${base64Config})";

  print(markdownTemplate);
}
