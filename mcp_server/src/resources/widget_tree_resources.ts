import { ResourceTemplate } from "@modelcontextprotocol/sdk/types.js";
// TODO: maybe convert to yaml file, if it will grow
export const TREE_RESOURCES: ResourceTemplate[] = [
  {
    uriTemplate: "visual://tree/root",
    name: "Widget Tree Root",
    description: "Get the root widget of the Flutter application",
    mimeType: "application/json",
  },
  {
    uriTemplate: "visual://tree/node/{node_id}",
    name: "Widget Node",
    description: "Get details of a specific widget node",
    mimeType: "application/json",
  },
  {
    uriTemplate: "visual://tree/children/{node_id}",
    name: "Widget Node Children",
    description: "Get children of a specific widget node",
    mimeType: "application/json",
  },
  {
    uriTemplate: "visual://visual/errors",
    name: "Visual Errors",
    description: "Get current visual errors in the widget tree",
    mimeType: "application/json",
  },
  {
    uriTemplate: "visual://visual/viewport",
    name: "Viewport Info",
    description: "Get current viewport information",
    mimeType: "application/json",
  },
];
