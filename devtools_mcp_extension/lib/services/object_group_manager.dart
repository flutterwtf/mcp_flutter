import 'package:uuid/uuid.dart';
import 'package:vm_service/vm_service.dart';

class ObjectGroup {
  ObjectGroup({
    required this.debugName,
    required final VmService vmService,
    required final String isolateId,
  }) : _vmService = vmService,
       _isolateId = isolateId {
    groupName = const Uuid().v4();
  }

  final String debugName;
  final VmService _vmService;
  final String _isolateId;
  late final String groupName;
  var _disposed = false;

  bool get disposed => _disposed;

  Future<void> dispose() async {
    if (_disposed) {
      return;
    }
    try {
      await _vmService.callServiceExtension(
        'ext.flutter.inspector.disposeGroup',
        isolateId: _isolateId,
        args: {'groupName': groupName},
      );
    } catch (e) {
      // Log the error, but don't rethrow.
      print('Error disposing object group $groupName: $e');
    } finally {
      _disposed = true;
    }
  }
}

class ObjectGroupManager {
  ObjectGroupManager({
    required final String debugName,
    required final VmService vmService,
    required final String isolateId,
  }) : _debugName = debugName,
       _vmService = vmService,
       _isolateId = isolateId;

  final String _debugName;
  final VmService _vmService;
  final String _isolateId;

  ObjectGroup? _current;
  ObjectGroup? _next;

  ObjectGroup get next {
    if (_next != null) {
      // If _next was previously disposed, create a new one.
      if (_next!.disposed) {
        _next = ObjectGroup(
          debugName: _debugName,
          vmService: _vmService,
          isolateId: _isolateId,
        );
      }
      return _next!;
    }
    _next = ObjectGroup(
      debugName: _debugName,
      vmService: _vmService,
      isolateId: _isolateId,
    );
    return _next!;
  }

  Future<void> promoteNext() async {
    await _current?.dispose();
    _current = _next;
    _next = null;
  }

  Future<void> cancelNext() async {
    await _next?.dispose();
    _next = null;
  }

  Future<void> dispose() async {
    await _current?.dispose();
    await _next?.dispose();
    _current = null;
    _next = null;
  }
}
