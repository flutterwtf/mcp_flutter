// Copyright 2023 The Flutter Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file or at https://developers.google.com/open-source/licenses/bsd.

import 'package:collection/collection.dart';
import 'package:devtools_mcp_extension/core/devtools_core/shared/memory/class_name.dart';
import 'package:vm_service/vm_service.dart';

bool isPrimitiveInstanceKind(final String? kind) =>
    kind == InstanceKind.kBool ||
    kind == InstanceKind.kDouble ||
    kind == InstanceKind.kInt ||
    kind == InstanceKind.kNull ||
    kind == InstanceKind.kString;

Future<ClassRef?> findClass(
  final String? isolateId,
  final HeapClassName className,
) async {
  if (isolateId == null) return null;
  final service = serviceConnection.serviceManager.service;
  if (service == null) return null;
  final classes = await service.getClassList(isolateId);
  return classes.classes?.firstWhere(className.matches);
}

/// Finds instance in isolate by class and identityHashCode.
Future<InstanceRef?> findInstance(
  final String? isolateId,
  final String? classId,
  final int? hashCode,
) async {
  if (classId == null ||
      isolateId == null ||
      hashCode == null ||
      hashCode == 0) {
    return null;
  }

  final result = (await serviceConnection.serviceManager.service!.getInstances(
    isolateId,
    classId,
    preferences.memory.refLimit.value,
  )).instances?.firstWhereOrNull(
    (final instance) =>
        (instance is InstanceRef) && (instance.identityHashCode == hashCode),
  );

  if (result is InstanceRef) return result;
  return null;
}
