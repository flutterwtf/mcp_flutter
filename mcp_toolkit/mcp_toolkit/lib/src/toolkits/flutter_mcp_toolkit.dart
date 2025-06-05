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
    ) async {
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
    ) async {
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
