import { Resource, ResourceTemplate } from "@modelcontextprotocol/sdk/types.js";
// TODO: maybe convert to yaml file, if it will grow
export const TREE_RESOURCES: Resource[] = [
  {
    uri: "visual://localhost/tree/root",
    name: "Widget Tree Root",
    description: "Get the root widget of the Flutter application",
    mimeType: "application/json",
  },
  {
    uri: "visual://localhost/view/info",
    name: "View Info",
    description: "Get current view information",
    mimeType: "application/json",
  },
  {
    uri: "visual://localhost/app/errors/latest",
    name: "Latest Application Error",
    description: "Get 1 latest application error",
    mimeType: "application/json",
  },
  {
    uri: "visual://localhost/app/errors/ten",
    name: "10 Latest Application Errors",
    description: "Get 10 latest application errors",
    mimeType: "application/json",
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
