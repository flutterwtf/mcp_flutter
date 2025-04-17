# Flutter Inspector MCP Server for AI-Powered Development

[GitHub Repository](https://github.com/Arenukvern/mcp_flutter)
[![smithery badge](https://smithery.ai/badge/@Arenukvern/mcp_flutter)](https://smithery.ai/server/@Arenukvern/mcp_flutter)

🔍 A powerful Model Context Protocol (MCP) server that connects your Flutter apps with AI coding assistants like Cursor, Claude, and Cline.

<a href="https://glama.ai/mcp/servers/qnu3f0fa20">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/qnu3f0fa20/badge" alt="Flutter Inspector Server MCP server" />
</a>

⚠️ This project is a work in progress and not all methods (mostly Flutter Inspector related) are implemented yet.

Currently Flutter works with MCP server via forwarding server. Please see [Architecture](https://github.com/Arenukvern/mcp_flutter/blob/main/ARCHITECTURE.md) for more details.

Some of other methods are not tested - they may work or not. Please use with caution. It is possible that the most methods will be removed from the MCP server later to focus solely on Flutter applications and maybe Jaspr.

## ⚠️ WARNING ⚠️

Dump RPC methods (like `dump_render_tree`), may cause huge amount of tokens usage or overload context. Therefore now they are disabled by default, but can be enabled via environment variable `DUMPS_SUPPORTED=true`.

See more details about environment variables in [.env.example](mcp_server/.env.example).

## OS testing statuses:

- Open issue: https://github.com/Arenukvern/mcp_flutter/issues/23

What works:
✅ macOS, ✅ iOS (getting errors works, screenshots doesn't)

Should work, in testing:
🚧 Android (some methods works, some not, investigating)

Should work, not tested yet, don't have access to OS: 🤔 Windows 🤔 Linux

❌ Web - doesn't work currently, not sure why.

## 🚀 Getting Started

- Quick Start is available in [QUICK_START.md](QUICK_START.md)
- Configuration options are available in [CONFIGURATION.md](CONFIGURATION.md)

## 🎯 What Agent can call:

- [Resource|Tool] **Analyse errors**: get precise and condensed errors of your app.
  Why it is better then console message: it contains precisely only what Agent need, not the whole list of traced widgets and duplicate information. This works best to give Agent understanding of the error.
- [Resource|Tool] **Screenshot**: get screenshot of the app. Works only with Claude (untested). Cursor and Cline doesn't support image type in the response.
- [Tool] **Hot reload**: hot reload app.

### Will be implemented:

- [Resource|Tool] **App info**: size of screen, pixel ratio. Unlocks ability for an Agent to use widget selection.
- **Hot reload & Hot restart**
- [Resource|Tool] **Selection tool**:
  Current idea:

  1. Enable widget selection in Flutter Inspector.
  2. Select widget by logical pixel position.
  3. Get detailed information about your Flutter app's structure based on logical pixel position.

### In research:

- **Inspect Current Route**: See current navigation state
- **Extensions: Flutter Provider/Riverpod states**: Get state of Provider/Riverpod instances.
- **Extensions: Jaspr**: ?
- **Extensions: Jaspr Provider**: ?
- **Extensions: Flame**: ?

## 📚 Available Tools

All tools default to using port 8181 if no port is specified. You can override this by providing a specific port number.

Most tools described in [MCP_RPC_DESCRIPTION](MCP_RPC_DESCRIPTION.md)

todo: add more details about useful methods

## 🔧 Troubleshooting

Make sure you:

1. Verify that forwarding server is running.
2. Opened Devtools in Browser.
3. Have added MCP extension to your Flutter app dev dependencies and enabled it in Devtools.

4. **Connection Issues**

   - Ensure your Flutter app is running in debug mode
   - Verify the port matches in both Flutter app and inspector
   - Check if the port is not being used by another process

5. **AI Tool Not Detecting Inspector**
   - Restart the AI tool after configuration changes
   - Verify the configuration JSON syntax
   - Check the tool's logs for connection errors

## 🚧 Smithery Integration 🚧 (work in progress)

The Flutter Inspector is registered with Smithery's registry, making it discoverable and usable by other AI tools through a standardized interface.

### Integration Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌─────────────┐
│                 │     │              │     │              │     │                 │     │             │
│  Flutter App    │<--->│  DevTools    │<--->│  Forwarding  │<--->│   MCP Server   │<--->│  Smithery   │
│  (Debug Mode)   │     │  Extension   │     │  Server      │     │   (Registered) │     │  Registry   │
│                 │     │              │     │              │     │                 │     │             │
└─────────────────┘     └──────────────┘     └──────────────┘     └─────────────────┘     └─────────────┘
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or report issues on the [GitHub repository](https://github.com/Arenukvern/mcp_flutter).

## 📖 Learn More

- [Flutter DevTools Documentation](https://docs.flutter.dev/development/tools/devtools/overview)
- [Dart VM Service Protocol](https://github.com/dart-lang/sdk/blob/main/runtime/vm/service/service.md)
- [Flutter DevTools RPC Constants (I guess and hope they are correct:))](https://github.com/flutter/devtools/tree/87f8016e2610c98c3e2eae8b1c823de068701dfd/packages/devtools_app/lib/src/shared/analytics/constants)

## 📄 License

MIT - Feel free to use in your projects!

---

_Flutter and Dart are trademarks of Google LLC._
