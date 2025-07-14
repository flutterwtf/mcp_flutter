// GENERATED CODE - DO NOT MODIFY BY HAND

// ignore_for_file: prefer_final_parameters

part of 'error_event.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$FlutterErrorEventToJson(_FlutterErrorEvent instance) =>
    <String, dynamic>{
      'renderFlexId': instance.renderFlexId,
      'renderedErrorText': instance.renderedErrorText,
      'nodeId': instance.nodeId,
      'type': instance.type,
      'message': instance.message,
      'timestamp': instance.timestamp.toIso8601String(),
      'severity': _$ErrorSeverityEnumMap[instance.severity],
    };

const _$ErrorSeverityEnumMap = {
  ErrorSeverity.warning: 'warning',
  ErrorSeverity.error: 'error',
  ErrorSeverity.fatal: 'fatal',
};
