import 'dart:async';

import 'package:dart_mcp/client.dart';
import 'package:from_json_to_json/from_json_to_json.dart';
import 'package:is_dart_empty_or_not/is_dart_empty_or_not.dart';

import '../mcp_models.dart';
import '../mcp_toolkit_binding.dart';
import '../services/application_info.dart';
import '../services/error_monitor.dart';
import '../services/screenshot_service.dart';

/// Returns a set of MCPCallEntry objects for the Flutter MCP Toolkit.
///
/// The toolkit provides functionality for handling app errors,
/// view screenshots, and view details.
///
/// [binding] is the MCP toolkit binding instance.
Set<MCPCallEntry> getFlutterMcpToolkitEntries({
  required final MCPToolkitBinding binding,
}) => {
  OnAppErrorsEntry(errorMonitor: binding),
  OnViewScreenshotsEntry(),
  OnViewDetailsEntry(),
  TapByTextEntry(),
  EnterTextByHintEntry(),
  TapBySemanticLabelEntry(),
  TapByCoordinateEntry(),
  OnViewWidgetTreeEntry(),
  ScrollByOffsetEntry(),
  OnGetNavigationTreeEntry(),
  OnGetWidgetPropertiesEntry(),
  OnGetNavigationStackEntry(),
  LongPressByTextEntry(),
  PopScreenEntry(),
  NavigateToRouteEntry(),
};

/// Extension on [MCPToolkitBinding] to initialize the Flutter MCP Toolkit.
extension MCPToolkitBindingExtension on MCPToolkitBinding {
  /// Initializes the Flutter MCP Toolkit.
  void initializeFlutterToolkit() => unawaited(
    addEntries(entries: getFlutterMcpToolkitEntries(binding: this)),
  );
}

/// {@template on_app_errors_entry}
/// MCPCallEntry for handling app errors.
/// {@endtemplate}
extension type OnAppErrorsEntry._(MCPCallEntry entry) implements MCPCallEntry {
  /// {@macro on_app_errors_entry}
  factory OnAppErrorsEntry({required final ErrorMonitor errorMonitor}) {
    final entry = MCPCallEntry.tool(
      handler: (final parameters) {
        final count = jsonDecodeInt(parameters['count'] ?? '').whenZeroUse(10);
        final reversedErrors = errorMonitor.errors.take(count).toList();
        final errors = reversedErrors.map((final e) => e.toJson()).toList();
        final message = () {
          if (errors.isEmpty) {
            return 'No errors found. Here are possible reasons: \n'
                '1) There were really no errors. \n'
                '2) Errors occurred before they were captured by MCP server. \n'
                'What you can do (choose wisely): \n'
                '1) Try to reproduce action, which expected to cause errors. \n'
                '2) If errors still not visible, try to navigate to another '
                'screen and back. \n'
                '3) If even then errors still not visible, try to restart app.';
          }

          return 'Errors found. \n'
              'Take a notice: the error message may have contain '
              'a path to file and line number. \n'
              'Use it to find the error in codebase.';
        }();

        return MCPCallResult(message: message, parameters: {'errors': errors});
      },
      definition: MCPToolDefinition(
        name: 'app_errors',
        description:
        'Get application errors and diagnostics information. '
            'Returns recent errors with file paths and line numbers '
            'for debugging.',
        inputSchema: ObjectSchema(
          properties: {
            'count': IntegerSchema(
              description: 'Number of recent errors to retrieve',
              minimum: 1,
              maximum: 10,
            ),
          },
        ),
      ),
    );
    return OnAppErrorsEntry._(entry);
  }
}

/// {@template on_view_screenshots_entry}
/// MCPCallEntry for handling view screenshots.
/// {@endtemplate}
extension type OnViewScreenshotsEntry._(MCPCallEntry entry)
implements MCPCallEntry {
  /// {@macro on_view_screenshots_entry}
  factory OnViewScreenshotsEntry() {
    final entry = MCPCallEntry.tool(
      handler: (final parameters) async {
        final compress = jsonDecodeBool(parameters['compress']);
        final images = await ScreenshotService.takeScreenshots(
          compress: compress,
        );
        return MCPCallResult(
          message:
          'Screenshots taken for each view. '
              'If you find visual errors, you can try to request errors '
              'to get more information with stack trace',
          parameters: {'images': images},
        );
      },
      definition: MCPToolDefinition(
        name: 'view_screenshots',
        description:
        'Take screenshots of all Flutter views/screens. '
            'Useful for visual debugging and UI analysis.',
        inputSchema: ObjectSchema(
          properties: {
            'compress': BooleanSchema(
              description: 'Whether to compress the screenshots',
            ),
          },
        ),
      ),
    );
    return OnViewScreenshotsEntry._(entry);
  }
}

/// {@template on_view_details_entry}
/// MCPCallEntry for handling view details.
/// {@endtemplate}
extension type const OnViewDetailsEntry._(MCPCallEntry entry)
implements MCPCallEntry {
  /// {@macro on_view_details_entry}
  factory OnViewDetailsEntry() {
    final entry = MCPCallEntry.tool(
      handler: (final parameters) {
        final details = ApplicationInfo.getViewsInformation();
        final json = details.map((final e) => e.toJson()).toList();
        return MCPCallResult(
          message: 'Information about each view. ',
          parameters: {'details': json},
        );
      },
      definition: MCPToolDefinition(
        name: 'view_details',
        description:
        'Get detailed information about Flutter views and widgets. '
            'Returns structural information about the current UI state.',
        inputSchema: ObjectSchema(properties: {}),
      ),
    );
    return OnViewDetailsEntry._(entry);
  }
}


/// {@template tap_by_text_entry}
/// MCPCallEntry for tapping widgets by their text content.
/// {@endtemplate}
extension type TapByTextEntry._(MCPCallEntry entry) implements MCPCallEntry {
  /// {@macro tap_by_text_entry}
  factory TapByTextEntry() {
    final entry = MCPCallEntry(const MCPMethodName('tap_by_text'), (final parameters,) {
      final searchText = parameters['text'];
      var found = false;

      void visitor(final Element element) {
        if (found) return;

        final widget = element.widget;

        bool matchesText() {
          if (widget is Text && widget.data == searchText) return true;
          if (widget is RichText && widget.text.toPlainText() == searchText) return true;
          if (widget is TextPainterWidget && widget.text == searchText) return true;
          return false;
        }

        void simulateGesture(final Element target) {
          final renderObject = target.renderObject;
          if (renderObject is! RenderBox) return;

          final position = renderObject.localToGlobal(renderObject.size.center(Offset.zero));
          bool handled = false;

          target.visitAncestorElements((final ancestor) {
            final w = ancestor.widget;

            // GestureDetector
            if (w is GestureDetector) {
              final downDetails = TapDownDetails(globalPosition: position);
              final upDetails = TapUpDetails(globalPosition: position, kind: PointerDeviceKind.touch);

              w.onTapDown?.call(downDetails);
              w.onTapUp?.call(upDetails);
              w.onTap?.call();
              if (w.onTap == null && w.onTapDown == null && w.onTapUp == null) {
                w.onTapCancel?.call();
              }

              handled = true;
              return false;
            }

            bool tryCall(final VoidCallback? callback) {
              if (callback != null) {
                callback();
                return true;
              }
              return false;
            }

            // Button-like widgets
            if (w is TextButton ||
                w is ElevatedButton ||
                w is OutlinedButton ||
                w is IconButton ||
                w is FloatingActionButton) {
              handled = tryCall((w as dynamic).onPressed);
              if (handled) return false;
            }

            // Ink variants
            if (w is InkWell || w is InkResponse) {
              handled = tryCall((w as dynamic).onTap);
              if (handled) return false;
            }

            return true;
          });

          if (handled) {
            found = true;
          }
        }

        if (matchesText()) {
          simulateGesture(element);
        }

        element.visitChildren(visitor);
      }

      final root = WidgetsBinding.instance.rootElement;
      if (root != null) {
        root.visitChildren(visitor);
      }

      final message = found
          ? 'Successfully tapped widget with text: $searchText'
          : 'Could not find tappable widget with text: $searchText';

      return MCPCallResult(message: message, parameters: {'success': found});
    });

    return TapByTextEntry._(entry);
  }
}


/// {@template enter_text_by_hint_entry}
/// MCPCallEntry for entering text into text fields by their hint text.
/// {@endtemplate}
extension type EnterTextByHintEntry._(MCPCallEntry entry)
implements MCPCallEntry {
  /// {@macro enter_text_by_hint_entry}
  factory EnterTextByHintEntry() {
    final entry = MCPCallEntry(const MCPMethodName('enter_text_by_hint'), (final parameters,) {
      final hintText = parameters['hint'] ?? '';
      final textToEnter = parameters['text'] ?? '';
      var found = false;

      void visitor(final Element element) {
        if (found) return;

        final widget = element.widget;
        if (widget is TextField && widget.decoration?.hintText == hintText) {
          final textField = widget;
          if (textField.controller != null) {
            textField.controller!.text = textToEnter;
            if (textField.onChanged != null) {
              textField.onChanged?.call(textToEnter);
            }
            found = true;
            return;
          } else if (element is StatefulElement) {
            final state = element.state;
            if (state is EditableTextState) {
              state.updateEditingValue(TextEditingValue(text: textToEnter));
              if (textField.onChanged != null) {
                textField.onChanged?.call(textToEnter);
              }
              found = true;
              return;
            }
          }
        }
        element.visitChildren(visitor);
      }

      // Start the search from the root
      final context = WidgetsBinding.instance.rootElement;
      if (context != null) {
        context.visitChildren(visitor);
      }

      final message =
      found
          ? 'Successfully entered text into field with hint: $hintText'
          : 'Could not find text field with hint: $hintText';

      return MCPCallResult(message: message, parameters: {'success': found});
    });
    return EnterTextByHintEntry._(entry);
  }
}

/// {@template tap_by_semantic_label_entry}
/// MCPCallEntry for tapping widgets by their semantic label.
/// {@endtemplate}
extension type TapBySemanticLabelEntry._(MCPCallEntry entry)
implements MCPCallEntry {
  /// {@macro tap_by_semantic_label_entry}
  factory TapBySemanticLabelEntry() {
    final entry = MCPCallEntry(const MCPMethodName('tap_by_semantic_label'), (final parameters,) {
      final searchLabel = (parameters['label'] ?? '').toLowerCase();
      var found = false;

      void visitor(final Element element) {
        if (found) return;

        final widget = element.widget;

        bool matchesLabel() {
          if (widget is Semantics && widget.properties.label?.toLowerCase() == searchLabel) return true;
          if (widget is FloatingActionButton) {
            final renderObject = element.renderObject;
            if (renderObject is RenderObject) {
              final semantics = renderObject.debugSemantics;
              return semantics?.label.toLowerCase() == searchLabel ||
                  (searchLabel == 'increment' && widget.tooltip == null);
            }
          }
          return false;
        }

        void simulateGesture(final Element target) {
          final renderObject = target.renderObject;
          if (renderObject is! RenderBox) return;

          final position = renderObject.localToGlobal(renderObject.size.center(Offset.zero));
          bool handled = false;

          target.visitAncestorElements((final ancestor) {
            final w = ancestor.widget;

            // GestureDetector
            if (w is GestureDetector) {
              final downDetails = TapDownDetails(globalPosition: position);
              final upDetails = TapUpDetails(globalPosition: position, kind: PointerDeviceKind.touch);

              w.onTapDown?.call(downDetails);
              w.onTapUp?.call(upDetails);
              w.onTap?.call();
              if (w.onTap == null && w.onTapDown == null && w.onTapUp == null) {
                w.onTapCancel?.call();
              }

              handled = true;
              return false;
            }

            bool tryCall(final VoidCallback? callback) {
              if (callback != null) {
                callback();
                return true;
              }
              return false;
            }

            // Button-like widgets
            if (w is TextButton ||
                w is ElevatedButton ||
                w is OutlinedButton ||
                w is IconButton ||
                w is FloatingActionButton) {
              handled = tryCall((w as dynamic).onPressed);
              if (handled) return false;
            }

            // Ink variants
            if (w is InkWell || w is InkResponse) {
              handled = tryCall((w as dynamic).onTap);
              if (handled) return false;
            }

            return true;
          });

          if (handled) {
            found = true;
          }
        }

        if (matchesLabel()) {
          simulateGesture(element);
        }

        element.visitChildren(visitor);
      }

      final rootContext = WidgetsBinding.instance.rootElement;
      if (rootContext != null) {
        rootContext.visitChildren(visitor);
      }

      final message =
      found
          ? 'Successfully tapped widget with semanticLabel: $searchLabel'
          : 'Could not find tappable widget with semanticLabel: $searchLabel';

      return MCPCallResult(message: message, parameters: {'success': found});
    });
    return TapBySemanticLabelEntry._(entry);
  }
}

/// {@template tap_by_coordinate_entry}
/// MCPCallEntry for tapping widgets by their coordinates.
/// {@endtemplate}
extension type TapByCoordinateEntry._(MCPCallEntry entry)
implements MCPCallEntry {
  /// {@macro tap_by_coordinate_entry}
  factory TapByCoordinateEntry() {
    final entry = MCPCallEntry(const MCPMethodName('tap_by_coordinate'), (final parameters,) async {
      final dx = double.tryParse(parameters['x']?.toString() ?? '');
      final dy = double.tryParse(parameters['y']?.toString() ?? '');

      if (dx == null || dy == null) {
        return MCPCallResult(
          message: 'Invalid coordinates.',
          parameters: {'success': false},
        );
      }

      final position = Offset(dx, dy);
      var found = false;

      void visitor(final Element element) {
        if (found) return;

        final renderObject = element.renderObject;

        bool matchesPosition() {
          if (renderObject == null || !renderObject.attached) return false;
          try {
            final bounds = renderObject.paintBounds;
            final transform = renderObject.getTransformTo(null);
            final globalBounds = MatrixUtils.transformRect(transform, bounds);
            return globalBounds.contains(position);
          } catch (_) {
            return false;
          }
        }

        void simulateGesture(final Element target) {
          final renderObject = target.renderObject;
          if (renderObject is! RenderBox) return;

          bool handled = false;

          target.visitAncestorElements((final ancestor) {
            final w = ancestor.widget;

            // GestureDetector
            if (w is GestureDetector) {
              final downDetails = TapDownDetails(globalPosition: position);
              final upDetails = TapUpDetails(globalPosition: position, kind: PointerDeviceKind.touch);

              w.onTapDown?.call(downDetails);
              w.onTapUp?.call(upDetails);
              w.onTap?.call();
              if (w.onTap == null && w.onTapDown == null && w.onTapUp == null) {
                w.onTapCancel?.call();
              }

              handled = true;
              return false;
            }

            bool tryCall(final VoidCallback? callback) {
              if (callback != null) {
                callback();
                return true;
              }
              return false;
            }

            // Button-like widgets
            if (w is TextButton ||
                w is ElevatedButton ||
                w is OutlinedButton ||
                w is IconButton ||
                w is FloatingActionButton) {
              handled = tryCall((w as dynamic).onPressed);
              if (handled) return false;
            }

            // Ink variants
            if (w is InkWell || w is InkResponse) {
              handled = tryCall((w as dynamic).onTap);
              if (handled) return false;
            }

            return true;
          });

          if (handled) {
            found = true;
            return;
          }

          // If none of the standard tap handlers worked, simulate raw pointer event
          if (!found) {
            try {
              final gestureBinding = GestureBinding.instance;
              final now = DateTime.now();
              final timestamp = Duration(microseconds: now.microsecondsSinceEpoch);

              final down = PointerDownEvent(
                position: position,
                timeStamp: timestamp,
                pointer: 1,
              );

              final up = PointerUpEvent(
                position: position,
                timeStamp: timestamp + const Duration(milliseconds: 50),
                pointer: 1,
              );

              gestureBinding.handlePointerEvent(down);
              Future.delayed(const Duration(milliseconds: 10), () {
                gestureBinding.handlePointerEvent(up);
              });

              found = true;
            } catch (_) {}
          }
        }

        if (matchesPosition()) {
          simulateGesture(element);
        }

        element.visitChildren(visitor);
      }

      final rootContext = WidgetsBinding.instance.rootElement;
      if (rootContext != null) {
        rootContext.visitChildren(visitor);
      }

      return MCPCallResult(
        message:
        found
            ? 'Tapped widget at coordinate: ($dx, $dy)'
            : 'No tappable widget found at: ($dx, $dy)',
        parameters: {'success': found},
      );
    });

    return TapByCoordinateEntry._(entry);
  }
}

/// {@template on_view_widget_tree_entry}
/// MCPCallEntry for viewing the widget tree.
/// {@endtemplate}
extension type const OnViewWidgetTreeEntry._(MCPCallEntry entry)
implements MCPCallEntry {
  /// {@macro on_view_widget_tree_entry}
  factory OnViewWidgetTreeEntry() {
    final entry = MCPCallEntry(const MCPMethodName('view_widget_tree'), (final parameters,) {
      final includeRenderParams = jsonDecodeBool(parameters['includeRenderParams']);
      final root = WidgetsBinding.instance.rootElement;
      if (root == null) {
        return MCPCallResult(
          message: 'No root element found.',
          parameters: {'tree': []},
        );
      }

      Map<String, dynamic> serializeElement(final Element element) {
        final widget = element.widget;
        final renderObject = element.renderObject;

        final Map<String, dynamic> data = {
          'widget': widget.runtimeType.toString(),
          'key': widget.key?.toString(),
          'type': widget.runtimeType.toString(),
        };

        try {
          if (widget is Text) {
            data['text'] = widget.data;
          } else if (widget is Semantics) {
            data['semanticLabel'] = widget.properties.label;
          } else if (widget is Icon) {
            data['icon'] = widget.icon.runtimeType.toString();
          } else if (widget is TextField) {
            data['hint'] = widget.decoration?.hintText;
          } else if (widget is ElevatedButton ||
              widget is TextButton ||
              widget is IconButton ||
              widget is FloatingActionButton) {
            data['hasOnPressed'] = (widget as dynamic).onPressed != null;
            if ((widget as dynamic).tooltip != null) {
              data['tooltip'] = (widget as dynamic).tooltip;
            }
          } else if (widget is DropdownButton) {
            data['itemsCount'] = widget.items?.length;
            data['hasOnChanged'] = widget.onChanged != null;
          } else if (widget is PopupMenuButton) {
            data['hasOnSelected'] = widget.onSelected != null;
            data['tooltip'] = widget.tooltip;
          }

          // Scrollable widgets
          if (widget is SingleChildScrollView ||
              widget is ListView ||
              widget is GridView ||
              widget is CustomScrollView ||
              widget is Scrollbar) {
            final Axis? axis = switch (widget) {
              final SingleChildScrollView w => w.scrollDirection,
              final ListView w => w.scrollDirection,
              final GridView w => w.scrollDirection,
              final CustomScrollView w => w.scrollDirection,
              final Scrollbar _ => null,
              _ => null,
            };

            final ScrollController? controller = switch (widget) {
              final SingleChildScrollView w => w.controller,
              final ListView w => w.controller,
              final GridView w => w.controller,
              final CustomScrollView w => w.controller,
              final Scrollbar w => w.controller,
              _ => null,
            };

            data['isScrollable'] = true;
            if (axis case final Axis a) {
              data['scrollDirection'] = a.toString();
            }
            data['hasScrollController'] = controller != null;
          }
        } catch (_) {
          data['error'] = 'Failed to extract properties.';
        }

        if (includeRenderParams && renderObject != null && renderObject.attached) {
          try {
            final bounds = renderObject.paintBounds;
            final transform = renderObject.getTransformTo(null);
            final globalBounds = MatrixUtils.transformRect(transform, bounds);
            data['rect'] = {
              'left': globalBounds.left,
              'top': globalBounds.top,
              'right': globalBounds.right,
              'bottom': globalBounds.bottom,
              'width': globalBounds.width,
              'height': globalBounds.height,
            };
          } catch (_) {}
        }

        final List<Map<String, dynamic>> children = [];
        element.visitChildren((final child) {
          children.add(serializeElement(child));
        });

        data['children'] = children;

        return data;
      }

      final treeJson = serializeElement(root);

      return MCPCallResult(
        message: 'Serialized widget tree structure.',
        parameters: {'tree': treeJson},
      );
    });

    return OnViewWidgetTreeEntry._(entry);
  }
}

/// {@template scroll_by_offset_entry}
/// Improved MCPCallEntry for scrolling a scrollable widget by an offset.
/// {@endtemplate}
extension type ScrollByOffsetEntry._(MCPCallEntry entry)
implements MCPCallEntry {
  /// {@macro scroll_by_offset_entry}
  factory ScrollByOffsetEntry() {
    final entry = MCPCallEntry(
      const MCPMethodName('scroll_by_offset'),
          (final parameters,) async {
        final dx = double.tryParse(parameters['dx'] ?? '') ?? 0.0;
        final dy = double.tryParse(parameters['dy'] ?? '') ?? 0.0;

        final keyFilter = parameters['key']?.toString();
        final semanticLabel = parameters['semanticLabel']?.toString();
        final textFilter = parameters['text']?.toString();

        var scrolled = false;
        final debug = <String>[];

        bool matches(final Element e) {
          final w = e.widget;

          if (keyFilter != null &&
              w.key is ValueKey &&
              (w.key! as ValueKey).value != keyFilter) {
            return false;
          }

          if (semanticLabel != null &&
              w is Semantics &&
              w.properties.label != semanticLabel) {
            return false;
          }

          if (textFilter != null) {
            var found = false;
            void search(final Element el) {
              if (found) return;
              if (el.widget is Text &&
                  (el.widget as Text)
                      .data
                      ?.contains(textFilter) == true) {
                found = true;
              }
              el.visitChildren(search);
            }
            search(e);
            if (!found) return false;
          }
          return true;
        }

        ScrollableState? findScrollableState(final Element e) {
          ScrollableState? result;

          if (e is StatefulElement && e.widget is Scrollable) {
            final st = e.state;
            if (st is ScrollableState) return st;
          }

          e.visitAncestorElements((final anc) {
            if (anc is StatefulElement && anc.widget is Scrollable) {
              final st = anc.state;
              if (st is ScrollableState) {
                result = st;
                return false;
              }
            }
            return true;
          });
          return result;
        }

        Future<bool> scroll(final Element e, final double dx, final double dy) async {
          final scrollState = findScrollableState(e);
          if (scrollState == null) return false;

          final position = scrollState.position;
          final controller = scrollState.widget.controller;
          final axis = position.axis;

          final delta = axis == Axis.vertical ? dy : dx;
          final target = (position.pixels + delta)
              .clamp(position.minScrollExtent, position.maxScrollExtent);

          Future<bool> byController() async {
            if (controller == null || !controller.hasClients) return false;
            try {
              controller.jumpTo(target);
              return true;
            } catch (_) {
              try {
                await controller.animateTo(
                  target,
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeOut,
                );
                return true;
              } catch (_) {
                return false;
              }
            }
          }

          Future<bool> byPosition() async {
            try {
              await position.animateTo(
                target,
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeOut,
              );
              return true;
            } catch (_) {
              return false;
            }
          }

          Future<bool> byEnsureVisible() async {
            try {
              await Scrollable.ensureVisible(
                e,
                alignment: 0,
                duration: const Duration(milliseconds: 300),
              );
              return true;
            } catch (_) {
              return false;
            }
          }

          Future<bool> byGesture() async {
            try {
              final g = GestureBinding.instance;
              const start = Offset.zero;
              final end = axis == Axis.vertical
                  ? start.translate(0, delta)
                  : start.translate(delta, 0);
              final ts = Duration(
                  microseconds: DateTime
                      .now()
                      .microsecondsSinceEpoch);

              g..handlePointerEvent(
                PointerDownEvent(timeStamp: ts, pointer: 1),
              )..handlePointerEvent(
                PointerMoveEvent(
                  position: end,
                  timeStamp: ts + const Duration(milliseconds: 16),
                  pointer: 1,
                ),
              )..handlePointerEvent(
                PointerUpEvent(
                  position: end,
                  timeStamp: ts + const Duration(milliseconds: 32),
                  pointer: 1,
                ),
              );
              return true;
            } catch (_) {
              return false;
            }
          }

          return await byController() ||
              await byPosition() ||
              await byEnsureVisible() ||
              await byGesture();
        }

        Future<void> walk(final Element root) async {
          Future<void> dfs(final Element e) async {
            if (scrolled) return;

            if (matches(e) && await scroll(e, dx, dy)) {
              scrolled = true;
              return;
            }

            final waits = <Future<void>>[];
            e.visitChildren((final child) {
              waits.add(dfs(child));
            });
            await Future.wait(waits);
          }

          await dfs(root);
        }

        final root = WidgetsBinding.instance.rootElement;
        if (root != null) await walk(root);

        return MCPCallResult(
          message: scrolled
              ? 'Scrolled by dx=$dx, dy=$dy'
              : 'No suitable Scrollable found',
          parameters: {'success': scrolled, 'debug': debug},
        );
      },
    );

    return ScrollByOffsetEntry._(entry);
  }
}

/// {@template get_navigation_stack_entry}
/// MCPCallEntry for getting the current navigation stack (supports Navigator 2.0 and basic 1.0).
/// {@endtemplate}
extension type const OnGetNavigationStackEntry._(MCPCallEntry entry)
implements MCPCallEntry {
  /// {@macro get_navigation_stack_entry}
  factory OnGetNavigationStackEntry() {
    final entry = MCPCallEntry(const MCPMethodName('get_navigation_stack'),
            (final parameters,) {
          final root = WidgetsBinding.instance.rootElement;
          if (root == null) {
            return MCPCallResult(
              message: 'No root element found.',
              parameters: {'stack': []},
            );
          }

          final List<Map<String, dynamic>> stackEntries = [];

          void findNavigatorElements(final Element element) {
            if (element is StatefulElement && element.state is NavigatorState) {
              final NavigatorState navState = element.state as NavigatorState;
              final Navigator navigatorWidget = navState.widget;

              try {
                final pages = navigatorWidget.pages;
                if (pages.isNotEmpty) {
                  for (final page in pages) {
                    stackEntries.add({
                      'type': 'Page',
                      'name': page.name ?? page.runtimeType.toString(),
                      'runtimeType': page.runtimeType.toString(),
                      'key': page.key.toString(),
                    });
                  }
                } else {
                  // Navigator 1.0 fallback
                  if (navigatorWidget.initialRoute != null) {
                    stackEntries.add({
                      'type': 'InitialRoute',
                      'name': navigatorWidget.initialRoute,
                    });
                  } else {
                    stackEntries.add({
                      'type': 'Unknown',
                      'message':
                      'Could not extract stack from NavigatorState (Navigator 1.0)',
                    });
                  }
                }
              } catch (_) {
                stackEntries.add({
                  'type': 'Error',
                  'message': 'Error while accessing navigator.pages or initialRoute',
                });
              }
            }

            element.visitChildren(findNavigatorElements);
          }

          root.visitChildren(findNavigatorElements);

          return MCPCallResult(
            message: 'Collected navigation stack.',
            parameters: {'stack': stackEntries},
          );
        });

    return OnGetNavigationStackEntry._(entry);
  }
}

/// {@template on_get_navigation_tree_entry}
/// MCPCallEntry for viewing the navigation tree (GoRouter, AutoRoute, or fallback).
/// {@endtemplate}
extension type const OnGetNavigationTreeEntry._(MCPCallEntry entry)
implements MCPCallEntry {
  /// {@macro on_get_navigation_tree_entry}
  factory OnGetNavigationTreeEntry() {
    final entry = MCPCallEntry(const MCPMethodName('get_navigation_tree'),
            (final parameters,) {
          final root = WidgetsBinding.instance.rootElement;
          final routerContext = root != null ? findRouterContext(root) : null;

          if (routerContext == null) {
            return MCPCallResult(
              message: 'No Router widget found in the widget tree.',
              parameters: {'tree': []},
            );
          }

          // Get RouterDelegate directly from RouterState
          final delegate = (routerContext.widget as Router).routerDelegate;

          if (delegate == null) {
            return MCPCallResult(
              message: 'RouterDelegate not found.',
              parameters: {'tree': []},
            );
          }

          // --- GoRouter ---
          if (delegate is GoRouterDelegate) {
            try {
              final goRouter = delegate.state.topRoute;
              final tree = _serializeGoRouter(goRouter?.routes ?? []);
              return MCPCallResult(
                message: 'GoRouter navigation tree.',
                parameters: {'tree': tree},
              );
            } catch (e) {
              return MCPCallResult(
                message: 'Failed to serialize GoRouter: $e',
                parameters: {'tree': []},
              );
            }
          }

          // --- AutoRoute ---
          if (delegate.runtimeType.toString().contains('AutoRouterDelegate')) {
            try {
              final autoRouter = _findAutoRouter(routerContext);
              final tree = _serializeAutoRouter(autoRouter);
              return MCPCallResult(
                message: 'AutoRoute navigation tree.',
                parameters: {'tree': tree},
              );
            } catch (e) {
              return MCPCallResult(
                message: 'Failed to serialize AutoRoute: $e',
                parameters: {'tree': []},
              );
            }
          }

          // --- Navigator fallback ---
          try {
            final navStack = <Map<String, dynamic>>[];
            void findNavigatorElements(final Element element) {
              if (element is StatefulElement && element.state is NavigatorState) {
                final NavigatorState navState = element.state as NavigatorState;
                final Navigator navigatorWidget = navState.widget;
                try {
                  final pages = navigatorWidget.pages;
                  if (pages.isNotEmpty) {
                    for (final page in pages) {
                      navStack.add({
                        'type': 'Page',
                        'name': page.name ?? page.runtimeType.toString(),
                        'runtimeType': page.runtimeType.toString(),
                        'key': page.key.toString(),
                      });
                    }
                  } else if (navigatorWidget.initialRoute != null) {
                    navStack.add({
                      'type': 'InitialRoute',
                      'name': navigatorWidget.initialRoute,
                    });
                  }
                } catch (_) {}
              }
              element.visitChildren(findNavigatorElements);
            }

            (routerContext as Element).visitChildren(findNavigatorElements);
            return MCPCallResult(
              message: 'Navigator navigation stack.',
              parameters: {'tree': navStack},
            );
          } catch (e) {
            return MCPCallResult(
              message: 'Unknown navigation type or error: $e',
              parameters: {'tree': []},
            );
          }
        });

    return OnGetNavigationTreeEntry._(entry);
  }
}


// ==== GoRouter support ====

List<Map<String, dynamic>> _serializeGoRouter(final List<RouteBase> routes, [final String parentPath = '']) {
  final List<Map<String, dynamic>> result = [];

  for (final route in routes) {
    String? routePath;
    String? routeName;
    String? pageBuilder;
    List<RouteBase>? childrenRoutes;

    if (route is GoRoute) {
      routePath = route.path;
      routeName = route.name?.toString();
      pageBuilder = route.builder?.toString();
      childrenRoutes = route.routes;
    } else if (route is ShellRoute) {
      // ShellRoute has a builder and routes
      routePath = null; // ShellRoute does not have a path
      routeName = null;
      pageBuilder = route.builder?.toString();
      childrenRoutes = route.routes;
    } else    // Fallback for other RouteBase types
      try {
        childrenRoutes = route.routes;
      } catch (_) {}


    final path = parentPath + '/' + (routePath ?? '').replaceAll('//', '/');
    final routeInfo = <String, dynamic>{
      'type': route.runtimeType.toString(),
      'path': path,
      'name': routeName,
      'page': pageBuilder,
    };
    if (childrenRoutes != null && childrenRoutes.isNotEmpty) {
      routeInfo['children'] = _serializeGoRouter(childrenRoutes, path);
    }
    result.add(routeInfo);
  }

  return result;
}

// ==== AutoRoute support ====

dynamic _findAutoRouter(final BuildContext context) {
  // fallback using dynamic context
  return (context as dynamic).router;
}

List<Map<String, dynamic>> _serializeAutoRouter(final dynamic router, [final String parentPath = '']) {
  final List<Map<String, dynamic>> result = [];

  final stack = (router is Map && router['stack'] is List)
      ? router['stack'] as List
      : (router != null && router.stack is List ? router.stack as List : <dynamic>[]);

  for (final route in stack) {
    dynamic routeData;
    if (route is Map) {
      routeData = route['data'];
    } else if (route != null && route.data != null) {
      // ignore: avoid_dynamic_calls
      routeData = route.data;
    }
    String routeDataName = 'unknown';
    if (routeData is Map && routeData['name'] != null) {
      routeDataName = routeData['name'].toString();
    } else if (routeData != null && routeData.name != null) {
      // ignore: avoid_dynamic_calls
      routeDataName = routeData.name.toString();
    }
    final path = parentPath + '/' + routeDataName;
    String? routeName;
    String? page;
    if (routeData is Map) {
      routeName = routeData['name']?.toString();
      page = routeData['route']?.toString();
    } else if (routeData != null) {
      try {
        // ignore: avoid_dynamic_calls
        if (routeData.name != null) routeName = routeData.name.toString();
      } catch (_) {}
      try {
        // ignore: avoid_dynamic_calls
        if (routeData.route != null) page = routeData.route.toString();
      } catch (_) {}
    }
    final routeInfo = <String, dynamic>{
      'path': path,
      'name': routeName,
      'page': page,
    };
    // Children
    List<dynamic>? children;
    if (route is Map && route.containsKey('children')) {
      children = route['children'] as List<dynamic>?;
    } else if (route != null) {
      try {
        // ignore: avoid_dynamic_calls
        if (route.children != null) children = route.children as List<dynamic>?;
      } catch (_) {}
    }
    if (children != null && children.isNotEmpty) {
      routeInfo['children'] = _serializeAutoRouter(children, path);
    }
    result.add(routeInfo);
  }

  return result;
}

BuildContext? findRouterContext(final Element root) {
  BuildContext? found;
  void visitor(final Element element) {
    if (found != null) return;
    if (element.widget is Router) {
      found = element;
      return;
    }
    element.visitChildren(visitor);
  }
  root.visitChildren(visitor);
  return found;
}

/// {@template on_get_widget_properties_entry}
/// MCPCallEntry that returns widget properties at a specific element location.
/// {@endtemplate}
extension type const OnGetWidgetPropertiesEntry._(MCPCallEntry entry)
implements MCPCallEntry {
  /// {@macro on_get_widget_properties_entry}
  factory OnGetWidgetPropertiesEntry() {
    final entry = MCPCallEntry(const MCPMethodName('get_widget_properties'),
            (final parameters,) {
          final String? key = parameters['key'];
          if (key == null) {
            return MCPCallResult(
              message: 'Missing required parameter: key',
              parameters: {},
            );
          }

          final root = WidgetsBinding.instance.rootElement;
          if (root == null) {
            return MCPCallResult(
              message: 'No root element found',
              parameters: {},
            );
          }

          Element? found;
          void finder(final Element element) {
            if (found != null) return;
            final widgetKey = element.widget.key;
            if (widgetKey != null) {
              if (widgetKey.toString() == key || widgetKey.toString().contains(key)) {
                found = element;
                return;
              }
              // Handle ValueKey specifically
              if (widgetKey is ValueKey) {
                if (widgetKey.value.toString() == key) {
                  found = element;
                  return;
                }
              }
            }
            element.visitChildren(finder);
          }

          root.visitChildren(finder);

          if (found == null) {
            return MCPCallResult(
              message: 'Widget with key "$key" not found.',
              parameters: {},
            );
          }

          final widget = found!.widget;
          final renderObject = found is RenderObjectElement ? found!.renderObject : null;
          final diagnostics = widget.toDiagnosticsNode(style: DiagnosticsTreeStyle.singleLine).toString();

          final properties = <String, dynamic>{
            'runtimeType': widget.runtimeType.toString(),
            'key': widget.key.toString(),
            'diagnostics': diagnostics,
          };

          if (renderObject is RenderBox) {
            properties['size'] = {
              'width': renderObject.size.width,
              'height': renderObject.size.height,
            };
            try {
              final offset = renderObject.localToGlobal(Offset.zero);
              properties['offset'] = {'dx': offset.dx, 'dy': offset.dy};
            } catch (_) {}
          }

          return MCPCallResult(
            message: 'Widget properties for key "$key"',
            parameters: properties,
          );
        });

    return OnGetWidgetPropertiesEntry._(entry);
  }
}

/// {@template long_press_by_text_entry}
/// MCPCallEntry for performing a long press on widgets by their text, key, or semanticsLabel.
/// Supports detailed matching criteria and configurable long press duration.
/// {@endtemplate}
extension type LongPressByTextEntry._(MCPCallEntry entry) implements MCPCallEntry {
  /// {@macro long_press_by_text_entry}
  factory LongPressByTextEntry() {
    final entry = MCPCallEntry(const MCPMethodName('long_press'), (final parameters,) async {
      final query = parameters['query']?.toString();
      final durationMs = int.tryParse(parameters['duration']?.toString() ?? '') ?? 500; // Default to 500ms for long press
      var found = false;
      String matchedCriteria = '';
      String widgetType = '';

      void visitor(final Element element) {
        if (found) return;

        final widget = element.widget;

        bool matches() {
          final String? keyStr = widget.key?.toString();
          final String? semanticsLabel = _extractSemanticsLabel(widget);

          if (widget is Text && widget.data == query) {
            matchedCriteria = 'text content';
            return true;
          }
          if (widget is RichText && widget.text.toPlainText() == query) {
            matchedCriteria = 'rich text content';
            return true;
          }
          if (widget is TextPainterWidget && widget.text == query) {
            matchedCriteria = 'text painter content';
            return true;
          }
          if (keyStr != null && keyStr.contains(query!)) {
            matchedCriteria = 'key match';
            return true;
          }
          if (semanticsLabel != null && semanticsLabel.contains(query!)) {
            matchedCriteria = 'semantics label';
            return true;
          }
          // Additional matching for button tooltip or hint text
          if (widget is TextField && widget.decoration?.hintText == query) {
            matchedCriteria = 'text field hint';
            return true;
          }
          if ((widget is ElevatedButton || widget is TextButton || widget is IconButton || widget is FloatingActionButton) && (widget as dynamic).tooltip == query) {
            matchedCriteria = 'button tooltip';
            return true;
          }
          return false;
        }

        void simulateLongPress(final Element target) {
          final renderObject = target.renderObject;
          if (renderObject is! RenderBox) return;

          final position = renderObject.localToGlobal(renderObject.size.center(Offset.zero));
          bool handled = false;
          widgetType = target.widget.runtimeType.toString();

          target.visitAncestorElements((final ancestor) {
            final w = ancestor.widget;

            if (w is GestureDetector) {
              final startDetails = LongPressStartDetails(globalPosition: position);
              final endDetails = LongPressEndDetails(globalPosition: position);
              w.onLongPressStart?.call(startDetails);
              w.onLongPress?.call();
              // Simulate duration
              Future.delayed(Duration(milliseconds: durationMs), () {
                w.onLongPressEnd?.call(endDetails);
              });
              handled = true;
              return false;
            }

            bool tryCall(final VoidCallback? callback) {
              if (callback != null) {
                callback();
                return true;
              }
              return false;
            }

            if (w is InkWell || w is InkResponse) {
              handled = tryCall((w as dynamic).onLongPress);
              if (handled) return false;
            }
            // Additional widget types
            if (w is ListTile) {
              handled = tryCall((w as dynamic).onLongPress);
              if (handled) return false;
            }

            return true;
          });

          if (handled) {
            found = true;
          } else {
            // Fallback to raw pointer events if no specific handler is found
            try {
              final gestureBinding = GestureBinding.instance;
              final now = DateTime.now();
              final timestamp = Duration(microseconds: now.microsecondsSinceEpoch);

              final down = PointerDownEvent(
                position: position,
                timeStamp: timestamp,
                pointer: 1,
              );

              final up = PointerUpEvent(
                position: position,
                timeStamp: timestamp + Duration(milliseconds: durationMs),
                pointer: 1,
              );

              gestureBinding.handlePointerEvent(down);
              Future.delayed(Duration(milliseconds: durationMs), () {
                gestureBinding.handlePointerEvent(up);
              });

              found = true;
            } catch (_) {}
          }
        }

        if (query != null && matches()) {
          simulateLongPress(element);
        }

        element.visitChildren(visitor);
      }

      final root = WidgetsBinding.instance.rootElement;
      if (root != null) {
        root.visitChildren(visitor);
      }

      final message = found
          ? 'Successfully long-pressed widget with query: $query (Matched by: $matchedCriteria, Type: $widgetType)'
          : 'Could not find long-pressable widget with query: $query';

      return MCPCallResult(message: message, parameters: {'success': found, 'widgetType': widgetType, 'matchedBy': matchedCriteria});
    });

    return LongPressByTextEntry._(entry);
  }
}

String? _extractSemanticsLabel(final Widget widget) {
  if (widget is Semantics) return widget.properties.label;
  if (widget is ExcludeSemantics) return null;
  if (widget is MergeSemantics) return null;
  // Add more if needed
  return null;
}

/// {@template pop_screen_entry}
/// MCPCallEntry for popping the current screen (Navigator.pop) supporting Navigator 1.0, 2.0, GoRouter, and AutoRouter.
/// {@endtemplate}
extension type PopScreenEntry._(MCPCallEntry entry) implements MCPCallEntry {
  /// {@macro pop_screen_entry}
  factory PopScreenEntry() {
    final entry = MCPCallEntry(const MCPMethodName('pop_screen'), (final parameters,) async {
      final root = WidgetsBinding.instance.rootElement;
      if (root == null) {
        return MCPCallResult(
          message: 'No root element found.',
          parameters: {'success': false},
        );
      }
      String? usedNavigator;
      bool success = false;
      String? error;

      // --- GoRouter ---
      try {
        final routerContext = findRouterContext(root);
        if (routerContext != null) {
          final delegate = (routerContext.widget as Router).routerDelegate;
          if (delegate is GoRouterDelegate) {
            // ignore: avoid_dynamic_calls
            final goRouter = (delegate as dynamic).goRouter;
            if (goRouter != null) {
              goRouter.pop();
              usedNavigator = 'GoRouter';
              success = true;
            } else if (delegate is dynamic && delegate.canPop != null && delegate.canPop()) {
              delegate.pop();
              usedNavigator = 'GoRouter (delegate.pop)';
              success = true;
            }
          } else if (delegate.runtimeType.toString().contains('AutoRouterDelegate')) {
            // --- AutoRouter ---
            try {
              final autoRouter = _findAutoRouter(routerContext);
              if (autoRouter != null && (autoRouter as dynamic).canPop()) {
                (autoRouter as dynamic).pop();
                usedNavigator = 'AutoRouter';
                success = true;
              }
            } catch (e) {
              error = 'AutoRouter pop failed: $e';
            }
          }
        }
      } catch (e) {
        error = 'Router pop failed: $e';
      }

      // --- Navigator fallback ---
      if (!success) {
        try {
          NavigatorState? foundNavigator;
          void findNavigator(final Element element) {
            if (foundNavigator != null) return;
            if (element is StatefulElement && element.state is NavigatorState) {
              foundNavigator = element.state as NavigatorState;
              return;
            }
            element.visitChildren(findNavigator);
          }
          root.visitChildren(findNavigator);
          if (foundNavigator != null && foundNavigator!.canPop()) {
            foundNavigator!.pop();
            usedNavigator = 'Navigator';
            success = true;
          }
        } catch (e) {
          error = 'Navigator pop failed: $e';
        }
      }

      return MCPCallResult(
        message: success
            ? 'Successfully popped screen using $usedNavigator.'
            : 'Failed to pop screen.' + (error != null ? ' Error: $error' : ''),
        parameters: {'success': success, 'usedNavigator': usedNavigator, if (error != null) 'error': error},
      );
    });
    return PopScreenEntry._(entry);
  }
}

/// {@template navigate_to_route_entry}
/// MCPCallEntry for navigating to a route by string, supporting GoRouter, AutoRoute, and Navigator.
/// {@endtemplate}
extension type NavigateToRouteEntry._(MCPCallEntry entry) implements MCPCallEntry {
  /// {@macro navigate_to_route_entry}
  factory NavigateToRouteEntry() {
    final entry = MCPCallEntry(const MCPMethodName('navigate_to_route'), (final parameters,) async {
      final String? route = parameters['route'];
      if (route == null) {
        return MCPCallResult(message: 'Missing required parameter: route', parameters: {});
      }
      final root = WidgetsBinding.instance.rootElement;
      if (root == null) {
        return MCPCallResult(message: 'No root element found.', parameters: {});
      }
      // 1. Try to find MaterialApp and use routerConfig for navigation
      dynamic routerConfig;
      void findMaterialApp(final Element element) {
        if (routerConfig != null) return;
        if (element.widget is MaterialApp) {
          routerConfig = (element.widget as MaterialApp).routerConfig;
          return;
        }
        element.visitChildren(findMaterialApp);
      }
      root.visitChildren(findMaterialApp);
      if (routerConfig != null) {
        try {
          // Attempt to navigate using routerConfig as GoRouter
          routerConfig.go(route);
          return MCPCallResult(
            message: 'Navigated using MaterialApp routerConfig',
            parameters: {'success': true, 'system': 'MaterialApp.routerConfig'},
          );
        } catch (e) {
          // If navigation fails, fall back to customRouterConfig
        }
      }
      // 2. Check customRouterConfig set by user
      if (RouterConfigStorage.customRouterConfig != null) {
        try {
          RouterConfigStorage.customRouterConfig.go(route);
          return MCPCallResult(
            message: 'Navigated using customRouterConfig',
            parameters: {'success': true, 'system': 'customRouterConfig'},
          );
        } catch (e) {
          // If navigation fails, proceed to failure
        }
      }
      // 3. If neither routerConfig nor customRouterConfig is available, return failure
      return MCPCallResult(
        message: 'Failed to navigate to route: No router configuration found',
        parameters: {'success': false},
      );
    });
    return NavigateToRouteEntry._(entry);
  }
}
