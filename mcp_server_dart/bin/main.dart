#!/usr/bin/env dart
// ignore_for_file: do_not_use_environment

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
      final VMServiceConfiguration configuration = (
        vmHost:
            parsedArgs.option(dartVMHost) ??
            const String.fromEnvironment(
              'DART_VM_HOST',
              defaultValue: 'localhost',
            ),
        vmPort:
            int.tryParse(
              parsedArgs.option(dartVMPort) ??
                  const String.fromEnvironment(
                    'DART_VM_PORT',
                    defaultValue: '8181',
                  ),
            ) ??
            8181,
        resourcesSupported: parsedArgs.flag(resourcesSupported),
        imagesSupported: parsedArgs.flag(imagesSupported),
        dumpsSupported: parsedArgs.flag(dumpsSupported),
        logLevel:
            parsedArgs.option(logLevel) ??
            const String.fromEnvironment('LOG_LEVEL', defaultValue: 'critical'),
        environment:
            parsedArgs.option(environment) ??
            const String.fromEnvironment(
              'NODE_ENV',
              defaultValue: 'production',
            ),
      );
      await MCPToolkitServer.connect(
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
        configuration: configuration,
      );
    },
    (final e, final s) {
      io.stderr
        ..writeln('Error: $e')
        ..writeln('Stack trace: $s');
    },
    zoneSpecification: ZoneSpecification(
      print: (_, _, _, final value) {
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
        defaultsTo: const bool.fromEnvironment(
          'RESOURCES_SUPPORTED',
          defaultValue: true,
        ),
        help: 'Enable resources support for widget tree and screenshots',
      )
      ..addFlag(
        imagesSupported,
        defaultsTo: const bool.fromEnvironment(
          'IMAGES_SUPPORTED',
          defaultValue: true,
        ),
        help: 'Enable images support for screenshots',
      )
      ..addFlag(
        dumpsSupported,
        defaultsTo: const bool.fromEnvironment(
          'DUMPS_SUPPORTED',
          defaultValue: true,
        ),
        help: 'Enable debug dump operations',
      )
      ..addOption(
        logLevel,
        defaultsTo: 'critical',
        help:
            'Logging level (debug|info|notice|warning|error|critical|alert|emergency)',
      )
      ..addOption(
        environment,
        defaultsTo: 'production',
        help: 'Environment mode (development|production)',
      )
      ..addFlag(help, abbr: 'h', help: 'Show usage text');

const dartVMHost = 'dart-vm-host';
const dartVMPort = 'dart-vm-port';
const resourcesSupported = 'resources-supported';
const imagesSupported = 'images-supported';
const dumpsSupported = 'dumps-supported';
const logLevel = 'log-level';
const environment = 'environment';
const help = 'help';
