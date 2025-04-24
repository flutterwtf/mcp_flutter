// ignore_for_file: public_member_api_docs

import 'package:equatable/equatable.dart';
import 'package:flutter/foundation.dart';

/// Severity level of an error.
enum ErrorSeverity { warning, error, fatal }

/// Represents a Flutter error event.
class FlutterErrorEvent with EquatableMixin {
  /// The type of the error.
  FlutterErrorEvent({
    required this.type,
    required this.message,
    this.stackTrace,
    final DateTime? timestamp,
    this.severity = ErrorSeverity.error,
  }) : timestamp = timestamp ?? DateTime.now();

  final String type;
  final String message;
  final StackTrace? stackTrace;
  final DateTime timestamp;
  final ErrorSeverity severity;

  Map<String, dynamic> toJson() => {
    'type': type,
    'message': message,
    'stackTrace': stackTrace?.toString(),
    'timestamp': timestamp.toIso8601String(),
    'severity': severity.name,
  };

  @override
  List<Object?> get props => [type, message, stackTrace, severity];
}

/// A mixin that provides error monitoring capabilities.
/// Can be used with any class to add error monitoring functionality.
mixin ErrorMonitor {
  /// List of errors, recorded by [attachToFlutterError] and [handleZoneError]
  ///
  /// Add limitation with configurable latest 10 errors
  ///
  /// Set uses [LinkedHashSet] to store errors
  final errors = <FlutterErrorEvent>{};

  /// Initialize error monitoring
  void attachToFlutterError({final bool handleFlutterErrors = true}) {
    if (handleFlutterErrors) {
      final originalOnError = FlutterError.onError;
      FlutterError.onError = (final details) {
        originalOnError?.call(details);
        _handleError(
          FlutterErrorEvent(
            type: 'FlutterError',
            message: details.exceptionAsString(),
            stackTrace: details.stack,
          ),
        );
      };
    }
  }

  /// Handle uncaught error
  /// ```dart
  /// // Can be used with external error handling zones
  /// runZonedGuarded(
  ///   () => runApp(this),
  ///   (error, stack) {
  ///     // External error handling (e.g. Crashlytics)
  ///     FirebaseCrashlytics.instance.recordError(error, stack);
  ///     // Monitor errors in this app
  ///     McpBridge.instance.handleUncaughtError(error, stack);
  ///   },
  /// );
  /// ```
  void handleZoneError(final Object error, final StackTrace stack) {
    _handleError(
      FlutterErrorEvent(
        type: 'UncaughtException',
        message: error.toString(),
        stackTrace: stack,
        severity: ErrorSeverity.fatal,
      ),
    );
  }

  void _handleError(final FlutterErrorEvent event) => errors.add(event);
}
