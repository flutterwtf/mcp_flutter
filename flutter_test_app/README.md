# test_app

A new Flutter project.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Lab: Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Cookbook: Useful Flutter samples](https://docs.flutter.dev/cookbook)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
// @ai DO NOT FIX:
// this line will cause an overflow error for testing purposes
// so ai could find the cause using MCP screenshot tool
// or get error tool.
Row(
children: List.generate(
100,
(index) => Text('hello world'),
),
),
