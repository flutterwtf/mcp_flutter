<div align="center">

# MCP Server + Flutter MCP Toolkit

_For AI-Powered Development_

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Flutter](https://img.shields.io/badge/Flutter-3.x-blue.svg)](https://flutter.dev)
[![smithery badge](https://smithery.ai/badge/@Arenukvern/mcp_flutter)](https://smithery.ai/server/@Arenukvern/mcp_flutter)
[![Verified on MseeP](https://mseep.ai/badge.svg)](https://mseep.ai/app/03aa0f2d-4ef7-40ae-93de-c7b87e0ac32d)
[![All Contributors](https://img.shields.io/github/all-contributors/Arenukvern/mcp_flutter?color=ee8449&style=flat-square)](https://github.com/Arenukvern/mcp_flutter#contributors-)

</div>

<a href="https://glama.ai/mcp/servers/qnu3f0fa20">
<img width="380" height="200" src="https://glama.ai/mcp/servers/qnu3f0fa20/badge" alt="Flutter Inspector Server MCP server" />
</a>

🔍 Model Context Protocol (MCP) server that connects your Flutter apps with AI coding assistants like Cursor, Claude, Cline, Windsurf, RooCode or any other AI assistant that supports MCP server

<!-- Media -->

![View Screenshots](docs/view_screenshots.gif)

<!-- End of Media -->

## 📖 Documentation

- [Quick Start](QUICK_START.md)
- [Configuration](CONFIGURATION.md)

> [!NOTE]
> There is a new [experimental package in development from Flutter team](https://github.com/dart-lang/ai/tree/main/pkgs/dart_tooling_mcp_server) which exposes Dart tooling development.
>
> Therefore my current focus is
>
> 1. to stabilize and polish tools which are useful in development (so it would be more plug & play, for example: it will return not only the errors, but prompt for AI how to work with that error) [see more in MCP_RPC_DESCRIPTION.md](MCP_RPC_DESCRIPTION.md)
> 2. fine-tune process of MCP server tools creation by making it customizable.
>
> Hope it will be useful for you,
>
> Have a nice day!

## 🎉 v2.1.0 released! 🎉

Added Dart MCP Server to replace in future Typescript one. Already working, will migrate to it in the future. See more about it in [CHANGELOG.md](CHANGELOG.md).

## ⚠️ WARNING

Dump RPC methods (like `dump_render_tree`), may cause huge amount of tokens usage or overload context. Therefore now they are disabled by default, but can be enabled via environment variable `DUMPS_SUPPORTED=true`.

See more details about environment variables in [.env.example](mcp_server/.env.example).

## 🚀 Getting Started

- (Experimental) You can try to install MCP server and configure it using your AI Agent. Use the following prompt: `Please install MCP server using this link: https://github.com/Arenukvern/mcp_flutter/blob/main/llm_install.md`

- with Cursor: https://www.youtube.com/watch?v=pyDHaI81uts
- with VSCode + Cline: use prompt `Please install MCP server using this link: https://github.com/Arenukvern/mcp_flutter/blob/main/llm_install.md`

- Quick Start is available in [QUICK_START.md](QUICK_START.md)
- Configuration options are available in [CONFIGURATION.md](CONFIGURATION.md)

## 🎯 AI Agent Tools

### Error Analysis

- `get_app_errors` [Resource|Tool] - Retrieves precise and condensed error information from your Flutter app
  **Usage**:

  - Uses only short description of the error. Should filter duplicate errors, to avoid flooding Agent context window with the same errors.
  - Uses Error Monitor to capture Dart VM errors. All errors captured in Flutter app, and then available by request from MCP server.

  **Tested on**:
  ✅ macOS, ✅ iOS
  **Not tested on**:
  🚧 Android, 🤔 Windows, 🤔 Linux, ❌ Web
  [See issue](https://github.com/Arenukvern/mcp_flutter/issues/23)

### Development Tools

- `view_screenshot` [Resource|Tool] - Captures a screenshots of the running application.
  **Configuration**:

  - Enable with `--images` flag or `IMAGES_SUPPORTED=true` environment variable
  - Will use PNG compression to optimize image size.


- `get_view_details` [Resource|Tool] - size of screen, pixel ratio. May unlock ability for an Agent to use widget selection.


- `view_widget_tree` [Tool] - json tree of widgets with small information about them. May unlock ability for an Agent to use widget selection.

- `get_widget_properties` [Tool] - Returns detailed properties of a widget identified by its key.


<!-- - `hot_reload` [Tool] - Performs hot reload of the Flutter application
  **Tested on**:
  ✅ macOS, ✅ iOS, ✅ Android
  **Not tested on**:
  🤔 Windows, 🤔 Linux, ❌ Web
  [See issue](https://github.com/Arenukvern/mcp_flutter/issues/23)

  **Tested on**:
  ✅ macOS, ✅ iOS
  **Not tested on**:
  🚧 Android, 🤔 Windows, 🤔 Linux, ❌ Web
  [See issue](https://github.com/Arenukvern/mcp_flutter/issues/23) -->

### Testing Tools

- `tap_by_text` [Tool] - Find TextButton, ElevatedButton or GestureDetector with child widget Text with the passed string 
  **Usage**:

    - Write the AI agent the text that is on the button and wait.
    - Write action instructions to the AI agent, telling it to call `view_screenshots` after each action so that it continues to follow the script itself by clicking buttons.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOs 🤔 Windows, 🤔 Linux, ❌ Web


- `enter_text_by_hint` [Tool] - Looks for a TextField that has `hintText` equal to the `hint` parameter. If found and if TextField has controller, sets `text` to controller. If there is no controller but element is a StatefulElement, tries to reach EditableTextState and manually update TextEditingValue. If onChanged is set, manually calls it.
  **Usage**:

    - Write the AI agent the hint text of TextField and text that you want to write in it and wait.
    - Write input data as well as action instructions to the AI agent, instructing it to call 'view_screenshots' after each action so that it continues to follow the script and determine its next step.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOs 🤔 Windows, 🤔 Linux, ❌ Web


- `tap_by_semantic_label` [Tool] - Looks for a Semantics that has label equal to the `text` parameter. Tap on ancestor widget that has tappable methods
  **Usage**:

  - Write the AI agent the semantic label of widget.
  - Write action instructions to the AI agent, telling it to call view_screenshots after each action so that it continues to follow the script itself by clicking buttons.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOs 🤔 Windows, 🤔 Linux, ❌ Web


- `tap_by_coordinate` [Tool] - Looks for a tappable widget on `dx` and `dy`. Tap on it if it has tappable methods
  **Usage**:

  - Write the AI agent the coordinates of widget.
  - Write action instructions to the AI agent, telling it to call view_screenshots after each action so that it continues to follow the script itself by clicking on coordinates.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOs 🤔 Windows, 🤔 Linux, ❌ Web


- `scroll_by_offset` [Tool] - Scrolls a scrollable widget (like ListView, GridView, etc.) by a specified horizontal (`dx`) or vertical (`dy`) offset. You can optionally filter the target scrollable by its key, semantic label, or by searching for a child widget containing specific text.
  **Usage**:
  - Provide `dx` and/or `dy` to specify the scroll amount. The scroll will be applied along the widget's scroll direction (vertical or horizontal).
  - Optionally, provide a `key`, `semanticLabel`, or `text` to target a specific scrollable widget.
  - If no filter is provided, the first scrollable found will be scrolled.
  - Useful for programmatically scrolling lists, grids, or other scrollable areas in your app.
  - After scrolling, you can call `view_screenshots` to verify the new UI state.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOs 🤔 Windows, 🤔 Linux, ❌ Web

- `long_press` [Tool] - Performs a long press on a widget identified by text, key, or semantic label.
  **Usage**:
  - Provide the `query` parameter to match the widget (by text, key, semantic label, hint, or tooltip).
  - Optionally, provide `duration` (in milliseconds) to control the long press duration (default: 500ms).
  - Useful for testing context menus, drag-and-drop, or any UI that responds to long press gestures.
  - Returns success status, matched widget type, and matching criteria.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOs 🤔 Windows, 🤔 Linux, ❌ Web

### Navigation Tools

- `get_navigation_tree` [Tool] - Returns a tree structure representing the current navigation hierarchy of your app. Supports GoRouter, AutoRoute, or falls back to Navigator. Useful for understanding the full navigation structure and available routes.
  **Usage**:

  - Call this tool to get a JSON tree of all navigation routes and their relationships.
  - Helps AI agents reason about possible navigation paths and available screens.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOs 🤔 Windows, 🤔 Linux, ❌ Web


- `get_navigation_stack` [Tool] - Returns the current navigation stack, showing the active pages/screens in the app. Supports both Navigator 2.0 and basic Navigator 1.0.
  **Usage**:

  - Call this tool to get a list of the current stack of pages/screens.
  - Useful for understanding the current navigation state and back stack.

  **Tested on**:
  ✅ Android
  **Not tested on**:
  🤔 iOS, 🤔 macOs 🤔 Windows, 🤔 Linux, ❌ Web

All tools default to using port 8181 if no port is specified. You can override this by providing a specific port number.

📚 Please see more in [MCP_RPC_DESCRIPTION](MCP_RPC_DESCRIPTION.md)

## 🔒 Security

Generally, since you use MCP server to connect to Flutter app in Debug Mode, it should be safe to use. However, I still recommend to review how it works in [ARCHITECTURE.md](ARCHITECTURE.md), how it can be modified to improve security if needed.

This MCP server is verified by [MseeP.ai](https://mseep.ai).

[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/arenukvern-mcp-flutter-badge.png)](https://mseep.ai/app/arenukvern-mcp-flutter)

## 🔧 Troubleshooting

1. **Connection Issues**

   - Ensure your Flutter app is running in debug mode
   - Verify the port matches in both Flutter app and MCP server
   - Check if the port is not being used by another process

2. **AI Tool Not Detecting Inspector**
   - Restart the AI tool after configuration changes
   - Verify the configuration JSON syntax
   - Check the tool's logs for connection errors

The Flutter MCP Server is registered with Smithery's registry, making it discoverable and usable by other AI tools through a standardized interface.

### Integration Architecture

```
┌─────────────────┐     ┌───────────────────────┐     ┌─────────────────┐
│                 │     │  Flutter App with     │     │                 │
│  Flutter App    │<--->│  mcp_toolkit (VM Svc.  │<--->│   MCP Server   │
│  (Debug Mode)   │     │  Extensions)          │     │                 │
│                 │     │                       │     │                 │
└─────────────────┘     └───────────────────────┘     └─────────────────┘
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or report issues on the [GitHub repository](https://github.com/Arenukvern/mcp_flutter).

## ✨ Contributors

Huge thanks to all contributors for making this project better!

<!-- https://allcontributors.org/docs/en/bot/usage -->

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://calclavia.com"><img src="https://avatars.githubusercontent.com/u/1828968?v=4?s=100" width="100px;" alt="Henry Mao"/><br /><sub><b>Henry Mao</b></sub></a><br /><a href="#infra-calclavia" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/marwenbk"><img src="https://avatars.githubusercontent.com/u/18284646?v=4?s=100" width="100px;" alt="Marwen"/><br /><sub><b>Marwen</b></sub></a><br /><a href="#doc-marwenbk" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://eastagile.com"><img src="https://avatars.githubusercontent.com/u/2829939?v=4?s=100" width="100px;" alt="Lawrence Sinclair"/><br /><sub><b>Lawrence Sinclair</b></sub></a><br /><a href="#doc-lwsinclair" title="Documentation">📖</a> <a href="#security-lwsinclair" title="Security">🛡️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://glama.ai"><img src="https://avatars.githubusercontent.com/u/108313943?v=4?s=100" width="100px;" alt="Frank Fiegel"/><br /><sub><b>Frank Fiegel</b></sub></a><br /><a href="#infra-punkpeye" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Harishwarrior"><img src="https://avatars.githubusercontent.com/u/38380040?v=4?s=100" width="100px;" alt="Harish Anbalagan"/><br /><sub><b>Harish Anbalagan</b></sub></a><br /><a href="#userTesting-Harishwarrior" title="User Testing">📓</a> <a href="#bug-Harishwarrior" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/torbenkeller"><img src="https://avatars.githubusercontent.com/u/33001558?v=4?s=100" width="100px;" alt="Torben Keller"/><br /><sub><b>Torben Keller</b></sub></a><br /><a href="#userTesting-torbenkeller" title="User Testing">📓</a> <a href="#bug-torbenkeller" title="Bug reports">🐛</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

## 📖 Learn More

- [Flutter DevTools Documentation](https://docs.flutter.dev/development/tools/devtools/overview)
- [Dart VM Service Protocol](https://github.com/dart-lang/sdk/blob/main/runtime/vm/service/service.md)
- [Flutter DevTools RPC Constants (I guess and hope they are correct:))](https://github.com/flutter/devtools/tree/87f8016e2610c98c3e2eae8b1c823de068701dfd/packages/devtools_app/lib/src/shared/analytics/constants)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Arenukvern/mcp_flutter&type=Date)](https://www.star-history.com/#Arenukvern/mcp_flutter&Date)

## 📄 License

[MIT](LICENSE) - Feel free to use in your projects!

---

_Flutter and Dart are trademarks of Google LLC._
