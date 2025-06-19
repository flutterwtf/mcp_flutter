import 'package:flutter/material.dart';

/// {@template text_painter_widget}
/// A widget that paints a text using a custom painter.
/// {@endtemplate}
class TextPainterWidget extends StatelessWidget {
  /// {@macro text_painter_widget}
  const TextPainterWidget({
    required this.text,
    required this.painter,
    super.key,
  });

  /// The text to paint.
  final String text;

  /// The painter to use.
  final CustomPainter painter;

  @override
  Widget build(final BuildContext context) => CustomPaint(painter: painter);
}
