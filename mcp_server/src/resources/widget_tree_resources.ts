import { Resource, ResourceTemplate } from "@modelcontextprotocol/sdk/types.js";
// TODO: maybe convert to yaml file, if it will grow
export const TREE_RESOURCES: Resource[] = [
  {
    uri: "visual://localhost/tree/root",
    name: "Widget Tree Root",
    description: "Get the root widget of the Flutter application",
  },
  {
    uri: "visual://localhost/view/errors",
    name: "View Errors",
    description: "Get current view errors",
  },
  {
    uri: "visual://localhost/view/info",
    name: "View Info",
    description: "Get current view information",
  },
];

export const TREE_RESOURCES_TEMPLATES: ResourceTemplate[] = [
  {
    uriTemplate: "visual://localhost/tree/node/{node_id}",
    name: "Widget Node",
    description: "Get details of a specific widget node",
    mimeType: "application/json",
  },
  {
    uriTemplate: "visual://localhost/tree/parent/{node_id}",
    name: "Widget Node Parent",
    description: "Get parent of a specific widget node",
    mimeType: "application/json",
  },
  {
    uriTemplate: "visual://localhost/tree/children/{node_id}",
    name: "Widget Node Children",
    description: "Get children of a specific widget node",
    mimeType: "application/json",
  },
];
