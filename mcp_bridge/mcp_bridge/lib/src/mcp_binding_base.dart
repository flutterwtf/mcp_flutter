// part of this code is from the Flutter framework and
// modified for the MCP Bridge
//
// Copyright 2014 The Flutter Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import 'dart:convert';
import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

///
abstract class McpBridgeBindingBase {
  /// Default abstract constructor for bindings.
  ///
  /// First calls [initInstances] to have bindings initialize their
  /// instance pointers and other state, then calls
  /// [initServiceExtensions] to have bindings initialize their
  /// VM service extensions, if any.
  McpBridgeBindingBase();

  /// Called when the binding is initialized, to register service
  /// extensions.
  ///
  /// Bindings that want to expose service extensions should overload
  /// this method to register them using calls to
  /// [registerSignalServiceExtension],
  /// [registerBoolServiceExtension],
  /// [registerNumericServiceExtension], and
  /// [registerServiceExtension] (in increasing order of complexity).
  ///
  /// Implementations of this method must call their superclass
  /// implementation.
  ///
  /// {@macro flutter.foundation.BindingBase.registerServiceExtension}
  ///
  /// See also:
  ///
  ///  * <https://github.com/dart-lang/sdk/blob/main/runtime/vm/service/service.md#rpcs-requests-and-responses>
  @protected
  @mustCallSuper
  void initServiceExtensions() {
    assert(!_debugServiceExtensionsRegistered);

    assert(() {
      registerSignalServiceExtension(
        name: FoundationServiceExtensions.reassemble.name,
        callback: reassembleApplication,
      );
      return true;
    }());

    if (!kReleaseMode) {
      if (!kIsWeb) {
        registerSignalServiceExtension(
          name: FoundationServiceExtensions.exit.name,
          callback: _exitApplication,
        );
      }
      // These service extensions are used in profile mode applications.
      registerStringServiceExtension(
        name: FoundationServiceExtensions.connectedVmServiceUri.name,
        getter: () async => connectedVmServiceUri ?? '',
        setter: (final uri) async {
          connectedVmServiceUri = uri;
        },
      );
      registerStringServiceExtension(
        name: FoundationServiceExtensions.activeDevToolsServerAddress.name,
        getter: () async => activeDevToolsServerAddress ?? '',
        setter: (final serverAddress) async {
          activeDevToolsServerAddress = serverAddress;
        },
      );
    }

    assert(() {
      registerServiceExtension(
        name: FoundationServiceExtensions.platformOverride.name,
        callback: (final parameters) async {
          if (parameters.containsKey('value')) {
            final String value = parameters['value']!;
            debugDefaultTargetPlatformOverride = null;
            for (final TargetPlatform candidate in TargetPlatform.values) {
              if (candidate.name == value) {
                debugDefaultTargetPlatformOverride = candidate;
                break;
              }
            }
            _postExtensionStateChangedEvent(
              FoundationServiceExtensions.platformOverride.name,
              defaultTargetPlatform.name,
            );
            await reassembleApplication();
          }
          return <String, dynamic>{'value': defaultTargetPlatform.name};
        },
      );

      registerServiceExtension(
        name: FoundationServiceExtensions.brightnessOverride.name,
        callback: (final parameters) async {
          if (parameters.containsKey('value')) {
            debugBrightnessOverride = switch (parameters['value']) {
              'Brightness.light' => ui.Brightness.light,
              'Brightness.dark' => ui.Brightness.dark,
              _ => null,
            };
            _postExtensionStateChangedEvent(
              FoundationServiceExtensions.brightnessOverride.name,
              (debugBrightnessOverride ?? platformDispatcher.platformBrightness)
                  .toString(),
            );
            await reassembleApplication();
          }
          return <String, dynamic>{
            'value':
                (debugBrightnessOverride ??
                        platformDispatcher.platformBrightness)
                    .toString(),
          };
        },
      );
      return true;
    }());
    assert(() {
      _debugServiceExtensionsRegistered = true;
      return true;
    }());
  }

  /// Registers a service extension method with the given name (full
  /// name "ext.flutter.name"), which takes no arguments and returns
  /// no value.
  ///
  /// Calls the `callback` callback when the service extension is called.
  ///
  /// {@macro flutter.foundation.BindingBase.registerServiceExtension}
  @protected
  void registerSignalServiceExtension({
    required final String name,
    required final AsyncCallback callback,
  }) {
    registerServiceExtension(
      name: name,
      callback: (final parameters) async {
        await callback();
        return <String, dynamic>{};
      },
    );
  }

  /// Registers a service extension method with the given name (full
  /// name "ext.flutter.name"), which takes a single argument
  /// "enabled" which can have the value "true" or the value "false"
  /// or can be omitted to read the current value. (Any value other
  /// than "true" is considered equivalent to "false". Other arguments
  /// are ignored.)
  ///
  /// Calls the `getter` callback to obtain the value when
  /// responding to the service extension method being called.
  ///
  /// Calls the `setter` callback with the new value when the
  /// service extension method is called with a new value.
  ///
  /// {@macro flutter.foundation.BindingBase.registerServiceExtension}
  @protected
  void registerBoolServiceExtension({
    required final String name,
    required final AsyncValueGetter<bool> getter,
    required final AsyncValueSetter<bool> setter,
  }) {
    registerServiceExtension(
      name: name,
      callback: (final parameters) async {
        if (parameters.containsKey('enabled')) {
          await setter(parameters['enabled'] == 'true');
          _postExtensionStateChangedEvent(
            name,
            await getter() ? 'true' : 'false',
          );
        }
        return <String, dynamic>{'enabled': await getter() ? 'true' : 'false'};
      },
    );
  }

  /// Registers a service extension method with the given name (full
  /// name "ext.flutter.name"), which takes a single argument with the
  /// same name as the method which, if present, must have a value
  /// that can be parsed by [double.parse], and can be omitted to read
  /// the current value. (Other arguments are ignored.)
  ///
  /// Calls the `getter` callback to obtain the value when
  /// responding to the service extension method being called.
  ///
  /// Calls the `setter` callback with the new value when the
  /// service extension method is called with a new value.
  ///
  /// {@macro flutter.foundation.BindingBase.registerServiceExtension}
  @protected
  void registerNumericServiceExtension({
    required final String name,
    required final AsyncValueGetter<double> getter,
    required final AsyncValueSetter<double> setter,
  }) {
    registerServiceExtension(
      name: name,
      callback: (final parameters) async {
        if (parameters.containsKey(name)) {
          await setter(double.parse(parameters[name]!));
          _postExtensionStateChangedEvent(name, (await getter()).toString());
        }
        return <String, dynamic>{name: (await getter()).toString()};
      },
    );
  }

  /// Sends an event when a service extension's state is changed.
  ///
  /// Clients should listen for this event to stay aware of the current service
  /// extension state. Any service extension that manages a state should call
  /// this method on state change.
  ///
  /// `value` reflects the newly updated service extension value.
  ///
  /// This will be called automatically for service extensions registered via
  /// [registerBoolServiceExtension], [registerNumericServiceExtension], or
  /// [registerStringServiceExtension].
  void _postExtensionStateChangedEvent(final String name, final value) {
    postEvent('Flutter.ServiceExtensionStateChanged', <String, dynamic>{
      'extension': 'ext.flutter.$name',
      'value': value,
    });
  }

  /// All events dispatched by a [BindingBase] use this method instead of
  /// calling [developer.postEvent] directly so that tests for [BindingBase]
  /// can track which events were dispatched by overriding this method.
  ///
  /// This is unrelated to the events managed by [lockEvents].
  @protected
  void postEvent(final String eventKind, final Map<String, dynamic> eventData) {
    developer.postEvent(eventKind, eventData);
  }

  /// Registers a service extension method with the given name (full name
  /// "ext.flutter.name"), which optionally takes a single argument with the
  /// name "value". If the argument is omitted, the value is to be read,
  /// otherwise it is to be set. Returns the current value.
  ///
  /// Calls the `getter` callback to obtain the value when
  /// responding to the service extension method being called.
  ///
  /// Calls the `setter` callback with the new value when the
  /// service extension method is called with a new value.
  ///
  /// {@macro flutter.foundation.BindingBase.registerServiceExtension}
  @protected
  void registerStringServiceExtension({
    required final String name,
    required final AsyncValueGetter<String> getter,
    required final AsyncValueSetter<String> setter,
  }) {
    registerServiceExtension(
      name: name,
      callback: (final parameters) async {
        if (parameters.containsKey('value')) {
          await setter(parameters['value']!);
          _postExtensionStateChangedEvent(name, await getter());
        }
        return <String, dynamic>{'value': await getter()};
      },
    );
  }

  /// Registers a service extension method with the given name (full name
  /// "ext.flutter.name").
  ///
  /// The given callback is called when the extension method is called. The
  /// callback must return a [Future] that either eventually completes to a
  /// return value in the form of a name/value map where the values can all be
  /// converted to JSON using `json.encode()` (see [JsonEncoder]), or fails. In
  /// case of failure, the failure is reported to the remote caller and is
  /// dumped to the logs.
  ///
  /// The returned map will be mutated.
  ///
  /// {@template flutter.foundation.BindingBase.registerServiceExtension}
  /// A registered service extension can only be activated if the vm-service
  /// is included in the build, which only happens in debug and profile mode.
  /// Although a service extension cannot be used in release mode its code may
  /// still be included in the Dart snapshot and blow up binary size if it is
  /// not wrapped in a guard that allows the tree shaker to remove it (see
  /// sample code below).
  ///
  /// {@tool snippet}
  /// The following code registers a service extension that is only included in
  /// debug builds.
  ///
  /// ```dart
  /// void myRegistrationFunction() {
  ///   assert(() {
  ///     // Register your service extension here.
  ///     return true;
  ///   }());
  /// }
  /// ```
  /// {@end-tool}
  ///
  /// {@tool snippet}
  /// A service extension registered with the following code snippet is
  /// available in debug and profile mode.
  ///
  /// ```dart
  /// void myOtherRegistrationFunction() {
  ///   // kReleaseMode is defined in the 'flutter/foundation.dart' package.
  ///   if (!kReleaseMode) {
  ///     // Register your service extension here.
  ///   }
  /// }
  /// ```
  /// {@end-tool}
  ///
  /// Both guards ensure that Dart's tree shaker can remove the code for the
  /// service extension in release builds.
  /// {@endtemplate}
  @protected
  void registerServiceExtension({
    required final String name,
    required final ServiceExtensionCallback callback,
  }) {
    final String methodName = 'ext.flutter.$name';
    developer.registerExtension(methodName, (
      final method,
      final parameters,
    ) async {
      assert(method == methodName);
      assert(() {
        if (debugInstrumentationEnabled) {
          debugPrint('service extension method received: $method($parameters)');
        }
        return true;
      }());

      // VM service extensions are handled as "out of band" messages by the VM,
      // which means they are handled at various times, generally ASAP.
      // Notably, this includes being handled in the middle of microtask loops.
      // While this makes sense for some service extensions (e.g. "dump current
      // stack trace", which explicitly doesn't want to wait for a loop to
      // complete), Flutter extensions need not be handled with such high
      // priority. Further, handling them with such high priority exposes us to
      // the possibility that they're handled in the middle of a frame, which
      // breaks many assertions. As such, we ensure they we run the callbacks
      // on the outer event loop here.
      await debugInstrumentAction<void>(
        'Wait for outer event loop',
        () => Future<void>.delayed(Duration.zero),
      );

      late Map<String, dynamic> result;
      try {
        result = await callback(parameters);
      } catch (exception, stack) {
        FlutterError.reportError(
          FlutterErrorDetails(
            exception: exception,
            stack: stack,
            context: ErrorDescription(
              'during a service extension callback for "$method"',
            ),
          ),
        );
        return developer.ServiceExtensionResponse.error(
          developer.ServiceExtensionResponse.extensionError,
          json.encode(<String, String>{
            'exception': exception.toString(),
            'stack': stack.toString(),
            'method': method,
          }),
        );
      }
      result['type'] = '_extensionType';
      result['method'] = method;
      return developer.ServiceExtensionResponse.result(json.encode(result));
    });
  }

  @override
  String toString() => '<${objectRuntimeType(this, 'McpBridgeBindingBase')}>';
}
