import 'package:flutter/foundation.dart';

/// Severity level of an error.
enum ErrorSeverity { warning, error, fatal }

/// Represents a Flutter error event.
class FlutterErrorEvent {
  final String type;
  final String message;
  final StackTrace? stackTrace;
  final DateTime timestamp;
  final ErrorSeverity severity;

  FlutterErrorEvent({
    required this.type,
    required this.message,
    this.stackTrace,
    DateTime? timestamp,
    this.severity = ErrorSeverity.error,
  }) : timestamp = timestamp ?? DateTime.now();

  Map<String, dynamic> toJson() => {
    'type': type,
    'message': message,
    'stackTrace': stackTrace?.toString(),
    'timestamp': timestamp.toIso8601String(),
    'severity': severity.name,
  };
}

/// A mixin that provides error monitoring capabilities.
/// Can be used with any class to add error monitoring functionality.
mixin ErrorMonitor {
  static final errors = <FlutterErrorEvent>[];

  /// Initialize error monitoring
  void attachToFlutterError({bool handleFlutterErrors = true}) {
    if (handleFlutterErrors) {
      final originalOnError = FlutterError.onError;
      FlutterError.onError = (FlutterErrorDetails details) {
        originalOnError?.call(details);
        _handleError(
          FlutterErrorEvent(
            type: 'FlutterError',
            message: details.exceptionAsString(),
            stackTrace: details.stack,
            severity: ErrorSeverity.error,
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
  void handleZoneError(Object error, StackTrace stack) {
    _handleError(
      FlutterErrorEvent(
        type: 'UncaughtException',
        message: error.toString(),
        stackTrace: stack,
        severity: ErrorSeverity.fatal,
      ),
    );
  }

  void _handleError(FlutterErrorEvent event) => errors.add(event);
}
