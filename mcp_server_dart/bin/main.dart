#!/usr/bin/env dart

import 'dart:async';
import 'dart:convert';
import 'dart:io' as io;

import 'package:args/args.dart';
import 'package:async/async.dart';
import 'package:flutter_inspector_mcp_server/flutter_inspector_mcp_server.dart';
import 'package:stream_channel/stream_channel.dart';

void main(final List<String> args) async {
  final parsedArgs = argParser.parse(args);
  if (parsedArgs.flag(help)) {
    print(argParser.usage);
    io.exit(0);
  }

  await runZonedGuarded(
    () async {
      await FlutterInspectorMCPServer.connect(
        StreamChannel.withCloseGuarantee(io.stdin, io.stdout)
            .transform(StreamChannelTransformer.fromCodec(utf8))
            .transformStream(const LineSplitter())
            .transformSink(
              StreamSinkTransformer.fromHandlers(
                handleData: (final data, final sink) {
                  sink.add('$data\n');
                },
              ),
            ),
        dartVMHost: parsedArgs.option(dartVMHost) ?? 'localhost',
        dartVMPort: int.tryParse(parsedArgs.option(dartVMPort) ?? '') ?? 8181,
        resourcesSupported: parsedArgs.flag(resourcesSupported),
        imagesSupported: parsedArgs.flag(imagesSupported),
      );
    },
    (final e, final s) {
      // Log unhandled errors to stderr
      io.stderr
        ..writeln('Error: $e')
        ..writeln('Stack trace: $s');
    },
    zoneSpecification: ZoneSpecification(
      print: (_, _, _, final value) {
        // Don't allow print since this breaks stdio communication
        // Log to stderr instead
        io.stderr.writeln('Print intercepted: $value');
      },
    ),
  );
}

final argParser =
    ArgParser(allowTrailingOptions: false)
      ..addOption(
        dartVMHost,
        defaultsTo: 'localhost',
        help: 'Host for Dart VM connection',
      )
      ..addOption(
        dartVMPort,
        defaultsTo: '8181',
        help: 'Port for Dart VM connection',
      )
      ..addFlag(
        resourcesSupported,
        defaultsTo: true,
        help: 'Enable resources support for widget tree and screenshots',
      )
      ..addFlag(
        imagesSupported,
        defaultsTo: true,
        help: 'Enable images support for screenshots',
      )
      ..addFlag(help, abbr: 'h', help: 'Show usage text');

const dartVMHost = 'dart-vm-host';
const dartVMPort = 'dart-vm-port';
const resourcesSupported = 'resources-supported';
const imagesSupported = 'images-supported';
const help = 'help';
