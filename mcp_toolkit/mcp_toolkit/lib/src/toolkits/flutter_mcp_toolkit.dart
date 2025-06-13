// ignore_for_file: unnecessary_null_comparison

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
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
};

/// Extension on [MCPToolkitBinding] to initialize the Flutter MCP Toolkit.
extension MCPToolkitBindingExtension on MCPToolkitBinding {
  /// Initializes the Flutter MCP Toolkit.
  void initializeFlutterToolkit() =>
      addEntries(entries: getFlutterMcpToolkitEntries(binding: this));
}

/// {@template on_app_errors_entry}
/// MCPCallEntry for handling app errors.
/// {@endtemplate}
extension type OnAppErrorsEntry._(MCPCallEntry entry) implements MCPCallEntry {
  /// {@macro on_app_errors_entry}
  factory OnAppErrorsEntry({required final ErrorMonitor errorMonitor}) {
    final entry = MCPCallEntry(const MCPMethodName('app_errors'), (
      final parameters,
    ) {
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
    });
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
    final entry = MCPCallEntry(const MCPMethodName('view_screenshots'), (
      final parameters,
    ) async {
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
    });
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
    final entry = MCPCallEntry(const MCPMethodName('view_details'), (
      final parameters,
    ) {
      final details = ApplicationInfo.getViewsInformation();
      final json = details.map((final e) => e.toJson()).toList();
      return MCPCallResult(
        message: 'Information about each view. ',
        parameters: {'details': json},
      );
    });
    return OnViewDetailsEntry._(entry);
  }
}

/// {@template tap_by_text_entry}
/// MCPCallEntry for tapping widgets by their text content.
/// {@endtemplate}
extension type TapByTextEntry._(MCPCallEntry entry) implements MCPCallEntry {
  /// {@macro tap_by_text_entry}
  factory TapByTextEntry() {
    final entry = MCPCallEntry(const MCPMethodName('tap_by_text'), (
      final parameters,
    ) {
      final searchText = parameters['text'];
      var found = false;

      void visitor(final Element element) {
        if (found) return;

        final widget = element.widget;
        if (widget is Text && widget.data == searchText) {
          final context = element;

          final elevatedButton =
              context.findAncestorWidgetOfExactType<ElevatedButton>();
          if (elevatedButton?.onPressed != null) {
            elevatedButton!.onPressed!();
            found = true;
            return;
          }

          final textButton =
              context.findAncestorWidgetOfExactType<TextButton>();
          if (textButton?.onPressed != null) {
            textButton!.onPressed!();
            found = true;
            return;
          }

          final gestureDetector =
              context.findAncestorWidgetOfExactType<GestureDetector>();
          if (gestureDetector?.onTap != null) {
            gestureDetector!.onTap!();
            found = true;
            return;
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
    final entry = MCPCallEntry(const MCPMethodName('enter_text_by_hint'), (
      final parameters,
    ) {
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
    final entry = MCPCallEntry(const MCPMethodName('tap_by_semantic_label'), (
      final parameters,
    ) {
      final searchLabel = (parameters['label'] ?? '').toLowerCase();
      var found = false;

      void visitor(final Element element) {
        if (found) return;

        final widget = element.widget;

        // Check for explicit Semantics widgets
        if (widget is Semantics &&
            widget.properties.label?.toLowerCase() == searchLabel) {
          final context = element;

          final elevatedButton =
              context.findAncestorWidgetOfExactType<ElevatedButton>();
          if (elevatedButton?.onPressed != null) {
            elevatedButton!.onPressed!();
            found = true;
            return;
          }

          final textButton =
              context.findAncestorWidgetOfExactType<TextButton>();
          if (textButton?.onPressed != null) {
            textButton!.onPressed!();
            found = true;
            return;
          }

          final floatingActionButton =
              context.findAncestorWidgetOfExactType<FloatingActionButton>();
          if (floatingActionButton?.onPressed != null) {
            floatingActionButton!.onPressed!();
            found = true;
            return;
          }

          final gestureDetector =
              context.findAncestorWidgetOfExactType<GestureDetector>();
          if (gestureDetector?.onTap != null) {
            gestureDetector!.onTap!();
            found = true;
            return;
          }
        }

        // Check for FloatingActionButton with implicit semantics
        if (widget is FloatingActionButton) {
          // FloatingActionButton typically has "Increment" as default semantic label
          final renderObject = element.renderObject;
          if (renderObject is RenderObject) {
            final semantics = renderObject.debugSemantics;
            if (semantics?.label.toLowerCase() == searchLabel ||
                (searchLabel == 'increment' && widget.tooltip == null)) {
              if (widget.onPressed != null) {
                widget.onPressed!();
                found = true;
                return;
              }
            }
          }
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
    final entry = MCPCallEntry(const MCPMethodName('tap_by_coordinate'), (
      final parameters,
    ) async {
      final dx = double.tryParse(parameters['x']?.toString() ?? '');
      final dy = double.tryParse(parameters['y']?.toString() ?? '');

      if (dx == null || dy == null) {
        return MCPCallResult(
          message: 'Invalid coordinates.',
          parameters: {'success': false},
        );
      }

      final position = Offset(dx, dy);
      bool tapped = false;

      final rootContext = WidgetsBinding.instance.rootElement;

      void visitor(final Element element) {
        if (tapped) return;

        final widget = element.widget;
        final renderObject = element.renderObject;

        if (renderObject != null && renderObject.attached) {
          try {
            final bounds = renderObject.paintBounds;
            final transform = renderObject.getTransformTo(null);
            final globalBounds = MatrixUtils.transformRect(transform, bounds);

            // Enlarge the area for easy clicking
            final expandedBounds = globalBounds.inflate(10);

            if (expandedBounds.contains(position)) {
              // Checking onTap/onPressed support
              final onTap = () {
                if (widget is GestureDetector && widget.onTap != null) {
                  widget.onTap!();
                  return true;
                }
                if (widget is InkWell && widget.onTap != null) {
                  widget.onTap!();
                  return true;
                }
                if (widget is ElevatedButton && widget.onPressed != null) {
                  widget.onPressed!();
                  return true;
                }
                if (widget is TextButton && widget.onPressed != null) {
                  widget.onPressed!();
                  return true;
                }
                if (widget is IconButton && widget.onPressed != null) {
                  widget.onPressed!();
                  return true;
                }
                return false;
              }();

              if (onTap) {
                tapped = true;
                return;
              }
            }
          } catch (_) {}
        }

        element.visitChildren(visitor);
      }

      if (rootContext != null) {
        rootContext.visitChildren(visitor);
      }

      // If none of the onTap/onPressed triggered, we simulate a touch
      if (!tapped) {
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
          await Future.delayed(const Duration(milliseconds: 10));
          gestureBinding.handlePointerEvent(up);
          await Future.delayed(const Duration(milliseconds: 100));

          tapped = true;
        } catch (_) {}
      }

      return MCPCallResult(
        message:
            tapped
                ? 'Tapped widget at coordinate: ($dx, $dy)'
                : 'No tappable widget found at: ($dx, $dy)',
        parameters: {'success': tapped},
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
    final entry = MCPCallEntry(const MCPMethodName('view_widget_tree'), (
      final parameters,
    ) {
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

        if (renderObject != null && renderObject.attached) {
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
/// MCPCallEntry for scrolling a scrollable widget by an offset.
/// {@endtemplate}
extension type ScrollByOffsetEntry._(MCPCallEntry entry)
    implements MCPCallEntry {
  /// {@macro scroll_by_offset_entry}
  factory ScrollByOffsetEntry() {
    final entry = MCPCallEntry(const MCPMethodName('scroll_by_offset'), (
      final parameters,
    ) async {
      final dx = double.tryParse(parameters['dx']?.toString() ?? '') ?? 0.0;
      final dy = double.tryParse(parameters['dy']?.toString() ?? '') ?? 0.0;
      final keyFilter = parameters['key']?.toString();
      final semanticLabelFilter = parameters['semanticLabel']?.toString();
      final textFilter = parameters['text']?.toString();

      bool hasMatchingDescendant(
        final Element element,
        final String textToFind,
      ) {
        bool found = false;

        void searchForText(final Element e) {
          if (found) return;

          final widget = e.widget;
          if (widget is Text && widget.data?.contains(textToFind) == true) {
            found = true;
            return;
          }

          e.visitChildren(searchForText);
        }

        searchForText(element);
        return found;
      }

      bool matchesFilters(final Element element) {
        final widget = element.widget;

        // If no filters are specified, match all scrollable widgets
        if (keyFilter == null &&
            semanticLabelFilter == null &&
            textFilter == null) {
          return true;
        }

        // Filter by key
        if (keyFilter != null && widget.key is ValueKey) {
          if ((widget.key! as ValueKey).value != keyFilter) return false;
        }

        // Filter by semantic label
        if (semanticLabelFilter != null &&
            widget is Semantics &&
            widget.properties.label != semanticLabelFilter) {
          return false;
        }

        // Filter by text - check if this scrollable widget contains the text
        if (textFilter != null) {
          if (!hasMatchingDescendant(element, textFilter)) {
            return false;
          }
        }

        return true;
      }

      bool scrolled = false;
      final rootContext = WidgetsBinding.instance.rootElement;
      final List<String> debugInfo = [];

      Future<void> visitor(final Element element) async {
        if (scrolled) return;

        final widget = element.widget;

        // Check if this element is a scrollable widget
        final bool isScrollable =
            widget is SingleChildScrollView ||
            widget is ListView ||
            widget is GridView ||
            widget is CustomScrollView ||
            widget is Scrollbar;

        if (isScrollable) {
          debugInfo.add('Found scrollable widget: ${widget.runtimeType}');

          if (matchesFilters(element)) {
            debugInfo.add('Widget matches filters');

            // Found a matching scrollable widget, try to scroll it
            ScrollController? controller;

            // Get the appropriate controller based on widget type
            if (widget is SingleChildScrollView) {
              controller = widget.controller;
              debugInfo.add(
                'SingleChildScrollView - controller: ${controller != null ? "present" : "null"}',
              );
            } else if (widget is ListView) {
              controller = widget.controller;
              debugInfo.add(
                'ListView - controller: ${controller != null ? "present" : "null"}',
              );
            } else if (widget is GridView) {
              controller = widget.controller;
              debugInfo.add(
                'GridView - controller: ${controller != null ? "present" : "null"}',
              );
            } else if (widget is CustomScrollView) {
              controller = widget.controller;
              debugInfo.add(
                'CustomScrollView - controller: ${controller != null ? "present" : "null"}',
              );
            } else if (widget is Scrollbar) {
              controller = widget.controller;
              debugInfo.add(
                'Scrollbar - controller: ${controller != null ? "present" : "null"}',
              );
            }

            // If no explicit controller, try to get the primary scroll controller
            if (controller == null) {
              try {
                controller = PrimaryScrollController.of(element);
                debugInfo.add('Using PrimaryScrollController');
              } catch (e) {
                debugInfo.add('PrimaryScrollController failed: $e');
              }
            }

            if (controller != null) {
              debugInfo.add('Controller hasClients: ${controller.hasClients}');

              if (controller.hasClients) {
                try {
                  final currentOffset = controller.offset;
                  debugInfo.add('Current offset: $currentOffset');

                  // Determine which direction to scroll based on widget type and parameters
                  double newOffset = currentOffset;

                  if (widget is SingleChildScrollView) {
                    debugInfo.add('ScrollDirection: ${widget.scrollDirection}');
                    if (widget.scrollDirection == Axis.horizontal && dx != 0) {
                      newOffset = currentOffset + dx;
                      debugInfo.add('Scrolling horizontally to: $newOffset');
                    } else if (widget.scrollDirection == Axis.vertical &&
                        dy != 0) {
                      newOffset = currentOffset + dy;
                      debugInfo.add('Scrolling vertically to: $newOffset');
                    } else if (dy != 0) {
                      // Default to vertical if no specific direction and dy is provided
                      newOffset = currentOffset + dy;
                      debugInfo.add('Default vertical scroll to: $newOffset');
                    }
                  } else {
                    // For ListView, GridView, etc., default to vertical scrolling
                    if (dy != 0) {
                      newOffset = currentOffset + dy;
                      debugInfo.add('List/Grid vertical scroll to: $newOffset');
                    } else if (dx != 0) {
                      newOffset = currentOffset + dx;
                      debugInfo.add(
                        'List/Grid horizontal scroll to: $newOffset',
                      );
                    }
                  }

                  // Ensure we don't scroll beyond bounds
                  final maxScrollExtent = controller.position.maxScrollExtent;
                  final minScrollExtent = controller.position.minScrollExtent;
                  debugInfo.add(
                    'Scroll bounds: min=$minScrollExtent, max=$maxScrollExtent',
                  );
                  newOffset = newOffset.clamp(minScrollExtent, maxScrollExtent);
                  debugInfo.add('Clamped offset: $newOffset');

                  if (newOffset != currentOffset) {
                    debugInfo.add(
                      'Attempting to scroll from $currentOffset to $newOffset',
                    );

                    // Try jumpTo first as it's more reliable
                    try {
                      controller.jumpTo(newOffset);
                      scrolled = true;
                      debugInfo.add(
                        'Successfully jumped to new offset: $newOffset',
                      );
                      return;
                    } catch (jumpError) {
                      debugInfo.add('JumpTo failed: $jumpError');

                      // Fallback to animateTo
                      try {
                        debugInfo.add('Trying animateTo as fallback');
                        await controller.animateTo(
                          newOffset,
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.easeOut,
                        );
                        scrolled = true;
                        debugInfo.add(
                          'Successfully animated to new offset: $newOffset',
                        );
                        return;
                      } catch (animateError) {
                        debugInfo.add('AnimateTo also failed: $animateError');
                      }
                    }
                  } else {
                    debugInfo.add(
                      'New offset same as current, no scroll needed',
                    );
                  }
                } catch (e) {
                  debugInfo.add('Animation failed: $e');
                  // If animation fails, try jumpTo
                  try {
                    final currentOffset = controller.offset;
                    double newOffset = currentOffset;

                    if (widget is SingleChildScrollView) {
                      if (widget.scrollDirection == Axis.horizontal &&
                          dx != 0) {
                        newOffset = currentOffset + dx;
                      } else if (dy != 0) {
                        newOffset = currentOffset + dy;
                      }
                    } else {
                      newOffset = currentOffset + (dy != 0 ? dy : dx);
                    }

                    final maxScrollExtent = controller.position.maxScrollExtent;
                    final minScrollExtent = controller.position.minScrollExtent;
                    newOffset = newOffset.clamp(
                      minScrollExtent,
                      maxScrollExtent,
                    );

                    if (newOffset != currentOffset) {
                      controller.jumpTo(newOffset);
                      scrolled = true;
                      debugInfo.add('Successfully jumped to new offset');
                      return;
                    }
                  } catch (e2) {
                    debugInfo.add('JumpTo also failed: $e2');
                  }
                }
              }
            }
          } else {
            debugInfo.add('Widget does not match filters');
          }
        }

        // Continue searching in children
        element.visitChildren(visitor);
      }

      if (rootContext != null) {
        await visitor(rootContext);
      }

      final debugMessage =
          debugInfo.isNotEmpty ? '\nDebug info:\n${debugInfo.join('\n')}' : '';

      return MCPCallResult(
        message:
            scrolled
                ? 'Successfully scrolled scrollable widget by offset dx=$dx, dy=$dy.$debugMessage'
                : 'No matching scrollable widget found or could not scroll. Make sure the widget has a ScrollController and scrollable content.$debugMessage',
        parameters: {'success': scrolled, 'debug': debugInfo},
      );
    });

    return ScrollByOffsetEntry._(entry);
  }
}
