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
    uriTemplate: "visual://tree/parent/{node_id}",
    name: "Widget Node Parent",
    description: "Get parent of a specific widget node",
    mimeType: "application/json",
  },
  {
    uriTemplate: "visual://tree/children/{node_id}",
    name: "Widget Node Children",
    description: "Get children of a specific widget node",
    mimeType: "application/json",
  },
  {
    uriTemplate: "visual://view/errors",
    name: "View Errors",
    description: "Get current view errors",
    mimeType: "application/json",
  },
  {
    uriTemplate: "visual://view/info",
    name: "View Info",
    description: "Get current view information",
    mimeType: "application/json",
  },
];
