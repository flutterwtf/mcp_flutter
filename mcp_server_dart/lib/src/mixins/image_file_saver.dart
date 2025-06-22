// Copyright (c) 2025, Flutter Inspector MCP Server authors.
// Licensed under the MIT License.

import 'dart:convert';
import 'dart:io';

import 'package:dart_mcp/server.dart';
import 'package:flutter_inspector_mcp_server/src/base_server.dart';
import 'package:path/path.dart' as path;

/// Class for saving images to files in a temporal folder.
class ImageFileSaver {
  /// Creates an ImageFileSaver instance.
  const ImageFileSaver({required this.server});

  /// The server instance for logging.
  final BaseMCPToolkitServer server;

  static const _temporalFolderName = '.mcp_screenshots';

  /// Gets the temporal folder path for saving images.
  String get _temporalFolderPath {
    final currentDir = Directory.current.path;
    return path.join(currentDir, _temporalFolderName);
  }

  /// Ensures the temporal folder exists.
  Future<Directory> _ensureTemporalFolder() async {
    final folder = Directory(_temporalFolderPath);
    if (!folder.existsSync()) {
      await folder.create(recursive: true);
      server.log(
        LoggingLevel.info,
        'Created temporal folder: ${folder.path}',
        logger: 'ImageFileSaver',
      );
    }
    return folder;
  }

  /// Saves a base64 image to a file and returns the file URL.
  Future<String> saveImageToFile(final String base64Image) async {
    final folder = await _ensureTemporalFolder();
    final timestamp = DateTime.now().toIso8601String().replaceAll(':', '-');
    final fileName = 'screenshot-$timestamp.png';
    final filePath = path.join(folder.path, fileName);

    try {
      final bytes = base64Decode(base64Image);
      final file = File(filePath);
      await file.writeAsBytes(bytes);

      final fileUrl = 'file://${file.absolute.path}';
      server.log(
        LoggingLevel.info,
        'Saved screenshot to: $filePath (${bytes.length} bytes) '
        '- URL: $fileUrl',
        logger: 'ImageFileSaver',
      );

      return fileUrl;
    } on Exception catch (e) {
      server.log(
        LoggingLevel.error,
        'Failed to save image to file: $e',
        logger: 'ImageFileSaver',
      );
      rethrow;
    }
  }

  /// Saves multiple base64 images to files and returns the file URLs.
  Future<List<String>> saveImagesToFiles(
    final List<String> base64Images,
  ) async {
    final fileUrls = <String>[];

    for (final image in base64Images) {
      try {
        final fileUrl = await saveImageToFile(image);
        fileUrls.add(fileUrl);
      } on Exception catch (e) {
        server.log(
          LoggingLevel.error,
          'Failed to save image to file: $e',
          logger: 'ImageFileSaver',
        );
        // Continue with other images instead of failing completely
      }
    }

    return fileUrls;
  }

  /// Cleans up old screenshot files (older than 24 hours).
  Future<void> cleanupOldScreenshots() async {
    try {
      final folder = Directory(_temporalFolderPath);
      if (!folder.existsSync()) return;

      final cutoffTime = DateTime.now().subtract(const Duration(hours: 24));
      final entities = await folder.list().toList();

      for (final entity in entities) {
        if (entity is File && entity.path.contains('screenshot-')) {
          final stat = entity.statSync();
          if (stat.modified.isBefore(cutoffTime)) {
            entity.deleteSync();
            server.log(
              LoggingLevel.debug,
              'Deleted old screenshot: ${entity.path}',
              logger: 'ImageFileSaver',
            );
          }
        }
      }
    } on Exception catch (e) {
      server.log(
        LoggingLevel.warning,
        'Failed to cleanup old screenshots: $e',
        logger: 'ImageFileSaver',
      );
    }
  }
}
