import 'package:equatable/equatable.dart';
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
class FlutterErrorEvent with EquatableMixin {
  /// Creates a new [FlutterErrorEvent] instance.
  FlutterErrorEvent({
    required this.type,
    required this.message,
    required this.timestamp,
    required this.nodeId,
    required this.json,
    this.diagnostics,
    this.stackTrace,
    this.severity = ErrorSeverity.error,
  });

  /// The JSON data associated with the error event.
  final Map<String, dynamic> json;

  /// The unique identifier for the error event.
  final String nodeId;

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

  /// The ID of the RenderFlex widget that caused the error.
  String get renderFlexId {
    final renderedErrorText = json['renderedErrorText'];
    final idMatch = RegExp(
      'RenderFlex#([a-f0-9]+)',
    ).firstMatch(renderedErrorText ?? '');

    final id = idMatch?.group(1);

    return id ?? '';
  }

  String get renderedErrorText => json['renderedErrorText'] ?? '';
  Map<String, dynamic> toJson() => {
    'type': type,
    'message': message,
    'severity': severity,
    'timestamp': timestamp,
    'renderFlexId': renderFlexId,
    'renderedErrorText': renderedErrorText,
  };

  @override
  String toString() => 'FlutterErrorEvent(${toJson()})';

  @override
  List<Object?> get props => [type, message, renderFlexId];
}
