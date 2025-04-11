import 'package:vm_service/vm_service.dart';

/// Represents the severity level of an error.
enum ErrorSeverity {
  /// A warning that doesn't affect functionality but should be addressed.
  warning,

  /// An error that affects functionality but doesn't crash the app.
  error,

  /// A severe error that crashes or severely impacts the app.
  fatal,
}

/// Represents a Flutter error event with diagnostic information.
class FlutterErrorEvent {
  /// Creates a new [FlutterErrorEvent] instance.
  FlutterErrorEvent({
    required this.type,
    required this.message,
    required this.timestamp,
    this.diagnostics,
    this.stackTrace,
    this.severity = ErrorSeverity.error,
  });

  /// The type of error (e.g., 'Flutter Error', 'VM Error').
  final String type;

  /// The error message.
  final String message;

  /// Diagnostic information about the error.
  final Instance? diagnostics;

  /// The stack trace of the error, if available.
  final StackTrace? stackTrace;

  /// When the error occurred.
  final DateTime timestamp;

  /// The severity level of the error.
  final ErrorSeverity severity;

  @override
  String toString() =>
      'FlutterErrorEvent(type: $type, message: $message, severity: $severity, timestamp: $timestamp)';
}
